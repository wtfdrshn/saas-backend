const validateTicketForCheckIn = async (ticket) => {
  try {
    // Check if ticket exists and is valid
    if (!ticket || !ticket.isValid) {
      return {
        success: false,
        message: 'Invalid ticket'
      };
    }

    // Initialize checkInStatus if it doesn't exist
    if (!ticket.checkInStatus) {
      ticket.checkInStatus = {
        status: 'not-checked-in',
        checkInCount: 0,
        history: []
      };
    }

    // Check if already checked in
    if (ticket.checkInStatus.status === 'checked-in') {
      return {
        success: false,
        message: 'Ticket already checked in',
        status: ticket.checkInStatus
      };
    }

    // Check event status
    if (!ticket.event || ticket.event.status !== 'ongoing') {
      return {
        success: false,
        message: `Event is ${ticket.event?.status || 'invalid'}`
      };
    }

    return { success: true };
  } catch (error) {
    console.error('Error validating ticket:', error);
    return {
      success: false,
      message: 'Error validating ticket',
      error: error.message
    };
  }
};

const updateTicketCheckInStatus = async (ticket, scannedBy, session) => {
  try {
    const now = new Date();
    
    // Initialize checkInStatus if it doesn't exist
    if (!ticket.checkInStatus) {
      ticket.checkInStatus = {
        status: 'not-checked-in',
        checkInCount: 0,
        history: []
      };
    }

    // Update status
    ticket.checkInStatus.status = 'checked-in';
    ticket.checkInStatus.lastCheckedInAt = now;
    ticket.checkInStatus.checkInCount = (ticket.checkInStatus.checkInCount || 0) + 1;

    // Initialize history array if it doesn't exist
    if (!ticket.checkInStatus.history) {
      ticket.checkInStatus.history = [];
    }

    // Add to history
    ticket.checkInStatus.history.push({
      action: 'check-in',
      timestamp: now,
      scannedBy
    });

    // Save with session
    return await ticket.save({ session });
  } catch (error) {
    console.error('Error updating ticket status:', error);
    throw error;
  }
};

const updateEventAttendance = async (event, ticketId, scannedBy, session) => {
  try {
    const now = new Date();

    // Initialize attendance if it doesn't exist
    if (!event.attendance) {
      event.attendance = {
        currentCount: 0,
        totalCount: 0,
        checkedInAttendees: [],
        history: []
      };
    }

    // Initialize arrays if they don't exist
    if (!event.attendance.checkedInAttendees) {
      event.attendance.checkedInAttendees = [];
    }
    if (!event.attendance.history) {
      event.attendance.history = [];
    }

    // Add to checkedInAttendees if not already present
    const existingAttendee = event.attendance.checkedInAttendees
      .find(a => a.ticketId.toString() === ticketId.toString());

    if (!existingAttendee) {
      event.attendance.checkedInAttendees.push({
        ticketId,
        status: 'checked-in',
        timestamp: now,
        scannedBy
      });
    } else {
      // Update existing attendee status
      existingAttendee.status = 'checked-in';
      existingAttendee.timestamp = now;
      existingAttendee.scannedBy = scannedBy;
    }

    // Add to history
    event.attendance.history.push({
      action: 'check-in',
      ticketId,
      timestamp: now,
      scannedBy
    });

    // Update currentCount
    event.attendance.currentCount = event.attendance.checkedInAttendees
      .filter(a => a.status === 'checked-in').length;

    // Save with session
    return await event.save({ session });
  } catch (error) {
    console.error('Error updating event attendance:', error);
    throw error;
  }
};

const getTicketStatus = async (ticket) => {
  try {
    // Initialize default status if checkInStatus doesn't exist
    if (!ticket.checkInStatus) {
      ticket.checkInStatus = {
        status: 'not-checked-in',
        checkInCount: 0,
        history: []
      };
    }

    return {
      success: true,
      status: ticket.checkInStatus.status || 'not-checked-in',
      lastCheckedInAt: ticket.checkInStatus.lastCheckedInAt,
      lastCheckedOutAt: ticket.checkInStatus.lastCheckedOutAt,
      checkInCount: ticket.checkInStatus.checkInCount || 0,
      ticketNumber: ticket.ticketNumber,
      eventTitle: ticket.event.title,
      userName: ticket.user?.name,
      isValid: ticket.isValid
    };
  } catch (error) {
    console.error('Error getting ticket status:', error);
    return {
      success: false,
      message: 'Error getting ticket status',
      error: error.message
    };
  }
};

const handleError = (res, error) => {
  console.error('Error in attendance operation:', error);
  res.status(500).json({
    success: false,
    message: error.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });
};

module.exports = {
  getTicketStatus,
  validateTicketForCheckIn,
  updateTicketCheckInStatus,
  updateEventAttendance,
  handleError
};
