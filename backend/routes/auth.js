const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const sgMail = require('@sendgrid/mail');
if (process.env.SENDGRID_API_KEY) sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const { OAuth2Client } = require('google-auth-library');
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Generate JWT token
const generateToken = (userId) => {
    return jwt.sign({ userId }, process.env.JWT_SECRET, {
        expiresIn: '30d'
    });
};

// Shared SSO user resolution: find-or-create user, link social IDs
async function findOrCreateSSOUser({ email, name, socialIdField, socialIdValue, avatar }) {
    // 1. Check if user exists by social ID (returning SSO user)
    let user = await User.findOne({ [socialIdField]: socialIdValue });
    if (user) {
        user.lastLogin = new Date();
        await user.save();
        return user;
    }

    // 2. Check if user exists by email (account linking)
    if (email) {
        user = await User.findOne({ email: email.toLowerCase() });
        if (user) {
            user[socialIdField] = socialIdValue;
            if (!user.avatar && avatar) user.avatar = avatar;
            user.lastLogin = new Date();
            await user.save();
            return user;
        }
    }

    // 3. New user — create account
    user = new User({
        name: name || 'SlowDay User',
        email: email ? email.toLowerCase() : undefined,
        [socialIdField]: socialIdValue,
        accountType: 'customer',
        authProvider: socialIdField === 'googleId' ? 'google' : 'facebook',
        avatar: avatar || null,
        isVerified: true,
        lastLogin: new Date()
    });

    try {
        await user.save();
    } catch (err) {
        if (err.code === 11000) {
            // Race condition — another request just created this user
            user = await User.findOne({ [socialIdField]: socialIdValue });
            if (user) return user;
        }
        throw err;
    }
    return user;
}

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
                accountType: user.accountType,
                authProvider: user.authProvider || 'local'
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

        // SSO-only users have no password — they must use Google/Facebook
        if (!user.password) {
            return res.status(401).json({
                success: false,
                message: 'This account uses social sign-in. Please use Google or Facebook to log in.'
            });
        }

        // Check password — use direct bcrypt.compare for safety
        const isMatch = await bcrypt.compare(password, user.password);
        console.log('[login] User:', user.email, '| Match:', isMatch, '| Hash prefix:', user.password?.substring(0, 10), '| Hash len:', user.password?.length, '| PW len received:', password?.length);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Track last login
        user.lastLogin = new Date();
        await user.save();

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
                accountType: user.accountType,
                authProvider: user.authProvider || 'local'
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

        // Save hashed token + expiry (1 hour) — use updateOne to avoid triggering pre-save hook
        await User.updateOne({ _id: user._id }, {
            $set: { resetPasswordToken: resetTokenHash, resetPasswordExpires: Date.now() + 3600000 }
        });

        // Build reset URL
        const resetUrl = `${process.env.FRONTEND_URL || 'https://www.slowdaydeals.com'}?resetToken=${resetToken}`;

        // Send email via SendGrid
        if (!process.env.SENDGRID_API_KEY) {
            console.error('[forgot-password] SENDGRID_API_KEY is not set — cannot send reset email to', user.email);
            return res.status(500).json({ success: false, message: 'Email service not configured. Please contact support.' });
        }

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
        try {
            await sgMail.send(msg);
            console.log('[forgot-password] Reset email sent to', user.email);
        } catch (sendErr) {
            console.error('[forgot-password] SendGrid error:', sendErr.response?.body || sendErr.message);
            return res.status(500).json({ success: false, message: 'Failed to send reset email. Please try again later.' });
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

        // Hash password manually and use updateOne to bypass pre-save hook entirely
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        await User.updateOne({ _id: user._id }, {
            $set: { password: hashedPassword },
            $unset: { resetPasswordToken: 1, resetPasswordExpires: 1 }
        });

        // Verify the password was saved correctly by re-reading from DB
        const verify = await User.findById(user._id);
        const verifyMatch = await bcrypt.compare(password, verify.password);
        console.log('[reset-password] Verified:', verifyMatch, '| Hash prefix:', verify.password?.substring(0, 10), '| Hash len:', verify.password?.length);

        if (!verifyMatch) {
            return res.status(500).json({ success: false, message: 'Password save verification failed. Please try again.' });
        }

        // Auto-login: return JWT so user doesn't have to log in manually
        const autoToken = generateToken(user._id);
        res.json({
            success: true,
            message: 'Password reset successfully.',
            token: autoToken,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                accountType: user.accountType,
                authProvider: user.authProvider || 'local'
            },
            _build: 'v98'
        });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ success: false, message: 'Error resetting password.' });
    }
});

// @route   POST /api/auth/google
// @desc    Sign in / sign up with Google
// @access  Public
router.post('/google', async (req, res) => {
    try {
        const { idToken } = req.body;
        if (!idToken) {
            return res.status(400).json({ success: false, message: 'Google ID token is required' });
        }

        // Verify the Google ID token
        const ticket = await googleClient.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID
        });
        const payload = ticket.getPayload();
        const { sub: googleId, email, name, picture } = payload;

        if (!googleId) {
            return res.status(400).json({ success: false, message: 'Invalid Google token' });
        }

        const user = await findOrCreateSSOUser({
            email,
            name,
            socialIdField: 'googleId',
            socialIdValue: googleId,
            avatar: picture
        });

        const token = generateToken(user._id);

        res.json({
            success: true,
            message: 'Google sign-in successful',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                accountType: user.accountType,
                authProvider: user.authProvider || 'google'
            }
        });
    } catch (error) {
        console.error('Google auth error:', error);
        if (error.message?.includes('Token used too late') || error.message?.includes('Invalid token')) {
            return res.status(401).json({ success: false, message: 'Google token expired or invalid. Please try again.' });
        }
        res.status(500).json({ success: false, message: 'Google sign-in failed', error: error.message });
    }
});

// @route   POST /api/auth/facebook
// @desc    Sign in / sign up with Facebook
// @access  Public
router.post('/facebook', async (req, res) => {
    try {
        const { accessToken } = req.body;
        if (!accessToken) {
            return res.status(400).json({ success: false, message: 'Facebook access token is required' });
        }

        // Verify the Facebook access token by calling the Graph API
        const fbResponse = await fetch(
            `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${accessToken}`
        );
        const fbData = await fbResponse.json();

        if (fbData.error) {
            console.error('Facebook token verification failed:', fbData.error);
            return res.status(401).json({ success: false, message: 'Invalid Facebook token' });
        }

        const { id: facebookId, name, email, picture } = fbData;
        const avatar = picture?.data?.url || null;

        if (!facebookId) {
            return res.status(400).json({ success: false, message: 'Could not retrieve Facebook user info' });
        }

        const user = await findOrCreateSSOUser({
            email,
            name,
            socialIdField: 'facebookId',
            socialIdValue: facebookId,
            avatar
        });

        const token = generateToken(user._id);

        res.json({
            success: true,
            message: 'Facebook sign-in successful',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                accountType: user.accountType,
                authProvider: user.authProvider || 'facebook'
            }
        });
    } catch (error) {
        console.error('Facebook auth error:', error);
        res.status(500).json({ success: false, message: 'Facebook sign-in failed', error: error.message });
    }
});

// ── Provider Setup (from admin-created profile) ────────────────────────────

// Verify setup token — called when provider lands on ?setupProvider=TOKEN
router.get('/verify-setup-token', async (req, res) => {
    try {
        const { token } = req.query;
        if (!token) return res.status(400).json({ success: false, message: 'Token required.' });

        const user = await User.findOne({
            providerSetupToken: token,
            providerSetupExpires: { $gt: new Date() }
        });
        if (!user) return res.status(400).json({ success: false, message: 'Invalid or expired setup link.' });

        res.json({ success: true, name: user.name, email: user.email || '' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Complete setup — provider sets password or uses SSO
router.post('/setup-provider', async (req, res) => {
    try {
        const { token, password } = req.body;
        if (!token) return res.status(400).json({ success: false, message: 'Token required.' });

        const user = await User.findOne({
            providerSetupToken: token,
            providerSetupExpires: { $gt: new Date() }
        });
        if (!user) return res.status(400).json({ success: false, message: 'Invalid or expired setup link.' });

        if (password) {
            if (password.length < 6) {
                return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
            }
            user.password = password;
        }

        user.providerSetupToken = null;
        user.providerSetupExpires = null;
        user.lastLogin = new Date();
        await user.save();

        const jwtToken = generateToken(user._id);
        res.json({
            success: true,
            token: jwtToken,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                accountType: user.accountType,
                authProvider: user.authProvider
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
