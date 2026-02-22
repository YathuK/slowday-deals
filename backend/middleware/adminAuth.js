const jwt = require('jsonwebtoken');
const Staff = require('../models/Staff');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'slowday-internal-2024';

const staffAuth = async (req, res, next) => {
    try {
        // Try JWT first
        const authHeader = req.header('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.replace('Bearer ', '');
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (decoded.type === 'staff' && decoded.staffId) {
                const staff = await Staff.findById(decoded.staffId);
                if (staff && staff.isActive) {
                    req.staff = staff;
                    return next();
                }
            }
        }

        // Fallback: legacy x-admin-key header (transition period)
        const key = req.headers['x-admin-key'] || req.query.key;
        if (key === ADMIN_PASSWORD) {
            // Create a pseudo-staff object for legacy auth
            req.staff = { _id: null, role: 'super_admin', name: 'Legacy Admin', legacy: true };
            return next();
        }

        return res.status(401).json({ success: false, message: 'Unauthorized' });
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }
};

const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.staff) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }
        // super_admin always passes
        if (req.staff.role === 'super_admin') return next();
        if (roles.includes(req.staff.role)) return next();
        return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    };
};

module.exports = { staffAuth, requireRole };
