const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { getDbSafe } = require('../database/db');

const ACCESS_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-change-in-production';
const ACCESS_EXPIRES = '15m';
const REFRESH_EXPIRES = '7d';

if (ACCESS_SECRET === 'your-super-secret-jwt-key-change-in-production' && process.env.NODE_ENV === 'production') {
  console.warn('⚠️  WARNING: Using default JWT_SECRET in production. Set JWT_SECRET in environment variables.');
}

exports.generateAccessToken = (userId) => jwt.sign({ userId }, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES });

exports.generateRefreshToken = async (userId) => {
  const token = crypto.randomBytes(40).toString('hex');
  const db = await getDbSafe();
  if (db) {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)').run(userId, token, expiresAt);
  }
  return token;
};

exports.generateTokens = async (userId) => {
  const accessToken = exports.generateAccessToken(userId);
  const refreshToken = await exports.generateRefreshToken(userId);
  return { accessToken, refreshToken };
};

exports.verifyRefreshToken = async (token) => {
  const db = await getDbSafe();
  if (!db) return null;
  const row = db.prepare('SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > datetime("now")').get(token);
  if (!row) return null;
  return row.user_id;
};

exports.revokeRefreshToken = async (token) => {
  const db = await getDbSafe();
  if (db) {
    db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(token);
  }
};

exports.revokeUserRefreshTokens = async (userId) => {
  const db = await getDbSafe();
  if (db) {
    db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(userId);
  }
};

exports.authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: true, message: 'No token provided' });
  }
  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, ACCESS_SECRET);
    const db = await getDbSafe(res);
    if (!db) return;
    const user = db.prepare('SELECT id, name, email, role, avatar, created_at FROM users WHERE id = ?').get(decoded.userId);
    if (!user) return res.status(401).json({ error: true, message: 'Invalid token' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: true, message: 'Invalid or expired token' });
  }
};

exports.optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }
  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, ACCESS_SECRET);
    const db = await getDbSafe();
    if (db) {
      req.user = db.prepare('SELECT id, name, email, role, avatar, created_at FROM users WHERE id = ?').get(decoded.userId);
    } else {
      req.user = null;
    }
  } catch {
    req.user = null;
  }
  next();
};

exports.requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: true, message: 'Admin role required' });
  }
  next();
};