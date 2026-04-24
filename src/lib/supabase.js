// ─── Supabase client + magic-link auth ─────────────────────────────────────
// Single source of truth for the Supabase connection. Everything that touches
// the cloud (storage.js, Settings auth panel) goes through here.
//
// Env:
//   VITE_SUPABASE_URL       — https://<project>.supabase.co
//   VITE_SUPABASE_ANON_KEY  — public anon key (safe to ship client-side)
//
// If either is missing, isConfigured is false and the app stays local-only.

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(url && anonKey);

export const supabase = isConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // Explicit storage ref — Supabase uses localStorage by default in the browser
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      },
    })
  : null;

/* ─── Auth helpers ────────────────────────────────────────────────────────── */

export async function sendMagicLink(email) {
  if (!supabase) throw new Error('Supabase not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local.');
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.origin,
      // Allow signup on first use — single-user app, expected flow
      shouldCreateUser: true,
    },
  });
  if (error) throw error;
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function getSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getUserId() {
  const session = await getSession();
  return session?.user?.id || null;
}

export async function getUserEmail() {
  const session = await getSession();
  return session?.user?.email || null;
}

export async function isSignedIn() {
  return Boolean(await getUserId());
}

// Subscribe to auth state changes. Returns an unsubscribe function.
export function onAuthChange(callback) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return () => data.subscription.unsubscribe();
}
