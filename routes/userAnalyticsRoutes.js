const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getDashboardStats,
  getUpcomingEvents,
  getTicketHistory,
  getEventAttendance,
  getSpendingAnalytics,
  getFavoriteCategories,
  getTicketUsageStats
} = require('../controllers/userAnalyticsController');

// User analytics routes
router.get('/dashboard-stats', protect, getDashboardStats);
router.get('/upcoming-events', protect, getUpcomingEvents);
router.get('/ticket-history', protect, getTicketHistory);
router.get('/event-attendance', protect, getEventAttendance);
router.get('/spending', protect, getSpendingAnalytics);
router.get('/favorite-categories', protect, getFavoriteCategories);
router.get('/ticket-usage', protect, getTicketUsageStats);

module.exports = router; 