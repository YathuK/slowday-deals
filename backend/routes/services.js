const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Service = require('../models/Service');
const { auth } = require('../middleware/auth');

// @route   GET /api/services
// @desc    Get all active services
// @access  Public
router.get('/', async (req, res) => {
    try {
        const { serviceType, location, minPrice, maxPrice } = req.query;
        let query = { isActive: true };
        if (serviceType) query.serviceType = serviceType;
        if (location) query.location = new RegExp(location, 'i');

        const services = await Service.find(query).sort({ createdAt: -1 });

        res.json({ success: true, count: services.length, services });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching services', error: error.message });
    }
});

// @route   GET /api/services/provider/my-services
// @desc    Get provider's own services
// @access  Private
router.get('/provider/my-services', auth, async (req, res) => {
    try {
        const services = await Service.find({ provider: req.user._id }).sort({ createdAt: -1 });
        res.json({ success: true, count: services.length, services });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching services', error: error.message });
    }
});

// @route   GET /api/services/:id
// @desc    Get single service
// @access  Public
router.get('/:id', async (req, res) => {
    try {
        const service = await Service.findById(req.params.id);
        if (!service) return res.status(404).json({ success: false, message: 'Service not found' });
        res.json({ success: true, service });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching service', error: error.message });
    }
});

// @route   POST /api/services
// @desc    Create new service - ANY logged in user can create
// @access  Private (any logged in user)
router.post('/', auth, [
    body('providerName').trim().notEmpty().withMessage('Provider name is required'),
    body('serviceType').notEmpty().withMessage('Service type is required'),
    body('description').isLength({ min: 10 }).withMessage('Description must be at least 10 characters'),
    body('location').trim().notEmpty().withMessage('Location is required'),
    body('contact').trim().notEmpty().withMessage('Contact is required'),
    body('weekdayPrice').isFloat({ min: 0 }).withMessage('Valid weekday price is required'),
    body('weekendPrice').isFloat({ min: 0 }).withMessage('Valid weekend price is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
        }

        const {
            providerName, serviceType, description, location, contact, email,
            weekdayPrice, weekendPrice, normalPrice,
            weekdaySlots, weekendSlots,
            dealActive, availabilityWindows, photos,
            instagram, tiktok, facebook
        } = req.body;

        const service = new Service({
            provider: req.user._id,
            providerName,
            serviceType,
            description,
            location,
            contact,
            email: email || req.user.email,
            instagram: instagram || '',
            tiktok: tiktok || '',
            facebook: facebook || '',
            weekdayPrice,
            weekendPrice,
            normalPrice: normalPrice || null,
            weekdaySlots: weekdaySlots || null,
            weekendSlots: weekendSlots || null,
            dealActive: dealActive !== undefined ? dealActive : true,
            availabilityWindows: availabilityWindows || [],
            photos: photos || []
        });

        await service.save();

        // Also update user's accountType to provider
        req.user.accountType = 'provider';
        await req.user.save();

        res.status(201).json({ success: true, message: 'Service created successfully!', service });
    } catch (error) {
        console.error('Create service error:', error);
        res.status(500).json({ success: false, message: 'Error creating service', error: error.message });
    }
});

// @route   PUT /api/services/:id
// @desc    Update service
// @access  Private (owner only)
router.put('/:id', auth, async (req, res) => {
    try {
        const service = await Service.findById(req.params.id);
        if (!service) return res.status(404).json({ success: false, message: 'Service not found' });
        if (service.provider && service.provider.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        const updated = await Service.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        res.json({ success: true, message: 'Service updated', service: updated });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error updating service', error: error.message });
    }
});

// @route   DELETE /api/services/:id
// @desc    Delete service
// @access  Private (owner only)
router.delete('/:id', auth, async (req, res) => {
    try {
        const service = await Service.findById(req.params.id);
        if (!service) return res.status(404).json({ success: false, message: 'Service not found' });
        if (service.provider && service.provider.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        await service.deleteOne();
        req.user.accountType = 'customer';
        await req.user.save();
        res.json({ success: true, message: 'Service deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error deleting service', error: error.message });
    }
});

module.exports = router;
