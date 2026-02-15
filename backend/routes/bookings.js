const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Booking = require('../models/Booking');
const Service = require('../models/Service');
const { auth } = require('../middleware/auth');

// Helper to check if date is weekend
const isWeekend = (date) => {
    const day = new Date(date).getDay();
    return day === 0 || day === 6; // Sunday = 0, Saturday = 6
};

// @route   POST /api/bookings
// @desc    Create new booking
// @access  Private
router.post('/', [auth], [
    body('serviceId').notEmpty().withMessage('Service ID is required'),
    body('customerContact').trim().notEmpty().withMessage('Contact is required'),
    body('preferredTime').isISO8601().withMessage('Valid date/time is required'),
    body('notes').optional().trim()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                success: false,
                message: 'Validation failed',
                errors: errors.array() 
            });
        }

        const { serviceId, customerContact, preferredTime, notes } = req.body;

        // Find service
        const service = await Service.findById(serviceId).populate('provider');
        if (!service) {
            return res.status(404).json({ 
                success: false,
                message: 'Service not found' 
            });
        }

        // Determine price based on day
        const isWeekendBooking = isWeekend(preferredTime);
        const price = isWeekendBooking ? service.weekendPrice : service.weekdayPrice;

        // Create booking
        const booking = new Booking({
            customer: req.user._id,
            service: serviceId,
            provider: service.provider._id,
            customerName: req.user.name,
            customerContact,
            preferredTime,
            notes: notes || '',
            price,
            isWeekend: isWeekendBooking
        });

        await booking.save();

        // Populate booking details
        await booking.populate([
            { path: 'service', select: 'serviceType providerName location' },
            { path: 'provider', select: 'name email phone' }
        ]);

        res.status(201).json({
            success: true,
            message: 'Booking created successfully! The provider will contact you soon.',
            booking
        });
    } catch (error) {
        console.error('Create booking error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error creating booking',
            error: error.message 
        });
    }
});

// @route   GET /api/bookings/customer
// @desc    Get customer's bookings
// @access  Private
router.get('/customer', auth, async (req, res) => {
    try {
        const { status } = req.query;
        
        let query = { customer: req.user._id };
        if (status) query.status = status;

        const bookings = await Booking.find(query)
            .populate('service', 'serviceType providerName location photos')
            .populate('provider', 'name phone email')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            count: bookings.length,
            bookings
        });
    } catch (error) {
        console.error('Get customer bookings error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching bookings',
            error: error.message 
        });
    }
});

// @route   GET /api/bookings/provider
// @desc    Get provider's bookings
// @access  Private (Provider only)
router.get('/provider', auth, async (req, res) => {
    try {
        if (req.user.accountType !== 'provider') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Provider account required.'
            });
        }

        const { status } = req.query;
        
        let query = { provider: req.user._id };
        if (status) query.status = status;

        const bookings = await Booking.find(query)
            .populate('service', 'serviceType providerName location')
            .populate('customer', 'name phone email')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            count: bookings.length,
            bookings
        });
    } catch (error) {
        console.error('Get provider bookings error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching bookings',
            error: error.message 
        });
    }
});

// @route   GET /api/bookings/:id
// @desc    Get single booking
// @access  Private
router.get('/:id', auth, async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id)
            .populate('service')
            .populate('customer', 'name phone email')
            .populate('provider', 'name phone email');

        if (!booking) {
            return res.status(404).json({ 
                success: false,
                message: 'Booking not found' 
            });
        }

        // Check authorization
        if (booking.customer._id.toString() !== req.user._id.toString() && 
            booking.provider._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ 
                success: false,
                message: 'Not authorized to view this booking' 
            });
        }

        res.json({
            success: true,
            booking
        });
    } catch (error) {
        console.error('Get booking error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching booking',
            error: error.message 
        });
    }
});

// @route   PUT /api/bookings/:id/status
// @desc    Update booking status
// @access  Private (Provider only for their bookings, Customer for cancel)
router.put('/:id/status', auth, async (req, res) => {
    try {
        const { status } = req.body;

        if (!['pending', 'confirmed', 'completed', 'cancelled'].includes(status)) {
            return res.status(400).json({ 
                success: false,
                message: 'Invalid status' 
            });
        }

        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({ 
                success: false,
                message: 'Booking not found' 
            });
        }

        // Authorization check
        const isProvider = booking.provider.toString() === req.user._id.toString();
        const isCustomer = booking.customer.toString() === req.user._id.toString();

        if (!isProvider && !isCustomer) {
            return res.status(403).json({ 
                success: false,
                message: 'Not authorized to update this booking' 
            });
        }

        // Customers can only cancel their own bookings
        if (isCustomer && !isProvider && status !== 'cancelled') {
            return res.status(403).json({ 
                success: false,
                message: 'Customers can only cancel bookings' 
            });
        }

        booking.status = status;
        await booking.save();

        await booking.populate([
            { path: 'service', select: 'serviceType providerName' },
            { path: 'customer', select: 'name' },
            { path: 'provider', select: 'name' }
        ]);

        res.json({
            success: true,
            message: `Booking ${status} successfully`,
            booking
        });
    } catch (error) {
        console.error('Update booking status error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error updating booking',
            error: error.message 
        });
    }
});

// @route   GET /api/bookings/stats/dashboard
// @desc    Get booking statistics for provider dashboard
// @access  Private (Provider only)
router.get('/stats/dashboard', auth, async (req, res) => {
    try {
        if (req.user.accountType !== 'provider') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Provider account required.'
            });
        }

        const stats = await Booking.aggregate([
            { $match: { provider: req.user._id } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    totalRevenue: { $sum: '$price' }
                }
            }
        ]);

        const totalBookings = await Booking.countDocuments({ provider: req.user._id });
        const totalRevenue = await Booking.aggregate([
            { $match: { provider: req.user._id, status: { $in: ['confirmed', 'completed'] } } },
            { $group: { _id: null, total: { $sum: '$price' } } }
        ]);

        res.json({
            success: true,
            stats: {
                total: totalBookings,
                byStatus: stats,
                totalRevenue: totalRevenue[0]?.total || 0
            }
        });
    } catch (error) {
        console.error('Get booking stats error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching statistics',
            error: error.message 
        });
    }
});

module.exports = router;
