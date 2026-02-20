const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Service = require('../models/Service');
const Booking = require('../models/Booking');

// Simple hardcoded admin auth - replace with env var in production
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'slowday-internal-2024';

// Admin auth middleware
const adminAuth = (req, res, next) => {
    const key = req.headers['x-admin-key'] || req.query.key;
    if (key !== ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    next();
};

// @route GET /api/admin/analytics
// @desc  Full analytics for back office
router.get('/analytics', adminAuth, async (req, res) => {
    try {
        const now = new Date();
        const startOfDay = new Date(now); startOfDay.setHours(0,0,0,0);
        const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - 7);
        const startOfMonth = new Date(now); startOfMonth.setDate(now.getDate() - 30);

        // --- USER STATS ---
        const totalUsers = await User.countDocuments();
        const totalCustomers = await User.countDocuments({ accountType: 'customer' });
        const totalProviders = await User.countDocuments({ accountType: 'provider' });

        const dau = await User.countDocuments({ updatedAt: { $gte: startOfDay } });
        const wau = await User.countDocuments({ updatedAt: { $gte: startOfWeek } });
        const mau = await User.countDocuments({ updatedAt: { $gte: startOfMonth } });

        const newUsersToday = await User.countDocuments({ createdAt: { $gte: startOfDay } });
        const newUsersWeek = await User.countDocuments({ createdAt: { $gte: startOfWeek } });
        const newUsersMonth = await User.countDocuments({ createdAt: { $gte: startOfMonth } });

        // --- SERVICE/DEAL STATS by category ---
        const services = await Service.find({ isActive: true }).lean();

        const categoryMap = {};
        for (const svc of services) {
            const cat = svc.serviceType || 'Other';
            if (!categoryMap[cat]) categoryMap[cat] = [];

            // Build availability slot rows
            const slots = [];
            if (svc.availabilityWindows && svc.availabilityWindows.length > 0) {
                for (const w of svc.availabilityWindows) {
                    const isWeekend = ['Saturday','Sunday'].includes(w.day);
                    const totalSlots = isWeekend ? svc.weekendSlots : svc.weekdaySlots;
                    const usedSlots = isWeekend ? svc.weekendSlotsUsed : svc.weekdaySlotsUsed;
                    slots.push({
                        day: w.day,
                        startTime: w.startTime,
                        endTime: w.endTime,
                        duration: w.sessionDuration,
                        totalSlots: totalSlots || '∞',
                        bookedSlots: usedSlots || 0,
                        remainingSlots: totalSlots ? Math.max(0, totalSlots - (usedSlots || 0)) : '∞',
                        price: isWeekend ? svc.weekendPrice : svc.weekdayPrice
                    });
                }
            } else {
                // No windows - show weekday/weekend summary
                slots.push({
                    day: 'Weekdays',
                    startTime: '-', endTime: '-', duration: '-',
                    totalSlots: svc.weekdaySlots || '∞',
                    bookedSlots: svc.weekdaySlotsUsed || 0,
                    remainingSlots: svc.weekdaySlots ? Math.max(0, svc.weekdaySlots - (svc.weekdaySlotsUsed || 0)) : '∞',
                    price: svc.weekdayPrice
                });
                slots.push({
                    day: 'Weekends',
                    startTime: '-', endTime: '-', duration: '-',
                    totalSlots: svc.weekendSlots || '∞',
                    bookedSlots: svc.weekendSlotsUsed || 0,
                    remainingSlots: svc.weekendSlots ? Math.max(0, svc.weekendSlots - (svc.weekendSlotsUsed || 0)) : '∞',
                    price: svc.weekendPrice
                });
            }

            categoryMap[cat].push({
                id: svc._id,
                providerName: svc.providerName,
                location: svc.location,
                dealActive: svc.dealActive,
                slots
            });
        }

        // --- BOOKING STATS ---
        const totalBookings = await Booking.countDocuments();
        const pendingBookings = await Booking.countDocuments({ status: 'pending' });
        const confirmedBookings = await Booking.countDocuments({ status: 'confirmed' });
        const completedBookings = await Booking.countDocuments({ status: 'completed' });
        const cancelledBookings = await Booking.countDocuments({ status: 'cancelled' });
        const bookingsToday = await Booking.countDocuments({ createdAt: { $gte: startOfDay } });
        const bookingsWeek = await Booking.countDocuments({ createdAt: { $gte: startOfWeek } });

        // Revenue stats
        const revenueData = await Booking.aggregate([
            { $match: { status: { $in: ['confirmed', 'completed'] } } },
            { $group: { _id: null, total: { $sum: '$price' }, totalSaved: { $sum: '$savedAmount' } } }
        ]);
        const totalRevenue = revenueData[0]?.total || 0;
        const totalSaved = revenueData[0]?.totalSaved || 0;

        res.json({
            success: true,
            generatedAt: now,
            users: { totalUsers, totalCustomers, totalProviders, dau, wau, mau, newUsersToday, newUsersWeek, newUsersMonth },
            services: { total: services.length, byCategory: categoryMap },
            bookings: { totalBookings, pendingBookings, confirmedBookings, completedBookings, cancelledBookings, bookingsToday, bookingsWeek, totalRevenue, totalSaved }
        });
    } catch (err) {
        console.error('Admin analytics error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
