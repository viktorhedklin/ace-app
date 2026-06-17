// ─── Saved-scenario library ─────────────────────────────────────────────────
// Persists built scenarios so the agent can reopen them, practice against them,
// rename or delete them. Backed by the unified storage adapter (localStorage
// mirror + Supabase). One record per scenario under NAMESPACES.SCENARIOS, keyed
// by a stable internal recordId (NOT the human-facing scenario.id, which the
// user can edit freely without clobbering the saved record).

import { NAMESPACES, get, set, list, remove } from './storage';

const NS = NAMESPACES.SCENARIOS;

function uid() {
  return `scn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// Short human label for the library list.
export function scenarioLabel(scenario) {
  return (
    (scenario?.title && String(scenario.title).trim()) ||
    (scenario?.id && String(scenario.id).trim()) ||
    'Untitled scenario'
  );
}

// List saved scenarios, newest-updated first.
// Returns [{ recordId, name, scenario, createdAt, updatedAt }]
export function listScenarios() {
  return list(NS)
    .map(({ key, value }) => ({ recordId: key, ...value }))
    .filter(r => r && r.scenario)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function getScenario(recordId) {
  const v = get(NS, recordId);
  return v ? { recordId, ...v } : null;
}

// Create a new saved record. Returns the recordId.
export async function saveScenario(scenario, name) {
  const recordId = uid();
  const now = Date.now();
  const rec = {
    name: (name && name.trim()) || scenarioLabel(scenario),
    scenario,
    createdAt: now,
    updatedAt: now,
  };
  await set(NS, recordId, rec);
  return recordId;
}

// Update the scenario body of an existing record (used for auto-save while editing).
export async function updateScenario(recordId, scenario) {
  const existing = get(NS, recordId);
  if (!existing) return saveScenario(scenario);
  const rec = { ...existing, scenario, updatedAt: Date.now() };
  await set(NS, recordId, rec);
  return recordId;
}

export async function renameScenario(recordId, name) {
  const existing = get(NS, recordId);
  if (!existing) return;
  await set(NS, recordId, { ...existing, name: (name || '').trim() || existing.name, updatedAt: Date.now() });
}

export async function deleteScenario(recordId) {
  await remove(NS, recordId);
}
