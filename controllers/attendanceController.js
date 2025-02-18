const Ticket = require('../models/Ticket');
const Event = require('../models/Event');
const mongoose = require('mongoose');
const { 
  getTicketStatus, 
  validateTicketForCheckIn, 
  updateTicketCheckInStatus, 
  updateEventAttendance,
  handleError 
} = require('../utils/attendanceHelpers');  

// Scan and validate ticket
const scanTicket = async (req, res) => {
  try {
    const { ticketId, ticketNumber } = req.body;
    const scannedBy = req.user.id;

    const ticket = await Ticket.findOne({
      _id: ticketId,
      ticketNumber: ticketNumber,
      isValid: true
    }).populate('event').populate('user', 'name');

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Invalid ticket'
      });
    }

    // Check event status
    if (ticket.event.status !== 'ongoing') {
      return res.status(400).json({
        success: false,
        message: `Event is ${ticket.event.status}`
      });
    }

    const ticketStatus = await getTicketStatus(ticket);
    
    res.json({
      success: true,
      ticket,
      status: ticketStatus,
      canCheckIn: ticketStatus.status !== 'checked-in'
    });
  } catch (error) {
    handleError(res, error);
  }
};

const handleDatabaseOperation = async (operation) => {
  let session = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();

    const result = await operation(session);

    await session.commitTransaction();
    return result;
  } catch (error) {
    if (session) {
      await session.abortTransaction();
    }
    throw error;
  } finally {
    if (session) {
      session.endSession();
    }
  }
};

// Check in attendee
const checkInAttendee = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { ticketId } = req.body;
    const scannedBy = req.user.id;

    // Find ticket with populated event
    const ticket = await Ticket.findById(ticketId)
      .populate('event')
      .populate('user', 'name')
      .session(session);

    if (!ticket) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Validate ticket for check-in
    const validationResult = await validateTicketForCheckIn(ticket);
    if (!validationResult.success) {
      await session.abortTransaction();
      return res.status(400).json(validationResult);
    }

    // Update ticket status
    const updatedTicket = await updateTicketCheckInStatus(ticket, scannedBy, session);

    // Find and update event attendance
    const event = await Event.findById(ticket.event._id).session(session);
    
    // Initialize attendance if it doesn't exist
    if (!event.attendance) {
      event.attendance = {
        currentCount: 0,
        totalCheckins: 0,
        checkedInAttendees: [],
        history: []
      };
    }

    // Check if this is the first time this ticket is being checked in
    const existingCheckIn = event.attendance.history.find(
      h => h.ticketId.toString() === ticketId && h.action === 'check-in'
    );

    // Increment totalCheckins only if this is a new check-in
    if (!existingCheckIn) {
      event.attendance.totalCheckins = (event.attendance.totalCheckins || 0) + 1;
    }

    // Update other attendance data
    if (!event.attendance.checkedInAttendees) {
      event.attendance.checkedInAttendees = [];
    }

    const attendeeIndex = event.attendance.checkedInAttendees
      .findIndex(a => a.ticketId.toString() === ticketId);

    if (attendeeIndex === -1) {
      // Add new attendee
      event.attendance.checkedInAttendees.push({
        ticketId,
        status: 'checked-in',
        timestamp: new Date(),
        scannedBy
      });
    } else {
      // Update existing attendee
      event.attendance.checkedInAttendees[attendeeIndex] = {
        ticketId,
        status: 'checked-in',
        timestamp: new Date(),
        scannedBy
      };
    }

    // Add to history
    if (!event.attendance.history) {
      event.attendance.history = [];
    }
    
    event.attendance.history.push({
      action: 'check-in',
      ticketId,
      timestamp: new Date(),
      scannedBy
    });

    // Update current count
    event.attendance.currentCount = event.attendance.checkedInAttendees
      .filter(a => a.status === 'checked-in').length;

    // Save the event
    const updatedEvent = await event.save({ session });

    await session.commitTransaction();

    // Return success response
    res.json({
      success: true,
      message: 'Check-in successful',
      ticket: updatedTicket,
      status: updatedTicket.checkInStatus,
      attendance: {
        currentCount: updatedEvent.attendance.currentCount,
        totalCheckins: updatedEvent.attendance.totalCheckins,
        checkedInAttendees: updatedEvent.attendance.checkedInAttendees
      }
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error in checkInAttendee:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error checking in attendee',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  } finally {
    session.endSession();
  }
};

// Check out attendee
const checkOutAttendee = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { ticketId } = req.body;
    const scannedBy = req.user.id;

    // Find ticket with populated event
    const ticket = await Ticket.findById(ticketId)
      .populate('event')
      .populate('user', 'name')
      .session(session);

    if (!ticket) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Check if ticket is checked in
    if (!ticket.checkInStatus || ticket.checkInStatus.status !== 'checked-in') {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Ticket is not checked in'
      });
    }

    // Update ticket status
    const now = new Date();
    ticket.checkInStatus.status = 'checked-out';
    ticket.checkInStatus.lastCheckedOutAt = now;
    // Make ticket invalid after check-out
    ticket.isValid = false;
    
    if (!ticket.checkInStatus.history) {
      ticket.checkInStatus.history = [];
    }
    ticket.checkInStatus.history.push({
      action: 'check-out',
      timestamp: now,
      scannedBy
    });

    await ticket.save({ session });

    // Update event attendance
    const event = await Event.findById(ticket.event._id).session(session);
    
    if (!event.attendance) {
      event.attendance = {
        currentCount: 0,
        checkedInAttendees: [],
        history: []
      };
    }

    // Update attendee status in event
    const attendeeIndex = event.attendance.checkedInAttendees
      .findIndex(a => a.ticketId.toString() === ticketId);

    if (attendeeIndex !== -1) {
      event.attendance.checkedInAttendees[attendeeIndex].status = 'checked-out';
      event.attendance.checkedInAttendees[attendeeIndex].timestamp = now;
    }

    // Add to history
    event.attendance.history.push({
      action: 'check-out',
      ticketId,
      timestamp: now,
      scannedBy,
      invalidated: true  // Add flag to indicate ticket was invalidated
    });

    // Update current count
    event.attendance.currentCount = event.attendance.checkedInAttendees
      .filter(a => a.status === 'checked-in').length;

    await event.save({ session });

    await session.commitTransaction();

    res.json({
      success: true,
      message: 'Check-out successful. Ticket has been invalidated.',
      ticket,
      status: {
        ...ticket.checkInStatus,
        isValid: false
      },
      attendance: {
        currentCount: event.attendance.currentCount,
        checkedInAttendees: event.attendance.checkedInAttendees
      }
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Error in checkOutAttendee:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error checking out attendee',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  } finally {
    session.endSession();
  }
};

// Get event attendance
const getEventAttendance = async (req, res) => {
  try {
    const { eventId } = req.params;
    
    if (!eventId) {
      return res.status(400).json({ 
        success: false,
        message: 'Event ID is required' 
      });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ 
        success: false,
        message: 'Event not found',
        eventId 
      });
    }

    // Initialize attendance if it doesn't exist
    if (!event.attendance) {
      event.attendance = {
        currentCount: 0,
        totalCheckins: 0,
        lastUpdated: new Date()
      };
      await event.save();
    }

    const attendance = {
      currentCount: event.attendance.currentCount || 0,
      totalCheckins: event.attendance.totalCheckins || 0,
      lastUpdated: event.attendance.lastUpdated || new Date()
    };

    res.json(attendance);
  } catch (error) {
    console.error('Error in getEventAttendance:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching attendance',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Add this new controller method
const getCheckedInAttendees = async (req, res) => {
  try {
    const { eventId } = req.params;
    
    const tickets = await Ticket.find({
      event: eventId,
      'checkInStatus.isCheckedIn': true
    }).populate('user', 'name email')
      .sort({ 'checkInStatus.checkedInAt': -1 });

    res.json(tickets);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching attendees',
      error: error.message
    });
  }
};

const getAttendanceHistory = async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId)
      .select('attendance.history')
      .populate({
        path: 'attendance.history.ticketId',
        select: 'ticketNumber user',
        populate: {
          path: 'user',
          select: 'name email'
        }
      })
      .populate({
        path: 'attendance.history.scannedBy',
        select: 'name email'
      });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    const history = event.attendance?.history || [];

    // Format the history data
    const formattedHistory = history.map(entry => ({
      id: entry._id,
      action: entry.action,
      timestamp: entry.timestamp,
      ticket: {
        id: entry.ticketId?._id,
        number: entry.ticketId?.ticketNumber,
        attendee: {
          name: entry.ticketId?.user?.name,
          email: entry.ticketId?.user?.email
        }
      },
      scannedBy: {
        name: entry.scannedBy?.name,
        email: entry.scannedBy?.email
      }
    }));

    res.json({
      success: true,
      history: formattedHistory
    });
  } catch (error) {
    handleError(res, error);
  }
};

module.exports = {
  scanTicket,
  checkInAttendee,
  checkOutAttendee,
  getEventAttendance,
  getCheckedInAttendees,
  getAttendanceHistory
}; 