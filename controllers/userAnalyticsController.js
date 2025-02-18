const Event = require('../models/Event');
const Ticket = require('../models/Ticket');
const mongoose = require('mongoose');

// Get dashboard statistics
const getDashboardStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();

    // Get all tickets for the user
    const tickets = await Ticket.find({ user: userId })
      .populate('event', 'title startDate endDate status');

    // Calculate stats
    const totalTickets = tickets.length;
    const validTickets = tickets.filter(ticket => 
      new Date(ticket.event.startDate) > now
    ).length;
    const upcomingEvents = new Set(tickets
      .filter(ticket => new Date(ticket.event.startDate) > now)
      .map(ticket => ticket.event._id.toString())
    ).size;
    const pastEvents = new Set(tickets
      .filter(ticket => new Date(ticket.event.startDate) <= now)
      .map(ticket => ticket.event._id.toString())
    ).size;
    const totalQuantity = tickets.reduce((sum, ticket) => sum + ticket.quantity, 0);

    res.json({
      stats: {
        totalTickets,
        validTickets,
        upcomingEvents,
        pastEvents,
        totalQuantity
      }
    });
  } catch (error) {
    console.error('Error in getDashboardStats:', error);
    res.status(500).json({ message: 'Error fetching dashboard statistics' });
  }
};

// Get upcoming events
const getUpcomingEvents = async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();

    const tickets = await Ticket.find({ 
      user: userId,
    }).populate({
      path: 'event',
      match: { startDate: { $gt: now } },
      select: 'title startDate endDate location description coverImage'
    });

    const upcomingEvents = tickets
      .filter(ticket => ticket.event) // Filter out null events
      .map(ticket => ({
        _id: ticket._id,
        eventId: ticket.event._id,
        title: ticket.event.title,
        startDate: ticket.event.startDate,
        endDate: ticket.event.endDate,
        location: ticket.event.location,
        coverImage: ticket.event.coverImage,
        description: ticket.event.description,
        ticketQuantity: ticket.quantity,
        ticketNumber: ticket.ticketNumber
      }));

    res.json(upcomingEvents);
  } catch (error) {
    console.error('Error in getUpcomingEvents:', error);
    res.status(500).json({ message: 'Error fetching upcoming events' });
  }
};

// Get ticket history
const getTicketHistory = async (req, res) => {
  try {
    const userId = req.user.id;

    const tickets = await Ticket.find({ user: userId })
      .populate('event', 'title startDate endDate venue status')
      .sort({ createdAt: -1 });

    const ticketHistory = tickets.map(ticket => ({
      _id: ticket._id,
      eventTitle: ticket.event.title,
      startDate: ticket.event.startDate,
      venue: ticket.event.venue,
      quantity: ticket.quantity,
      totalAmount: ticket.totalAmount,
      purchaseDate: ticket.createdAt,
      ticketNumber: ticket.ticketNumber,
      status: ticket.event.status,
      isValid: new Date(ticket.event.startDate) > new Date()
    }));

    res.json(ticketHistory);
  } catch (error) {
    console.error('Error in getTicketHistory:', error);
    res.status(500).json({ message: 'Error fetching ticket history' });
  }
};

// Get event attendance
const getEventAttendance = async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();

    const tickets = await Ticket.find({ user: userId })
      .populate('event', 'title startDate endDate status');

    const attendance = {
      attended: tickets.filter(ticket => 
        new Date(ticket.event.startDate) < now && ticket.isUsed
      ).length,
      missed: tickets.filter(ticket => 
        new Date(ticket.event.startDate) < now && !ticket.isUsed
      ).length,
      upcoming: tickets.filter(ticket => 
        new Date(ticket.event.startDate) > now
      ).length
    };

    res.json(attendance);
  } catch (error) {
    console.error('Error in getEventAttendance:', error);
    res.status(500).json({ message: 'Error fetching event attendance' });
  }
};

// Get spending analytics
const getSpendingAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;
    const { timeframe } = req.query;
    const now = new Date();
    let startDate;

    switch (timeframe) {
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'month':
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case 'year':
        startDate = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      default:
        startDate = new Date(now.setMonth(now.getMonth() - 1)); // Default to month
    }

    const spending = await Ticket.aggregate([
      {
        $match: {
          user: mongoose.Types.ObjectId(userId),
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          totalSpent: { $sum: "$totalAmount" },
          ticketCount: { $sum: "$quantity" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json(spending);
  } catch (error) {
    console.error('Error in getSpendingAnalytics:', error);
    res.status(500).json({ message: 'Error fetching spending analytics' });
  }
};

// Get favorite categories
const getFavoriteCategories = async (req, res) => {
  try {
    const userId = req.user.id;

    const categories = await Ticket.aggregate([
      {
        $match: { user: mongoose.Types.ObjectId(userId) }
      },
      {
        $lookup: {
          from: 'events',
          localField: 'event',
          foreignField: '_id',
          as: 'eventDetails'
        }
      },
      { $unwind: '$eventDetails' },
      {
        $group: {
          _id: '$eventDetails.category',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json(categories);
  } catch (error) {
    console.error('Error in getFavoriteCategories:', error);
    res.status(500).json({ message: 'Error fetching favorite categories' });
  }
};

// Get ticket usage stats
const getTicketUsageStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const usageStats = await Ticket.aggregate([
      {
        $match: { user: mongoose.Types.ObjectId(userId) }
      },
      {
        $group: {
          _id: '$isUsed',
          count: { $sum: 1 }
        }
      }
    ]);

    const stats = {
      used: usageStats.find(stat => stat._id === true)?.count || 0,
      unused: usageStats.find(stat => stat._id === false)?.count || 0
    };

    res.json(stats);
  } catch (error) {
    console.error('Error in getTicketUsageStats:', error);
    res.status(500).json({ message: 'Error fetching ticket usage stats' });
  }
};

module.exports = {
  getDashboardStats,
  getUpcomingEvents,
  getTicketHistory,
  getEventAttendance,
  getSpendingAnalytics,
  getFavoriteCategories,
  getTicketUsageStats
}; 