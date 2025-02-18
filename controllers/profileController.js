const User = require('../models/User');
const Organizer = require('../models/Organizer');
const { uploadToCloudinary } = require('../utils/cloudinary');

// User Profile Controllers
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Error in getUserProfile:', error);
    res.status(500).json({ message: 'Error fetching user profile' });
  }
};

const updateUserProfile = async (req, res) => {
  try {
    const { name, email } = req.body;
    
    // Check if email is being changed and if it's already in use
    if (email !== req.user.email) {
      const emailExists = await User.findOne({ 
        email,
        _id: { $ne: req.user.id }
      });
      if (emailExists) {
        return res.status(400).json({ message: 'Email already in use' });
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { 
        name,
        email,
      },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error in updateUserProfile:', error);
    res.status(400).json({ message: error.message });
  }
};

// Organizer Profile Controllers
const getOrganizerProfile = async (req, res) => {
  try {
    const organizer = await Organizer.findById(req.user.id).select('-password -otpSecret -otpExpiry');
    if (!organizer) {
      return res.status(404).json({ message: 'Organizer not found' });
    }
    res.json(organizer);
  } catch (error) {
    console.error('Error in getOrganizerProfile:', error);
    res.status(500).json({ message: 'Error fetching organizer profile' });
  }
};

const updateOrganizerProfile = async (req, res) => {
  try {
    const { 
      name, 
      email, 
      organizationName, 
      description, 
      website, 
      socialMedia 
    } = req.body;

    // Check if email is being changed and if it's already in use
    if (email !== req.user.email) {
      const emailExists = await Organizer.findOne({ 
        email,
        _id: { $ne: req.user.id }
      });
      if (emailExists) {
        return res.status(400).json({ message: 'Email already in use' });
      }
    }

    const organizer = await Organizer.findByIdAndUpdate(
      req.user.id,
      {
        name,
        email,
        organizationName,
        description,
        website,
        socialMedia
      },
      { new: true, runValidators: true }
    ).select('-password -otpSecret -otpExpiry');

    if (!organizer) {
      return res.status(404).json({ message: 'Organizer not found' });
    }

    res.json(organizer);
  } catch (error) {
    console.error('Error in updateOrganizerProfile:', error);
    res.status(400).json({ message: error.message });
  }
};

// Common Profile Picture Upload Controller
const uploadProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Upload to Cloudinary
    const result = await uploadToCloudinary(req.file.path);
    
    // Update user/organizer profile picture
    const Model = req.user.role === 'organizer' ? Organizer : User;
    const profile = await Model.findByIdAndUpdate(
      req.user.id,
      { profilePicture: result.secure_url },
      { new: true }
    ).select('-password');

    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    res.json({ 
      message: 'Profile picture updated successfully',
      profilePicture: result.secure_url 
    });
  } catch (error) {
    console.error('Error in uploadProfilePicture:', error);
    res.status(400).json({ message: error.message });
  }
};

module.exports = {
  getUserProfile,
  updateUserProfile,
  getOrganizerProfile,
  updateOrganizerProfile,
  uploadProfilePicture
};
