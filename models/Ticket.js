const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  totalAmount: {
    type: Number,
    required: true
  },
  paymentId: {
    type: String,
    // required: true,
    // unique: true
  },
  orderId: {
    type: String,
    // required: true,
    unique: true
  },
  isValid: {
    type: Boolean,
    default: true
  },
  ticketNumber: {
    type: String,
    unique: true
  },
  purchasedAt: {
    type: Date,
    default: Date.now
  },
  checkInStatus: {
    status: {
      type: String,
      enum: ['not-checked-in', 'checked-in', 'checked-out'],
      default: 'not-checked-in'
    },
    lastCheckedInAt: Date,
    lastCheckedOutAt: Date,
    checkInCount: {
      type: Number,
      default: 0
    },
    history: [{
      action: {
        type: String,
        enum: ['check-in', 'check-out']
      },
      timestamp: {
        type: Date,
        default: Date.now
      },
      scannedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organizer'
      }
    }]
  },
  invalidationReason: {
    type: String
  }
}, { timestamps: true });

// Generate unique ticket number before saving
ticketSchema.pre('save', async function(next) {
  if (this.isNew) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.ticketNumber = `TKT${year}${month}${random}`;
  }

  if (this.isFree) {
    this.paymentId = `FREE_EVENT_${this.event._id}`;
    this.orderId = `FREE_${this.event._id}_${Date.now()}`;
  }
  next();
});

module.exports = mongoose.model('Ticket', ticketSchema); 