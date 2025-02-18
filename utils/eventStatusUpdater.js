const Event = require('../models/Event');

const updateEventStatuses = async () => {
  try {
    const events = await Event.find({
      status: { $nin: ['cancelled', 'postponed'] }
    });

    for (const event of events) {
      await event.updateEventStatus();
    }
  } catch (error) {
    console.error('Error updating event statuses:', error);
  }
};

module.exports = updateEventStatuses; 