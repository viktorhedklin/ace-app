// ─── Local Case Memory — IndexedDB ───────────────────────────────────────────
// Tracks scrubbed case records across all tools.
// Zero PII: all records should have UIDs already scrubbed by scrubPII() before entry.

const DB_NAME = 'ace_case_memory';
const DB_VERSION = 1;
const STORE = 'cases';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('uid', 'uid', { unique: false });
        store.createIndex('ts', 'ts', { unique: false });
        store.createIndex('tool', 'tool', { unique: false });
        store.createIndex('vipLevel', 'vipLevel', { unique: false });
      }
    };
  });
}

// Save a case record. uid should already be scrubbed to [USER_ID] or a hashed ref.
export async function saveCase({ uid = '', tool = '', channel = '', vipLevel = 0, notes = '' } = {}) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const req = tx.objectStore(STORE).add({ uid, tool, channel, vipLevel, ts: Date.now(), notes });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch { /* non-critical — never block UI */ }
}

// Get all cases for a specific UID
export async function getCasesByUID(uid) {
  if (!uid) return [];
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).index('uid').getAll(uid);
      req.onsuccess = () => resolve((req.result || []).reverse());
      req.onerror = () => reject(req.error);
    });
  } catch { return []; }
}

// Get cases from the last N hours — for the Case Timeline HUD
export async function getRecentCases(hours = 4) {
  try {
    const db = await openDB();
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).index('ts').getAll(IDBKeyRange.lowerBound(cutoff));
      req.onsuccess = () => resolve((req.result || []).reverse());
      req.onerror = () => reject(req.error);
    });
  } catch { return []; }
}

export async function getAllCases() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      req.onsuccess = () => resolve((req.result || []).reverse());
      req.onerror = () => reject(req.error);
    });
  } catch { return []; }
}
