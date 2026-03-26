// server.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const mysql = require('mysql2/promise');
const crypto = require('crypto');

const app = express();
const PORT = 3000;
const SECRET_KEY = process.env.JWT_SECRET || 'your-very-secure-secret'; // use env var in production!

// ─── MYSQL POOL ────────────────────────────────────────────
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'fullstack_app',
    waitForConnections: true,
    connectionLimit: 10
});

// ─── IN-MEMORY TOKEN BLACKLIST ──────────────────────────────
// Stores { token: expiresAt } pairs so we can prune expired entries
const tokenBlacklist = new Map();

function blacklistToken(token) {
    try {
        const decoded = jwt.decode(token);
        if (decoded && decoded.exp) {
            tokenBlacklist.set(token, decoded.exp * 1000); // convert to ms
        }
    } catch (_) {}
}

function isBlacklisted(token) {
    if (!tokenBlacklist.has(token)) return false;
    const expiresAt = tokenBlacklist.get(token);
    if (Date.now() > expiresAt) {
        tokenBlacklist.delete(token); // prune expired entry
        return false;
    }
    return true;
}

// Prune expired tokens every 15 minutes
setInterval(() => {
    const now = Date.now();
    for (const [token, expiresAt] of tokenBlacklist.entries()) {
        if (now > expiresAt) tokenBlacklist.delete(token);
    }
}, 15 * 60 * 1000);

// ─── MIDDLEWARE ─────────────────────────────────────────────
app.use(cors({
    origin: ['http://127.0.0.1:5500', 'http://localhost:5500']
}));
app.use(express.json());

// ─── DB INIT ────────────────────────────────────────────────
async function initDB() {
    const conn = await pool.getConnection();
    try {
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                firstName VARCHAR(100) NOT NULL DEFAULT '',
                lastName  VARCHAR(100) NOT NULL DEFAULT '',
                email     VARCHAR(255) NOT NULL UNIQUE,
                password  VARCHAR(255) NOT NULL,
                role      ENUM('Admin','User') NOT NULL DEFAULT 'User',
                verified  TINYINT(1) NOT NULL DEFAULT 0,
                createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id        INT AUTO_INCREMENT PRIMARY KEY,
                email     VARCHAR(255) NOT NULL,
                token     VARCHAR(64) NOT NULL UNIQUE,
                expiresAt DATETIME NOT NULL,
                used      TINYINT(1) NOT NULL DEFAULT 0,
                createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_token (token),
                INDEX idx_email (email)
            )
        `);

        const [rows] = await conn.execute('SELECT id FROM users LIMIT 1');
        if (rows.length === 0) {
            const hashed = await bcrypt.hash('Password123!', 10);
            await conn.execute(
                `INSERT INTO users (firstName, lastName, email, password, role, verified)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                ['Admin', 'User', 'admin@example.com', hashed, 'Admin', 1]
            );
            console.log('  Seeded default admin: admin@example.com / Password123!');
        }
    } finally {
        conn.release();
    }
}

// ─── AUTH ROUTES ────────────────────────────────────────────

// POST /api/register
app.post('/api/register', async (req, res) => {
    const { firstName = '', lastName = '', email, password, role = 'User' } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'email and password required' });
    }

    try {
        const [existing] = await pool.execute(
            'SELECT id FROM users WHERE email = ?', [email]
        );
        if (existing.length > 0) {
            return res.status(409).json({ error: 'user already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.execute(
            `INSERT INTO users (firstName, lastName, email, password, role, verified)
             VALUES (?, ?, ?, ?, ?, 0)`,
            [firstName, lastName, email, hashedPassword, role]
        );

        res.status(201).json({ message: 'user registered', email, role });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'server error' });
    }
});

// POST /api/login
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'email and password required' });
    }

    try {
        const [rows] = await pool.execute(
            'SELECT * FROM users WHERE email = ?', [email]
        );
        const user = rows[0];

        if (!user) {
            return res.status(401).json({ error: 'invalid email or password' });
        }
        if (!user.verified) {
            return res.status(401).json({ error: 'email not verified' });
        }

        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ error: 'invalid email or password' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            SECRET_KEY,
            { expiresIn: '1h' }
        );

        res.json({
            token,
            user: {
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: user.role
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'server error' });
    }
});

// POST /api/logout  ← NEW
// Adds the current JWT to the blacklist so it can no longer be used
app.post('/api/logout', authenticateToken, (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token) blacklistToken(token);
    res.json({ message: 'logged out successfully' });
});

// POST /api/verify
app.post('/api/verify', async (req, res) => {
    const { email } = req.body;
    try {
        const [result] = await pool.execute(
            'UPDATE users SET verified = 1 WHERE email = ?', [email]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'user not found' });
        }
        res.json({ message: 'email verified successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'server error' });
    }
});

// ─── PASSWORD RESET FLOW ─────────────────────────────────────

// POST /api/password-reset/request  ← NEW
// Generates a reset token (in production, email it; here we return it directly for demo)
app.post('/api/password-reset/request', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email required' });

    try {
        const [rows] = await pool.execute(
            'SELECT id FROM users WHERE email = ?', [email]
        );
        if (rows.length === 0) {
            return res.json({ message: 'if that email exists, a reset link has been sent' });
        }
        await pool.execute(
            `UPDATE password_reset_tokens SET used = 1 WHERE email = ? AND used = 0`,
            [email]
        );

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        await pool.execute(
            `INSERT INTO password_reset_tokens (email, token, expiresAt) VALUES (?, ?, ?)`,
            [email, token, expiresAt]
        );
        res.json({
            message: 'if that email exists, a reset link has been sent',
            _demo_reset_token: token
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'server error' });
    }
});

// POST /api/password-reset/confirm  ← NEW
// Validates the token and sets a new password
app.post('/api/password-reset/confirm', async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
        return res.status(400).json({ error: 'token and newPassword required' });
    }
    if (newPassword.length < 6) {
        return res.status(400).json({ error: 'password must be at least 6 characters' });
    }

    try {
        const [rows] = await pool.execute(
            `SELECT * FROM password_reset_tokens
             WHERE token = ? AND used = 0 AND expiresAt > NOW()`,
            [token]
        );

        if (rows.length === 0) {
            return res.status(400).json({ error: 'invalid or expired reset token' });
        }

        const { email } = rows[0];
        const hashed = await bcrypt.hash(newPassword, 10);

        await pool.execute('UPDATE users SET password = ? WHERE email = ?', [hashed, email]);
        await pool.execute(
            'UPDATE password_reset_tokens SET used = 1 WHERE token = ?', [token]
        );

        res.json({ message: 'password reset successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'server error' });
    }
});

// ─── PROTECTED ROUTES ───────────────────────────────────────

app.get('/api/profile', authenticateToken, (req, res) => {
    res.json({ user: req.user });
});

app.get('/api/admin/dashboard', authenticateToken, authorizeRole('Admin'), (req, res) => {
    res.json({ message: 'welcome to admin dashboard!', data: 'secret admin info' });
});

app.get('/api/content/guest', (req, res) => {
    res.json({ message: 'public content for all visitors' });
});

app.get('/api/debug/users', async (req, res) => {
    const [rows] = await pool.execute('SELECT email, verified FROM users');
    res.json(rows);
});

// ─── MIDDLEWARE ──────────────────────────────────────────────

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'access token required' });
    }
    // Check blacklist first
    if (isBlacklisted(token)) {
        return res.status(401).json({ error: 'token has been revoked — please log in again' });
    }

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ error: 'invalid or expired token' });
        req.user = user;
        next();
    });
}

function authorizeRole(role) {
    return (req, res, next) => {
        if (req.user.role !== role) {
            return res.status(403).json({ error: 'access denied: insufficient permissions' });
        }
        next();
    };
}

// ─── START ───────────────────────────────────────────────────
initDB()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`\n Backend running on http://localhost:${PORT}`);
            console.log('\n Default login: admin@example.com / Password123!');
        });
    })
    .catch(err => {
        console.error('Failed to initialise DB:', err.message);
        process.exit(1);
    });