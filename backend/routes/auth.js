const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const sgMail = require('@sendgrid/mail');
if (process.env.SENDGRID_API_KEY) sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Generate JWT token
const generateToken = (userId) => {
    return jwt.sign({ userId }, process.env.JWT_SECRET, {
        expiresIn: '30d'
    });
};

// @route   POST /api/auth/signup
// @desc    Register new user
// @access  Public
router.post('/signup', [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').optional({ checkFalsy: true }).isEmail().withMessage('Please enter a valid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('phone').trim().notEmpty().withMessage('Phone number is required'),
    body('accountType').isIn(['customer', 'provider']).withMessage('Invalid account type')
], async (req, res) => {
    try {
        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                success: false,
                message: 'Validation failed',
                errors: errors.array() 
            });
        }

        const { name, email, password, phone, accountType } = req.body;

        if (!email && !phone) {
            return res.status(400).json({ success: false, message: 'Email or phone number is required' });
        }

        // Check if user already exists by email or phone
        const query = [];
        if (email) query.push({ email: email.toLowerCase() });
        if (phone) query.push({ phone });
        const existingUser = query.length > 0 ? await User.findOne({ $or: query }) : null;
        if (existingUser) {
            return res.status(400).json({ 
                success: false,
                message: 'An account with this email or phone already exists' 
            });
        }

        // Create new user
        const user = new User({
            name,
            email,
            password,
            phone,
            accountType
        });

        await user.save();

        // Generate token
        const token = generateToken(user._id);

        res.status(201).json({
            success: true,
            message: 'Account created successfully',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                accountType: user.accountType
            }
        });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error creating account',
            error: error.message 
        });
    }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', [
    body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, message: 'Password is required' });
        }

        const { emailOrPhone, password } = req.body;
        if (!emailOrPhone) {
            return res.status(400).json({ success: false, message: 'Email or phone number is required' });
        }

        // Find user by email or phone
        const isEmail = emailOrPhone.includes('@');
        const user = await User.findOne(isEmail ? { email: emailOrPhone.toLowerCase() } : { phone: emailOrPhone });
        if (!user) {
            return res.status(401).json({ 
                success: false,
                message: 'Invalid email/phone or password' 
            });
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ 
                success: false,
                message: 'Invalid email or password' 
            });
        }

        // Generate token
        const token = generateToken(user._id);

        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                accountType: user.accountType
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error logging in',
            error: error.message 
        });
    }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', auth, async (req, res) => {
    try {
        res.json({
            success: true,
            user: req.user
        });
    } catch (error) {
        res.status(500).json({ 
            success: false,
            message: 'Error fetching user data',
            error: error.message 
        });
    }
});

// @route   POST /api/auth/forgot-password
// @desc    Send password reset email
// @access  Public
router.post('/forgot-password', async (req, res) => {
    try {
        const { emailOrPhone } = req.body;
        if (!emailOrPhone) return res.json({ success: true, message: 'If that account exists, a reset link has been sent.' });
        const isEmail = emailOrPhone.includes('@');
        const user = await User.findOne(isEmail ? { email: emailOrPhone.toLowerCase() } : { phone: emailOrPhone });

        // Always return success to prevent email enumeration
        if (!user) {
            return res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
        }

        // Generate secure reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

        // Save hashed token + expiry (1 hour) to user
        user.resetPasswordToken = resetTokenHash;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
        await user.save();

        // Build reset URL
        const resetUrl = `${process.env.FRONTEND_URL || 'https://www.slowdaydeals.com'}?resetToken=${resetToken}`;

        // Send email via SendGrid
        if (process.env.SENDGRID_API_KEY) {
            const msg = {
                to: user.email,
                from: process.env.FROM_EMAIL || 'notifications@slowdaydeals.com',
                subject: '🔑 Reset Your SlowDay Deals Password',
                html: `
                    <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
                        <div style="text-align:center;margin-bottom:24px;">
                            <div style="background:linear-gradient(135deg,#667eea,#764ba2);width:56px;height:56px;border-radius:14px;display:inline-flex;align-items:center;justify-content:center;font-size:28px;">⚡</div>
                        </div>
                        <h2 style="color:#1a1a2e;margin-bottom:8px;">Reset your password</h2>
                        <p style="color:#666;line-height:1.6;margin-bottom:24px;">Hi ${user.name}, we received a request to reset your SlowDay Deals password. Click the button below to choose a new one.</p>
                        <a href="${resetUrl}" style="display:block;text-align:center;background:linear-gradient(135deg,#667eea,#764ba2);color:white;padding:14px 24px;border-radius:12px;text-decoration:none;font-weight:700;font-size:16px;margin-bottom:24px;">Reset My Password</a>
                        <p style="color:#999;font-size:13px;text-align:center;">This link expires in <strong>1 hour</strong>. If you didn't request this, you can safely ignore this email.</p>
                        <hr style="border:none;border-top:1px solid #f0f0f0;margin:24px 0;">
                        <p style="color:#bbb;font-size:12px;text-align:center;">SlowDay Deals · slowdaydeals.com</p>
                    </div>
                `
            };
            await sgMail.send(msg);
        }

        res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ success: false, message: 'Error sending reset email.' });
    }
});

// @route   POST /api/auth/reset-password
// @desc    Reset password using token
// @access  Public
router.post('/reset-password', async (req, res) => {
    try {
        const { token, password } = req.body;
        if (!token || !password) {
            return res.status(400).json({ success: false, message: 'Token and password are required.' });
        }
        if (password.length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
        }

        // Hash the incoming token to compare with stored hash
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        const user = await User.findOne({
            resetPasswordToken: tokenHash,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ success: false, message: 'Reset link is invalid or has expired.' });
        }

        // Set new password (model will hash it via pre-save hook)
        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.json({ success: true, message: 'Password reset successfully.' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ success: false, message: 'Error resetting password.' });
    }
});

module.exports = router;
