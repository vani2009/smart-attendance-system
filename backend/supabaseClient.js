// backend/supabaseClient.js — Supabase client singleton

const { createClient } = require('@supabase/supabase-js');
const config = require('../config/config');

// Standard client (respects Row Level Security)
const supabase = createClient(config.supabase.url, config.supabase.anonKey);

// Admin client (bypasses RLS — use only on server-side)
const supabaseAdmin = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

module.exports = { supabase, supabaseAdmin };