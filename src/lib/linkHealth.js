// Client helper for the /api/checkLink serverless function.
// Extracts Bybit help-center URLs from a message body and checks them.
// Per-session cache avoids re-checking the same URL during a shift.

const BYBIT_URL_RE = /https?:\/\/(?:www\.)?bybit\.(?:com|eu)\/[^\s)\]]+/gi;
const CACHE = new Map(); // url -> { ok, checkedAt }
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min

/** Extract unique Bybit help-center URLs from a string, trimming trailing punct. */
export function extractBybitUrls(text) {
  if (!text || typeof text !== 'string') return [];
  const matches = text.match(BYBIT_URL_RE) || [];
  return [...new Set(matches.map(u => u.replace(/[.,;:!?)\]]+$/, '')))];
}

/**
 * Check all Bybit URLs in a message. Returns { urls, dead }.
 * dead = subset that returned ok:false from the server.
 * Gracefully returns { urls, dead: [] } if the endpoint itself fails —
 * we never want a dead link-check to break the chat UI.
 */
export async function checkMessageLinks(text) {
  const urls = extractBybitUrls(text);
  if (urls.length === 0) return { urls: [], dead: [] };

  const now = Date.now();
  const toCheck = [];
  const resolved = new Map();

  for (const url of urls) {
    const cached = CACHE.get(url);
    if (cached && now - cached.checkedAt < CACHE_TTL_MS) {
      resolved.set(url, cached.ok);
    } else {
      toCheck.push(url);
    }
  }

  if (toCheck.length > 0) {
    try {
      const res = await fetch('/api/checkLink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: toCheck }),
      });
      if (res.ok) {
        const data = await res.json();
        for (const r of data.results || []) {
          CACHE.set(r.url, { ok: r.ok, checkedAt: now });
          resolved.set(r.url, r.ok);
        }
      } else {
        // Endpoint failed — don't flag anything as dead, just return empty dead list
        for (const url of toCheck) resolved.set(url, true);
      }
    } catch {
      for (const url of toCheck) resolved.set(url, true);
    }
  }

  const dead = urls.filter(url => resolved.get(url) === false);
  return { urls, dead };
}
