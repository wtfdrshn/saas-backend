const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  scanTicket,
  checkInAttendee,
  checkOutAttendee,
  getEventAttendance,
  getCheckedInAttendees,
  getAttendanceHistory
} = require('../controllers/attendanceController');

// Add validation middleware
const validateTicketData = (req, res, next) => {
  const { ticketId, ticketNumber } = req.body;
  
  if (!ticketId || typeof ticketId !== 'string') {
    return res.status(400).json({ 
      message: 'Invalid or missing ticketId'
    });
  }
  
  if (!ticketNumber || typeof ticketNumber !== 'string') {
    return res.status(400).json({ 
      message: 'Invalid or missing ticketNumber'
    });
  }
  
  next();
};

router.post('/scan', protect, authorize('admin', 'organizer'), validateTicketData, scanTicket);
router.post('/check-in', protect, authorize('admin', 'organizer'), checkInAttendee);
router.post('/check-out', protect, authorize('admin', 'organizer'), checkOutAttendee);
router.get('/event/:eventId', protect, authorize('admin', 'organizer'), getEventAttendance);
router.get('/event/:eventId/attendees', protect, authorize('admin', 'organizer'), getCheckedInAttendees);
router.get('/event/:eventId/history', protect, authorize('admin', 'organizer'), getAttendanceHistory);

module.exports = router; 