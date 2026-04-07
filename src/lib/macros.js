// ─── Macro Engine ─────────────────────────────────────────────────────────────
// Chain tool navigations + template insertions into single-key commands (Alt+1..9).
// Stored in localStorage — no API, no external state.

const STORAGE_KEY = 'ace_macros';

export const DEFAULT_MACROS = [
  { id: 'm1', key: 1, name: 'P2P Payment Dispute', icon: '⚖️', actions: [{ type: 'navigate', path: '/p2p-dispute' }] },
  { id: 'm2', key: 2, name: 'Missing Deposit Wizard', icon: '💸', actions: [{ type: 'navigate', path: '/missing-deposit' }] },
  { id: 'm3', key: 3, name: 'Hack Case SOP', icon: '🔴', actions: [{ type: 'navigate', path: '/hack-case' }] },
  { id: 'm4', key: 4, name: 'SEPA Delay Lookup', icon: '💶', actions: [{ type: 'navigate', path: '/sepa-delay' }] },
  { id: 'm5', key: 5, name: 'Quality Check', icon: '🎯', actions: [{ type: 'navigate', path: '/quality-check' }] },
];

export function getMacros() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_MACROS;
  } catch {
    return DEFAULT_MACROS;
  }
}

export function saveMacros(macros) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(macros));
}

export function addMacro({ key, name, icon, actions }) {
  const macros = getMacros();
  const existing = macros.findIndex(m => m.key === key);
  const next = { id: `m${key}_${Date.now()}`, key, name, icon: icon || '⚡', actions };
  if (existing >= 0) macros[existing] = next;
  else macros.push(next);
  saveMacros(macros);
  return macros;
}

export function deleteMacro(id) {
  const updated = getMacros().filter(m => m.id !== id);
  saveMacros(updated);
  return updated;
}

// Execute a single macro — actions are dispatched via the navigate fn
export function executeMacro(macro, navigate) {
  if (!macro?.actions?.length) return;
  for (const action of macro.actions) {
    if (action.type === 'navigate') navigate(action.path);
  }
}
