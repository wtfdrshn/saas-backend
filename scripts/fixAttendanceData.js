const mongoose = require('mongoose');
const Event = require('../models/Event');
require('dotenv').config();

const fixAttendanceData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // First, update the schema directly in MongoDB
    const db = mongoose.connection.db;
    const result = await db.collection('events').updateMany(
      {}, // match all documents
      {
        $set: {
          attendance: {
            currentCount: 0,
            checkedInAttendees: [],
            history: []
          }
        }
      }
    );

    console.log(`Updated ${result.modifiedCount} events`);

    // Now verify the data with Mongoose
    const events = await Event.find({});
    console.log(`Verified ${events.length} events`);

    // Optional: Log the first event's attendance structure
    if (events.length > 0) {
      console.log('Sample event attendance:', JSON.stringify(events[0].attendance, null, 2));
    }

    console.log('Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

// Add proper error handling for the connection
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

fixAttendanceData(); 