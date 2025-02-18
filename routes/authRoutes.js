const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

// http://localhost:5000/api/auth/register/user


router.post('/register/user', authController.registerUser);
router.post('/register/organizer', authController.registerOrganizer);
router.post('/login/user', authController.loginUser);
router.post('/login/organizer', authController.loginOrganizer);
router.post('/verify-otp', authController.verifyOrganizerOTP);

module.exports = router; 