// server.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const PORT = 3000;
const SECRET_KEY = 'your-very-secure-secret'; // In production, use environment variables!

// Enable CORS for frontend (Live Server ports)
app.use(cors({
    origin: ['http://127.0.0.1:5500', 'http://localhost:5500']
}));

// Middleware to parse JSON
app.use(express.json());

// In-memory "database" — syncs with your frontend accounts
let users = [
    {
        id: 1,
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@example.com',
        password: 'Password123!',
        role: 'Admin',
        verified: true
    }
];

// Pre-hash passwords on startup
users = users.map(user => {
    if (!user.password.startsWith('$2a$')) {
        user.password = bcrypt.hashSync(user.password, 10);
    }
    return user;
});

// ─── AUTH ROUTES ───────────────────────────────────────────

// POST /api/register
app.post('/api/register', async (req, res) => {
    const { firstName, lastName, email, password, role = 'User' } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'email and password required' });
    }

    const existing = users.find(u => u.email === email);
    if (existing) {
        return res.status(409).json({ error: 'user already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
        id: users.length + 1,
        firstName: firstName || '',
        lastName: lastName || '',
        email,
        password: hashedPassword,
        role,
        verified: false
    };

    users.push(newUser);
    res.status(201).json({ message: 'user registered', email, role });
});

// POST /api/login
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'email and password required' });
    }

    const user = users.find(u => u.email === email);

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

    // Generate JWT token
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
});

// ─── PROTECTED ROUTES ──────────────────────────────────────

// GET /api/profile
app.get('/api/profile', authenticateToken, (req, res) => {
    res.json({ user: req.user });
});

// GET /api/admin/dashboard (Admin only)
app.get('/api/admin/dashboard', authenticateToken, authorizeRole('Admin'), (req, res) => {
    res.json({ message: 'welcome to admin dashboard!', data: 'secret admin info' });
});

// GET /api/content/guest (Public)
app.get('/api/content/guest', (req, res) => {
    res.json({ message: 'public content for all visitors' });
});

app.post('/api/verify', (req, res) => {
    const { email } = req.body;
    const user = users.find(u => u.email === email);
    if (!user) return res.status(404).json({ error: 'user not found' });
    user.verified = true;
    res.json({ message: 'email verified successfully' });
});

app.get('/api/debug/users', (req, res) => {
    res.json(users.map(u => ({ email: u.email, verified: u.verified })));
});

// ─── MIDDLEWARE ────────────────────────────────────────────

// Token authentication
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'access token required' });
    }

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ error: 'invalid or expired token' });
        req.user = user;
        next();
    });
}

// Role authorization
function authorizeRole(role) {
    return (req, res, next) => {
        if (req.user.role !== role) {
            return res.status(403).json({ error: 'access denied: insufficient permissions' });
        }
        next();
    };
}

// ─── START SERVER ──────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n Backend running on http://localhost:${PORT}`);
    console.log('\n Default login credentials:');
    console.log('   Admin: email=admin@example.com, password=Password123!');
    console.log('\n Make sure your frontend is running on port 5500 (Live Server)');
});