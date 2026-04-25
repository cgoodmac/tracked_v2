// Supabase client singleton. Reads URL + publishable key from Vite env vars.
// The publishable key (formerly "anon key") is safe to expose to the browser
// because Row Level Security policies (defined in Supabase) restrict every
// query to the authenticated user's own data.

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').trim()
const SUPABASE_PUBLISHABLE_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim()

function isValidUrl(s) {
  try { return /^https?:/.test(new URL(s).protocol) } catch { return false }
}

export const isSupabaseConfigured = isValidUrl(SUPABASE_URL) && SUPABASE_PUBLISHABLE_KEY.length > 0

if (!isSupabaseConfigured) {
  // Don't throw — let the app boot in "local-only" mode if env vars are
  // missing. The login screen will surface a clear error instead.
  // This also keeps `npm run build` from breaking before vars are wired up.
  console.warn('[tracked] Supabase env vars not set — running local-only')
}

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        // Persist the session in localStorage so reloading keeps you logged in.
        persistSession: true,
        autoRefreshToken: true,
        // Detect the magic-link tokens that Supabase appends to the URL hash
        // when a user clicks the email link, so we can sign them in seamlessly.
        detectSessionInUrl: true,
        // Use a unique storage key so it doesn't collide with our own state keys
        storageKey: 'tracked_auth',
      },
    })
  : null
