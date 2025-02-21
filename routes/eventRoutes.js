const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect } = require('../middleware/authMiddleware');
const { 
  createEvent, 
  getEvents, 
  getEvent, 
  updateEvent, 
  deleteEvent, 
  getEventAnalytics,
  updateEventStatus,
  getOrganizerEvents
} = require('../controllers/eventController');
const { checkEventLimit } = require('../middleware/subscription.js');

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Not an image! Please upload an image.'), false);
    }
  },
});

const uploadFields = upload.fields([
  { name: 'bannerImage', maxCount: 1 },
  { name: 'coverImage', maxCount: 1 }
]);

// Public routes (no authentication required)
router.get('/', getEvents);
router.get('/organizer', protect, getOrganizerEvents);
router.get('/:id', getEvent);

// Protected routes (authentication required)
router.post('/', protect, checkEventLimit, uploadFields, createEvent);
router.put('/:id', protect, uploadFields, updateEvent);
router.delete('/:id', protect, deleteEvent);
router.get('/:eventId/analytics', protect, getEventAnalytics);
router.patch('/:id/status', protect, updateEventStatus);
module.exports = router;