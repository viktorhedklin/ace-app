// ─── Shifts — cloud-synced per-day shift records ─────────────────────────
// Thin wrapper over the storage adapter. Namespace = 'shifts', key = ISO
// date (YYYY-MM-DD). Reads are synchronous (localStorage mirror); writes
// are fire-and-forget from callers.
//
// Back-compat: read() checks the adapter first, then falls back to the
// legacy `shift_<date>` key so pre-migration data stays visible.
// write() drops the legacy key so we don't end up with two sources of
// truth after a single save.

import { get, set, remove, list, NAMESPACES } from './storage';

const LEGACY_PREFIX = 'shift_';

function legacyKey(date) { return `${LEGACY_PREFIX}${date}`; }

export function loadShift(date) {
  // Prefer adapter; fall back to legacy localStorage key.
  const fromAdapter = get(NAMESPACES.SHIFTS, date);
  if (fromAdapter) return fromAdapter;
  try {
    const raw = localStorage.getItem(legacyKey(date));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export async function saveShift(date, data) {
  await set(NAMESPACES.SHIFTS, date, data);
  localStorage.removeItem(legacyKey(date));
}

export async function deleteShift(date) {
  await remove(NAMESPACES.SHIFTS, date);
  localStorage.removeItem(legacyKey(date));
}

// Returns [{ date, data }] for every shift the user has, newest first.
// Merges adapter-managed entries with any lingering legacy `shift_*` keys
// so pre-migration data still shows up everywhere.
export function listShifts() {
  const seen = new Set();
  const out = [];

  // 1. Adapter-managed entries
  for (const { key, value } of list(NAMESPACES.SHIFTS)) {
    seen.add(key);
    out.push({ date: key, data: value });
  }

  // 2. Legacy entries (only those not already in the adapter)
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(LEGACY_PREFIX)) continue;
    const date = k.slice(LEGACY_PREFIX.length);
    if (seen.has(date)) continue;
    try {
      const value = JSON.parse(localStorage.getItem(k));
      if (value) out.push({ date, data: value });
    } catch { /* skip malformed */ }
  }

  return out.sort((a, b) => b.date.localeCompare(a.date));
}

export async function clearAllShifts() {
  for (const { date } of listShifts()) {
    await deleteShift(date);
  }
}
