const Ticket = require('../models/Ticket');
const Event = require('../models/Event');
const razorpay = require('../config/razorpay');
const crypto = require('crypto');

// Create Razorpay order
const createOrder = async (req, res) => {
  try {
    const { eventId, quantity } = req.body;
    const userId = req.user.id;
    
    // Fetch event details
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
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      eventId,
      quantity
    } = req.body;

    // Verify payment signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: 'Invalid payment signature' });
    }

    // Get order details
    const order = await razorpay.orders.fetch(razorpay_order_id);
    
    // Create ticket
    const ticket = await Ticket.create({
      user: req.user.id,
      event: eventId,
      quantity,
      totalAmount: order.amount / 100, // Convert from paise to rupees
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      isValid: true
    });

    await ticket.populate(['event', 'user']);

    res.json({
      message: 'Payment successful',
      ticket
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ message: 'Error verifying payment' });
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