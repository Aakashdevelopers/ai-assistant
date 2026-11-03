const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'fitup-jwt-secret-key-change-in-prod!';
const DEFAULT_USER_ID = 'local-default-user-id';

/**
 * Express middleware to verify JWT token or inject local default user
 */
function authenticateUser(req, res, next) {
    // Check Authorization header or cookie
    const authHeader = req.headers.authorization;
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    } else if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
    }

    if (!token) {
        // For single-user / local development fallback
        req.user = { id: DEFAULT_USER_ID, username: 'local_user', email: 'user@local.fitup' };
        return next();
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        // If token expired or invalid, fallback to local default user for development
        req.user = { id: DEFAULT_USER_ID, username: 'local_user', email: 'user@local.fitup' };
        next();
    }
}

/**
 * Strict auth requirement
 */
function requireAuth(req, res, next) {
    if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Unauthorized. Authentication required.' });
    }
    next();
}

module.exports = {
    authenticateUser,
    requireAuth,
    JWT_SECRET,
    DEFAULT_USER_ID
};
