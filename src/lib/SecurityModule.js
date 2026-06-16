// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY MODULE — Single source of truth for ALL PII scrubbing in ACE.
// ═══════════════════════════════════════════════════════════════════════════════
// RULES:
// 1. Every outbound text (to LLM, to cloud, to any external service) MUST pass
//    through scrubPII() from THIS module.
// 2. No other file may define its own PII patterns. Import from here or nowhere.
// 3. Order matters: TX_HASH (64 hex) before ETH_ADDR (40 hex) to prevent
//    partial matches. CARD/IBAN before UID to prevent number-length collisions.
// 4. This file has zero dependencies — it can be imported anywhere without
//    circular import risk.
// ═══════════════════════════════════════════════════════════════════════════════

// ── Normalization helper ──────────────────────────────────────────────────────
// Strips whitespace/separator tricks that evade digit-based patterns.
// "4 1 1 1 - 1 1 1 1 - 1 1 1 1 - 1 1 1 1" → "4111111111111111"
// "1 2 3 4 5 6 7 8" → "12345678" (UID evasion)
function normalizeDigits(text) {
  // Collapse runs of digits separated only by spaces, dots, dashes, or underscores
  // into a single digit block, so the regex can match them.
  return text.replace(/(\d)[\s.\-_]+(?=\d)/g, '$1');
}

// --- PII patterns: ordered from most specific → least specific ---
const PII_PATTERNS = [
  // Emails — RFC-ish, covers subdomain and plus-addressing
  { rx: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, tag: '[EMAIL]' },

  // Names preceded by common CRM labels (capture group replacement)
  {
    rx: /(?:(?:full[-_\s]?)?name|customer|client|from|to|sender|recipient)\s*[:\s]+([A-Z][a-z][\w'-]*(?:\s+[A-Z][a-z][\w'-]*)+)/g,
    tag: '[NAME]',
    group: 1,
  },

  // Phone numbers: international format, 10-15 digits with separators
  { rx: /(?<!\d)(\+?[\d][\d\s().\\-]{8,14}[\d])(?!\d)/g, tag: '[PHONE]' },

  // IBAN — 2-letter country + 2 check digits + up to 30 alphanumeric
  { rx: /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}\b/g, tag: '[IBAN]' },

  // API keys & secrets — Anthropic, OpenAI, Stripe, generic
  { rx: /\b(sk-ant-[a-zA-Z0-9_-]{20,}|sk-[a-zA-Z0-9]{20,}|sk_live_[a-zA-Z0-9]{20,}|pk_live_[a-zA-Z0-9]{20,}|key-[a-zA-Z0-9]{20,})\b/g, tag: '[API_KEY]' },

  // Crypto private keys — 64 hex chars with 0x prefix (ETH-style)
  { rx: /\b0x[a-fA-F0-9]{64}\b/g, tag: '[PRIVATE_KEY]' },

  // Card numbers — 13-19 contiguous digits (normalized — spaces/dashes already collapsed)
  { rx: /\b\d{13,19}\b/g, tag: '[CARD]' },

  // TX hashes — 64 hex chars bare (no 0x prefix, preceded by "tx" context to distinguish from private keys)
  { rx: /(?:tx[-_\s]?(?:hash|id)|transaction[-_\s]?(?:hash|id))\s*[:\s]*([a-fA-F0-9]{64})\b/gi, tag: '[TX_HASH]', group: 1 },
  // TX hashes — bare 64 hex without context (fallback)
  { rx: /(?<![a-fA-F0-9])\b[a-fA-F0-9]{64}\b(?![a-fA-F0-9])/g, tag: '[TX_HASH]' },

  // ETH/EVM addresses — 0x + 40 hex chars
  { rx: /\b0x[a-fA-F0-9]{40}\b/g, tag: '[ETH_ADDR]' },

  // BTC addresses — starts with 1 or 3, base58 encoding
  { rx: /\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b/g, tag: '[BTC_ADDR]' },

  // IP addresses — IPv4
  { rx: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g, tag: '[IP_ADDR]' },

  // UID-style digit blocks — 6-12 contiguous digits (normalized)
  { rx: /(?<![a-fA-F0-9])\b\d{6,12}\b(?![a-fA-F0-9])/g, tag: '[USER_ID]' },

  // Seed phrases — 12 or 24 lowercase words (BIP-39 mnemonic)
  { rx: /\b([a-z]{3,8}\s+){11}[a-z]{3,8}\b/g, tag: '[SEED_PHRASE]' },
  { rx: /\b([a-z]{3,8}\s+){23}[a-z]{3,8}\b/g, tag: '[SEED_PHRASE]' },
];

// --- Identity leak patterns (AI model name detection) ---
const IDENTITY_PATTERNS = [
  /\b(gpt[-\s]?\d[\d.]?|chatgpt|openai|gemini|bard|llama|mistral|claude|anthropic|palm|grok)\b/gi,
  /running on\s+\w+[\d.]+/gi,
  /powered by\s+(openai|anthropic|google|meta|mistral)/gi,
  /i('m| am) an? (ai|language model|llm|large language model)/gi,
];

/**
 * Scrub ALL personally identifiable information from text.
 * Safe to call multiple times — already-scrubbed tags won't re-match.
 * Returns the scrubbed string.
 */
export function scrubPII(text) {
  if (!text || typeof text !== 'string') return text || '';
  // Normalize whitespace-separated digits before pattern matching.
  // Catches evasion like "4111 1111 1111 1111" or "1 2 3 4 5 6 7 8".
  let out = normalizeDigits(text);
  for (const { rx, tag, group } of PII_PATTERNS) {
    rx.lastIndex = 0;
    if (group) {
      out = out.replace(rx, (match, g1) => match.replace(g1, tag));
    } else {
      out = out.replace(rx, tag);
    }
    rx.lastIndex = 0;
  }
  return out;
}

/**
 * Scrub text and return both the result and what was found.
 * Used by audit logging.
 */
export function scrubPIIWithAudit(text) {
  if (!text || typeof text !== 'string') return { scrubbed: text || '', found: [] };
  let out = normalizeDigits(text);
  const found = [];
  for (const { rx, tag, group } of PII_PATTERNS) {
    rx.lastIndex = 0;
    const before = out;
    if (group) {
      out = out.replace(rx, (match, g1) => match.replace(g1, tag));
    } else {
      out = out.replace(rx, tag);
    }
    rx.lastIndex = 0;
    if (out !== before) found.push(tag.replace(/[[\]]/g, ''));
  }
  return { scrubbed: out, found };
}

/**
 * Scrub AI identity leaks from response text.
 * Returns cleaned text.
 */
export function scrubIdentityLeaks(text) {
  if (!text || typeof text !== 'string') return text || '';
  let out = text;
  for (const rx of IDENTITY_PATTERNS) {
    rx.lastIndex = 0;
    out = out.replace(rx, '[REDACTED]');
    rx.lastIndex = 0;
  }
  return out;
}

/**
 * Full outbound sanitization — PII + identity leaks.
 * Call this on any text before it leaves the browser.
 */
export function sanitize(text) {
  return scrubIdentityLeaks(scrubPII(text));
}

// ═══════════════════════════════════════════════════════════════════════════════
// STORAGE SHIELD — scrub anything before it touches localStorage / IndexedDB.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Scrub a message array before writing to persistent storage.
 * Both user AND assistant messages get scrubbed — defense-in-depth
 * against the API echoing PII back in responses.
 */
export function scrubMessagesForStorage(messages) {
  if (!Array.isArray(messages)) return messages;
  return messages.map(m => ({
    ...m,
    content: typeof m.content === 'string' ? scrubPII(m.content) : m.content,
  }));
}

/**
 * Scrub an arbitrary text value before writing to storage.
 * Use for case summaries, notes, any free-text field being persisted.
 */
export function scrubForStorage(text) {
  if (!text || typeof text !== 'string') return text || '';
  return scrubPII(text);
}
