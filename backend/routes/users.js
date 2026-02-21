const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Service = require('../models/Service');
const { auth } = require('../middleware/auth');

// @route   GET /api/users/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .populate('savedServices');

        res.json({
            success: true,
            user
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching profile',
            error: error.message 
        });
    }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', auth, async (req, res) => {
    try {
        const { name, phone, avatar } = req.body;

        const updateData = {};
        if (name) updateData.name = name;
        if (phone) updateData.phone = phone;
        if (avatar) updateData.avatar = avatar;

        const user = await User.findByIdAndUpdate(
            req.user._id,
            { $set: updateData },
            { new: true, runValidators: true }
        ).select('-password');

        res.json({
            success: true,
            message: 'Profile updated successfully',
            user
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error updating profile',
            error: error.message 
        });
    }
});

// @route   POST /api/users/saved-services/:serviceId
// @desc    Save a service
// @access  Private
router.post('/saved-services/:serviceId', auth, async (req, res) => {
    try {
        const service = await Service.findById(req.params.serviceId);

        if (!service) {
            return res.status(404).json({ 
                success: false,
                message: 'Service not found' 
            });
        }

        const user = await User.findById(req.user._id);

        // Check if already saved
        if (user.savedServices.includes(req.params.serviceId)) {
            return res.status(400).json({ 
                success: false,
                message: 'Service already saved' 
            });
        }

        user.savedServices.push(req.params.serviceId);
        await user.save();

        res.json({
            success: true,
            message: 'Service saved successfully',
            savedServices: user.savedServices
        });
    } catch (error) {
        console.error('Save service error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error saving service',
            error: error.message 
        });
    }
});

// @route   DELETE /api/users/saved-services/:serviceId
// @desc    Remove saved service
// @access  Private
router.delete('/saved-services/:serviceId', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        user.savedServices = user.savedServices.filter(
            id => id.toString() !== req.params.serviceId
        );

        await user.save();

        res.json({
            success: true,
            message: 'Service removed from saved',
            savedServices: user.savedServices
        });
    } catch (error) {
        console.error('Remove saved service error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error removing service',
            error: error.message 
        });
    }
});

// @route   GET /api/users/saved-services
// @desc    Get all saved services
// @access  Private
router.get('/saved-services', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .populate({
                path: 'savedServices',
                match: { isActive: true }
            });

        res.json({
            success: true,
            count: user.savedServices.length,
            services: user.savedServices
        });
    } catch (error) {
        console.error('Get saved services error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching saved services',
            error: error.message 
        });
    }
});

// @route   PUT /api/users/password
// @desc    Change password
// @access  Private
router.put('/password', auth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'Both fields required' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
        }
        const bcrypt = require('bcryptjs');
        const user = await User.findById(req.user._id);
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Current password is incorrect' });
        }
        user.password = newPassword;
        await user.save();
        res.json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error changing password', error: error.message });
    }
});

// @route   DELETE /api/users/account
// @desc    Delete account
// @access  Private
router.delete('/account', auth, async (req, res) => {
    try {
        const Booking = require('../models/Booking');
        // Delete all user data
        await Booking.deleteMany({ customer: req.user._id });
        await Service.deleteMany({ provider: req.user._id });
        await User.findByIdAndDelete(req.user._id);
        res.json({ success: true, message: 'Account deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error deleting account', error: error.message });
    }
});

module.exports = router;
