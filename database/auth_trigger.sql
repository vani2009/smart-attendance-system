-- database/auth_trigger.sql
-- Supabase trigger: automatically creates a row in public.profiles
-- whenever a new user signs up via auth.users.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student')
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Drop if exists, then recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security (RLS) Policies
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses              ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records   ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications        ENABLE ROW LEVEL SECURITY;

-- PROFILES: users can read all profiles, but only update their own
CREATE POLICY "profiles_select_all"   ON profiles FOR SELECT USING (TRUE);
CREATE POLICY "profiles_update_own"   ON profiles FOR UPDATE USING (auth.uid() = id);

-- COURSES: all authenticated users can view; only teachers can insert/update their own
CREATE POLICY "courses_select_all"    ON courses FOR SELECT USING (TRUE);
CREATE POLICY "courses_insert_teacher" ON courses FOR INSERT
  WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "courses_update_teacher" ON courses FOR UPDATE
  USING (auth.uid() = teacher_id);

-- ENROLLMENTS: students see their own; teachers see their course enrollments
CREATE POLICY "enrollments_student_own" ON enrollments FOR SELECT
  USING (auth.uid() = student_id);
CREATE POLICY "enrollments_teacher_course" ON enrollments FOR SELECT
  USING (auth.uid() IN (SELECT teacher_id FROM courses WHERE id = course_id));

-- ATTENDANCE SESSIONS: teachers manage their own; students can view active sessions
CREATE POLICY "sessions_teacher_manage" ON attendance_sessions FOR ALL
  USING (auth.uid() = teacher_id);
CREATE POLICY "sessions_student_view" ON attendance_sessions FOR SELECT
  USING (
    status = 'active' AND
    auth.uid() IN (SELECT student_id FROM enrollments WHERE course_id = attendance_sessions.course_id)
  );

-- ATTENDANCE RECORDS: students see their own; teachers see their course records
CREATE POLICY "records_student_own" ON attendance_records FOR SELECT
  USING (auth.uid() = student_id);
CREATE POLICY "records_teacher_course" ON attendance_records FOR SELECT
  USING (auth.uid() IN (SELECT teacher_id FROM courses WHERE id = course_id));

-- NOTIFICATIONS: users see only their own
CREATE POLICY "notifications_own" ON notifications FOR ALL
  USING (auth.uid() = user_id);