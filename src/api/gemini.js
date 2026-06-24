// ─── Google Gemini client ────────────────────────────────────────────────────
// Uses Google's OpenAI-compatibility endpoint, not the native Gemini API —
// mirrors nvidia.js / alibaba.js exactly so it slots into the same proxy and
// dispatch pattern. All requests go through the serverless proxy (/api/llm)
// so the key can live server-side (GEMINI_API_KEY). If no server key is set,
// the user's locally-stored key is sent via the BYO-key header.

import { scrubPII } from '@/lib/SecurityModule';
import { llmFetch } from '@/api/proxy';

const GEMINI_KEY_SLOT = 'gemini_api_key';

export function getGeminiKey() {
  return localStorage.getItem(GEMINI_KEY_SLOT) || '';
}

export function setGeminiKey(key) {
  localStorage.setItem(GEMINI_KEY_SLOT, key.trim());
}

export function clearGeminiKey() {
  localStorage.removeItem(GEMINI_KEY_SLOT);
}

// Scrub message content — handles both string and content-array formats.
function scrubContent(content) {
  if (typeof content === 'string') return scrubPII(content);
  if (Array.isArray(content)) {
    return content.map(block =>
      block.type === 'text' ? { ...block, text: scrubPII(block.text) } : block
    );
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
 * Non-streaming Gemini chat completion (via OpenAI-compat endpoint).
 * Returns { text, usage } where usage = { input_tokens, output_tokens }.
 */
export async function geminiChat(apiKey, messages, systemPrompt, maxTokens = 1024, model = 'gemini-2.5-flash', opts = {}) {
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

  const res = await llmFetch('gemini', apiKey, payload, opts.signal);

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || err?.message || `Gemini error ${res.status}`);
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
 * Streaming Gemini chat completion (via OpenAI-compat endpoint).
 * Calls onToken(token, accumulated) for each chunk. Returns { text, usage }.
 */
export async function geminiChatStream(apiKey, messages, systemPrompt, maxTokens, onToken, model = 'gemini-2.5-flash') {
  const safeMessages = messages.map(m => ({
    ...m,
    content: m.role === 'user' ? scrubContent(m.content) : m.content,
  }));
  const allMessages = [...buildSystemMessages(systemPrompt), ...safeMessages];

  const res = await llmFetch('gemini', apiKey, {
    model,
    messages: allMessages,
    max_tokens: maxTokens,
    stream: true,
    stream_options: { include_usage: true },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || err?.message || `Gemini error ${res.status}`);
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
