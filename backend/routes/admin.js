const express = require('express');
const router = express.Router();
const https = require('https');
const http = require('http');
const User = require('../models/User');
const Service = require('../models/Service');
const Booking = require('../models/Booking');
const Lead = require('../models/Lead');

// ── Lead Finder helpers ──────────────────────────────────────────────────────

function gFetch(url) {
    return new Promise((resolve, reject) => {
        https.get(url, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
        }).on('error', reject);
    });
}

function fetchWebsite(rawUrl, redirectsLeft = 3) {
    return new Promise(resolve => {
        if (!rawUrl || redirectsLeft === 0) return resolve('');
        let url = rawUrl;
        if (!url.startsWith('http')) url = 'https://' + url;
        try {
            const mod = url.startsWith('https') ? https : http;
            const req = mod.get(url, { timeout: 5000, headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
                if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location) {
                    res.resume();
                    return fetchWebsite(res.headers.location, redirectsLeft - 1).then(resolve);
                }
                let d = '';
                res.on('data', c => { d += c; if (d.length > 100000) { res.destroy(); } });
                res.on('end', () => resolve(d));
                res.on('error', () => resolve(''));
            });
            req.setTimeout(5000, () => { req.destroy(); resolve(''); });
            req.on('error', () => resolve(''));
        } catch { resolve(''); }
    });
}

function extractEmail(html) {
    if (!html) return '';
    const matches = html.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [];
    return matches.find(e =>
        !e.match(/\.(png|jpg|jpeg|gif|svg|webp|css|js|woff|ttf)$/i) &&
        !e.includes('example.') && !e.includes('sentry') &&
        !e.includes('wixpress') && !e.includes('@2x') &&
        !e.includes('youremail') && e.length < 80
    ) || '';
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getPlaceLeads(industry, city, apiKey) {
    const query = encodeURIComponent(`${industry} in ${city}`);
    const places = [];

    // Paginate through up to 3 pages (max 60 results from Google)
    let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${apiKey}`;
    for (let page = 0; page < 3; page++) {
        const data = await gFetch(url);
        if (!['OK', 'ZERO_RESULTS'].includes(data.status)) {
            if (page === 0) throw new Error(`Places API: ${data.status} — ${data.error_message || ''}`);
            break;
        }
        places.push(...(data.results || []));
        if (!data.next_page_token) break;
        // Google requires a short delay before the next_page_token becomes valid
        await sleep(2000);
        url = `https://maps.googleapis.com/maps/api/place/textsearch/json?pagetoken=${data.next_page_token}&key=${apiKey}`;
    }

    // Fetch all place details in parallel — no website scraping here
    const leads = await Promise.all(places.map(async place => {
        try {
            const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_address,formatted_phone_number,website&key=${apiKey}`;
            const detail = await gFetch(detailUrl);
            const r = detail.result || {};
            return {
                businessName: r.name || place.name || '',
                contactName: '',
                phone: r.formatted_phone_number || '',
                email: '',
                address: r.formatted_address || place.formatted_address || '',
                website: r.website || '',
                serviceType: industry
            };
        } catch {
            return {
                businessName: place.name || '',
                contactName: '', phone: '', email: '',
                address: place.formatted_address || '',
                website: '', serviceType: industry
            };
        }
    }));

    return leads;
}

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

// @route GET /api/admin/leads
// @desc  Google Places lead finder — returns businesses by city + industries
router.get('/leads', adminAuth, async (req, res) => {
    const { city, industries } = req.query;
    if (!city) return res.status(400).json({ success: false, message: 'city is required' });
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) return res.status(500).json({ success: false, message: 'GOOGLE_PLACES_API_KEY is not set in .env' });

    const industryList = Array.isArray(industries) ? industries : (industries ? [industries] : []);
    if (!industryList.length) return res.status(400).json({ success: false, message: 'at least one industry is required' });

    try {
        const allLeads = [];
        for (const industry of industryList) {
            const leads = await getPlaceLeads(industry, city.trim(), apiKey);
            allLeads.push(...leads);
        }
        res.json({ success: true, total: allLeads.length, leads: allLeads });
    } catch (err) {
        console.error('Lead finder error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// @route POST /api/admin/leads/save
// @desc  Persist search results to the Lead CRM
router.post('/leads/save', adminAuth, async (req, res) => {
    const { leads, city } = req.body;
    if (!Array.isArray(leads) || !leads.length) {
        return res.status(400).json({ success: false, message: 'leads array is required' });
    }
    try {
        const docs = leads.map(l => ({
            businessName: l.businessName || '',
            contactName:  l.contactName  || '',
            phone:        l.phone        || '',
            email:        l.email        || '',
            address:      l.address      || '',
            website:      l.website      || '',
            serviceType:  l.serviceType  || '',
            city:         city           || '',
            status: 'new'
        }));
        const saved = await Lead.insertMany(docs);
        res.json({ success: true, saved: saved.length });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// @route POST /api/admin/leads/scrape-emails
// @desc  Scrape emails from an array of websites — called separately after search
router.post('/leads/scrape-emails', adminAuth, async (req, res) => {
    const { websites } = req.body; // array of URL strings, one per lead
    if (!Array.isArray(websites)) {
        return res.status(400).json({ success: false, message: 'websites array is required' });
    }
    const emails = await Promise.all(
        websites.map(async url => {
            if (!url) return '';
            try {
                const html = await fetchWebsite(url);
                return extractEmail(html);
            } catch { return ''; }
        })
    );
    res.json({ success: true, emails });
});

// @route GET /api/admin/leads/saved
// @desc  Fetch all saved leads (optional query filters: status, city, serviceType)
router.get('/leads/saved', adminAuth, async (req, res) => {
    try {
        const filter = {};
        if (req.query.status)      filter.status      = req.query.status;
        if (req.query.city)        filter.city        = new RegExp(req.query.city, 'i');
        if (req.query.serviceType) filter.serviceType = req.query.serviceType;
        const leads = await Lead.find(filter).sort({ createdAt: -1 });
        res.json({ success: true, total: leads.length, leads });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// @route PATCH /api/admin/leads/saved/:id
// @desc  Update status, contactName, or notes on a saved lead
router.patch('/leads/saved/:id', adminAuth, async (req, res) => {
    try {
        const { status, contactName, email, notes } = req.body;
        const update = {};
        if (status      !== undefined) update.status      = status;
        if (contactName !== undefined) update.contactName = contactName;
        if (email       !== undefined) update.email       = email;
        if (notes       !== undefined) update.notes       = notes;
        const lead = await Lead.findByIdAndUpdate(req.params.id, update, { new: true });
        if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
        res.json({ success: true, lead });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// @route DELETE /api/admin/leads/saved/:id
// @desc  Delete a saved lead
router.delete('/leads/saved/:id', adminAuth, async (req, res) => {
    try {
        const lead = await Lead.findByIdAndDelete(req.params.id);
        if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
