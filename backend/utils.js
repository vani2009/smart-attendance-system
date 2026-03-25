// backend/utils.js — Shared utility functions

const jwt = require('jsonwebtoken');
const config = require('../config/config');

// ─── Geo ─────────────────────────────────────────────────────────────────────

/**
 * Haversine formula: returns distance in metres between two lat/lng points.
 */
function getLocationDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth radius in metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── JWT ─────────────────────────────────────────────────────────────────────

function signJWT(payload) {
  return jwt.sign(payload, config.server.jwtSecret, {
    expiresIn: config.server.jwtExpiry,
  });
}

function verifyJWT(token) {
  try {
    return { valid: true, decoded: jwt.verify(token, config.server.jwtSecret) };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

/**
 * Express middleware: checks Bearer token and attaches req.user.
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  const token = authHeader.slice(7);
  const result = verifyJWT(token);

  if (!result.valid) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.user = result.decoded;
  return next();
}

/**
 * Role guard middleware factory.
 * Usage: router.get('/path', requireAuth, requireRole('teacher'), handler)
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    return next();
  };
}

// ─── Date / Time ─────────────────────────────────────────────────────────────

/** Returns ISO date string for today (YYYY-MM-DD) */
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** Returns ms remaining until a Unix epoch ms timestamp */
function msUntil(epochMs) {
  return Math.max(0, epochMs - Date.now());
}

/** Returns human-readable countdown string e.g. "4m 32s" */
function formatCountdown(epochMs) {
  const totalSec = Math.max(0, Math.floor(msUntil(epochMs) / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// ─── Response helpers ─────────────────────────────────────────────────────────

function sendSuccess(res, data, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data });
}

function sendError(res, message, statusCode = 400, details = null) {
  const body = { success: false, error: message };
  if (details) body.details = details;
  return res.status(statusCode).json(body);
}

// ─── Attendance stats ─────────────────────────────────────────────────────────

/**
 * Calculates attendance percentage from counts.
 * Returns rounded integer 0-100.
 */
function calcAttendancePercent(present, total) {
  if (!total || total === 0) return 0;
  return Math.round((present / total) * 100);
}

/**
 * Returns an "at risk" flag: true if attendance < 75%.
 */
function isAtRisk(present, total) {
  return calcAttendancePercent(present, total) < 75;
}

module.exports = {
  getLocationDistance,
  signJWT,
  verifyJWT,
  requireAuth,
  requireRole,
  todayISO,
  msUntil,
  formatCountdown,
  sendSuccess,
  sendError,
  calcAttendancePercent,
  isAtRisk,
};