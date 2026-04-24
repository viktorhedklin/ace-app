// ─── QA memory queue — durable feedback entries from QA reviews ───────────
// Each time a QA review is flagged with actionable issues, the memory
// writer LLM generates a short feedback entry; we keep the last 50 in a
// queue so the Trajectory coach can surface recurring patterns.
//
// Namespace = 'qa_memory', key = 'queue', value = [{ ts, sourceEntry, body }]

import { get, set, remove, NAMESPACES } from './storage';

const LEGACY_KEY = 'ace_qa_memory_queue';
const MAX_ENTRIES = 50;

export function getQueue() {
  // Prefer adapter; fall back to legacy key.
  const fromAdapter = get(NAMESPACES.QA_MEMORY, 'queue');
  if (Array.isArray(fromAdapter)) return fromAdapter;
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export async function pushEntry(entry) {
  const next = [...getQueue(), entry].slice(-MAX_ENTRIES);
  await set(NAMESPACES.QA_MEMORY, 'queue', next);
  localStorage.removeItem(LEGACY_KEY);
  return next;
}

export async function clearQueue() {
  await remove(NAMESPACES.QA_MEMORY, 'queue');
  localStorage.removeItem(LEGACY_KEY);
}
