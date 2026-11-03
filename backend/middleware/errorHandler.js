function errorHandler(err, req, res, next) {
    console.error(`[Error] ${req.method} ${req.url}:`, err.stack || err.message);

    const statusCode = err.statusCode || (res.statusCode !== 200 ? res.statusCode : 500);
    const message = err.message || 'Internal Server Error';

    res.status(statusCode).json({
        error: message,
        statusCode: statusCode,
        path: req.originalUrl,
        timestamp: new Date().toISOString()
    });
}

module.exports = errorHandler;
