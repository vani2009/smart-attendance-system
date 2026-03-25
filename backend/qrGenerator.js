// backend/qrGenerator.js — Dynamic QR Code Generation Engine

const crypto = require('crypto');
const QRCode = require('qrcode');
const config = require('../config/config');

/**
 * Creates an HMAC-SHA256 encrypted token from session data.
 * Token = HMAC(sessionId + timestamp + role, secretKey)
 */
function generateToken(sessionId, timestamp, role = 'teacher') {
  const payload = `${sessionId}:${timestamp}:${role}`;
  return crypto
    .createHmac('sha256', config.qr.secretKey)
    .update(payload)
    .digest('hex');
}

/**
 * Builds the QR payload object that gets encoded into the QR image.
 * For Teacher-Generated QR (Mode 1):
 *   sessionId  — the attendance session UUID
 *   timestamp  — Unix epoch ms at generation time
 *   expiresAt  — Unix epoch ms when QR becomes invalid
 *   token      — HMAC signature
 *   mode       — 'teacher'
 *
 * For Student-Generated QR (Mode 2):
 *   studentId  — student's user UUID
 *   sessionId  — attendance session UUID
 *   timestamp  — generation time
 *   expiresAt  — 50 seconds from now
 *   token      — HMAC signature
 *   mode       — 'student'
 */
function buildTeacherQRPayload(sessionId) {
  const timestamp = Date.now();
  const expiresAt = timestamp + config.qr.teacherQRExpiry * 1000;
  const token = generateToken(sessionId, timestamp, 'teacher');

  return {
    mode: 'teacher',
    sessionId,
    timestamp,
    expiresAt,
    token,
  };
}

function buildStudentQRPayload(studentId, sessionId) {
  const timestamp = Date.now();
  const expiresAt = timestamp + config.qr.studentQRExpiry * 1000;
  const token = generateToken(`${studentId}:${sessionId}`, timestamp, 'student');

  return {
    mode: 'student',
    studentId,
    sessionId,
    timestamp,
    expiresAt,
    token,
  };
}

/**
 * Converts a payload object → base64 PNG data URL of the QR code.
 * Returns { dataUrl, payload, expiresAt }
 */
async function generateQRDataURL(payload) {
  const jsonString = JSON.stringify(payload);
  const dataUrl = await QRCode.toDataURL(jsonString, {
    errorCorrectionLevel: 'H',
    type: 'image/png',
    width: 300,
    margin: 2,
    color: {
      dark: '#2C1A0E',   // dark brown — matches brand palette
      light: '#FAF7F2',  // warm off-white background
    },
  });

  return {
    dataUrl,
    payload,
    expiresAt: payload.expiresAt,
  };
}

/**
 * Full pipeline: generate teacher QR for a session.
 * Returns { dataUrl, payload, expiresAt }
 */
async function generateTeacherQR(sessionId) {
  const payload = buildTeacherQRPayload(sessionId);
  return generateQRDataURL(payload);
}

/**
 * Full pipeline: generate student QR for attendance marking.
 * Returns { dataUrl, payload, expiresAt }
 */
async function generateStudentQR(studentId, sessionId) {
  const payload = buildStudentQRPayload(studentId, sessionId);
  return generateQRDataURL(payload);
}

/**
 * Verifies a token's HMAC signature without hitting the database.
 * Returns true if the signature matches and the QR hasn't expired.
 */
function verifyTokenSignature(payload) {
  const { mode, sessionId, studentId, timestamp, expiresAt, token } = payload;

  // Check expiry first (cheap operation)
  if (Date.now() > expiresAt) {
    return { valid: false, reason: 'QR_EXPIRED' };
  }

  // Recompute expected token
  let expectedToken;
  if (mode === 'teacher') {
    expectedToken = generateToken(sessionId, timestamp, 'teacher');
  } else if (mode === 'student') {
    expectedToken = generateToken(`${studentId}:${sessionId}`, timestamp, 'student');
  } else {
    return { valid: false, reason: 'UNKNOWN_MODE' };
  }

  // Constant-time comparison to prevent timing attacks
  const tokenBuffer = Buffer.from(token, 'hex');
  const expectedBuffer = Buffer.from(expectedToken, 'hex');

  if (
    tokenBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(tokenBuffer, expectedBuffer)
  ) {
    return { valid: false, reason: 'INVALID_TOKEN' };
  }

  return { valid: true };
}

module.exports = {
  generateTeacherQR,
  generateStudentQR,
  verifyTokenSignature,
  buildTeacherQRPayload,
  buildStudentQRPayload,
};