// ─── Live web-knowledge injector ────────────────────────────────────────────
// Opt-in (Settings → NVIDIA NIM → "Live web-knowledge injection", off by
// default). Offered only when the local KB has no confident match for the
// customer's question (see topMatchScore() in semanticSearch.js).
//
// Flow: sanitize the question into a generic, topic-level search query (never
// the raw message — strip PII via scrubPII, then keyword-reduce, then a
// strict reject-list check) → Brave Search → NVIDIA synthesizes a grounded
// answer from the snippets. The result is always returned with its sources
// and is the caller's job to label "external/unverified" and never
// auto-insert into a customer-facing reply (see CouncilBadge.jsx).

import { scrubPII } from '@/lib/SecurityModule';
import { braveSearch } from '@/api/braveSearch';
import { nvidiaChat, getNvidiaKey } from '@/api/nvidia';
import { topMatchScore } from '@/lib/semanticSearch';

// Below this cosine-similarity score, the local KB is treated as having no
// confident answer — eligible for the web-knowledge button to appear.
const KB_CONFIDENCE_THRESHOLD = 0.1;

const STOPWORDS = new Set([
  'the','a','an','is','are','was','were','be','been','to','of','in','on','for','and','or',
  'but','with','my','i','me','it','this','that','do','does','did','can','cant','cannot',
  'how','what','why','when','where','who','will','would','should','please','hi','hello',
  'have','has','had','not','need','help','about','your','you','am','im',
]);

export function isKbConfident(query) {
  return topMatchScore(query) >= KB_CONFIDENCE_THRESHOLD;
}

// Strict reject-list — if any of these still match after scrubbing +
// keyword-reduction, abort rather than let the query leave the browser.
const RISKY_PATTERNS = [
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i, // email
  /\b\d{6,}\b/,                              // long digit run (UID/card/phone remnants)
  /\b0x[a-fA-F0-9]{8,}\b/,                   // hex address/hash fragment
  /\[[A-Z_]+\]/,                             // leftover scrub tag — drop, don't send
];

/**
 * Reduce a raw customer message to a short, generic, topic-level search
 * query. Returns null if nothing safe/useful remains.
 */
export function sanitizeQuery(rawMessage) {
  if (!rawMessage?.trim()) return null;

  // Defense in depth — scrub again even though callers already scrub before
  // storing chat state.
  let text = scrubPII(rawMessage);
  // Drop scrub-tag placeholders entirely rather than searching for them.
  text = text.replace(/\[[A-Z_]+\]/g, ' ');

  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOPWORDS.has(t) && !/^\d+$/.test(t));

  if (!tokens.length) return null;

  // Keep it generic — top 6 tokens by simple frequency, original order.
  const seen = new Set();
  const keywords = [];
  for (const t of tokens) {
    if (seen.has(t)) continue;
    seen.add(t);
    keywords.push(t);
    if (keywords.length >= 6) break;
  }

  const query = `bybit ${keywords.join(' ')}`.trim().slice(0, 150);

  if (RISKY_PATTERNS.some(rx => rx.test(query))) return null;
  return query;
}

const SYNTH_SYSTEM_PROMPT = `You answer questions using ONLY the provided web search snippets. Cite snippets by their [n] number where you use them. If the snippets don't actually answer the question, say so plainly instead of guessing. Keep it to 3-5 sentences. Never include any account identifiers, emails, or transaction hashes.`;

/**
 * Sanitize → search → synthesize. Throws on failure with a short caller-
 * displayable message (NO_NVIDIA_KEY / NO_BRAVE_RESULTS / etc).
 * Returns { query, answer, sources: [{ title, url }] }.
 */
export async function fetchWebKnowledge(rawMessage, opts = {}) {
  const query = sanitizeQuery(rawMessage);
  if (!query) throw new Error('Could not build a safe search query from this message.');

  const results = await braveSearch(query, opts.signal);
  if (!results.length) throw new Error('No web results found.');

  const snippetBlock = results
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.snippet}`)
    .join('\n\n');

  const apiKey = getNvidiaKey();
  const { text } = await nvidiaChat(
    apiKey,
    [{ role: 'user', content: `Question: ${query}\n\nWeb search snippets:\n${snippetBlock}` }],
    SYNTH_SYSTEM_PROMPT,
    300,
    'meta/llama-4-maverick-17b-128e-instruct',
    { temperature: 0.2, signal: opts.signal }
  );

  return {
    query,
    answer: text.trim(),
    sources: results.map(r => ({ title: r.title, url: r.url })),
  };
}
