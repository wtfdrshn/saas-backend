const { log } = require('console');
const razorpay = require('../config/razorpay.js');
const Organizer = require("../models/Organizer.js")
require('dotenv').config();
const crypto = require('crypto');
const mongoose = require('mongoose');

const getOrganizerProfile = async (req, res) => {
  try {
    const organizer = await Organizer.findById(req.user.id)
      .select('-password')
      .lean();
    
    res.json(organizer);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Import Razorpay

const createSubscriptionOrder = async (req, res) => {
  try {
    // Shorten the receipt ID to ensure it's within the 40 character limit
    const receiptId = `sub_${Date.now().toString().slice(-8)}_${req.user.id.toString().slice(-8)}`;

    const options = {
      amount: 299900, // ₹2999.00
      currency: 'INR',
      receipt: receiptId, // Updated receipt format
      payment_capture: 1
    };

    const order = await razorpay.orders.create(options);
    
    // Fetch fresh user data from database
    const organizer = await Organizer.findById(req.user.id)
      .select('name email')
      .lean();

    if (!organizer) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      user: {
        name: organizer.name,
        email: organizer.email,
        id: organizer._id
      }
    });

  } catch (error) {
    console.error('Error creating subscription order:', error);
    res.status(500).json({ message: 'Error creating subscription order', error: error.message });
  }
};

const verifySubscription = async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    await session.startTransaction();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // 1. Verify signature
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      await session.abortTransaction();
      return res.status(400).json({ 
        success: false,
        message: 'Invalid payment signature',
        debug: { generated: generatedSignature, received: razorpay_signature }
      });
    }

    // 2. Update organizer
    const organizer = await Organizer.findById(req.user.id).session(session);
    if (!organizer) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Organizer not found' });
    }

    organizer.subscription = {
      tier: 'pro',
      status: 'active',
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id
    };

    await organizer.save({ session });
    await session.commitTransaction();

    res.json({ 
      success: true,
      message: 'Subscription activated successfully',
      subscription: organizer.subscription
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Verification Error:', {
      error: error.message,
      stack: error.stack,
      body: req.body
    });
    res.status(500).json({ 
      success: false,
      message: 'Payment verification failed',
      error: error.message 
    });
  } finally {
    await session.endSession();
  }
}; 

const getSubscriptionDetails = async (req, res) => {
  try {
    const subscription = await Organizer.findById(req.user.id)
      .select('subscription eventsCreated')
      .lean();

    return res.json(subscription);

  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching subscription details' });
  }
};

module.exports = {
  verifySubscription,
  createSubscriptionOrder,
  getOrganizerProfile,
  getSubscriptionDetails,
}