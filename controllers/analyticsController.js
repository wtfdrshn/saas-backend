const Event = require('../models/Event');
const Ticket = require('../models/Ticket');
const mongoose = require('mongoose');

// Get Dashboard Stats
const getDashboardStats = async (req, res) => {
  try {
    const organizerId = req.user.id;

    // Get all events by this organizer
    const events = await Event.find({ organizer: organizerId });
    const eventIds = events.map(event => event._id);

    // Calculate total and active events
    const totalEvents = events.length;
    const activeEvents = events.filter(event => 
      new Date(event.endDate) >= new Date()
    ).length;

    // Get tickets data
    const tickets = await Ticket.find({ event: { $in: eventIds } });
    const totalTicketsSold = tickets.reduce((sum, ticket) => sum + ticket.quantity, 0);
    const revenue = tickets.reduce((sum, ticket) => sum + ticket.totalAmount, 0);

    // Get recent events (last 5)
    const recentEvents = await Event.find({ organizer: organizerId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('title startDate status');

    // Get recent tickets (last 5)
    const recentTickets = await Ticket.find({ event: { $in: eventIds } })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('event', 'title')
      .lean();

    // Format recent tickets
    const formattedRecentTickets = recentTickets.map(ticket => ({
      _id: ticket._id,
      eventTitle: ticket.event.title,
      purchaseDate: ticket.createdAt,
      amount: ticket.totalAmount,
      quantity: ticket.quantity
    }));

    // Get sales data for the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const salesData = await Ticket.aggregate([
      {
        $match: {
          event: { $in: eventIds },
          createdAt: { $gte: sevenDaysAgo }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          sales: { $sum: "$totalAmount" },
          tickets: { $sum: "$quantity" }
        }
      },
      {
        $sort: { _id: 1 }
      },
      {
        $project: {
          date: "$_id",
          sales: 1,
          tickets: 1,
          _id: 0
        }
      }
    ]);

    // Fill in missing dates with zero values
    const allDates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(sevenDaysAgo);
      date.setDate(date.getDate() + i);
      allDates.push(date.toISOString().split('T')[0]);
    }

    const completeSalesData = allDates.map(date => {
      const existingData = salesData.find(d => d.date === date);
      return existingData || { date, sales: 0, tickets: 0 };
    });

    res.json({
      stats: {
        totalEvents,
        activeEvents,
        totalTicketsSold,
        revenue
      },
      recentEvents,
      recentTickets: formattedRecentTickets,
      salesData: completeSalesData
    });

  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ message: 'Error fetching dashboard statistics' });
  }
};

// Get Event Analytics
const getEventAnalytics = async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await Event.findById(eventId);
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Verify ownership
    if (event.organizer.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const tickets = await Ticket.find({ event: eventId });
    
    const totalTicketsSold = tickets.reduce((sum, ticket) => sum + ticket.quantity, 0);
    const totalRevenue = tickets.reduce((sum, ticket) => sum + ticket.totalAmount, 0);
    const averageTicketsPerBooking = totalTicketsSold / tickets.length || 0;

    // Get daily ticket sales for the past week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const ticketsSoldByDate = await Ticket.aggregate([
      {
        $match: {
          event: mongoose.Types.ObjectId(eventId),
          createdAt: { $gte: oneWeekAgo }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: "$quantity" }
        }
      },
      {
        $sort: { _id: -1 }
      }
    ]);

    res.json({
      event,
      analytics: {
        totalTicketsSold,
        totalRevenue,
        averageTicketsPerBooking,
        ticketsSoldByDate,
        bookingTrends: ticketsSoldByDate.map(day => ({
          date: day._id,
          tickets: day.count
        }))
      }
    });

  } catch (error) {
    console.error('Error fetching event analytics:', error);
    res.status(500).json({ message: 'Error fetching event analytics' });
  }
};

// Get Recent Events
const getRecentEvents = async (req, res) => {
  try {
    const recentEvents = await Event.find({ organizer: req.user.id })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('title startDate status');
    
    res.json(recentEvents);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching recent events' });
  }
};

// Get Recent Tickets
const getRecentTickets = async (req, res) => {
  try {
    const events = await Event.find({ organizer: req.user.id });
    const eventIds = events.map(event => event._id);

    const recentTickets = await Ticket.find({ event: { $in: eventIds } })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('event', 'title');

    res.json(recentTickets);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching recent tickets' });
  }
};

// Get Sales Data
const getSalesData = async (req, res) => {
  try {
    const events = await Event.find({ organizer: req.user.id });
    const eventIds = events.map(event => event._id);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const salesData = await Ticket.aggregate([
      {
        $match: {
          event: { $in: eventIds },
          createdAt: { $gte: sevenDaysAgo }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          sales: { $sum: "$totalAmount" },
          tickets: { $sum: "$quantity" }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    res.json(salesData);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching sales data' });
  }
};

const getOrganizerAnalytics = async (req, res) => {
    try {
      const organizerId = req.user.id;
  
      // Get all events by this organizer with ticket sales data
      const events = await Event.find({ organizer: organizerId });
      const eventIds = events.map(event => event._id);
  
      // Get all tickets for these events
      const tickets = await Ticket.find({ event: { $in: eventIds } });
  
      // Calculate per-event metrics
      const eventMetrics = events.map(event => {
        const eventTickets = tickets.filter(ticket => ticket.event.toString() === event._id.toString());
        const totalTicketsSold = eventTickets.reduce((sum, ticket) => sum + ticket.quantity, 0);
        const totalRevenue = eventTickets.reduce((sum, ticket) => sum + ticket.totalAmount, 0);
  
        return {
          _id: event._id,
          title: event.title,
          startDate: event.startDate,
          endDate: event.endDate,
          totalTicketsSold,
          totalRevenue
        };
      });
  
      // Calculate overall analytics
      const totalTicketsSold = tickets.reduce((sum, ticket) => sum + ticket.quantity, 0);
      const totalRevenue = tickets.reduce((sum, ticket) => sum + ticket.totalAmount, 0);
      const averageTicketsPerEvent = totalTicketsSold / events.length || 0;
  
      // Get sales trend for the past week
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  
      const salesTrend = await Ticket.aggregate([
        {
          $match: {
            event: { $in: eventIds },
            createdAt: { $gte: oneWeekAgo }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            tickets: { $sum: "$quantity" }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ]);
  
      res.json({
        totalEvents: events.length,
        totalTicketsSold,
        totalRevenue,
        averageTicketsPerEvent,
        events: eventMetrics,
        salesTrend: salesTrend.map(day => ({
          date: day._id,
          tickets: day.tickets
        }))
      });
  
    } catch (error) {
      console.error('Error fetching analytics:', error);
      res.status(500).json({ message: 'Error fetching analytics' });
    }
};
  

module.exports = {
  getDashboardStats,
  getEventAnalytics,
  getRecentEvents,
  getRecentTickets,
  getSalesData,
  getOrganizerAnalytics
}; 