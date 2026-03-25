// backend/qrScanner.js — Server Verification Engine
// Validates scanned QR tokens: signature, expiry, duplicate, registration.

const { supabaseAdmin } = require('./supabaseClient');
const { verifyTokenSignature } = require('./qrGenerator');
const { getLocationDistance } = require('./utils');
const config = require('../config/config');

/**
 * Main verification pipeline for a scanned QR.
 *
 * Steps:
 *  1. Parse JSON payload from scanned string
 *  2. Verify HMAC token signature + expiry (no DB)
 *  3. Verify session exists and is active (DB)
 *  4. Verify student is enrolled in the session's course (DB)
 *  5. Check for duplicate attendance in this session (DB)
 *  6. Optional: geo-verify student is within radius
 *  7. Record attendance
 *
 * Returns { success, message, attendanceId? }
 */
async function processScannedQR(scannedString, scannedByUserId, studentLocation = null) {
  // ── Step 1: Parse payload ────────────────────────────────────────────────
  let payload;
  try {
    payload = JSON.parse(scannedString);
  } catch {
    return { success: false, reason: 'INVALID_QR_FORMAT' };
  }

  const { mode, sessionId, studentId: payloadStudentId } = payload;

  // Determine who the student is based on mode
  // Mode 'teacher': teacher shows QR → student scans → student is the scanner
  // Mode 'student': student shows QR → teacher scans → student is in payload
  const actualStudentId = mode === 'teacher' ? scannedByUserId : payloadStudentId;

  if (!actualStudentId || !sessionId) {
    return { success: false, reason: 'MISSING_PAYLOAD_FIELDS' };
  }

  // ── Step 2: Verify token signature & expiry ──────────────────────────────
  const signatureResult = verifyTokenSignature(payload);
  if (!signatureResult.valid) {
    return { success: false, reason: signatureResult.reason };
  }

  // ── Step 3: Verify session is active ────────────────────────────────────
  const { data: session, error: sessionError } = await supabaseAdmin
    .from('attendance_sessions')
    .select('id, course_id, teacher_id, status, location_lat, location_lng, started_at')
    .eq('id', sessionId)
    .single();

  if (sessionError || !session) {
    return { success: false, reason: 'SESSION_NOT_FOUND' };
  }

  if (session.status !== 'active') {
    return { success: false, reason: 'SESSION_NOT_ACTIVE' };
  }

  // ── Step 4: Verify student is enrolled ──────────────────────────────────
  const { data: enrollment, error: enrollError } = await supabaseAdmin
    .from('enrollments')
    .select('id')
    .eq('student_id', actualStudentId)
    .eq('course_id', session.course_id)
    .single();

  if (enrollError || !enrollment) {
    return { success: false, reason: 'STUDENT_NOT_ENROLLED' };
  }

  // ── Step 5: Duplicate attendance check ──────────────────────────────────
  const { data: existing } = await supabaseAdmin
    .from('attendance_records')
    .select('id')
    .eq('session_id', sessionId)
    .eq('student_id', actualStudentId)
    .single();

  if (existing) {
    return { success: false, reason: 'DUPLICATE_ATTENDANCE' };
  }

  // ── Step 6: Optional geoverification ────────────────────────────────────
  if (session.location_lat && session.location_lng && studentLocation) {
    const distance = getLocationDistance(
      studentLocation.lat,
      studentLocation.lng,
      session.location_lat,
      session.location_lng
    );

    if (distance > config.attendance.locationRadiusMeters) {
      return { success: false, reason: 'LOCATION_OUT_OF_RANGE', distance };
    }
  }

  // ── Step 7: Record attendance ────────────────────────────────────────────
  const { data: record, error: insertError } = await supabaseAdmin
    .from('attendance_records')
    .insert({
      session_id: sessionId,
      student_id: actualStudentId,
      course_id: session.course_id,
      marked_at: new Date().toISOString(),
      verification_mode: mode,
      token_used: payload.token,
      location_lat: studentLocation?.lat || null,
      location_lng: studentLocation?.lng || null,
      status: 'present',
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('Failed to insert attendance record:', insertError);
    return { success: false, reason: 'DB_INSERT_FAILED' };
  }

  return {
    success: true,
    message: 'Attendance marked successfully',
    attendanceId: record.id,
    sessionId,
    studentId: actualStudentId,
  };
}

/**
 * Convenience wrapper used by the API route handlers.
 * Parses req body and calls processScannedQR.
 */
async function handleScanRequest(req, res) {
  try {
    const { qrData, location } = req.body;
    const userId = req.user?.id;

    if (!qrData) {
      return res.status(400).json({ success: false, reason: 'QR_DATA_REQUIRED' });
    }

    const result = await processScannedQR(qrData, userId, location || null);

    const statusCode = result.success ? 200 : 400;
    return res.status(statusCode).json(result);
  } catch (err) {
    console.error('Scan handler error:', err);
    return res.status(500).json({ success: false, reason: 'INTERNAL_ERROR' });
  }
}

module.exports = { processScannedQR, handleScanRequest };