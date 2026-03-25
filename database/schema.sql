-- Profiles
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  role TEXT CHECK (role IN ('student', 'teacher')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Courses
CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  teacher_id UUID REFERENCES profiles(id)
);

-- Enrollments
CREATE TABLE enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES profiles(id),
  course_id UUID REFERENCES courses(id)
);

-- Sessions
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id),
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  active BOOLEAN DEFAULT TRUE
);

-- Attendance Records
CREATE TABLE records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES profiles(id),
  session_id UUID REFERENCES sessions(id),
  marked_at TIMESTAMP DEFAULT NOW()
);

-- Used Tokens
CREATE TABLE used_tokens (
  token TEXT PRIMARY KEY,
  used_at TIMESTAMP DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);