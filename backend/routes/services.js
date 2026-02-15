const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Service = require('../models/Service');
const { auth, isProvider } = require('../middleware/auth');

// @route   GET /api/services
// @desc    Get all active services
// @access  Public
router.get('/', async (req, res) => {
    try {
        const { serviceType, location, minPrice, maxPrice } = req.query;
        
        let query = { isActive: true };
        
        if (serviceType) query.serviceType = serviceType;
        if (location) query.location = new RegExp(location, 'i');
        if (minPrice || maxPrice) {
            query.$or = [
                { weekdayPrice: { $gte: minPrice || 0, $lte: maxPrice || Infinity } },
                { weekendPrice: { $gte: minPrice || 0, $lte: maxPrice || Infinity } }
            ];
        }

        const services = await Service.find(query)
            .populate('provider', 'name email phone')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            count: services.length,
            services
        });
    } catch (error) {
        console.error('Get services error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching services',
            error: error.message 
        });
    }
});

// @route   GET /api/services/:id
// @desc    Get single service
// @access  Public
router.get('/:id', async (req, res) => {
    try {
        const service = await Service.findById(req.params.id)
            .populate('provider', 'name email phone');

        if (!service) {
            return res.status(404).json({ 
                success: false,
                message: 'Service not found' 
            });
        }

        res.json({
            success: true,
            service
        });
    } catch (error) {
        console.error('Get service error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching service',
            error: error.message 
        });
    }
});

// @route   POST /api/services
// @desc    Create new service
// @access  Private (Provider only)
router.post('/', [auth, isProvider], [
    body('providerName').trim().notEmpty().withMessage('Provider name is required'),
    body('serviceType').notEmpty().withMessage('Service type is required'),
    body('description').isLength({ min: 20 }).withMessage('Description must be at least 20 characters'),
    body('location').trim().notEmpty().withMessage('Location is required'),
    body('contact').trim().notEmpty().withMessage('Contact is required'),
    body('weekdayPrice').isFloat({ min: 0 }).withMessage('Valid weekday price is required'),
    body('weekendPrice').isFloat({ min: 0 }).withMessage('Valid weekend price is required')
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

        const { providerName, serviceType, description, location, contact, 
                weekdayPrice, weekendPrice, photos } = req.body;

        const service = new Service({
            provider: req.user._id,
            providerName,
            serviceType,
            description,
            location,
            contact,
            weekdayPrice,
            weekendPrice,
            photos: photos || []
        });

        await service.save();

        res.status(201).json({
            success: true,
            message: 'Service created successfully',
            service
        });
    } catch (error) {
        console.error('Create service error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error creating service',
            error: error.message 
        });
    }
});

// @route   PUT /api/services/:id
// @desc    Update service
// @access  Private (Provider only, own service)
router.put('/:id', [auth, isProvider], async (req, res) => {
    try {
        const service = await Service.findById(req.params.id);

        if (!service) {
            return res.status(404).json({ 
                success: false,
                message: 'Service not found' 
            });
        }

        // Check ownership
        if (service.provider.toString() !== req.user._id.toString()) {
            return res.status(403).json({ 
                success: false,
                message: 'Not authorized to update this service' 
            });
        }

        const updatedService = await Service.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true, runValidators: true }
        );

        res.json({
            success: true,
            message: 'Service updated successfully',
            service: updatedService
        });
    } catch (error) {
        console.error('Update service error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error updating service',
            error: error.message 
        });
    }
});

// @route   DELETE /api/services/:id
// @desc    Delete service
// @access  Private (Provider only, own service)
router.delete('/:id', [auth, isProvider], async (req, res) => {
    try {
        const service = await Service.findById(req.params.id);

        if (!service) {
            return res.status(404).json({ 
                success: false,
                message: 'Service not found' 
            });
        }

        // Check ownership
        if (service.provider.toString() !== req.user._id.toString()) {
            return res.status(403).json({ 
                success: false,
                message: 'Not authorized to delete this service' 
            });
        }

        await service.deleteOne();

        res.json({
            success: true,
            message: 'Service deleted successfully'
        });
    } catch (error) {
        console.error('Delete service error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error deleting service',
            error: error.message 
        });
    }
});

// @route   GET /api/services/provider/my-services
// @desc    Get provider's own services
// @access  Private (Provider only)
router.get('/provider/my-services', [auth, isProvider], async (req, res) => {
    try {
        const services = await Service.find({ provider: req.user._id })
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            count: services.length,
            services
        });
    } catch (error) {
        console.error('Get my services error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching services',
            error: error.message 
        });
    }
});

module.exports = router;
