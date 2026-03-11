// server.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const PORT = 3000;
const SECRET_KEY = 'your-very-secure-secret'; // In production, use environment variables!

// Enable CORS for frontend (e.g., Live Server on port 5500)
app.use(cors({
  origin: ['http://127.0.0.1:5500', 'http://localhost:5500'] // Adjust based on your frontend URL
}));

// Middleware to parse JSON
app.use(express.json());

// In-memory "database" (replace with MongoDB later)
let users = [
  { id: 1, username: 'admin', password: '$2a$10$...', role: 'admin' }, // pre-hashed
  { id: 2, username: 'alice', password: '$2a$10$...', role: 'user' }
];

// Helper: Hash password (run once to generate hashes)
// console.log(bcrypt.hashSync('admin123', 10)); // Use this to generate real hashes