// ─── LLM proxy client ───────────────────────────────────────────────────────
// All provider clients (claude.js, openai.js, alibaba.js) route their requests
// through the serverless proxy at /api/llm so provider keys can stay server-side.
//
// Key handling:
//   - If the server has the provider key in env (ANTHROPIC_API_KEY / OPENAI_API_KEY
//     / DASHSCOPE_API_KEY), the client need not send anything — the proxy uses env.
//   - Otherwise the locally-stored key is forwarded via the `x-client-key` header
//     (BYO-key fallback for local dev / self-host without server env).
//
// The proxy returns the provider-native response (JSON or SSE stream) unchanged,
// so callers parse it exactly as they would the direct provider response.

const PROXY_URL = '/api/llm';

/**
 * POST a provider-native payload to the proxy.
 * @param {'anthropic'|'openai'|'alibaba'} provider
 * @param {string} clientKey  locally-stored key (sent only if present; ignored when server has env key)
 * @param {object} payload    provider-native request body
 * @returns {Promise<Response>} raw fetch Response (caller reads .json() or .body stream)
 */
export async function llmFetch(provider, clientKey, payload) {
  const headers = { 'Content-Type': 'application/json' };
  if (clientKey) headers['x-client-key'] = clientKey;

  return fetch(PROXY_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ provider, payload }),
  });
}
