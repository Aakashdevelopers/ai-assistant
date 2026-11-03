require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const initDb = require('./database/initDb');

const authRoutes = require('./routes/auth');
const modelsRoutes = require('./routes/models');
const chatRoutes = require('./routes/chat');
const settingsRoutes = require('./routes/settings');
const projectsRoutes = require('./routes/projects');
const assistantsRoutes = require('./routes/assistants');
const uploadRoutes = require('./routes/upload');

const { apiLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// Security Headers
app.use(helmet({
    contentSecurityPolicy: false // disabled for inline SVG/icons in simple frontend
}));

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Apply rate limiting to all API routes
app.use('/api', apiLimiter);

// Serve Static Frontend Assets
const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/models', modelsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/assistants', assistantsRoutes);
app.use('/api/upload', uploadRoutes);

// Catch-all route to serve SPA frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// Global Error Handler
app.use(errorHandler);

// Initialize DB and Start Server
initDb().then(() => {
    app.listen(PORT, () => {
        console.log(`====================================================`);
        console.log(`🚀 FitUp ChatGPT-Style AI Web App Server is running!`);
        console.log(`🌐 URL: http://localhost:${PORT}`);
        console.log(`====================================================`);
    });
}).catch(err => {
    console.error('Failed to start server due to DB init error:', err);
});

module.exports = app;
