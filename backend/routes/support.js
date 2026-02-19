const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const SupportTicket = require('../models/SupportTicket');
const { auth } = require('../middleware/auth');
const sgMail = require('@sendgrid/mail');

if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const SUPPORT_EMAIL = 'support@slowdaydeals.com';
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@slowdaydeals.com';
const APP_URL = process.env.FRONTEND_URL || 'https://www.slowdaydeals.com';
const BACKEND_URL = process.env.BACKEND_URL || 'https://slowday-deals.onrender.com';

// POST /api/support - Create a support ticket
router.post('/', auth, async (req, res) => {
    try {
        const { subject, message } = req.body;
        if (!subject || !message) {
            return res.status(400).json({ success: false, message: 'Subject and message are required.' });
        }

        const resolveToken = crypto.randomBytes(32).toString('hex');

        const ticket = await SupportTicket.create({
            user: req.user._id,
            userName: req.user.name,
            userEmail: req.user.email,
            subject,
            message,
            resolveToken,
        });

        // Send email to support
        const resolveUrl = `${BACKEND_URL}/api/support/${ticket._id}/resolve?token=${resolveToken}`;

        const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;background:#f8f9ff;padding:24px;border-radius:16px;">
    <div style="background:linear-gradient(135deg,#667eea,#764ba2);padding:24px;border-radius:12px;text-align:center;margin-bottom:20px;">
        <h1 style="color:white;margin:0;font-size:22px;">⚡ SlowDay Deals</h1>
        <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:13px;">Support Ticket</p>
    </div>
    <div style="background:white;padding:24px;border-radius:12px;">
        <h2 style="color:#1a1a2e;margin:0 0 20px;">🎫 New Support Ticket</h2>
        <table style="width:100%;border-collapse:collapse;">
            <tr style="border-bottom:1px solid #f0f0f0;">
                <td style="padding:10px 0;color:#888;font-size:13px;width:35%;">Ticket ID</td>
                <td style="padding:10px 0;font-weight:600;color:#333;font-size:14px;">#${ticket._id.toString().slice(-8).toUpperCase()}</td>
            </tr>
            <tr style="border-bottom:1px solid #f0f0f0;">
                <td style="padding:10px 0;color:#888;font-size:13px;">Name</td>
                <td style="padding:10px 0;font-weight:600;color:#333;font-size:14px;">${req.user.name}</td>
            </tr>
            <tr style="border-bottom:1px solid #f0f0f0;">
                <td style="padding:10px 0;color:#888;font-size:13px;">Email</td>
                <td style="padding:10px 0;font-weight:600;color:#667eea;font-size:14px;">${req.user.email}</td>
            </tr>
            <tr style="border-bottom:1px solid #f0f0f0;">
                <td style="padding:10px 0;color:#888;font-size:13px;">Subject</td>
                <td style="padding:10px 0;font-weight:600;color:#333;font-size:14px;">${subject}</td>
            </tr>
            <tr>
                <td style="padding:10px 0;color:#888;font-size:13px;vertical-align:top;">Message</td>
                <td style="padding:10px 0;color:#333;font-size:14px;line-height:1.6;">${message.replace(/\n/g, '<br>')}</td>
            </tr>
        </table>
        <div style="text-align:center;margin-top:28px;">
            <a href="${resolveUrl}" style="display:inline-block;background:linear-gradient(135deg,#22c55e,#16a34a);color:white;text-decoration:none;padding:14px 32px;border-radius:25px;font-size:15px;font-weight:700;letter-spacing:0.3px;">
                ✅ Mark as Resolved
            </a>
            <p style="color:#aaa;font-size:12px;margin-top:12px;">Clicking this will remove the ticket from the user's account.</p>
        </div>
    </div>
    <p style="text-align:center;color:#aaa;font-size:12px;margin-top:16px;">SlowDay Deals • <a href="${APP_URL}" style="color:#667eea;text-decoration:none;">www.slowdaydeals.com</a></p>
</div>`;

        if (process.env.SENDGRID_API_KEY) {
            await sgMail.send({
                to: SUPPORT_EMAIL,
                from: { email: FROM_EMAIL, name: 'SlowDay Deals Support' },
                subject: `🎫 [Ticket #${ticket._id.toString().slice(-8).toUpperCase()}] ${subject}`,
                html,
            });
        }

        res.json({ success: true, message: 'Ticket submitted! We\'ll get back to you soon.', ticketId: ticket._id });
    } catch (err) {
        console.error('Support ticket error:', err);
        res.status(500).json({ success: false, message: 'Failed to submit ticket.' });
    }
});

// GET /api/support/my - Get current user's open tickets
router.get('/my', auth, async (req, res) => {
    try {
        const tickets = await SupportTicket.find({ user: req.user._id, status: 'open' }).sort({ createdAt: -1 });
        res.json({ success: true, tickets });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch tickets.' });
    }
});

// GET /api/support/:id/resolve?token=xxx - Resolve a ticket (called from email button)
router.get('/:id/resolve', async (req, res) => {
    try {
        const ticket = await SupportTicket.findById(req.params.id);
        if (!ticket) return res.status(404).send(resolvedPage('Ticket not found.', false));
        if (ticket.resolveToken !== req.query.token) return res.status(403).send(resolvedPage('Invalid resolve link.', false));
        if (ticket.status === 'resolved') return res.send(resolvedPage('This ticket was already resolved.', true));

        ticket.status = 'resolved';
        await ticket.save();

        res.send(resolvedPage(`Ticket #${ticket._id.toString().slice(-8).toUpperCase()} has been resolved. The user's account has been updated.`, true));
    } catch (err) {
        res.status(500).send(resolvedPage('Something went wrong.', false));
    }
});

function resolvedPage(message, success) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>SlowDay Support</title></head>
<body style="font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8f9ff;">
<div style="text-align:center;background:white;padding:40px;border-radius:20px;box-shadow:0 8px 40px rgba(0,0,0,0.1);max-width:400px;">
    <div style="font-size:56px;margin-bottom:16px;">${success ? '✅' : '❌'}</div>
    <h2 style="color:#1a1a2e;margin:0 0 12px;">SlowDay Deals Support</h2>
    <p style="color:#555;line-height:1.6;">${message}</p>
    <a href="https://www.slowdaydeals.com" style="display:inline-block;margin-top:20px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;text-decoration:none;padding:12px 24px;border-radius:25px;font-weight:600;">Back to App</a>
</div></body></html>`;
}

module.exports = router;
