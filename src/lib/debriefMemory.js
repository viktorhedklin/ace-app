// ─── Debrief lesson memory ───────────────────────────────────────────────────
// Persists lessons extracted from debrief conversations so ACE can reference
// them in future debriefs and scenario builds. Each lesson has a tag, the
// scenario context it came from, and a timestamp.

import { NAMESPACES, get, set } from './storage';

const NS = NAMESPACES.DEBRIEF;
const LESSONS_KEY = 'lessons';

function uid() {
  return `les_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// Returns flat array of { id, lesson, tag, scenarioId, scenarioTitle, savedAt }
export function listLessons() {
  const raw = get(NS, LESSONS_KEY);
  if (!Array.isArray(raw)) return [];
  return raw.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
}

export async function saveLessons(lessonsArray, { scenarioId, scenarioTitle } = {}) {
  const existing = listLessons();
  const now = Date.now();
  const newEntries = (lessonsArray || []).map(l => ({
    id: uid(),
    lesson: l.lesson || String(l),
    tag: l.tag || 'general',
    scenarioId: scenarioId || null,
    scenarioTitle: scenarioTitle || null,
    savedAt: now,
  }));
  const updated = [...existing, ...newEntries];
  await set(NS, LESSONS_KEY, updated);
  return updated;
}

export async function deleteLesson(id) {
  const existing = listLessons();
  await set(NS, LESSONS_KEY, existing.filter(l => l.id !== id));
}

export async function clearAllLessons() {
  await set(NS, LESSONS_KEY, []);
}
