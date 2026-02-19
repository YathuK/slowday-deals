const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const { auth } = require('../middleware/auth');

// @route   GET /api/leaderboard/savings
// @desc    Get customer savings leaderboard for percentile calculation
// @access  Private
router.get('/savings', auth, async (req, res) => {
    try {
        // Aggregate total spent at deal prices per customer
        // Sum 'price' (the deal price paid) across confirmed AND rescheduled bookings
        const leaderboard = await Booking.aggregate([
            { $match: { status: { $in: ['confirmed', 'rescheduled', 'completed'] } } },
            { $group: {
                _id: '$customer',
                totalSaved: { $sum: '$price' }
            }},
            { $sort: { totalSaved: -1 } }
        ]);

        // Find current user's rank
        const userSavings = leaderboard.find(entry => entry._id.toString() === req.user._id.toString());
        const userTotal = userSavings ? userSavings.totalSaved : 0;
        const userRank = leaderboard.findIndex(entry => entry._id.toString() === req.user._id.toString()) + 1;
        const totalCustomers = leaderboard.length;

        let percentile = 0;
        if (userRank > 0 && totalCustomers > 0) {
            // If rank 1 out of 10 → (10-1+1)/10 = 100th percentile → top 0% (but we show "top 1%")
            // If rank 5 out of 10 → (10-5+1)/10 = 60th percentile → top 40%
            percentile = Math.round((totalCustomers - userRank + 1) / totalCustomers * 100);
        }

        res.json({
            success: true,
            totalSaved: userTotal,
            rank: userRank,
            totalCustomers,
            percentile
        });
    } catch (error) {
        console.error('Leaderboard error:', error);
        res.status(500).json({ success: false, message: 'Error fetching leaderboard' });
    }
});

module.exports = router;
