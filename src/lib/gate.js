// ─── ACE Launch Gate ──────────────────────────────────────────────────────────
// Three paths unlock ACE:
//  1) API key (Anthropic sk-ant- or OpenAI sk-) → full AI features
//  2) Passphrase → "Browse mode" (workflows, SOPs, QA, heatmap; no AI chat)
//  3) Both       → full experience
//
// Master reset phrase is the ONLY way to reset the primary passphrase.
// Store only SHA-256 hashes in source. Plaintext never lives on disk.

// SHA-256 of the primary passphrase. Set via `crypto.subtle.digest`.
export const PRIMARY_PASSPHRASE_HASH =
  'ae40481fdea0206cabddaacf177566169562173bdc303c297cfe2d850b948f77';

// SHA-256 of the master reset phrase. Changing this requires access to the source.
export const MASTER_RESET_HASH =
  'c82a4937e46666d0a8083f9b37220f3b22b6a720ba96f81b0e67043fa10f9f50';

// localStorage / sessionStorage slots
export const BROWSE_MODE_KEY = 'ace_browse_mode_unlocked'; // 'true' if passphrase accepted
export const PASSPHRASE_OVERRIDE_KEY = 'ace_passphrase_override_hash'; // optional user-set replacement

// ─── SHA-256 helper (browser-safe, uses Web Crypto) ───────────────────────────
export async function sha256(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Verification ─────────────────────────────────────────────────────────────
// Checks input against the *current* passphrase hash — either the one
// hard-coded in source, or the user-set override (if present).
export async function verifyPassphrase(input) {
  const trimmed = input.trim();
  if (!trimmed) return false;
  const inputHash = await sha256(trimmed);
  const expected = localStorage.getItem(PASSPHRASE_OVERRIDE_KEY) || PRIMARY_PASSPHRASE_HASH;
  return inputHash === expected;
}

// Master reset phrase — unconditional, always the source constant.
export async function verifyMasterReset(input) {
  const trimmed = input.trim();
  if (!trimmed) return false;
  const inputHash = await sha256(trimmed);
  return inputHash === MASTER_RESET_HASH;
}

// ─── Session state ────────────────────────────────────────────────────────────
export function isBrowseMode() {
  return sessionStorage.getItem(BROWSE_MODE_KEY) === 'true';
}

export function enterBrowseMode() {
  sessionStorage.setItem(BROWSE_MODE_KEY, 'true');
}

export function exitBrowseMode() {
  sessionStorage.removeItem(BROWSE_MODE_KEY);
}

// Set a new passphrase (requires master reset first — caller enforces this).
// Stored as SHA-256 hash in localStorage, overriding the source constant.
export async function setNewPassphrase(newPlaintext) {
  const hash = await sha256(newPlaintext);
  localStorage.setItem(PASSPHRASE_OVERRIDE_KEY, hash);
}

// Clear the override — reverts to source passphrase.
export function clearPassphraseOverride() {
  localStorage.removeItem(PASSPHRASE_OVERRIDE_KEY);
}
