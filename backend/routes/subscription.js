const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');
const Subscription = require('../models/Subscription');
const { auth } = require('../middleware/auth');

const PRICE_ID = process.env.STRIPE_PRICE_ID || 'price_placeholder'; // $4.99/mo price ID from Stripe
const APP_URL = process.env.FRONTEND_URL || 'https://www.slowdaydeals.com';

// GET /api/subscription/status - Get current user's subscription status
router.get('/status', auth, async (req, res) => {
    try {
        const sub = await Subscription.findOne({ user: req.user._id });
        if (!sub || sub.status === 'none') {
            return res.json({ success: true, status: 'none', isPlus: false });
        }
        // Check if trial/subscription is still valid
        const now = new Date();
        let isPlus = false;
        if (sub.status === 'trialing' && sub.trialEnds && sub.trialEnds > now) isPlus = true;
        if (sub.status === 'active' && sub.currentPeriodEnd && sub.currentPeriodEnd > now) isPlus = true;
        res.json({
            success: true,
            status: sub.status,
            isPlus,
            trialEnds: sub.trialEnds,
            currentPeriodEnd: sub.currentPeriodEnd,
            cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        });
    } catch (err) {
        console.error('Subscription status error:', err);
        res.status(500).json({ success: false, message: 'Error fetching subscription status' });
    }
});

// POST /api/subscription/checkout - Create Stripe checkout session
router.post('/checkout', auth, async (req, res) => {
    try {
        if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_placeholder') {
            return res.status(503).json({ success: false, message: 'Payment system not configured yet. Please add your Stripe keys.' });
        }

        // Check if user already has active sub
        const existing = await Subscription.findOne({ user: req.user._id });
        if (existing && ['trialing', 'active'].includes(existing.status)) {
            return res.status(400).json({ success: false, message: 'You already have an active SlowDay+ subscription.' });
        }

        // Create or retrieve Stripe customer
        let customerId = existing?.stripeCustomerId;
        if (!customerId) {
            const customer = await stripe.customers.create({
                email: req.user.email,
                name: req.user.name,
                metadata: { userId: req.user._id.toString() }
            });
            customerId = customer.id;
        }

        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            mode: 'subscription',
            line_items: [{ price: PRICE_ID, quantity: 1 }],
            subscription_data: {
                trial_period_days: 14,
                metadata: { userId: req.user._id.toString() }
            },
            success_url: `${APP_URL}?subscription=success`,
            cancel_url: `${APP_URL}?subscription=cancelled`,
        });

        // Save customer ID ahead of webhook
        await Subscription.findOneAndUpdate(
            { user: req.user._id },
            { user: req.user._id, stripeCustomerId: customerId, status: 'none' },
            { upsert: true, new: true }
        );

        res.json({ success: true, url: session.url });
    } catch (err) {
        console.error('Checkout error:', err);
        res.status(500).json({ success: false, message: err.message || 'Failed to create checkout session' });
    }
});

// POST /api/subscription/cancel - Cancel at period end
router.post('/cancel', auth, async (req, res) => {
    try {
        const sub = await Subscription.findOne({ user: req.user._id });
        if (!sub || !sub.stripeSubscriptionId) {
            return res.status(404).json({ success: false, message: 'No active subscription found.' });
        }
        if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_placeholder') {
            // Dev mode: just mark cancelled
            await Subscription.findOneAndUpdate({ user: req.user._id }, { status: 'cancelled', cancelAtPeriodEnd: true });
            return res.json({ success: true, message: 'Subscription cancelled.' });
        }
        await stripe.subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: true });
        await Subscription.findOneAndUpdate({ user: req.user._id }, { cancelAtPeriodEnd: true });
        res.json({ success: true, message: 'Subscription will cancel at end of billing period.' });
    } catch (err) {
        console.error('Cancel error:', err);
        res.status(500).json({ success: false, message: 'Failed to cancel subscription' });
    }
});

// POST /api/subscription/webhook - Stripe webhook
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET || '');
    } catch (err) {
        console.error('Webhook signature error:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        switch (event.type) {
            case 'customer.subscription.created':
            case 'customer.subscription.updated': {
                const stripeSub = event.data.object;
                const userId = stripeSub.metadata?.userId;
                if (!userId) break;
                const trialEnd = stripeSub.trial_end ? new Date(stripeSub.trial_end * 1000) : null;
                const periodEnd = new Date(stripeSub.current_period_end * 1000);
                const status = stripeSub.status === 'trialing' ? 'trialing'
                    : stripeSub.status === 'active' ? 'active'
                    : stripeSub.status === 'canceled' ? 'cancelled' : 'expired';
                await Subscription.findOneAndUpdate(
                    { user: userId },
                    {
                        stripeSubscriptionId: stripeSub.id,
                        status,
                        trialEnds: trialEnd,
                        currentPeriodEnd: periodEnd,
                        cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
                    },
                    { upsert: true }
                );
                break;
            }
            case 'customer.subscription.deleted': {
                const stripeSub = event.data.object;
                const userId = stripeSub.metadata?.userId;
                if (userId) {
                    await Subscription.findOneAndUpdate({ user: userId }, { status: 'expired', cancelAtPeriodEnd: false });
                }
                break;
            }
        }
        res.json({ received: true });
    } catch (err) {
        console.error('Webhook handler error:', err);
        res.status(500).json({ error: 'Webhook handler failed' });
    }
});

module.exports = router;
