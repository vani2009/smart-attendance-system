# MyMark — Smart Curriculum Activity & Attendance System

**Team A** · Studio Shodwe · VIT Chennai 2024

> *Secure • Fast • Intelligent*

---

## Project Structure

```
smart-attendance-system/
├── backend/
│   ├── qrGenerator.js       — Dynamic QR generation with HMAC-SHA256 tokens
│   ├── qrScanner.js         — Server verification engine (7-step pipeline)
│   ├── supabaseClient.js    — Supabase client + admin client
│   └── utils.js             — JWT auth, geo distance, response helpers
├── config/
│   └── config.js            — App-wide config (QR expiry, server, DB)
├── database/
│   ├── schema.sql           — Core tables, indexes, and analytics views
│   ├── auth_trigger.sql     — Auto-profile creation + RLS policies
│   └── enrollment_schema.sql — Bulk enroll, roster, absentee marking
├── frontend/
│   ├── index.html           — Landing page
│   ├── login.html           — Authentication (role selector)
│   ├── teacher.html         — Teacher portal (QR generation + dashboard)
│   ├── student.html         — Student portal (scan + attendance view)
│   └── dashboard.html       — Admin overview
└── README.md
```

---

## Tech Stack

| Layer      | Technology |
|------------|------------|
| Frontend   | Vanilla HTML/CSS/JS (mobile-first) |
| Backend    | Node.js (Express) |
| Database   | Supabase (PostgreSQL) |
| Auth       | Supabase Auth + JWT |
| QR         | `qrcode` npm package + HMAC-SHA256 encryption |
| Security   | Encrypted tokens, RLS, one-time validation, geo-verification |
| Deployment | Vercel (frontend) · Railway/Supabase (backend) |

---

## Setup

### 1. Install dependencies

```bash
npm init -y
npm install @supabase/supabase-js qrcode jsonwebtoken express cors dotenv
```

### 2. Configure environment

Create a `.env` file:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
QR_SECRET_KEY=your-random-secret-key-min-32-chars
JWT_SECRET=your-jwt-secret
PORT=3000
```

### 3. Set up the database

In your Supabase SQL editor, run in order:
1. `database/schema.sql`
2. `database/auth_trigger.sql`
3. `database/enrollment_schema.sql`

### 4. Run the server

```bash
node server.js   # or: npm start
```

### 5. Open the frontend

Open `frontend/index.html` in a browser, or serve with:
```bash
npx serve frontend
```

---

## How It Works

### Mode 1 — Teacher-Generated QR

```
Teacher logs in
    ↓
System generates dynamic QR (HMAC token, 5-min expiry)
    ↓
Students scan QR with phone
    ↓
Server validates: signature + time + enrollment + duplicate
    ↓
Attendance recorded → Dashboard updates instantly
```

### Mode 2 — Student-Generated QR

```
Student logs in → App generates personal QR (50-sec expiry)
    ↓
Teacher scans student's QR
    ↓
Server validates token → Attendance marked
```

---

## Security Architecture

| Layer | Protection |
|-------|-----------|
| QR Code | HMAC-SHA256 signature with session ID + timestamp + secret key |
| Expiry | Teacher QR: 5 minutes · Student QR: 50 seconds |
| Replay Prevention | Token stored in `used_tokens` table after first use |
| Duplicate Check | Unique constraint on (session_id, student_id) |
| Enrollment Check | Student must be enrolled in the course |
| Geolocation | Optional: student within configurable radius of class |
| Database | Row Level Security (RLS) on all tables |

---

## Database Schema (Summary)

| Table | Purpose |
|-------|---------|
| `profiles` | Extended user data (extends Supabase auth.users) |
| `courses` | Course catalogue, linked to teacher |
| `enrollments` | Student ↔ Course many-to-many |
| `attendance_sessions` | One per class lecture |
| `attendance_records` | One per student per session |
| `used_tokens` | Replay attack prevention |
| `notifications` | Low-attendance alerts |

**Views:**
- `student_attendance_summary` — percentage per student per course
- `at_risk_students` — students below 75% with ≥ 3 sessions

---

## Team

| Member | Registration |
|--------|-------------|
| Kritika Mohan | 24BCE10637 |
| Samriddhi Jain | 24BCE11416 |
| Manasvi Kirkire | 24BCE10962 |
| Roopsha Ghosh | 24BCE10292 |
| Vani Agarwal | 24BCE11269 |

---

*MyMark is not just a project — it's a scalable institutional platform.*