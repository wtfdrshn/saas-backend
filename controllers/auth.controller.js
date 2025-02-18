const User = require('../models/User');
const Organizer = require('../models/Organizer');
const jwt = require('jsonwebtoken');
const { sendEmail } = require('../services/email.service');
const crypto = require('crypto');

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const authController = {
  // User Registration
  async registerUser(req, res) {
    try {
      const { name, email, password } = req.body;
      
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'Email already registered' });
      }

      const user = new User({
        name,
        email,
        password
      });

      await user.save();
      
      const token = jwt.sign(
        { id: user._id, role: 'user' },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
      );

      res.status(201).json({
        message: 'User registered successfully',
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email
        }
      });
    } catch (error) {
      res.status(500).json({ message: 'Registration failed', error: error.message });
    }
  },

  // Organizer Registration
  async registerOrganizer(req, res) {
    try {
      const { name, email, password, organizationName } = req.body;
      
      const existingOrganizer = await Organizer.findOne({ email });
      if (existingOrganizer) {
        return res.status(400).json({ message: 'Email already registered' });
      }

      const organizer = new Organizer({
        name,
        email,
        password,
        organizationName
      });

      await organizer.save();
      
      res.status(201).json({
        message: 'Organizer registered successfully. Please verify your email to login.',
        organizer: {
          id: organizer._id,
          name: organizer.name,
          email: organizer.email,
          organizationName: organizer.organizationName
        }
      });
    } catch (error) {
      res.status(500).json({ message: 'Registration failed', error: error.message });
    }
  },

  // User Login
  async loginUser(req, res) {
    try {
      const { email, password } = req.body;
      
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { 
          id: user._id,
          role: user.role,
          organizationId: user.organizationId
        },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
      );

      res.json({
        message: 'Login successful',
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          organizationId: user.organizationId
        }
      });
    } catch (error) {
      res.status(500).json({ message: 'Login failed', error: error.message });
    }
  },

  // Organizer Login
  async loginOrganizer(req, res) {
    try {
      const { email, password } = req.body;
      
      const organizer = await Organizer.findOne({ email });
      if (!organizer) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const isPasswordValid = await organizer.comparePassword(password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Generate OTP
      const otp = generateOTP();
      organizer.otpSecret = otp;
      organizer.otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      await organizer.save();

      // Send OTP email
      await sendEmail({
        to: organizer.email,
        subject: 'Login OTP',
        text: `Your OTP for login is: ${otp}. This OTP will expire in 10 minutes.`
      });

      res.json({
        message: 'OTP sent to your email',
        email: organizer.email
      });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: 'Login failed', error: error.message });
    }
  },

  // Verify Organizer OTP
  async verifyOrganizerOTP(req, res) {
    try {
      const { email, otp } = req.body;
      
      const organizer = await Organizer.findOne({ email });
      if (!organizer) {
        return res.status(404).json({ message: 'Organizer not found' });
      }

      if (organizer.otpSecret !== otp) {
        return res.status(401).json({ message: 'Invalid OTP' });
      }

      if (new Date() > organizer.otpExpiry) {
        return res.status(401).json({ message: 'OTP expired' });
      }

      // Clear OTP
      organizer.otpSecret = null;
      organizer.otpExpiry = null;
      await organizer.save();

      const token = jwt.sign(
        { id: organizer._id, role: 'organizer' },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
      );

      res.json({
        message: 'Login successful',
        token,
        organizer: {
          id: organizer._id,
          name: organizer.name,
          email: organizer.email,
          organizationName: organizer.organizationName,
          role: 'organizer'
        }
      });
    } catch (error) {
      res.status(500).json({ message: 'Verification failed', error: error.message });
    }
  }
};

module.exports = authController; 