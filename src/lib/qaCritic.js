// ─── NVIDIA QA critic pass ──────────────────────────────────────────────────
// Side critique of a drafted reply — tone, missing info, policy risk. Opt-in
// only (Settings → NVIDIA NIM toggle), never on the primary draft-generation
// path, never auto-inserted into the outgoing message. Both inputs are
// already scrubbed at the call site (Chat.jsx stores only scrubbed text in
// state); nvidiaChat() scrubs user-role content again as defense in depth.

import { nvidiaChat, getNvidiaKey } from '@/api/nvidia';

const SYSTEM_PROMPT = `You are a QA reviewer for a crypto-exchange customer support team. Given the customer's message and the agent's drafted reply, first output exactly one line "RISK: low" or "RISK: medium" or "RISK: high" reflecting overall tone/policy/compliance risk, then a blank line, then a SHORT critique (max 3 bullet points) covering tone, missing information, and policy/compliance risk. Be specific and actionable — if the draft is solid, say so briefly rather than inventing issues. Never include or repeat any account identifiers, emails, or transaction hashes.`;

const RISK_LINE = /^RISK:\s*(low|medium|high)\b/i;

const CROSS_CHECK_SYSTEM_PROMPT = `You are a second, independent QA reviewer fact-checking a colleague's drafted reply to a crypto-exchange customer. You have not seen any other critique. Give a terse 1-2 sentence verdict: do you agree the reply is accurate and safe to send, and flag anything additional you'd want changed. Never include or repeat any account identifiers, emails, or transaction hashes.`;

/**
 * Critique a drafted reply against the customer's message.
 * Returns { text, risk }. Throws on failure (caller handles display).
 */
export async function critiqueDraft(customerMessage, draftReply, opts = {}) {
  const apiKey = getNvidiaKey();
  const { text } = await nvidiaChat(
    apiKey,
    [{ role: 'user', content: `Customer message:\n${customerMessage}\n\nAgent's drafted reply:\n${draftReply}` }],
    SYSTEM_PROMPT,
    300,
    'meta/llama-4-maverick-17b-128e-instruct',
    { temperature: 0.3, signal: opts.signal }
  );
  const trimmed = text.trim();
  const match = trimmed.match(RISK_LINE);
  const risk = match ? match[1].toLowerCase() : 'low';
  const critique = match ? trimmed.slice(match[0].length).replace(/^\s+/, '') : trimmed;
  return { text: critique, risk };
}

/**
 * Independent second opinion on a drafted reply — only invoked when the
 * primary QA critic flags non-low risk. Returns the verdict text. Throws on
 * failure (caller handles display).
 */
export async function crossCheckDraft(customerMessage, draftReply, opts = {}) {
  const apiKey = getNvidiaKey();
  const { text } = await nvidiaChat(
    apiKey,
    [{ role: 'user', content: `Customer message:\n${customerMessage}\n\nAgent's drafted reply:\n${draftReply}` }],
    CROSS_CHECK_SYSTEM_PROMPT,
    200,
    'meta/llama-4-maverick-17b-128e-instruct',
    { temperature: 0.3, signal: opts.signal }
  );
  return text.trim();
}
