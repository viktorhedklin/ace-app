// ─── Brave Search proxy (Vercel serverless) ─────────────────────────────────
// Backs the opt-in live web-knowledge injector (Settings → NVIDIA NIM →
// "Live web-knowledge injection"). Keeps BRAVE_SEARCH_API_KEY off the client
// when configured server-side, same key-resolution order as api/llm.js:
//   1. Server env var BRAVE_SEARCH_API_KEY
//   2. `x-client-key` header (BYO-key fallback)
//
// Query sanitization (stripping UID/email/tx-hash/etc and generic-izing the
// query) happens client-side BEFORE this is called (src/lib/webKnowledge.js)
// — this endpoint just forwards an already-sanitized topic query to Brave.

const BRAVE_URL = 'https://api.search.brave.com/res/v1/web/search';

function resolveKey(req) {
  return process.env.BRAVE_SEARCH_API_KEY || req.headers['x-client-key'] || null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query } = req.body || {};
  if (!query || typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({ error: 'Missing query' });
  }
  if (query.length > 200) {
    return res.status(400).json({ error: 'Query too long (max 200 chars)' });
  }

  const apiKey = resolveKey(req);
  if (!apiKey) {
    return res.status(401).json({
      error: 'No API key for Brave Search. Set BRAVE_SEARCH_API_KEY on the server, or send x-client-key.',
    });
  }

  const params = new URLSearchParams({ q: query, count: '5' });

  let upstream;
  try {
    upstream = await fetch(`${BRAVE_URL}?${params}`, {
      headers: {
        Accept: 'application/json',
        'X-Subscription-Token': apiKey,
      },
    });
  } catch (e) {
    return res.status(502).json({ error: `Upstream fetch failed: ${e.message}` });
  }

  if (!upstream.ok) {
    const text = await upstream.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = { error: text }; }
    return res.status(upstream.status).json(parsed);
  }

  const data = await upstream.json();
  const results = (data.web?.results || []).slice(0, 5).map(r => ({
    title: r.title,
    url: r.url,
    snippet: r.description,
  }));

  return res.status(200).json({ results });
}
