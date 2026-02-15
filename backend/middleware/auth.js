const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
    try {
        // Get token from header
        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ 
                success: false,
                message: 'No authentication token, access denied' 
            });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Find user
        const user = await User.findById(decoded.userId).select('-password');
        
        if (!user) {
            return res.status(401).json({ 
                success: false,
                message: 'User not found' 
            });
        }

        // Attach user to request
        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ 
            success: false,
            message: 'Token is not valid',
            error: error.message
        });
    }
};

// Middleware to check if user is a provider
const isProvider = (req, res, next) => {
    if (req.user.accountType !== 'provider') {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Provider account required.'
        });
    }
    next();
};

module.exports = { auth, isProvider };
