// config/config.js — App-wide configuration

const config = {
  supabase: {
    url: process.env.SUPABASE_URL || 'https://your-project.supabase.co',
    anonKey: process.env.SUPABASE_ANON_KEY || 'your-anon-key',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key',
  },

  qr: {
    teacherQRExpiry: 5 * 60,        // 5 minutes in seconds
    studentQRExpiry: 50,             // 50 seconds
    refreshInterval: 30,             // regenerate every 30s for teacher mode
    secretKey: process.env.QR_SECRET_KEY || 'my-mark-secret-key-2024',
  },

  attendance: {
    locationRadiusMeters: 100,       // max distance from class location
    allowOfflineQueue: true,
    duplicateWindowSeconds: 60 * 60, // 1 hour window for duplicate detection
  },

  server: {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    jwtSecret: process.env.JWT_SECRET || 'jwt-secret-key',
    jwtExpiry: '24h',
  },

  roles: {
    TEACHER: 'teacher',
    STUDENT: 'student',
    ADMIN: 'admin',
  },
};

module.exports = config;