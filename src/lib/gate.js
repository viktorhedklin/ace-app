// ─── ACE Browse Mode ──────────────────────────────────────────────────────────
// Authentication is handled by Supabase (see src/lib/supabase.js + the
// SupabaseAuthGate component). This module now only tracks "browse mode" —
// using ACE without an LLM key (workflows, SOPs, QA, heatmap; no AI chat).
//
// The old client-side SHA-256 passphrase gate was removed: a shared hashed
// passphrase shipped in source is not real auth. Real sessions live in Supabase.

// sessionStorage slot — 'true' once the user opts into no-key browse mode.
export const BROWSE_MODE_KEY = 'ace_browse_mode_unlocked';

export function isBrowseMode() {
  return sessionStorage.getItem(BROWSE_MODE_KEY) === 'true';
}

export function enterBrowseMode() {
  sessionStorage.setItem(BROWSE_MODE_KEY, 'true');
}

export function exitBrowseMode() {
  sessionStorage.removeItem(BROWSE_MODE_KEY);
}
