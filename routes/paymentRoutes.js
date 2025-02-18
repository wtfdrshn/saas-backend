const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  createOrder,
  verifyPayment,
  getTicketDetails,
  getUserTickets
} = require('../controllers/paymentController');

router.post('/create-order', protect, createOrder);
router.post('/verify-payment', protect, verifyPayment);
router.get('/tickets/:id', protect, getTicketDetails);
router.get('/user/tickets', protect, getUserTickets);

module.exports = router; 