const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { 
  getOrganizerAnalytics, 
  getDashboardStats,
  getEventAnalytics,
  getRecentEvents,
  getRecentTickets,
  getSalesData
} = require('../controllers/analyticsController');

// Dashboard routes
router.get('/organizer', protect, getOrganizerAnalytics);
router.get('/dashboard-stats', protect, getDashboardStats);
router.get('/events/:eventId', protect, getEventAnalytics);
router.get('/recent-events', protect, getRecentEvents);
router.get('/recent-tickets', protect, getRecentTickets);
router.get('/sales-data', protect, getSalesData);

module.exports = router; 