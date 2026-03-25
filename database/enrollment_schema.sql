-- database/enrollment_schema.sql
-- Enrollment management: bulk insert helpers, stored procedures, and functions.

-- ─────────────────────────────────────────────────────────────────────────────
-- Function: enroll_student
-- Enrolls a single student into a course (teacher/admin only).
-- Returns the new enrollment id or raises an exception.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION enroll_student(
  p_student_id  UUID,
  p_course_id   UUID,
  p_teacher_id  UUID  -- must be the course owner
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_enrollment_id UUID;
BEGIN
  -- Validate teacher owns the course
  IF NOT EXISTS (
    SELECT 1 FROM courses
    WHERE id = p_course_id AND teacher_id = p_teacher_id
  ) THEN
    RAISE EXCEPTION 'Permission denied: not the course teacher';
  END IF;

  -- Validate student exists and has role = 'student'
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_student_id AND role = 'student'
  ) THEN
    RAISE EXCEPTION 'User % is not a registered student', p_student_id;
  END IF;

  INSERT INTO enrollments (student_id, course_id)
  VALUES (p_student_id, p_course_id)
  ON CONFLICT (student_id, course_id) DO NOTHING
  RETURNING id INTO v_enrollment_id;

  RETURN v_enrollment_id;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- Function: bulk_enroll_by_reg_numbers
-- Enroll multiple students at once using their registration numbers.
-- Returns a summary table of (reg_number, status, message).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION bulk_enroll_by_reg_numbers(
  p_reg_numbers TEXT[],
  p_course_id   UUID,
  p_teacher_id  UUID
)
RETURNS TABLE (reg_number TEXT, status TEXT, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reg TEXT;
  v_student_id UUID;
BEGIN
  -- Validate teacher
  IF NOT EXISTS (
    SELECT 1 FROM courses WHERE id = p_course_id AND teacher_id = p_teacher_id
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  FOREACH v_reg IN ARRAY p_reg_numbers
  LOOP
    SELECT id INTO v_student_id
    FROM profiles
    WHERE reg_number = v_reg AND role = 'student'
    LIMIT 1;

    IF v_student_id IS NULL THEN
      reg_number := v_reg; status := 'error'; message := 'Student not found';
      RETURN NEXT;
      CONTINUE;
    END IF;

    BEGIN
      INSERT INTO enrollments (student_id, course_id)
      VALUES (v_student_id, p_course_id);
      reg_number := v_reg; status := 'ok'; message := 'Enrolled';
    EXCEPTION WHEN unique_violation THEN
      reg_number := v_reg; status := 'skip'; message := 'Already enrolled';
    END;

    RETURN NEXT;
  END LOOP;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- Function: unenroll_student
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION unenroll_student(
  p_student_id UUID,
  p_course_id  UUID,
  p_teacher_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM courses WHERE id = p_course_id AND teacher_id = p_teacher_id
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  DELETE FROM enrollments
  WHERE student_id = p_student_id AND course_id = p_course_id;

  RETURN FOUND;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- Function: get_course_roster
-- Returns enrolled students with their current attendance summary.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_course_roster(p_course_id UUID)
RETURNS TABLE (
  student_id       UUID,
  full_name        TEXT,
  reg_number       TEXT,
  email            TEXT,
  total_sessions   BIGINT,
  attended         BIGINT,
  attendance_pct   NUMERIC,
  at_risk          BOOLEAN
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.student_id,
    p.full_name,
    p.reg_number,
    p.email,
    s.total_sessions,
    s.attended_sessions,
    s.attendance_pct,
    s.attendance_pct < 75 AND s.total_sessions >= 3
  FROM student_attendance_summary s
  JOIN profiles p ON p.id = s.student_id
  WHERE s.course_id = p_course_id
  ORDER BY p.full_name;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- Function: auto_mark_absentees
-- Called at session close to insert 'absent' records for enrolled students
-- who did NOT scan in.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION auto_mark_absentees(p_session_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_course_id UUID;
  v_count     INTEGER := 0;
BEGIN
  SELECT course_id INTO v_course_id
  FROM attendance_sessions WHERE id = p_session_id;

  INSERT INTO attendance_records (session_id, student_id, course_id, status)
  SELECT
    p_session_id,
    e.student_id,
    v_course_id,
    'absent'
  FROM enrollments e
  WHERE e.course_id = v_course_id
    AND e.student_id NOT IN (
      SELECT student_id FROM attendance_records WHERE session_id = p_session_id
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;