const Event = require('../models/Event');
const { uploadToCloudinary } = require('../utils/cloudinary');
const Ticket = require('../models/Ticket');
const mongoose = require('mongoose');

const createEvent = async (req, res) => {
  try {
    const eventData = {
      ...req.body,
      organizer: req.user.id,
      tags: req.body.tags ? req.body.tags.split(',').map(tag => tag.trim()) : []
    };

    // Handle image uploads
    if (req.files) {
      if (req.files.bannerImage) {
        const bannerResult = await uploadToCloudinary(req.files.bannerImage[0].path);
        eventData.bannerImage = bannerResult.secure_url;
      }
      if (req.files.coverImage) {
        const coverResult = await uploadToCloudinary(req.files.coverImage[0].path);
        eventData.coverImage = coverResult.secure_url;
      }
    }

    const event = new Event(eventData);
    await event.save();

    res.status(201).json(event);
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(400).json({ message: error.message });
  }
};

const getEvents = async (req, res) => {
  try {
    const { page = 1, limit = 10, category, status, search } = req.query;
    
    const query = {};
    if (category) query.category = category;
    if (status) query.status = status;
    if (search) {
      query.$text = { $search: search };
    }

    // Update all event statuses before querying
    await Event.find({
      status: { $nin: ['cancelled', 'postponed'] }
    }).then(events => {
      events.forEach(async (event) => {
        await event.updateEventStatus();
      });
    });

    const events = await Event.find(query)
      .populate('organizer', 'name email')
      .sort({ startDate: 1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Event.countDocuments(query);

    res.json({
      events,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ message: 'Error fetching events' });
  }
};

const getEvent = async (req, res) => {
  try {

    const id = req.params.id;
    const event = await Event.findOne({ 
      _id: id,
    }).populate('organizer');
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Format the response
    const formattedEvent = {
      ...event.toObject(),
      // Split tags if it's a string, otherwise keep as array
      tags: Array.isArray(event.tags) 
        ? event.tags.flatMap(tag => tag.split(',').map(t => t.trim()))
        : typeof event.tags === 'string'
        ? event.tags.split(',').map(tag => tag.trim())
        : [],
    };

    res.json(formattedEvent);
  } catch (error) {
    console.error('Error fetching event:', error);
    res.status(500).json({ message: 'Error fetching event details' });
  }
};

const updateEvent = async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(
      req.params.id,
      { ...req.body, organizer: req.user.id },
      { new: true }
    );
    res.json(event);
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(400).json({ message: error.message });
  }
};

const deleteEvent = async (req, res) => {
  try {
    // Add validation for user and event ID
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid event ID' });
    }

    console.log('Attempting to delete event:', {
      eventId: req.params.id,
      userId: req.user.id
    });

    const event = await Event.findOneAndDelete({ 
      _id: req.params.id, 
      organizer: req.user.id 
    });

    if (!event) {
      console.log('Event not found or user not authorized');
      return res.status(404).json({ 
        message: 'Event not found or you are not authorized to delete this event' 
      });
    }

    // Delete associated tickets (if any)
    await Ticket.deleteMany({ event: req.params.id });

    console.log('Event deleted successfully:', event._id);
    res.json({ 
      message: 'Event deleted successfully',
      eventId: event._id 
    });
  } catch (error) {
    console.error('Error in deleteEvent:', error);
    res.status(500).json({ 
      message: 'Error deleting event',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const getEventAnalytics = async (req, res) => {
  try {
    const { eventId } = req.params;

    if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ message: 'Invalid event ID' });
    }

    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Verify authorization
    if (event.organizer.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to view this event\'s analytics' });
    }

    // Get all tickets for this event
    const tickets = await Ticket.find({ event: eventId });

    // Calculate total tickets sold and revenue
    const totalTicketsSold = tickets.reduce((sum, ticket) => sum + ticket.quantity, 0);
    const totalRevenue = tickets.reduce((sum, ticket) => sum + ticket.totalAmount, 0);

    // Calculate average tickets per booking
    const averageTicketsPerBooking = totalTicketsSold / tickets.length || 0;

    // Calculate daily sales for the past week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const ticketsSoldByDate = await Ticket.aggregate([
      {
        $match: {
          event: event._id,
          createdAt: { $gte: oneWeekAgo }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: "$quantity" }
        }
      },
      {
        $sort: { _id: -1 }
      }
    ]);

    // Format for the response
    const bookingTrends = ticketsSoldByDate.map(day => ({
      date: day._id,
      tickets: day.count
    }));


    res.json({
      event,
      analytics: {
        totalTicketsSold,
        totalRevenue,
        averageTicketsPerBooking,
        ticketsSoldByDate,
        bookingTrends
      }
    });

  } catch (error) {
    console.error('Error in getEventAnalytics:', error);
    res.status(500).json({ 
      message: 'Error fetching analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const getOrganizerEvents = async (req, res) => {
  try {
    // Add validation for user
    if (!req.user || !req.user.id) {
      return res.status(401).json({ 
        message: 'User not authenticated',
        error: 'No user found in request'
      });
    }

    console.log('Fetching events for organizer:', req.user.id);

    const events = await Event.find({ 
      organizer: req.user.id 
    })
    .sort({ startDate: -1 })
    .select('-__v') // Exclude version key
    .lean(); // Convert to plain JavaScript object

    console.log(`Found ${events.length} events for organizer`);

    res.json(events);
  } catch (error) {
    console.error('Error in getOrganizerEvents:', error);
    res.status(500).json({ 
      message: 'Error fetching events',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

const updateEventStatus = async (req, res) => {
  try {
    const { status, manualStatusControl, reason } = req.body;
    
    if (!['upcoming', 'ongoing', 'past', 'postponed', 'cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const event = await Event.findOne({ 
      _id: req.params.id, 
      organizer: req.user.id 
    });

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Enable manual control if specified
    if (manualStatusControl) {
      event.manualStatusControl = true;
    }

    if(status === 'cancelled' || status === 'postponed' && reason) {
      event.statusReason = reason;
    }

    // Update the status
    event.status = status;
    await event.save();

    res.json(event);
  } catch (error) {
    console.error('Error updating event status:', error);
    res.status(400).json({ message: error.message });
  }
};

module.exports = { createEvent, getEvents, getEvent, updateEvent, deleteEvent, getEventAnalytics, getOrganizerEvents, updateEventStatus };