const rateLimit = require('express-rate-limit');

// General API rate limiter
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300, // limit each IP to 300 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests from this IP, please try again after 15 minutes.' }
});

// Chat completion rate limiter
const chatLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60, // limit to 60 chat requests per minute per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Rate limit exceeded for chat messages. Please slow down.' }
});

module.exports = {
    apiLimiter,
    chatLimiter
};
