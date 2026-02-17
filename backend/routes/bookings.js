const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Booking = require('../models/Booking');
const Service = require('../models/Service');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { notifyProviderNewBooking, notifyCustomerConfirmed, notifyCustomerRejected, notifyCustomerRescheduled } = require('../services/notifications');

const isWeekend = (date) => { const d = new Date(date).getDay(); return d === 0 || d === 6; };

router.post('/', auth, [
    body('serviceId').notEmpty(),
    body('customerContact').trim().notEmpty(),
    body('preferredTime').isISO8601()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ success: false, message: errors.array()[0].msg });
        const { serviceId, customerContact, preferredTime, notes } = req.body;
        const service = await Service.findById(serviceId);
        if (!service) return res.status(404).json({ success: false, message: 'Service not found' });

        // Check deal is still active
        if (!service.dealActive) {
            return res.status(400).json({ success: false, message: 'Sorry, this deal is no longer available.' });
        }

        const weekend = isWeekend(preferredTime);
        const price = weekend ? service.weekendPrice : service.weekdayPrice;

        // Check slots availability
        if (weekend) {
            if (service.weekendSlots !== null && service.weekendSlotsUsed >= service.weekendSlots) {
                return res.status(400).json({ success: false, message: 'Sorry, all weekend slots for this deal are taken.' });
            }
        } else {
            if (service.weekdaySlots !== null && service.weekdaySlotsUsed >= service.weekdaySlots) {
                return res.status(400).json({ success: false, message: 'Sorry, all weekday slots for this deal are taken.' });
            }
        }

        const booking = new Booking({
            customer: req.user._id,
            service: serviceId,
            provider: service.provider,
            customerName: req.user.name,
            customerContact,
            preferredTime,
            notes: notes || '',
            price,
            isWeekend: weekend,
            status: 'pending'
        });
        await booking.save();

        // Decrement slot count
        if (weekend) {
            if (service.weekendSlots !== null) {
                await Service.findByIdAndUpdate(serviceId, { $inc: { weekendSlotsUsed: 1 } });
            }
        } else {
            if (service.weekdaySlots !== null) {
                await Service.findByIdAndUpdate(serviceId, { $inc: { weekdaySlotsUsed: 1 } });
            }
        }

        notifyProviderNewBooking(booking, service, req.user).catch(console.error);
        res.status(201).json({ success: true, message: 'Booking sent! The provider will confirm soon.', booking });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error creating booking', error: error.message });
    }
});

router.get('/customer', auth, async (req, res) => {
    try {
        const bookings = await Booking.find({ customer: req.user._id })
            .populate('service', 'serviceType providerName location photos contact')
            .populate('provider', 'name phone email')
            .sort({ createdAt: -1 });
        res.json({ success: true, count: bookings.length, bookings });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching bookings', error: error.message });
    }
});

router.get('/provider', auth, async (req, res) => {
    try {
        const { status } = req.query;
        const uid = req.user._id;

        // Find all services owned by this user
        const myServices = await Service.find({ provider: uid }).select('_id');
        const myServiceIds = myServices.map(s => s._id);

        // Find bookings where provider = user OR service is owned by user
        let query = { $or: [{ provider: uid }, { service: { $in: myServiceIds } }] };
        if (status) query = { ...query, status };

        const bookings = await Booking.find(query)
            .populate('service', 'serviceType providerName location')
            .populate('customer', 'name phone email')
            .sort({ createdAt: -1 });

        res.json({ success: true, count: bookings.length, bookings });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching bookings', error: error.message });
    }
});

router.get('/analytics', auth, async (req, res) => {
    try {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfWeek = new Date(startOfDay); startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const uid = req.user._id;

        // Get all services owned by user
        const myServices = await Service.find({ provider: uid }).select('_id');
        const myServiceIds = myServices.map(s => s._id);
        const providerQuery = { $or: [{ provider: uid }, { service: { $in: myServiceIds } }] };

        const [daily, weekly, monthly, allTime] = await Promise.all([
            Booking.find({ ...providerQuery, createdAt: { $gte: startOfDay } }),
            Booking.find({ ...providerQuery, createdAt: { $gte: startOfWeek } }),
            Booking.find({ ...providerQuery, createdAt: { $gte: startOfMonth } }),
            Booking.find(providerQuery)
        ]);
        const earnings = (b) => b.filter(x => ['confirmed','completed'].includes(x.status)).reduce((s, x) => s + (x.price||0), 0);
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const day = new Date(startOfDay); day.setDate(day.getDate() - i);
            const next = new Date(day); next.setDate(day.getDate() + 1);
            const db = allTime.filter(b => new Date(b.createdAt) >= day && new Date(b.createdAt) < next);
            last7Days.push({ date: day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }), bookings: db.length, earnings: earnings(db) });
        }
        const byStatus = {};
        allTime.forEach(b => { byStatus[b.status] = (byStatus[b.status] || 0) + 1; });
        res.json({ success: true, analytics: {
            daily: { count: daily.length, earnings: earnings(daily) },
            weekly: { count: weekly.length, earnings: earnings(weekly) },
            monthly: { count: monthly.length, earnings: earnings(monthly) },
            allTime: { count: allTime.length, earnings: earnings(allTime) },
            byStatus, last7Days,
            pending: allTime.filter(b => b.status === 'pending').length
        }});
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching analytics', error: error.message });
    }
});

router.put('/:id/status', auth, async (req, res) => {
    try {
        const { status, newTime } = req.body;
        if (!['pending','confirmed','rescheduled','cancelled','rejected','completed'].includes(status))
            return res.status(400).json({ success: false, message: 'Invalid status' });
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

        const uid = req.user._id.toString();
        const isProvider = booking.provider?.toString() === uid;
        const isCustomer = booking.customer?.toString() === uid;

        // Also check if user owns the service directly (handles cases where provider field is set to user)
        const service = await Service.findById(booking.service);
        const isServiceOwner = service?.provider?.toString() === uid;

        const canActAsProvider = isProvider || isServiceOwner;

        if (!canActAsProvider && !isCustomer)
            return res.status(403).json({ success: false, message: 'Not authorized' });
        if (isCustomer && !canActAsProvider && status !== 'cancelled')
            return res.status(403).json({ success: false, message: 'Customers can only cancel bookings' });

        booking.status = status;
        if (status === 'rescheduled' && newTime) booking.preferredTime = new Date(newTime);
        await booking.save();

        const customer = await User.findById(booking.customer);
        if (service && customer) {
            if (status === 'confirmed') notifyCustomerConfirmed(booking, service, customer.email, customer.phone).catch(console.error);
            else if (['rejected','cancelled'].includes(status)) notifyCustomerRejected(booking, service, customer.email, customer.phone).catch(console.error);
            else if (status === 'rescheduled' && newTime) notifyCustomerRescheduled(booking, service, customer.email, customer.phone, newTime).catch(console.error);
        }
        await booking.populate([{ path: 'service', select: 'serviceType providerName location' }, { path: 'customer', select: 'name email phone' }]);
        res.json({ success: true, message: `Booking ${status}`, booking });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error updating booking', error: error.message });
    }
});

module.exports = router;
