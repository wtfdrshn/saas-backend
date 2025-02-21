const Ticket = require('../models/Ticket');
const Event = require('../models/Event');
const razorpay = require('../config/razorpay');
const crypto = require('crypto');
const mongoose = require('mongoose');

// Create Razorpay order
const createOrder = async (req, res) => {
  try {
    // Destructure from request body correctly
    // const eventId = req.body;
    const { eventId, quantity } = req.body;;
    // console.log(data)
    const userId = req.user.id;
    


    // Fetch event details with proper ID casting
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Handle free events differently
    if (event.price === 0 || event.isFree) {
      // Create free ticket directly without payment
      const ticket = await Ticket.create({
        user: userId,
        event: eventId,
        quantity,
        totalAmount: 0,
        isValid: true,
        checkInStatus: {
          isCheckedIn: false,
          checkInTime: null,
          checkOutTime: null
        }
      });

      await ticket.populate(['event', 'user']);

      return res.json({
        message: 'Free ticket created successfully',
        ticket,
        isFree: true
      });
    } 


    // For paid events, continue with Razorpay order creation
    const totalAmount = event.price * quantity;
    const amountInPaise = Math.round(totalAmount * 100);

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
      notes: {
        eventId,
        userId,
        quantity
      }
    });

    res.json({
      orderId: order.id,
      amount: totalAmount,
      currency: order.currency,
      event: {
        name: event.title,
        price: event.price
      },
      isFree: false
    });

  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ 
      message: 'Error creating order',
      details: error.message 
    });
  }
};

// Verify payment and create ticket
const verifyPayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, eventId, quantity } = req.body;
    const userId = req.user.id;

    // Validate payment signature
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Payment verification failed' });
    }

    // Get event details
    const event = await Event.findById(eventId).session(session);
    if (!event) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Event not found' });
    }

    // Check ticket availability
    if (event.availableTickets < quantity) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Not enough tickets available' });
    }

    // Create ticket (single document with quantity)
    const ticket = await Ticket.create([{
      user: userId,
      event: eventId,
      quantity,
      totalAmount: event.price * quantity,
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      status: 'confirmed',
      isValid: true,
      checkInStatus: {
        isCheckedIn: false,
        checkInTime: null,
        checkOutTime: null
      }
    }], { session });

    // Update event ticket count
    event.availableTickets -= quantity;
    event.soldTickets += quantity;
    await event.save({ session });

    await session.commitTransaction();
    
    res.json({
      success: true,
      message: 'Payment verified and ticket created',
      ticket: ticket[0]._id,
      paymentId: razorpay_payment_id
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Payment verification error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Payment verification failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    session.endSession();
  }
};

// Get ticket details
const getTicketDetails = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate('event')
      .populate('user', '-password');

    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    // Check if the ticket belongs to the requesting user
    if (ticket.user._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized access to ticket' });
    }

    res.json(ticket);
  } catch (error) {
    console.error('Error fetching ticket:', error);
    res.status(500).json({ message: 'Error fetching ticket details' });
  }
};

// Add this new controller function
const getUserTickets = async (req, res) => {
  try {
    const tickets = await Ticket.find({ user: req.user.id })
      .populate('event')
      .sort({ createdAt: -1 });

    res.json(tickets);
  } catch (error) {
    console.error('Error fetching user tickets:', error);
    res.status(500).json({ message: 'Error fetching tickets' });
  }
};

module.exports = {
  createOrder,
  verifyPayment,
  getTicketDetails,
  getUserTickets
}; 