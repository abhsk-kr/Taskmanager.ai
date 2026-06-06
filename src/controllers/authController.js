const bcrypt = require('bcryptjs');
const { getDbSafe } = require('../database/db');
const { generateTokens, verifyRefreshToken, revokeRefreshToken, revokeUserRefreshTokens } = require('../middleware/auth');

const toCamelUser = (u) => u ? { id: u.id, name: u.name, email: u.email, role: u.role, avatar: u.avatar, createdAt: u.created_at } : null;

exports.register = async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: true, message: 'Name, email, and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: true, message: 'Password must be at least 8 characters' });
  }
  try {
    const db = await getDbSafe(res);
    if (!db) return;
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
    if (existing) return res.status(409).json({ error: true, message: 'Email already registered' });
    const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'ADMIN'").get();
    const assignedRole = adminCount.count === 0 ? 'ADMIN' : 'MEMBER';
    const hashedPassword = await bcrypt.hash(password, 12);
    const result = db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)')
      .run(name.trim(), email.toLowerCase(), hashedPassword, assignedRole);
    const user = db.prepare('SELECT id, name, email, role, avatar, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
    const tokens = await generateTokens(user.id);
    res.status(201).json({ ...tokens, user: toCamelUser(user) });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: true, message: 'Internal server error' });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: true, message: 'Email and password are required' });
  }
  try {
    const db = await getDbSafe(res);
    if (!db) return;
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
    if (!user) return res.status(401).json({ error: true, message: 'Invalid email or password' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: true, message: 'Invalid email or password' });
    const tokens = await generateTokens(user.id);
    const { password: _, ...safeUser } = user;
    res.json({ ...tokens, user: toCamelUser(safeUser) });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: true, message: 'Internal server error' });
  }
};

exports.logout = async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await revokeRefreshToken(refreshToken);
  }
  res.json({ message: 'Logged out successfully' });
};

exports.me = async (req, res) => {
  res.json({ user: toCamelUser(req.user) });
};

exports.refresh = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: true, message: 'Refresh token required' });
  }
  try {
    const userId = await verifyRefreshToken(refreshToken);
    if (!userId) {
      return res.status(401).json({ error: true, message: 'Invalid or expired refresh token' });
    }
    await revokeRefreshToken(refreshToken);
    const db = await getDbSafe(res);
    if (!db) return;
    const user = db.prepare('SELECT id, name, email, role, avatar, created_at FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(401).json({ error: true, message: 'User not found' });
    const tokens = await generateTokens(user.id);
    res.json({ ...tokens, user: toCamelUser(user) });
  } catch (err) {
    console.error('Refresh error:', err);
    res.status(500).json({ error: true, message: 'Internal server error' });
  }
};