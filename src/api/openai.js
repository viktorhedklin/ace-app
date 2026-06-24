// OpenAI API client — mirrors claude.js patterns for provider routing.
// Key stored separately from Anthropic key.

import { scrubPII } from '@/lib/SecurityModule';
import { llmFetch } from '@/api/proxy';

const OPENAI_KEY_SLOT = 'openai_api_key_v2'; // v2 to avoid collision with legacy slot

export function getOpenAIKey() {
  return localStorage.getItem(OPENAI_KEY_SLOT) || '';
}

export function setOpenAIKey(key) {
  localStorage.setItem(OPENAI_KEY_SLOT, key.trim());
}

export function clearOpenAIKey() {
  localStorage.removeItem(OPENAI_KEY_SLOT);
}

// Newer OpenAI models (gpt-5 family, gpt-4.1) require max_completion_tokens
// instead of max_tokens. Route based on model id.
function tokenLimitField(model, maxTokens) {
  const needsNewField = /^(gpt-5|gpt-4\.1)/i.test(model);
  return needsNewField ? { max_completion_tokens: maxTokens } : { max_tokens: maxTokens };
}

// Scrub message content — handles both string and content-array formats
function scrubContent(content) {
  if (typeof content === 'string') return scrubPII(content);
  if (Array.isArray(content)) {
    return content.map(block => {
      if (block.type === 'text') return { ...block, text: scrubPII(block.text) };
      return block;
    });
  }
  return content;
}

// Convert Anthropic-style system prompt (string or content blocks) to OpenAI messages
function buildSystemMessages(systemPrompt) {
  if (!systemPrompt) return [];
  if (typeof systemPrompt === 'string') {
    return [{ role: 'system', content: systemPrompt }];
  }
  // Array of content blocks from buildCachedSystem — join text blocks into one system message
  const text = systemPrompt
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('\n\n');
  return text ? [{ role: 'system', content: text }] : [];
}

/**
 * Non-streaming OpenAI chat completion.
 * Returns { text, usage } where usage = { input_tokens, output_tokens }.
 */
export async function openaiChat(apiKey, messages, systemPrompt, maxTokens = 2048, model = 'gpt-4o', opts = {}) {
  const safeMessages = messages.map(m => ({
    ...m,
    content: m.role === 'user' ? scrubContent(m.content) : m.content,
  }));

  const allMessages = [...buildSystemMessages(systemPrompt), ...safeMessages];

  const res = await llmFetch('openai', apiKey, {
    model, ...tokenLimitField(model, maxTokens), messages: allMessages,
    ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
    ...(opts.temperature != null ? { temperature: opts.temperature } : {}),
  }, opts.signal);

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `OpenAI error ${res.status}`);
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
 * Streaming OpenAI chat completion.
 * Calls onToken(token, accumulated) for each chunk.
 * Returns { text, usage }.
 */
export async function openaiChatStream(apiKey, messages, systemPrompt, maxTokens, onToken, model = 'gpt-4o') {
  const safeMessages = messages.map(m => ({
    ...m,
    content: m.role === 'user' ? scrubContent(m.content) : m.content,
  }));

  const allMessages = [...buildSystemMessages(systemPrompt), ...safeMessages];

  const res = await llmFetch('openai', apiKey, {
    model, ...tokenLimitField(model, maxTokens), messages: allMessages,
    stream: true, stream_options: { include_usage: true },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `OpenAI error ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';
  let usage = { input_tokens: 0, output_tokens: 0 };

  while (true) {
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
        // Usage comes in the final chunk
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
