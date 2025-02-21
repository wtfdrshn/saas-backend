const Organizer = require('../models/Organizer')

const checkEventLimit = async (req, res, next) => {
  try {
    const organizer = await Organizer.findById(req.user.id);
    
    if (organizer.eventsCreated >= organizer.subscription.eventLimit) {
      return res.status(403).json({
        success: false,
        message: `Event limit reached. Upgrade your subscription to create more events.`
      });
    }
    
    next();
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { checkEventLimit }; 