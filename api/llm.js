// ─── ACE Unified LLM Proxy (Vercel serverless) ──────────────────────────────
// Single server-side gateway for ALL LLM providers: Anthropic, OpenAI, Alibaba
// Cloud Model Studio (DashScope). Keeps provider keys OFF the client when they
// are configured as serverless env vars.
//
// Why this exists:
//   The original client called api.anthropic.com directly with the key in
//   localStorage + `anthropic-dangerous-direct-browser-access`. That exposes the
//   key to any XSS / anyone with devtools. This proxy lets the key live in
//   Vercel env (ANTHROPIC_API_KEY / OPENAI_API_KEY / DASHSCOPE_API_KEY) instead.
//
// Key resolution order (per provider):
//   1. Server env var  (preferred — key never reaches the browser)
//   2. `x-client-key` request header (BYO-key fallback for local/self-host)
//   If neither is present → 401.
//
// PII scrubbing still happens client-side BEFORE the request is sent
// (SecurityModule.scrubPII), so no raw customer text is reconstructed here.
//
// Request body: { provider, payload }  where `payload` is the provider-native
// request body. We proxy the response (streaming or JSON) back unchanged.

const PROVIDERS = {
  anthropic: {
    url: 'https://api.anthropic.com/v1/messages',
    envKey: 'ANTHROPIC_API_KEY',
    authHeader: (key) => ({
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31,extended-cache-ttl-2025-04-11',
    }),
  },
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    envKey: 'OPENAI_API_KEY',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  // Alibaba Cloud Model Studio (DashScope) — INTERNATIONAL region,
  // OpenAI-compatible endpoint. Mainland China host differs; intl is used here.
  alibaba: {
    url: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
    envKey: 'DASHSCOPE_API_KEY',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  // NVIDIA NIM (build.nvidia.com) — free-tier OpenAI-compatible endpoint hosting
  // 80+ open models. Used for the QA critic pass and web-knowledge synthesis only
  // (never on the primary scenario/co-pilot path) — see src/api/nvidia.js.
  // NOTE: NVIDIA's free tier logs/trains on all inputs+outputs and disclaims
  // customer-facing use; callers must scrub PII before this ever fires (same
  // SecurityModule.scrubPII boundary as every other provider).
  nvidia: {
    url: 'https://integrate.api.nvidia.com/v1/chat/completions',
    envKey: 'NVIDIA_API_KEY',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
};

function resolveKey(provider, req) {
  const conf = PROVIDERS[provider];
  const envKey = process.env[conf.envKey];
  if (envKey) return envKey;
  const clientKey = req.headers['x-client-key'];
  if (clientKey) return clientKey;
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { provider, payload } = req.body || {};
  if (!provider || !PROVIDERS[provider]) {
    return res.status(400).json({ error: `Unknown or missing provider: ${provider}` });
  }
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'Missing payload' });
  }

  const conf = PROVIDERS[provider];
  const apiKey = resolveKey(provider, req);
  if (!apiKey) {
    return res.status(401).json({
      error: `No API key for ${provider}. Set ${conf.envKey} on the server, or send x-client-key.`,
    });
  }

  const isStream = payload.stream === true;

  let upstream;
  try {
    upstream = await fetch(conf.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...conf.authHeader(apiKey),
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return res.status(502).json({ error: `Upstream fetch failed: ${e.message}` });
  }

  // Non-OK → forward the provider error body as JSON.
  if (!upstream.ok) {
    const text = await upstream.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = { error: text }; }
    return res.status(upstream.status).json(parsed);
  }

  // Streaming (SSE) → pipe bytes straight through.
  if (isStream && upstream.body) {
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    const reader = upstream.body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
    } catch (e) {
      // Client likely disconnected — end gracefully.
      res.write(`\n\nerror: ${e.message}\n`);
    }
    return res.end();
  }

  // Non-streaming JSON.
  const data = await upstream.json();
  return res.status(200).json(data);
}
