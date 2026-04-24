// ─── Unified storage adapter — localStorage mirror + Supabase cloud ───────
// Single API for persistent data. Writes go to localStorage immediately
// (so the UI never waits) and then to Supabase async. If the cloud write
// fails (offline, not signed in), the op goes into a sync queue and
// flushes when we come back online / sign in.
//
// Reads come from localStorage (fast, offline-safe). Use pullAll() to
// refresh the local mirror from cloud on boot / login.
//
// Shape in Supabase:
//   table `ace_kv` — columns user_id | namespace | key | value (jsonb)
//   unique (user_id, namespace, key)
//
// Namespaces used by the app live in NAMESPACES below.

import { supabase, getUserId, isConfigured } from './supabase';

const SYNC_QUEUE_KEY = 'ace_sync_queue';
const CACHE_PREFIX = 'ace_cloud:';

export const NAMESPACES = {
  TRAJECTORY: 'trajectory',
  SHIFTS: 'shifts',
  QA_MEMORY: 'qa_memory',
  SAVED_CASES: 'saved_cases',
  KB: 'kb_articles',
  SETTINGS: 'settings',
  CHAT: 'chat',
};

/* ─── Local cache helpers ─────────────────────────────────────────────────── */

function cacheKey(namespace, key) {
  return `${CACHE_PREFIX}${namespace}:${key}`;
}

function readCache(namespace, key) {
  try {
    const raw = localStorage.getItem(cacheKey(namespace, key));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function writeCache(namespace, key, value) {
  try {
    localStorage.setItem(cacheKey(namespace, key), JSON.stringify(value));
  } catch (e) {
    console.warn('[storage] localStorage write failed', namespace, key, e);
  }
}

function removeCache(namespace, key) {
  localStorage.removeItem(cacheKey(namespace, key));
}

function listCache(namespace) {
  const prefix = cacheKey(namespace, '');
  const out = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(prefix)) {
      const key = k.slice(prefix.length);
      const value = readCache(namespace, key);
      if (value !== null) out.push({ key, value });
    }
  }
  return out;
}

/* ─── Sync queue (for writes made while offline / signed out) ─────────────── */

function readQueue() {
  try { return JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || '[]'); }
  catch { return []; }
}

function writeQueue(queue) {
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
}

function enqueue(op) {
  const queue = readQueue();
  queue.push({ ...op, ts: Date.now() });
  writeQueue(queue);
}

/* ─── Cloud ops ───────────────────────────────────────────────────────────── */

async function cloudUpsert(namespace, key, value) {
  if (!supabase) return { ok: false, reason: 'not_configured' };
  const userId = await getUserId();
  if (!userId) return { ok: false, reason: 'not_signed_in' };
  const { error } = await supabase
    .from('ace_kv')
    .upsert(
      { user_id: userId, namespace, key, value },
      { onConflict: 'user_id,namespace,key' }
    );
  if (error) {
    console.warn('[storage] cloud upsert failed', { namespace, key, reason: error.message, code: error.code, details: error.details, hint: error.hint });
    return { ok: false, reason: error.message };
  }
  return { ok: true };
}

async function cloudDelete(namespace, key) {
  if (!supabase) return { ok: false, reason: 'not_configured' };
  const userId = await getUserId();
  if (!userId) return { ok: false, reason: 'not_signed_in' };
  const { error } = await supabase
    .from('ace_kv')
    .delete()
    .eq('user_id', userId)
    .eq('namespace', namespace)
    .eq('key', key);
  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}

/* ─── Public API ──────────────────────────────────────────────────────────── */

// Read is always synchronous from the localStorage mirror.
export function get(namespace, key) {
  return readCache(namespace, key);
}

export function list(namespace) {
  return listCache(namespace);
}

// Write goes to localStorage immediately, then best-effort to cloud.
// Caller can await but doesn't need to — UI updates are already correct.
export async function set(namespace, key, value) {
  writeCache(namespace, key, value);
  const res = await cloudUpsert(namespace, key, value);
  if (!res.ok) {
    enqueue({ op: 'set', namespace, key, value, lastReason: res.reason });
  }
  return { value, cloud: res.ok, reason: res.reason };
}

export async function remove(namespace, key) {
  removeCache(namespace, key);
  const res = await cloudDelete(namespace, key);
  if (!res.ok) enqueue({ op: 'delete', namespace, key });
}

/* ─── Sync: pull everything from cloud into local cache ───────────────────── */

export async function pullAll() {
  if (!supabase) return { ok: false, reason: 'not_configured', count: 0 };
  const userId = await getUserId();
  if (!userId) return { ok: false, reason: 'not_signed_in', count: 0 };

  const { data, error } = await supabase
    .from('ace_kv')
    .select('namespace, key, value')
    .eq('user_id', userId);

  if (error) return { ok: false, reason: error.message, count: 0 };

  for (const row of data) {
    writeCache(row.namespace, row.key, row.value);
  }
  return { ok: true, count: data.length };
}

// Flush any queued writes made while offline / signed out.
export async function flushQueue() {
  const queue = readQueue();
  if (!queue.length) return { flushed: 0, failed: 0 };

  const remaining = [];
  let flushed = 0;

  for (const op of queue) {
    let res;
    if (op.op === 'set') res = await cloudUpsert(op.namespace, op.key, op.value);
    else if (op.op === 'delete') res = await cloudDelete(op.namespace, op.key);
    else continue;

    if (res.ok) flushed++;
    else remaining.push(op);
  }

  writeQueue(remaining);
  return { flushed, failed: remaining.length };
}

/* ─── One-time migration: legacy localStorage → cloud ─────────────────────── */

// Maps legacy direct localStorage keys onto (namespace, key) so existing
// data gets lifted into the adapter on first sync.
const LEGACY_KEY_MAP = [
  { legacy: 'ace_trajectory',        namespace: NAMESPACES.TRAJECTORY, key: 'plan' },
  { legacy: 'ace_qa_memory_queue',   namespace: NAMESPACES.QA_MEMORY,  key: 'queue' },
  { legacy: 'casepad_notes',         namespace: NAMESPACES.SETTINGS,   key: 'casepad_notes' },
  { legacy: 'ace_macros',            namespace: NAMESPACES.SETTINGS,   key: 'macros' },
  { legacy: 'ace_saved_cases',       namespace: NAMESPACES.SAVED_CASES, key: 'index' },
  { legacy: 'ace_knowledge',         namespace: NAMESPACES.KB,         key: 'entries' },
  { legacy: 'ace_kb_sync_url',       namespace: NAMESPACES.KB,         key: 'sync_url' },
  { legacy: 'ace_kb_last_sync',      namespace: NAMESPACES.KB,         key: 'last_sync' },
  { legacy: 'pinned_templates',      namespace: NAMESPACES.SETTINGS,   key: 'pinned_templates' },
  { legacy: 'custom_templates',      namespace: NAMESPACES.SETTINGS,   key: 'custom_templates' },
  { legacy: 'closed_cases',          namespace: NAMESPACES.SAVED_CASES, key: 'closed' },
  { legacy: 'ace_snippets',          namespace: NAMESPACES.SETTINGS,   key: 'snippets' },
  { legacy: 'ace_case_events',       namespace: NAMESPACES.SETTINGS,   key: 'case_events' },
  { legacy: 'ace_auto_csat',         namespace: NAMESPACES.SETTINGS,   key: 'auto_csat' },
];

// Families of per-instance keys: `<prefix><id>` in localStorage →
// namespace `chat`, key `<target><id>`. Used by chat histories + per-channel prefs.
const LEGACY_PREFIX_MAP = [
  { prefix: 'chat_history_', namespace: NAMESPACES.CHAT, target: 'history_' },
  { prefix: 'tone_',         namespace: NAMESPACES.CHAT, target: 'tone_' },
  { prefix: 'deep_mode_',    namespace: NAMESPACES.CHAT, target: 'deep_' },
  { prefix: 'auto_memory_',  namespace: NAMESPACES.CHAT, target: 'auto_' },
];

export async function migrateFromLocalStorage() {
  if (!supabase) return { ok: false, reason: 'not_configured', migrated: 0, queued: 0 };
  const userId = await getUserId();
  if (!userId) return { ok: false, reason: 'not_signed_in', migrated: 0, queued: 0 };

  let migrated = 0;
  let queued = 0;
  let lastReason = null;

  // 1. Direct legacy keys
  for (const m of LEGACY_KEY_MAP) {
    const raw = localStorage.getItem(m.legacy);
    if (!raw) continue;
    let value;
    try { value = JSON.parse(raw); }
    catch { value = raw; }
    const res = await set(m.namespace, m.key, value);
    if (res.cloud) migrated++;
    else { queued++; lastReason = res.reason; }
  }

  // 2. Shifts: shift_YYYY-MM-DD → namespace shifts, key = date
  const shiftKeys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('shift_')) shiftKeys.push(k);
  }
  for (const k of shiftKeys) {
    const date = k.slice('shift_'.length);
    try {
      const value = JSON.parse(localStorage.getItem(k));
      const res = await set(NAMESPACES.SHIFTS, date, value);
      if (res.cloud) migrated++;
      else { queued++; lastReason = res.reason; }
    } catch { /* skip malformed */ }
  }

  // 3. Per-channel chat families (histories + prefs).
  // One pass over localStorage so we don't scan N times.
  const prefixMatches = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    for (const m of LEGACY_PREFIX_MAP) {
      if (k.startsWith(m.prefix)) {
        prefixMatches.push({ legacyKey: k, ...m });
        break;
      }
    }
  }
  for (const m of prefixMatches) {
    const id = m.legacyKey.slice(m.prefix.length);
    const raw = localStorage.getItem(m.legacyKey);
    if (raw == null) continue;
    let value;
    try { value = JSON.parse(raw); }
    catch { value = raw; }
    const res = await set(m.namespace, `${m.target}${id}`, value);
    if (res.cloud) migrated++;
    else { queued++; lastReason = res.reason; }
  }

  return { ok: true, migrated, queued, lastReason };
}

/* ─── Safe boot hook ──────────────────────────────────────────────────────── */

// Call on app boot (and on sign-in). Pulls latest cloud state into the mirror
// and flushes any queued writes. Safe to call when signed out — becomes a noop.
export async function syncOnBoot() {
  if (!isConfigured) return { ok: false, reason: 'not_configured' };
  const userId = await getUserId();
  if (!userId) return { ok: false, reason: 'not_signed_in' };

  await flushQueue();
  const pull = await pullAll();
  return { ok: pull.ok, pulled: pull.count || 0 };
}
