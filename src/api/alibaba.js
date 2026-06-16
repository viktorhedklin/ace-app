// ─── Alibaba Cloud Model Studio (DashScope) client ──────────────────────────
// INTERNATIONAL region, OpenAI-compatible endpoint. Mirrors openai.js.
// All requests go through the serverless proxy (/api/llm) so the DashScope key
// can live server-side (DASHSCOPE_API_KEY). If no server key is set, the user's
// locally-stored key is sent via the BYO-key header.
//
// Models (per Viktor's setup): qwen3.7-max, qwen3.7-plus, deepseek-v4-flash,
// qwen-max, qwen-plus.

import { scrubPII } from '@/lib/SecurityModule';
import { llmFetch } from '@/api/proxy';

const ALIBABA_KEY_SLOT = 'alibaba_api_key';

export function getAlibabaKey() {
  return localStorage.getItem(ALIBABA_KEY_SLOT) || '';
}

export function setAlibabaKey(key) {
  localStorage.setItem(ALIBABA_KEY_SLOT, key.trim());
}

export function clearAlibabaKey() {
  localStorage.removeItem(ALIBABA_KEY_SLOT);
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
 * Non-streaming DashScope chat completion.
 * Returns { text, usage } where usage = { input_tokens, output_tokens }.
 */
export async function alibabaChat(apiKey, messages, systemPrompt, maxTokens = 2048, model = 'qwen-plus') {
  const safeMessages = messages.map(m => ({
    ...m,
    content: m.role === 'user' ? scrubContent(m.content) : m.content,
  }));
  const allMessages = [...buildSystemMessages(systemPrompt), ...safeMessages];

  const res = await llmFetch('alibaba', apiKey, {
    model,
    messages: allMessages,
    max_tokens: maxTokens,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || err?.message || `Alibaba error ${res.status}`);
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
 * Streaming DashScope chat completion.
 * Calls onToken(token, accumulated) for each chunk. Returns { text, usage }.
 */
export async function alibabaChatStream(apiKey, messages, systemPrompt, maxTokens, onToken, model = 'qwen-plus') {
  const safeMessages = messages.map(m => ({
    ...m,
    content: m.role === 'user' ? scrubContent(m.content) : m.content,
  }));
  const allMessages = [...buildSystemMessages(systemPrompt), ...safeMessages];

  const res = await llmFetch('alibaba', apiKey, {
    model,
    messages: allMessages,
    max_tokens: maxTokens,
    stream: true,
    stream_options: { include_usage: true },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || err?.message || `Alibaba error ${res.status}`);
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
