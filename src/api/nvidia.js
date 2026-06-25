// ─── NVIDIA NIM (build.nvidia.com) client ───────────────────────────────────
// Free-tier OpenAI-compatible endpoint hosting 80+ open models. Mirrors
// alibaba.js / openai.js patterns exactly. All requests go through the
// serverless proxy (/api/llm) so the NVIDIA key can live server-side
// (NVIDIA_API_KEY). If no server key is set, the user's locally-stored key
// is sent via the BYO-key header.
//
// IMPORTANT — this provider is intentionally scoped to two side-features only
// (QA critic pass, web-knowledge synthesis), never the primary scenario or
// co-pilot path. NVIDIA's free tier logs and trains on all inputs/outputs and
// explicitly disclaims customer-facing production use — every call here MUST
// scrub PII first (same boundary as every other provider) and the caller is
// responsible for gating these features behind an explicit opt-in toggle.

import { scrubPII } from '@/lib/SecurityModule';
import { llmFetch } from '@/api/proxy';

const NVIDIA_KEY_SLOT = 'nvidia_api_key';

export function getNvidiaKey() {
  return localStorage.getItem(NVIDIA_KEY_SLOT) || '';
}

export function setNvidiaKey(key) {
  localStorage.setItem(NVIDIA_KEY_SLOT, key.trim());
}

export function clearNvidiaKey() {
  localStorage.removeItem(NVIDIA_KEY_SLOT);
}

// Scrub message content — handles both string and content-array formats.
function scrubContent(content) {
  if (typeof content === 'string') return scrubPII(content);
  if (Array.isArray(content)) {
    return content.map(block => {
      if (block.type === 'text') return { ...block, text: scrubPII(block.text) };
      // Anthropic-style vision block -> OpenAI-compatible image_url block
      if (block.type === 'image') {
        return { type: 'image_url', image_url: { url: `data:${block.source.media_type};base64,${block.source.data}` } };
      }
      return block;
    });
  }
  return content;
}

// Convert Anthropic-style system prompt (string or content blocks) to a single
// system message for the OpenAI-compatible API.
function buildSystemMessages(systemPrompt) {
  if (!systemPrompt) return [];
  if (typeof systemPrompt === 'string') {
    return [{ role: 'system', content: systemPrompt }];
  }
  const text = systemPrompt
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('\n\n');
  return text ? [{ role: 'system', content: text }] : [];
}

/**
 * Non-streaming NVIDIA NIM chat completion.
 * Returns { text, usage } where usage = { input_tokens, output_tokens }.
 */
export async function nvidiaChat(apiKey, messages, systemPrompt, maxTokens = 1024, model = 'meta/llama-4-maverick-17b-128e-instruct', opts = {}) {
  const safeMessages = messages.map(m => ({
    ...m,
    content: m.role === 'user' ? scrubContent(m.content) : m.content,
  }));
  const allMessages = [...buildSystemMessages(systemPrompt), ...safeMessages];

  const payload = {
    model,
    messages: allMessages,
    max_tokens: maxTokens,
  };
  if (opts.temperature != null) payload.temperature = opts.temperature;

  const res = await llmFetch('nvidia', apiKey, payload, opts.signal);

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || err?.message || `NVIDIA error ${res.status}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '';
  const usage = {
    input_tokens: data.usage?.prompt_tokens || 0,
    output_tokens: data.usage?.completion_tokens || 0,
  };
  return { text, usage };
}

/**
 * Streaming NVIDIA NIM chat completion.
 * Calls onToken(token, accumulated) for each chunk. Returns { text, usage }.
 */
export async function nvidiaChatStream(apiKey, messages, systemPrompt, maxTokens, onToken, model = 'meta/llama-4-maverick-17b-128e-instruct') {
  const safeMessages = messages.map(m => ({
    ...m,
    content: m.role === 'user' ? scrubContent(m.content) : m.content,
  }));
  const allMessages = [...buildSystemMessages(systemPrompt), ...safeMessages];

  const res = await llmFetch('nvidia', apiKey, {
    model,
    messages: allMessages,
    max_tokens: maxTokens,
    stream: true,
    stream_options: { include_usage: true },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || err?.message || `NVIDIA error ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';
  let usage = { input_tokens: 0, output_tokens: 0 };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') return { text: fullText, usage };
      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          fullText += delta;
          onToken(delta, fullText);
        }
        if (parsed.usage) {
          usage = {
            input_tokens: parsed.usage.prompt_tokens || 0,
            output_tokens: parsed.usage.completion_tokens || 0,
          };
        }
      } catch { /* ignore malformed lines */ }
    }
  }
  return { text: fullText, usage };
}
