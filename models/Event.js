const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  currentCount: {
    type: Number,
    default: 0
  },
  checkedInAttendees: [{
    ticketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ticket'
    },
    status: {
      type: String,
      enum: ['checked-in', 'checked-out'],
      default: 'checked-in'
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    scannedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organizer'
    }
  }],
  history: [{
    action: {
      type: String,
      enum: ['check-in', 'check-out']
    },
    ticketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ticket'
    },
    timestamp: Date,
    scannedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organizer'
    }
  }]
});

const eventSchema = new mongoose.Schema({
  // Basic Info
  title: {
    type: String,
    required: [true, 'Event title is required'],
    trim: true,
    minlength: [3, 'Title must be at least 3 characters long'],
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Event description is required'],
    minlength: [10, 'Description must be at least 10 characters long'],
    maxlength: [5000, 'Description cannot exceed 5000 characters']
  },
  category: {
    type: String,
    required: [true, 'Event category is required'],
    enum: {
      values: ['Conference', 'Workshop', 'Webinar', 'Meetup', 'Training', 'Other'],
      message: '{VALUE} is not a supported category'
    }
  },
  type: {
    type: String,
    required: [true, 'Event type is required'],
    enum: {
      values: ['physical', 'virtual', 'hybrid'],
      message: '{VALUE} is not a supported event type'
    }
  },

  // Date & Time
  startDate: {
    type: Date,
    required: [true, 'Start date is required'],
    // validate: {
    //   validator: function(value) {
    //     return value > new Date();
    //   },
    //   message: 'Start date must be in the future'
    // }
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required'],
    // validate: {
    //   validator: function(value) {
    //     return value >= this.startDate;
    //   },
    //   message: 'End date must be after or equal to start date'
    // }
  },

  // Location
  location: {
    type: String,
    required: [
      function() { return this.type !== 'virtual' },
      'Physical location is required for non-virtual events'
    ]
  },
  virtualLink: {
    type: String,
    required: [
      function() { 
        return this.type === 'virtual' || this.type === 'hybrid';
      },
      'Virtual link is required for virtual and hybrid events'
    ],
    trim: true,
    validate: {
      validator: function(value) {
        // Only validate if the field is required
        if (this.type === 'virtual' || this.type === 'hybrid') {
          return /^https?:\/\/.+/.test(value);
        }
        return true; // Skip validation for physical events
      },
      message: 'Virtual link must be a valid URL'
    }
  },

  // Pricing
  isFree: {
    type: Boolean,
    default: false
  },
  price: {
    type: Number,
    required: [
      function() { return !this.isFree; },
      'Price is required for paid events'
    ],
    min: [0, 'Price cannot be negative'],
    default: 0
  },

  // Media
  bannerImage: {
    type: String,
    required: [true, 'Banner image is required']
  },
  coverImage: {
    type: String,
    required: [true, 'Cover image is required']
  },

  // Additional Info
  tags: [{
    type: String,
    trim: true,
    lowercase: true,  
  }],

  // Active Status
  status: {
    type: String,
    enum: {
      values: ['upcoming', 'ongoing', 'past', 'postponed', 'cancelled'],
      message: '{VALUE} is not a supported event status'
    },
    default: 'upcoming'
  },

  // Analytics Data
  checkIns: {
    type: Number,
    default: 0
  },
  totalRevenue: {
    type: Number,
    default: 0
  },

  // Organizer Info
  organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organizer',
    required: [true, 'Organizer is required']
  },

  // Attendance
  attendance: {
    default: null,
    required: false,
    type: attendanceSchema,
    default: () => ({
      currentCount: 0,
      checkedInAttendees: [],
      history: []
    })
  },

  // Add fields for postponed/cancelled events
  statusUpdateDate: {
    type: Date
  },
  statusReason: {
    type: String,
    maxlength: [500, 'Status reason cannot exceed 500 characters'],
    required: [
      function() { 
        return this.status === 'cancelled' || this.status === 'postponed';
      },
      'Reason is required when cancelling or postponing an event'
    ]
  },

  // Add to the schema
  manualStatusControl: {
    type: Boolean,
    default: false,
    description: 'When enabled, event status will not update automatically'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
eventSchema.index({ title: 'text', description: 'text' });
eventSchema.index({ startDate: 1, endDate: 1 });
eventSchema.index({ status: 1 });
eventSchema.index({ organizer: 1 });
eventSchema.index({ category: 1 });
eventSchema.index({ isFree: 1 });
eventSchema.index({ price: 1 });

// Virtual for checking if event is past
eventSchema.virtual('isPast').get(function() {
  return this.endDate < new Date();
});

// Pre-save middleware for additional validations
eventSchema.pre('save', function(next) {
  // Convert tags to lowercase and remove duplicates
  if (this.tags) {
    this.tags = [...new Set(this.tags.map(tag => tag.toLowerCase()))];
  }

  // Ensure price is 0 for free events
  if (this.isFree) {
    this.price = 0;
  }

  next();
});

// Method to increment check-in count
eventSchema.methods.incrementCheckIns = async function() {
  this.checkIns += 1;
  return this.save();
};

// Method to update total revenue
eventSchema.methods.updateTotalRevenue = async function(amount) {
  this.totalRevenue += amount;
  return this.save();
};

// Add method to update event status
eventSchema.methods.updateEventStatus = async function() {
  // If manual control is enabled, don't auto-update status
  if (this.manualStatusControl) {
    return;
  }

  const now = new Date();
  const startDate = new Date(this.startDate);
  const endDate = new Date(this.endDate);

  // Don't auto-update if event is cancelled or postponed
  if (this.status === 'cancelled' || this.status === 'postponed') {
    return;
  }

  let newStatus;
  if (now < startDate) {
    newStatus = 'upcoming';
  } else if (now >= startDate && now <= endDate) {
    newStatus = 'ongoing';
  } else if (now > endDate) {
    newStatus = 'past';
  }

  // Only update if status has changed
  if (newStatus && this.status !== newStatus) {
    this.status = newStatus;
    await this.save();
  }
};

// Update the pre-save middleware
eventSchema.pre('save', async function(next) {
  if (this.isModified('status')) {
    const oldStatus = this._original ? this._original.status : null;
    
    // Allow manual status changes if manualStatusControl is enabled
    if (this.manualStatusControl) {
      // Still validate basic status transitions
      if (!['upcoming', 'ongoing', 'past', 'cancelled', 'postponed'].includes(this.status)) {
        throw new Error('Invalid status');
      }
    } else {
      // Original automatic status update logic
      const now = new Date();
      const startDate = new Date(this.startDate);
      const endDate = new Date(this.endDate);
      
      if (!['cancelled', 'postponed'].includes(this.status)) {
        if (now < startDate && this.status !== 'upcoming') {
          throw new Error('Event cannot be started before start date');
        }
        if (now > endDate && this.status !== 'past') {
          throw new Error('Event must be marked as past after end date');
        }
      }
    }

    // Handle ticket invalidation for cancelled/postponed/past events
    if (['cancelled', 'postponed', 'past'].includes(this.status) && 
        oldStatus !== this.status) {
      await mongoose.model('Ticket').updateMany(
        { event: this._id, isValid: true },
        { 
          isValid: false,
          invalidationReason: `Event ${this.status}`,
          updatedAt: new Date()
        }
      );
      
      this.statusUpdateDate = new Date();
    }
  }
  next();
});

// Add this method to the schema
eventSchema.methods.isTicketCheckedIn = function(ticketId) {
  return this.attendance.checkedInAttendees.includes(ticketId);
};

// Add this method to handle check-ins
eventSchema.methods.checkInTicket = async function(ticketId) {
  if (this.isTicketCheckedIn(ticketId)) {
    return {
      success: false,
      isCheckedIn: true,
      message: 'Ticket has already been checked in'
    };
  }

  this.attendance.checkedInAttendees.push(ticketId);
  this.attendance.currentCount += 1;
  this.attendance.totalCheckins += 1;
  this.attendance.lastUpdated = new Date();
  
  await this.save();

  return {
    success: true,
    isCheckedIn: false,
    message: 'Ticket checked in successfully'
  };
};

// Also add a method to reset attendance if needed (for testing)
eventSchema.methods.resetAttendance = async function() {
  this.attendance = {
    currentCount: 0,
    totalCheckins: 0,
    checkedInAttendees: [],
    lastUpdated: new Date()
  };
  return this.save();
};

const Event = mongoose.model('Event', eventSchema);

module.exports = Event; 