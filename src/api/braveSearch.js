// ─── Brave Search client ─────────────────────────────────────────────────────
// Thin wrapper around the /api/braveSearch proxy. Mirrors the BYOK pattern
// used by nvidia.js/alibaba.js — locally-stored key sent only as a fallback
// when the server has no BRAVE_SEARCH_API_KEY configured.

const BRAVE_KEY_SLOT = 'brave_search_key';

export function getBraveKey() {
  return localStorage.getItem(BRAVE_KEY_SLOT) || '';
}

export function setBraveKey(key) {
  localStorage.setItem(BRAVE_KEY_SLOT, key.trim());
}

export function clearBraveKey() {
  localStorage.removeItem(BRAVE_KEY_SLOT);
}

/**
 * Run a (already-sanitized) search query through Brave Search.
 * Returns [{ title, url, snippet }] — at most 5 results.
 */
export async function braveSearch(query, signal) {
  const clientKey = getBraveKey();
  const headers = { 'Content-Type': 'application/json' };
  if (clientKey) headers['x-client-key'] = clientKey;

  const res = await fetch('/api/braveSearch', {
    method: 'POST',
    headers,
    body: JSON.stringify({ query }),
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `Brave Search error ${res.status}`);
  }

  const data = await res.json();
  return data.results || [];
}
