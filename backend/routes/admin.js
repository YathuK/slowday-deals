const express = require('express');
const router = express.Router();
const https = require('https');
const http = require('http');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Service = require('../models/Service');
const Booking = require('../models/Booking');
const Lead = require('../models/Lead');
const Staff = require('../models/Staff');
const CallLog = require('../models/CallLog');
const EmailLog = require('../models/EmailLog');
const SupportTicket = require('../models/SupportTicket');
const { staffAuth, requireRole } = require('../middleware/adminAuth');
const sgMail = require('@sendgrid/mail');
if (process.env.SENDGRID_API_KEY) sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const ADMIN_URL = process.env.ADMIN_URL || 'https://www.slowdaydeals.com/admin';
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@slowdaydeals.com';

// Generate staff JWT
function generateStaffToken(staffId) {
    return jwt.sign({ staffId, type: 'staff' }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

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

    let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${apiKey}`;
    for (let page = 0; page < 3; page++) {
        const data = await gFetch(url);
        if (!['OK', 'ZERO_RESULTS'].includes(data.status)) {
            if (page === 0) throw new Error(`Places API: ${data.status} — ${data.error_message || ''}`);
            break;
        }
        places.push(...(data.results || []));
        if (!data.next_page_token) break;
        await sleep(2000);
        url = `https://maps.googleapis.com/maps/api/place/textsearch/json?pagetoken=${data.next_page_token}&key=${apiKey}`;
    }

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

// ══════════════════════════════════════════════════════════════════════════════
// STAFF AUTH ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// @route POST /api/admin/setup
// @desc  One-time super_admin account creation (only works if zero staff exist)
router.post('/setup', async (req, res) => {
    try {
        const count = await Staff.countDocuments();
        if (count > 0) {
            return res.status(400).json({ success: false, message: 'Setup already completed. Staff accounts exist.' });
        }
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: 'Name, email, and password are required.' });
        }
        if (password.length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
        }
        const staff = new Staff({ name, email, password, role: 'super_admin' });
        await staff.save();
        const token = generateStaffToken(staff._id);
        staff.lastLogin = new Date();
        await staff.save();
        res.status(201).json({ success: true, message: 'Super admin account created.', token, staff });
    } catch (err) {
        console.error('Setup error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// @route POST /api/admin/login
// @desc  Staff email/password login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required.' });
        }
        const staff = await Staff.findOne({ email: email.toLowerCase() });
        if (!staff || !staff.isActive) {
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }
        if (!staff.password) {
            return res.status(401).json({ success: false, message: 'Please accept your invite first to set a password.' });
        }
        const isMatch = await staff.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }
        staff.lastLogin = new Date();
        await staff.save();
        const token = generateStaffToken(staff._id);
        res.json({ success: true, token, staff });
    } catch (err) {
        console.error('Staff login error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// @route GET /api/admin/me
// @desc  Get current staff profile
router.get('/me', staffAuth, (req, res) => {
    if (req.staff.legacy) {
        return res.json({ success: true, staff: { name: 'Admin', role: 'super_admin', legacy: true } });
    }
    res.json({ success: true, staff: req.staff });
});

// ══════════════════════════════════════════════════════════════════════════════
// EMPLOYEE MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════

// @route GET /api/admin/staff
// @desc  List all staff members
router.get('/staff', staffAuth, requireRole('admin'), async (req, res) => {
    try {
        const staff = await Staff.find().sort({ createdAt: 1 });
        res.json({ success: true, staff });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// @route POST /api/admin/staff/invite
// @desc  Invite a new employee via email
router.post('/staff/invite', staffAuth, requireRole('admin'), async (req, res) => {
    try {
        const { email, name, role } = req.body;
        if (!email || !name || !role) {
            return res.status(400).json({ success: false, message: 'Email, name, and role are required.' });
        }
        if (!['admin', 'sales', 'support'].includes(role)) {
            return res.status(400).json({ success: false, message: 'Invalid role. Must be admin, sales, or support.' });
        }
        // Only super_admin can invite admins
        if (role === 'admin' && req.staff.role !== 'super_admin') {
            return res.status(403).json({ success: false, message: 'Only the super admin can invite admin users.' });
        }
        const existing = await Staff.findOne({ email: email.toLowerCase() });
        if (existing) {
            return res.status(400).json({ success: false, message: 'A staff member with this email already exists.' });
        }

        const inviteToken = crypto.randomBytes(32).toString('hex');
        const staff = new Staff({
            name,
            email: email.toLowerCase(),
            role,
            inviteToken,
            inviteExpires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            invitedBy: req.staff._id || null
        });
        await staff.save();

        // Send invite email
        const inviteUrl = `${ADMIN_URL}?invite=${inviteToken}`;
        if (process.env.SENDGRID_API_KEY) {
            await sgMail.send({
                to: email,
                from: { email: FROM_EMAIL, name: 'SlowDay Deals' },
                subject: 'You\'re Invited to SlowDay Deals Back Office',
                html: `
<div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
    <div style="text-align:center;margin-bottom:24px;">
        <div style="background:linear-gradient(135deg,#667eea,#764ba2);width:56px;height:56px;border-radius:14px;display:inline-flex;align-items:center;justify-content:center;font-size:28px;">⚡</div>
    </div>
    <h2 style="color:#1a1a2e;margin-bottom:8px;">You're Invited!</h2>
    <p style="color:#666;line-height:1.6;margin-bottom:24px;">Hi ${name}, you've been invited to join the SlowDay Deals back office as <strong>${role}</strong>. Click the button below to set your password and get started.</p>
    <a href="${inviteUrl}" style="display:block;text-align:center;background:linear-gradient(135deg,#667eea,#764ba2);color:white;padding:14px 24px;border-radius:12px;text-decoration:none;font-weight:700;font-size:16px;margin-bottom:24px;">Accept Invite</a>
    <p style="color:#999;font-size:13px;text-align:center;">This invite expires in <strong>7 days</strong>.</p>
    <hr style="border:none;border-top:1px solid #f0f0f0;margin:24px 0;">
    <p style="color:#bbb;font-size:12px;text-align:center;">SlowDay Deals</p>
</div>`
            });
        }

        res.status(201).json({ success: true, message: `Invite sent to ${email}`, staff });
    } catch (err) {
        console.error('Invite error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// @route POST /api/admin/staff/accept-invite
// @desc  Accept invite and set password (public — no auth required)
router.post('/staff/accept-invite', async (req, res) => {
    try {
        const { token, password } = req.body;
        if (!token || !password) {
            return res.status(400).json({ success: false, message: 'Token and password are required.' });
        }
        if (password.length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
        }
        const staff = await Staff.findOne({
            inviteToken: token,
            inviteExpires: { $gt: new Date() }
        });
        if (!staff) {
            return res.status(400).json({ success: false, message: 'Invalid or expired invite link.' });
        }
        staff.password = password;
        staff.inviteToken = null;
        staff.inviteExpires = null;
        staff.lastLogin = new Date();
        await staff.save();

        const jwtToken = generateStaffToken(staff._id);
        res.json({ success: true, message: 'Account activated!', token: jwtToken, staff });
    } catch (err) {
        console.error('Accept invite error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// @route PUT /api/admin/staff/:id
// @desc  Update staff role
router.put('/staff/:id', staffAuth, requireRole('admin'), async (req, res) => {
    try {
        const target = await Staff.findById(req.params.id);
        if (!target) return res.status(404).json({ success: false, message: 'Staff not found' });
        if (target.role === 'super_admin') {
            return res.status(403).json({ success: false, message: 'Cannot modify the super admin.' });
        }
        // Only super_admin can change roles
        if (req.staff.role !== 'super_admin') {
            return res.status(403).json({ success: false, message: 'Only the super admin can change roles.' });
        }
        const { role } = req.body;
        if (role && ['admin', 'sales', 'support'].includes(role)) {
            target.role = role;
        }
        await target.save();
        res.json({ success: true, staff: target });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// @route DELETE /api/admin/staff/:id
// @desc  Deactivate/remove staff member
router.delete('/staff/:id', staffAuth, requireRole('admin'), async (req, res) => {
    try {
        const target = await Staff.findById(req.params.id);
        if (!target) return res.status(404).json({ success: false, message: 'Staff not found' });
        if (target.role === 'super_admin') {
            return res.status(403).json({ success: false, message: 'Cannot remove the super admin.' });
        }
        // Admin can only remove sales/support, not other admins
        if (req.staff.role === 'admin' && target.role === 'admin') {
            return res.status(403).json({ success: false, message: 'Admins cannot remove other admins.' });
        }
        await Staff.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Staff member removed.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// ANALYTICS (existing)
// ══════════════════════════════════════════════════════════════════════════════

// @route GET /api/admin/analytics
// @desc  Full analytics for back office
router.get('/analytics', staffAuth, async (req, res) => {
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

// ══════════════════════════════════════════════════════════════════════════════
// LEAD FINDER (existing + enhancements)
// ══════════════════════════════════════════════════════════════════════════════

// @route GET /api/admin/leads
// @desc  Google Places lead finder
router.get('/leads', staffAuth, requireRole('admin', 'sales'), async (req, res) => {
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
router.post('/leads/save', staffAuth, requireRole('admin', 'sales'), async (req, res) => {
    const { leads, city } = req.body;
    if (!Array.isArray(leads) || !leads.length) {
        return res.status(400).json({ success: false, message: 'leads array is required' });
    }
    try {
        const docs = leads.map(l => ({
            businessName:  l.businessName  || '',
            contactName:   l.contactName   || '',
            phone:         l.phone         || '',
            email:         l.email         || '',
            address:       l.address       || '',
            website:       l.website       || '',
            serviceType:   l.serviceType   || '',
            city:          l.city          || city || '',
            status:        l.status        || 'new',
            price:         l.price         ?? null,
            discountPrice: l.discountPrice ?? null,
            days:          l.days          || [],
            notes:         l.notes         || ''
        }));
        const saved = await Lead.insertMany(docs);
        res.json({ success: true, saved: saved.length });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// @route POST /api/admin/leads/scrape-emails
router.post('/leads/scrape-emails', staffAuth, requireRole('admin', 'sales'), async (req, res) => {
    const { websites } = req.body;
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
router.get('/leads/saved', staffAuth, requireRole('admin', 'sales'), async (req, res) => {
    try {
        const filter = {};
        if (req.query.status)      filter.status      = req.query.status;
        if (req.query.city)        filter.city        = new RegExp(req.query.city, 'i');
        if (req.query.serviceType) filter.serviceType = req.query.serviceType;
        if (req.query.assignee)    filter.assignee    = req.query.assignee;
        const leads = await Lead.find(filter).populate('assignee', 'name email').sort({ createdAt: -1 });
        res.json({ success: true, total: leads.length, leads });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// @route PATCH /api/admin/leads/saved/:id
router.patch('/leads/saved/:id', staffAuth, requireRole('admin', 'sales'), async (req, res) => {
    try {
        const { status, contactName, email, phone, city, serviceType, notes, price, discountPrice, days, assignee, description, photos } = req.body;
        const update = {};
        if (status        !== undefined) update.status        = status;
        if (contactName   !== undefined) update.contactName   = contactName;
        if (email         !== undefined) update.email         = email;
        if (phone         !== undefined) update.phone         = phone;
        if (city          !== undefined) update.city          = city;
        if (serviceType   !== undefined) update.serviceType   = serviceType;
        if (notes         !== undefined) update.notes         = notes;
        if (price         !== undefined) update.price         = price;
        if (discountPrice !== undefined) update.discountPrice = discountPrice;
        if (days          !== undefined) update.days          = days;
        if (assignee      !== undefined) update.assignee      = assignee || null;
        if (description   !== undefined) update.description   = description;
        if (photos        !== undefined) {
            if (!Array.isArray(photos) || photos.length > 6) {
                return res.status(400).json({ success: false, message: 'Max 6 photos allowed.' });
            }
            update.photos = photos;
        }
        const lead = await Lead.findByIdAndUpdate(req.params.id, update, { new: true }).populate('assignee', 'name email');
        if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
        res.json({ success: true, lead });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// @route DELETE /api/admin/leads/saved/:id
router.delete('/leads/saved/:id', staffAuth, requireRole('admin', 'sales'), async (req, res) => {
    try {
        const lead = await Lead.findByIdAndDelete(req.params.id);
        if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// CALL LOGS
// ══════════════════════════════════════════════════════════════════════════════

// @route POST /api/admin/call-logs
// @desc  Log a call for a lead
router.post('/call-logs', staffAuth, requireRole('admin', 'sales'), async (req, res) => {
    try {
        const { leadId, startedAt, duration, notes, twilioCallSid, status } = req.body;
        if (!leadId) return res.status(400).json({ success: false, message: 'leadId is required' });
        const lead = await Lead.findById(leadId);
        if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

        const log = await CallLog.create({
            lead: leadId,
            caller: req.staff._id,
            callerName: req.staff.name || 'Admin',
            startedAt: startedAt || new Date(),
            duration: duration || 0,
            notes: notes || '',
            twilioCallSid: twilioCallSid || null,
            status: status || 'completed'
        });
        res.status(201).json({ success: true, callLog: log });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// @route PATCH /api/admin/call-logs/:id
// @desc  Update call log (notes, duration, status)
router.patch('/call-logs/:id', staffAuth, requireRole('admin', 'sales'), async (req, res) => {
    try {
        const { notes, duration, status, twilioCallSid } = req.body;
        const update = {};
        if (notes !== undefined) update.notes = notes;
        if (duration !== undefined) update.duration = duration;
        if (status !== undefined) update.status = status;
        if (twilioCallSid !== undefined) update.twilioCallSid = twilioCallSid;
        const log = await CallLog.findByIdAndUpdate(req.params.id, update, { new: true });
        if (!log) return res.status(404).json({ success: false, message: 'Call log not found' });
        res.json({ success: true, callLog: log });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// @route GET /api/admin/call-logs/:leadId
// @desc  Get call history for a lead
router.get('/call-logs/:leadId', staffAuth, requireRole('admin', 'sales'), async (req, res) => {
    try {
        const logs = await CallLog.find({ lead: req.params.leadId }).sort({ startedAt: -1 });
        res.json({ success: true, callLogs: logs });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── Email Logs ──────────────────────────────────────────────────────────────

// @route POST /api/admin/email-logs
// @desc  Send email to a lead and log it
router.post('/email-logs', staffAuth, requireRole('admin', 'sales'), async (req, res) => {
    try {
        const { leadId, to, subject, body } = req.body;
        if (!leadId || !to || !subject || !body) {
            return res.status(400).json({ success: false, message: 'leadId, to, subject, and body are required.' });
        }
        const lead = await Lead.findById(leadId);
        if (!lead) return res.status(404).json({ success: false, message: 'Lead not found.' });

        let status = 'sent';
        if (process.env.SENDGRID_API_KEY) {
            try {
                await sgMail.send({
                    to,
                    from: FROM_EMAIL,
                    subject,
                    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
${body.replace(/\n/g, '<br>')}
<hr style="border:none;border-top:1px solid #f0f0f0;margin:32px 0 16px;">
<p style="color:#bbb;font-size:12px;text-align:center;">SlowDay Deals</p>
</div>`
                });
            } catch (emailErr) {
                console.error('SendGrid error:', emailErr);
                status = 'failed';
            }
        } else {
            console.warn('SENDGRID_API_KEY not set — email not actually sent');
        }

        const log = await EmailLog.create({
            lead: leadId,
            sender: req.staff._id,
            senderName: req.staff.name || 'Admin',
            to,
            subject,
            body,
            sentAt: new Date(),
            status
        });

        if (status === 'failed') {
            return res.status(500).json({ success: false, message: 'Email failed to send.', emailLog: log });
        }
        res.status(201).json({ success: true, emailLog: log });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// @route GET /api/admin/email-logs/:leadId
// @desc  Get email history for a lead
router.get('/email-logs/:leadId', staffAuth, requireRole('admin', 'sales'), async (req, res) => {
    try {
        const logs = await EmailLog.find({ lead: req.params.leadId }).sort({ sentAt: -1 });
        res.json({ success: true, emailLogs: logs });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// TWILIO VOICE (BROWSER CALLING)
// ══════════════════════════════════════════════════════════════════════════════

// @route GET /api/admin/voice/token
// @desc  Generate Twilio Access Token for browser calling
router.get('/voice/token', staffAuth, requireRole('admin', 'sales'), (req, res) => {
    try {
        const AccessToken = require('twilio').jwt.AccessToken;
        const VoiceGrant = AccessToken.VoiceGrant;

        if (!process.env.TWILIO_API_KEY_SID || !process.env.TWILIO_API_KEY_SECRET || !process.env.TWILIO_TWIML_APP_SID) {
            return res.status(500).json({ success: false, message: 'Voice calling not configured. Set TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, and TWILIO_TWIML_APP_SID.' });
        }

        const token = new AccessToken(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_API_KEY_SID,
            process.env.TWILIO_API_KEY_SECRET,
            { identity: req.staff._id?.toString() || 'admin', ttl: 3600 }
        );

        const voiceGrant = new VoiceGrant({
            outgoingApplicationSid: process.env.TWILIO_TWIML_APP_SID,
            incomingAllow: false
        });
        token.addGrant(voiceGrant);

        res.json({ success: true, token: token.toJwt(), identity: req.staff._id?.toString() || 'admin' });
    } catch (err) {
        console.error('Voice token error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// @route POST /api/admin/voice/twiml
// @desc  TwiML instructions for outgoing calls (called by Twilio, NOT by browser)
router.post('/voice/twiml', (req, res) => {
    const VoiceResponse = require('twilio').twiml.VoiceResponse;
    const twiml = new VoiceResponse();

    const to = req.body.To;
    if (to && /^\+?[\d]+$/.test(to)) {
        const dial = twiml.dial({ callerId: process.env.TWILIO_PHONE_NUMBER, timeout: 30 });
        dial.number(to.startsWith('+') ? to : `+1${to}`);
    } else {
        twiml.say('No phone number provided. Goodbye.');
    }

    res.type('text/xml');
    res.send(twiml.toString());
});

// @route POST /api/admin/voice/status
// @desc  Twilio posts call status updates here
router.post('/voice/status', async (req, res) => {
    try {
        const { CallSid, CallStatus, CallDuration } = req.body;
        if (CallSid && ['completed', 'failed', 'no-answer', 'busy', 'canceled'].includes(CallStatus)) {
            await CallLog.findOneAndUpdate(
                { twilioCallSid: CallSid },
                { duration: parseInt(CallDuration) || 0, status: CallStatus }
            );
        }
    } catch (err) {
        console.error('Voice status webhook error:', err);
    }
    res.sendStatus(200);
});

// ══════════════════════════════════════════════════════════════════════════════
// SUPPORT TICKET MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════

// @route GET /api/admin/support/tickets
// @desc  List all support tickets
router.get('/support/tickets', staffAuth, requireRole('admin', 'support'), async (req, res) => {
    try {
        const filter = {};
        if (req.query.status) filter.status = req.query.status;
        const tickets = await SupportTicket.find(filter)
            .populate('assignedTo', 'name email')
            .sort({ createdAt: -1 });
        res.json({ success: true, total: tickets.length, tickets });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// @route PATCH /api/admin/support/tickets/:id
// @desc  Update ticket status or assignee
router.patch('/support/tickets/:id', staffAuth, requireRole('admin', 'support'), async (req, res) => {
    try {
        const { status, assignedTo } = req.body;
        const update = {};
        if (status !== undefined) update.status = status;
        if (assignedTo !== undefined) update.assignedTo = assignedTo || null;
        const ticket = await SupportTicket.findByIdAndUpdate(req.params.id, update, { new: true })
            .populate('assignedTo', 'name email');
        if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
        res.json({ success: true, ticket });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// @route POST /api/admin/support/tickets/:id/reply
// @desc  Add a reply to a support ticket and notify customer via email
router.post('/support/tickets/:id/reply', staffAuth, requireRole('admin', 'support'), async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) return res.status(400).json({ success: false, message: 'Message is required.' });

        const ticket = await SupportTicket.findById(req.params.id);
        if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

        ticket.replies.push({
            staffId: req.staff._id,
            staffName: req.staff.name || 'Support',
            message,
            createdAt: new Date()
        });
        if (ticket.status === 'open') ticket.status = 'in_progress';
        await ticket.save();

        // Email the customer
        if (process.env.SENDGRID_API_KEY && ticket.userEmail) {
            try {
                await sgMail.send({
                    to: ticket.userEmail,
                    from: { email: FROM_EMAIL, name: 'SlowDay Deals Support' },
                    subject: `Re: ${ticket.subject} — Ticket #${ticket._id.toString().slice(-8).toUpperCase()}`,
                    html: `
<div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
    <div style="text-align:center;margin-bottom:24px;">
        <div style="background:linear-gradient(135deg,#667eea,#764ba2);width:56px;height:56px;border-radius:14px;display:inline-flex;align-items:center;justify-content:center;font-size:28px;">⚡</div>
    </div>
    <h2 style="color:#1a1a2e;margin-bottom:8px;">Update on Your Ticket</h2>
    <p style="color:#666;line-height:1.6;">Hi ${ticket.userName}, our team has responded to your support ticket:</p>
    <div style="background:#f8f9ff;border-left:4px solid #667eea;padding:16px;border-radius:8px;margin:20px 0;">
        <p style="color:#333;line-height:1.6;margin:0;">${message.replace(/\n/g, '<br>')}</p>
    </div>
    <p style="color:#999;font-size:13px;">Ticket #${ticket._id.toString().slice(-8).toUpperCase()} — ${ticket.subject}</p>
    <hr style="border:none;border-top:1px solid #f0f0f0;margin:24px 0;">
    <p style="color:#bbb;font-size:12px;text-align:center;">SlowDay Deals</p>
</div>`
                });
            } catch (emailErr) {
                console.error('Failed to send reply email:', emailErr);
            }
        }

        const updated = await SupportTicket.findById(req.params.id).populate('assignedTo', 'name email');
        res.json({ success: true, ticket: updated });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── Create Provider Profile from Lead ────────────────────────────────────────

const SERVICE_TYPE_MAP = {
    'Cleaning Service': 'Cleaning',
    'Nail Service': 'Nails',
    'Spa Treatment': 'Spa'
};

router.post('/leads/:id/create-profile', staffAuth, requireRole('admin', 'sales'), async (req, res) => {
    try {
        const lead = await Lead.findById(req.params.id);
        if (!lead) return res.status(404).json({ success: false, message: 'Lead not found.' });

        // Validate minimum data
        const missing = [];
        if (!lead.businessName) missing.push('Business Name');
        if (!lead.serviceType) missing.push('Service Type');
        if (!lead.description || lead.description.length < 10) missing.push('Description (min 10 chars)');
        if (!lead.city) missing.push('City');
        if (!lead.phone && !lead.email) missing.push('Phone or Email');
        if (lead.discountPrice == null) missing.push('Deal Price');
        if (missing.length) {
            return res.status(400).json({ success: false, message: `Missing required fields: ${missing.join(', ')}` });
        }

        // Check for existing user with same email
        if (lead.email) {
            const existing = await User.findOne({ email: lead.email.toLowerCase() });
            if (existing) {
                return res.status(400).json({ success: false, message: 'A user with this email already exists.' });
            }
        }

        // Create provider user (no password — will be set up via token link)
        const setupToken = crypto.randomBytes(32).toString('hex');
        const user = new User({
            name: lead.contactName || lead.businessName,
            email: lead.email ? lead.email.toLowerCase() : undefined,
            phone: lead.phone || undefined,
            accountType: 'provider',
            providerSetupToken: setupToken,
            providerSetupExpires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
        });
        await user.save();

        // Map lead service type to Service enum
        const mappedType = SERVICE_TYPE_MAP[lead.serviceType] || lead.serviceType;
        const validTypes = ['Haircut', 'Barber', 'Cleaning', 'Massage', 'Nails', 'Spa',
            'Personal Training', 'Dog Walking', 'Tutoring', 'Photography',
            'Car Detailing', 'Laundry Service', 'Other'];
        const serviceType = validTypes.includes(mappedType) ? mappedType : 'Other';

        // Determine weekday/weekend pricing from lead's days
        const days = lead.days || [];
        const hasWeekday = days.some(d => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(d));
        const hasWeekend = days.some(d => ['Sat', 'Sun'].includes(d));
        const dealPrice = lead.discountPrice;
        const normalPrice = lead.price || dealPrice;

        try {
            const service = new Service({
                provider: user._id,
                providerName: lead.businessName,
                serviceType,
                description: lead.description,
                location: lead.city,
                contact: lead.phone || lead.email,
                email: lead.email || '',
                normalPrice,
                weekdayPrice: hasWeekday ? dealPrice : dealPrice,
                weekendPrice: hasWeekend ? dealPrice : dealPrice,
                photos: lead.photos || [],
                dealActive: false,
                isActive: true
            });
            await service.save();
        } catch (serviceErr) {
            // Rollback: delete the user if service creation fails
            await User.findByIdAndDelete(user._id);
            throw serviceErr;
        }

        // Update lead status to 'live'
        lead.status = 'live';
        await lead.save();

        // Send setup email
        const FRONTEND_URL = process.env.FRONTEND_URL || 'https://www.slowdaydeals.com';
        const setupUrl = `${FRONTEND_URL}?setupProvider=${setupToken}`;
        if (process.env.SENDGRID_API_KEY && lead.email) {
            try {
                await sgMail.send({
                    to: lead.email,
                    from: FROM_EMAIL,
                    subject: 'Your SlowDay Deals profile is ready!',
                    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:32px;">
    <h2 style="margin:0 0 16px;">Welcome to SlowDay Deals!</h2>
    <p>Hi ${lead.contactName || lead.businessName},</p>
    <p>Your business profile for <strong>${lead.businessName}</strong> has been created on SlowDay Deals.</p>
    <p>Click the button below to set up your account and manage your deal:</p>
    <a href="${setupUrl}" style="display:inline-block;background:#6c5ce7;color:#fff;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:600;margin:16px 0;">Set Up My Account</a>
    <p style="color:#999;font-size:13px;margin-top:24px;">This link expires in 30 days. If you didn't expect this email, you can safely ignore it.</p>
    <hr style="border:none;border-top:1px solid #f0f0f0;margin:24px 0;">
    <p style="color:#bbb;font-size:12px;text-align:center;">SlowDay Deals</p>
</div>`
                });
            } catch (emailErr) {
                console.error('Failed to send provider setup email:', emailErr);
            }
        }

        res.json({ success: true, message: 'Provider profile created successfully.' });
    } catch (err) {
        console.error('Create profile error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
