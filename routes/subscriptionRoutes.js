const express = require('express');
const router = express.Router();
const {
  createSubscriptionOrder,
  verifySubscription,
  getSubscriptionDetails

} = require('../controllers/subscriptionController.js');

const { protect } = require('../middleware/authMiddleware.js');

router.post('/create', protect, createSubscriptionOrder);
router.post('/verify', protect, verifySubscription); 
router.get('/details', protect, getSubscriptionDetails)

module.exports = router;