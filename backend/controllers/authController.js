const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { get, run } = require('../config/database');
const { JWT_SECRET, DEFAULT_USER_ID } = require('../middleware/authMiddleware');

async function register(req, res, next) {
    try {
        const { username, email, password } = req.body;
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Username, email, and password are required.' });
        }

        const existingUser = await get('SELECT id FROM users WHERE email = ? OR username = ?', [email, username]);
        if (existingUser) {
            return res.status(400).json({ error: 'User with this email or username already exists.' });
        }

        const id = 'user-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        await run('INSERT INTO users (id, username, email, password_hash) VALUES (?, ?, ?, ?)', [id, username, email, passwordHash]);
        await run('INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)', [id]);

        const token = jwt.sign({ id, username, email }, JWT_SECRET, { expiresIn: '7d' });

        res.status(201).json({
            message: 'User registered successfully',
            user: { id, username, email },
            token
        });
    } catch (err) {
        next(err);
    }
}

async function login(req, res, next) {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }

        const user = await get('SELECT * FROM users WHERE email = ? OR username = ?', [email, email]);
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const token = jwt.sign({ id: user.id, username: user.username, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

        res.json({
            message: 'Login successful',
            user: { id: user.id, username: user.username, email: user.email },
            token
        });
    } catch (err) {
        next(err);
    }
}

async function me(req, res, next) {
    try {
        const user = await get('SELECT id, username, email, avatar_url, created_at FROM users WHERE id = ?', [req.user.id]);
        if (!user) {
            // Return default local user info
            return res.json({
                user: {
                    id: DEFAULT_USER_ID,
                    username: 'local_user',
                    email: 'user@local.fitup',
                    created_at: new Date().toISOString()
                }
            });
        }
        res.json({ user });
    } catch (err) {
        next(err);
    }
}

async function logout(req, res) {
    res.json({ message: 'Logged out successfully.' });
}

module.exports = {
    register,
    login,
    me,
    logout
};
