const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const { auth } = require('../middleware/auth');

// @route   GET /api/leaderboard/savings
// @desc    Get customer savings leaderboard for percentile calculation
// @access  Private
router.get('/savings', auth, async (req, res) => {
    try {
        // Aggregate total savings per customer (confirmed bookings only)
        const leaderboard = await Booking.aggregate([
            { $match: { status: 'confirmed' } },
            { $group: {
                _id: '$customer',
                totalSaved: { $sum: '$savedAmount' }
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
            percentile = Math.round((1 - (userRank - 1) / totalCustomers) * 100);
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
