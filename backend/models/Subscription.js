const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    stripeCustomerId: { type: String, default: null },
    stripeSubscriptionId: { type: String, default: null },
    status: {
        type: String,
        enum: ['trialing', 'active', 'cancelled', 'expired', 'none'],
        default: 'none'
    },
    trialStarted: { type: Date, default: null },
    trialEnds: { type: Date, default: null },
    currentPeriodEnd: { type: Date, default: null },
    cancelAtPeriodEnd: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Subscription', subscriptionSchema);
