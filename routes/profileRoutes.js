const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const multer = require('multer');
const { 
  getUserProfile, 
  updateUserProfile,
  getOrganizerProfile,
  updateOrganizerProfile,
  uploadProfilePicture 
} = require('../controllers/profileController');

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Not an image! Please upload an image.'), false);
    }
  },
});

// User profile routes
router.get('/user', protect, getUserProfile);
router.put('/user', protect, updateUserProfile);

// Organizer profile routes
router.get('/organizer', protect, getOrganizerProfile);
router.put('/organizer', protect, updateOrganizerProfile);

// Common route for profile picture upload
router.post('/upload-picture', protect, upload.single('profilePicture'), uploadProfilePicture);

module.exports = router; 