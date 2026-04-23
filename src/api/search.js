// Web search via SerpAPI — proxied through Vite dev server to avoid CORS.
// Proxy rule: /api/serpapi/* → https://serpapi.com/*

const SERP_KEY_SLOT = 'serpapi_key';

export function getSerpApiKey() {
  return localStorage.getItem(SERP_KEY_SLOT) || '';
}

export function setSerpApiKey(key) {
  localStorage.setItem(SERP_KEY_SLOT, key.trim());
}

export function clearSerpApiKey() {
  localStorage.removeItem(SERP_KEY_SLOT);
}

/**
 * Search the web via SerpAPI Google engine.
 * Returns { results: string, links: string[] } — results is a plain-text
 * summary suitable for injecting into an LLM prompt.
 */
export async function searchWeb(query, { num = 8 } = {}) {
  const apiKey = getSerpApiKey();
  if (!apiKey) throw new Error('NO_SERP_KEY');

  const params = new URLSearchParams({
    q: query,
    api_key: apiKey,
    engine: 'google',
    num: String(num),
    gl: 'us',
    hl: 'en',
  });

  const res = await fetch(`/api/serpapi/search.json?${params}`);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`SerpAPI error ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();

  // Extract organic results
  const organic = (data.organic_results || []).slice(0, num);
  const links = organic.map(r => r.link).filter(Boolean);

  // Build plain-text context block for LLM injection
  const lines = organic.map((r, i) => {
    const parts = [`[${i + 1}] ${r.title}`];
    if (r.snippet) parts.push(r.snippet);
    if (r.link) parts.push(`URL: ${r.link}`);
    if (r.date) parts.push(`Date: ${r.date}`);
    return parts.join('\n');
  });

  // Include answer box / knowledge panel if present
  let topAnswer = '';
  if (data.answer_box?.snippet) {
    topAnswer = `FEATURED ANSWER: ${data.answer_box.snippet}\nSource: ${data.answer_box.link || 'N/A'}\n\n`;
  } else if (data.knowledge_graph?.description) {
    topAnswer = `KNOWLEDGE PANEL: ${data.knowledge_graph.description}\n\n`;
  }

  const results = topAnswer + lines.join('\n\n');
  return { results, links };
}
