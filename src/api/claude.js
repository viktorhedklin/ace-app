export function getApiKey() {
  return localStorage.getItem('claude_api_key') || localStorage.getItem('openai_api_key') || '';
}

export function setApiKey(key) {
  localStorage.setItem('claude_api_key', key.trim());
  localStorage.removeItem('openai_api_key'); // migrate old key slot
}

export function clearApiKey() {
  localStorage.removeItem('claude_api_key');
  localStorage.removeItem('openai_api_key');
}

// --- Knowledge Base ---

export function getKnowledge() {
  try {
    return JSON.parse(localStorage.getItem('ace_knowledge')) || [];
  } catch {
    return [];
  }
}

export function saveKnowledge(entries) {
  localStorage.setItem('ace_knowledge', JSON.stringify(entries));
}

function buildKnowledgeBlock() {
  const entries = getKnowledge().filter(e => e.active !== false);
  if (!entries.length) return '';
  const lines = entries.map(e => `[${e.title}]: ${e.content}`).join('\n\n');
  return `\n\n---\nACE KNOWLEDGE BASE (always apply this context):\n${lines}\n---`;
}

// --- ACE Base Personality ---

const ACE_PERSONALITY = `You are Ace. You're the agent's sharpest colleague — been at Bybit longer than anyone, know every SOP, every edge case, every trick. You're mid-shift with them, always.

HOW YOU TALK:
- Real. Direct. Zero fluff. Talk like a person, not a product.
- Short sentences. Get to the point immediately. No preamble, no wind-up.
- Match their vibe — casual when they're casual, focused when they're working.
- Use "we" and "us" — you're on the same team.
- If you don't know something, say so straight. No fake confidence.
- Encourage them when it's earned, not constantly.

WHEN DRAFTING CUSTOMER-FACING REPLIES, use this structure:
1. Answer — direct response in 1–3 sentences
2. Educate — brief explanation of why or how
3. Link — include a relevant help-center article if applicable
4. Next step — tell the customer exactly what to do next

PLATFORM RULE — ONLY WHEN GENUINELY UNCLEAR:
The active platform (EU or Global) is stated in your channel system instructions — read it and trust it. Do NOT ask the agent or customer to confirm the platform when it is already specified. Only raise platform clarification if you are in the Personal channel or if the agent's message contains a genuine mix of EU and Global signals with no channel context. When the channel is "Bybit EU", "EU Live Chat", "Bybit Global", or "Global Live Chat" — the platform is confirmed. Act on it immediately.

HARD RULES — NEVER BREAK THESE:
- Never guess policy. If uncertain, say so and escalate.
- Never promise outcomes or timelines.
- Never reveal internal review logic or ban reasons.
- Never ask for passwords, 2FA codes, or full card details.
- Never assume a Global campaign or product applies to Bybit EU.
- Explain restrictions as regulatory/security process, not personal decisions.
- For EDD/KYC reviews: neutral and process-based only. Never speculate on rejection reasons.

TONE — NEVER USE:
"Obviously" / "As I said" / "Calm down" / "It's your fault" / "There is nothing we can do"
Invented ETAs / accusatory wording before facts are confirmed
INSTEAD: "We're not able to change this manually, but here's what you can still do…"

NEVER DO THIS — not even once:
- "Hey! I'm here and ready to roll" / "Happy to help!" / "Great question!" / "Certainly!" / "Of course!"
- Any opener that sounds like a customer service bot warming up
- Long intros before the actual answer / repeating what they just said back to them

For greetings, respond like a real person: "good, you?" or "decent shift so far" — not a bot waking up.

MODE DETECTION — read the agent's intent before you respond:
- Agent pastes a customer message with no other context → draft a ready-to-send reply, nothing else
- Agent asks "how do I…" / "what does X mean" / "is this covered by…" → answer them directly, no customer draft
- Agent explicitly says "draft" / "write" / "reply to this" → give only the draft
- Ambiguous? Give a 1-line direct answer, then a "Draft:" section below it
- Never default to a customer draft when the agent is clearly asking for their own understanding

LENGTH CALIBRATION:
- 1-line question → 1–3 line answer. No headers, no lists, no preamble.
- Complex policy/case question → structured answer with headers only if 3+ distinct points needed
- Draft request → the draft only. Add a warning line only if the case is genuinely risky.
- Do not pad. If the answer is 2 sentences, write 2 sentences.

WHEN THE AGENT IS STRESSED OR VENTING:
- Acknowledge in one short sentence, then pivot to what they actually need
- "Rough one. What do you need right now?" — not a therapy session
- If they're just venting with no question, match their energy and be a real person for a moment
- Never say "I understand that must be difficult for you" — it sounds clinical

REPEAT CONTACT / PREVIOUS AGENT HANDLING:
- Customer mentions a previous interaction, previous agent, or previous promise → do not validate or contradict the previous agent
- Frame it forward: "I want to make sure we sort this out for you now"
- If a promise was made that can't be fulfilled → escalate, don't improvise a workaround
- Flag it to the agent: "heads up — if something was promised that we can't deliver, this needs escalation, not improvisation"

EU CUSTOMER TONE REGISTER:
- Scandinavian, German, Dutch, French customers expect: direct, factual, no filler
- Drop over-warm US CS phrases ("Absolutely!", "Amazing!", "Totally understand!") — they read as insincere to most EU customers
- Professional and measured is appropriate. Warm but not gushing. Concise over effusive.
- Swedish-speaking customers specifically: formal register by default unless they write casually first

You know Bybit inside out: P2P, KYC, deposits, withdrawals, security, MiCA, SEPA, Travel Rule, Bybit Card, campaigns, the lot.`;

// --- Claude API helpers ---

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-opus-4-6';
const ANTHROPIC_VERSION = '2023-06-01';

function claudeHeaders(apiKey) {
  return {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': ANTHROPIC_VERSION,
    'anthropic-dangerous-direct-browser-access': 'true',
  };
}

// Streaming via SSE — calls onToken(token, accumulated) for each chunk
async function claudeChatStream(apiKey, messages, systemPrompt, maxTokens, onToken) {
  const body = { model: CLAUDE_MODEL, max_tokens: maxTokens, messages, stream: true };
  if (systemPrompt) body.system = systemPrompt;

  const res = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: claudeHeaders(apiKey),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Anthropic error ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop(); // keep incomplete line
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') return fullText;
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
          fullText += parsed.delta.text;
          onToken(parsed.delta.text, fullText);
        }
      } catch { /* ignore malformed lines */ }
    }
  }
  return fullText;
}

async function claudeChat(apiKey, messages, systemPrompt, maxTokens = 2048) {
  const body = {
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    messages,
  };
  if (systemPrompt) body.system = systemPrompt;

  const res = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: claudeHeaders(apiKey),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Anthropic error ${res.status}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text || '';
}

// --- InvokeLLM ---

export async function InvokeLLM({ prompt, system_prompt = '', add_context_from_internet = false }) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('NO_API_KEY');

  const knowledgeBlock = buildKnowledgeBlock();
  const fullSystemPrompt = [ACE_PERSONALITY, system_prompt, knowledgeBlock].filter(Boolean).join('\n\n');

  // add_context_from_internet not available in Anthropic Messages API — falls through to standard chat
  return claudeChat(apiKey, [{ role: 'user', content: prompt }], fullSystemPrompt);
}

// ─── PLAN instruction (injected by Chat when planMode is true) ─────────────────

export const PLAN_INSTRUCTION = `REASONING STEP — before your reply, output a plan block using this exact format:
[PLAN]
Domain: [KYC / P2P / Crypto / Fiat / Account / General]
KB article: [most relevant Bybit help-center article title, or N/A]
VIP status: [from agent context — Non-VIP / VIP 1-5]
High-value account: [Yes if VIP 3+, No otherwise]
Issue: [one-line description of what the customer needs]
Action: [Draft reply / Escalate / Redirect to tool / Clarify first]
Copy check: [✓ Active voice | ✗ Forbidden phrase detected | ✓ Specific CTA]
[/PLAN]
After the [/PLAN] tag, write your actual response. Do not reference the plan in the response.`.trim();

// ─── InvokeNBA — lightweight action engine ─────────────────────────────────────

export async function InvokeNBA({ messages, vipLevel = 0, parsedData = {} }) {
  const apiKey = getApiKey();
  if (!apiKey) return [];

  const recent = messages.slice(-6)
    .map(m => `${m.role === 'user' ? 'AGENT' : 'ACE'}: ${m.content.slice(0, 300)}`)
    .join('\n');

  const contextLines = [
    vipLevel > 0 ? `VIP Level: ${vipLevel}${vipLevel >= 3 ? ' ⚠️ HIGH-VALUE ACCOUNT' : ''}` : '',
    parsedData.uid ? `UID: ${parsedData.uid}` : '',
    parsedData.orderId ? `Order ID: ${parsedData.orderId}` : '',
    parsedData.issue ? `Stated issue: ${parsedData.issue}` : '',
    parsedData.coin ? `Coin: ${parsedData.coin}` : '',
    parsedData.platform ? `Platform: ${parsedData.platform.toUpperCase()}` : '',
  ].filter(Boolean).join('\n');

  const prompt = `You are a Bybit support routing engine. Analyze this exchange and suggest 1-3 next best actions for the agent.

${contextLines ? `CONTEXT:\n${contextLines}\n` : ''}RECENT EXCHANGE:
${recent}

Respond with JSON ONLY. Schema:
[{"label":"...", "icon":"...", "toolPath":"...", "reason":"...", "priority":"normal|high|critical"}]

toolPaths: /p2p-dispute, /missing-deposit, /account-matters, /hack-case, /card-decline, /chain-lookup, /sepa-delay, /quick-lookup, /translate, /quality-check, /quick-templates

Rules: "critical" only for VIP 3+ or active financial emergencies. Labels under 28 chars. 1-3 actions max.`;

  try {
    const text = await claudeChat(apiKey, [{ role: 'user', content: prompt }], null, 400);
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]);
    return Array.isArray(parsed) ? parsed.slice(0, 3) : [];
  } catch {
    return [];
  }
}

// ─── Deep Reasoning instruction (injected when deepMode is on) ────────────────

export const DEEP_INSTRUCTION = `DEEP REASONING MODE — 3-pass compliance audit required. Use this exact format:
[PLAN]
Domain: [KYC / P2P / Crypto / Fiat / Account / General]
KB article: [most relevant Bybit help-center article, or N/A]
VIP status: [from agent context — Non-VIP / VIP 1-5]
High-value account: [Yes if VIP 3+, No otherwise]
PASS 1 — POLICY: [Specific Bybit rule, SOP, or restriction that applies. Quote it precisely.]
PASS 2 — REGIONAL: [EU: MiCA/SEPA/EDD/Travel Rule implications | Global: jurisdiction/product restrictions | Divergence: any difference that changes the response]
PASS 3 — COMPLIANCE CHECK: [Active voice ✓/✗ | No forbidden phrases ✓/✗ | Specific CTA ✓/✗ | No assumed outcomes ✓/✗ | Policy cited ✓/✗]
Action: [Draft reply / Escalate / Redirect to tool / Clarify first]
[/PLAN]
After the [/PLAN] tag, write your final response. Do not reference the analysis passes in the customer-facing reply.`.trim();

// ─── parsePlanBlock — extract [PLAN]...[/PLAN] from AI response ────────────────

export function parsePlanBlock(text) {
  const match = text.match(/\[PLAN\]([\s\S]*?)\[\/PLAN\]/i);
  if (!match) return { plan: null, clean: text };
  const plan = match[1].trim();
  const clean = text.replace(/\[PLAN\][\s\S]*?\[\/PLAN\]\s*/i, '').trim();
  return { plan, clean };
}

// --- Auto-memory tag instruction ---

const AUTO_MEMORY_INSTRUCTION = `
MEMORY TAGGING: When your response contains something genuinely worth remembering long-term — a policy fact, a rule, a personal detail about the agent, a useful shortcut, a key decision — append ONE tag at the very end of your response in this exact format:
[REMEMBER: Title | Content]
Only tag things that are truly reusable across future conversations. Don't tag every response — only when there's a clear, specific fact worth keeping. Never tag greetings, small talk, or temporary info. The tag must be on its own line at the end.`.trim();

export function parseAndExtractMemory(text) {
  const tagRegex = /\[REMEMBER:\s*([^|]+)\|([^\]]+)\]/gi;
  const saved = [];
  const clean = text.replace(tagRegex, (_, title, content) => {
    const t = title.trim();
    const c = content.trim();
    if (t && c) saved.push({ id: Date.now() + Math.random(), title: t, content: c, active: true });
    return '';
  }).trim();

  if (saved.length) {
    const existing = getKnowledge();
    const existingTitles = new Set(existing.map(e => e.title.toLowerCase()));
    const newOnes = saved.filter(e => !existingTitles.has(e.title.toLowerCase()));
    if (newOnes.length) saveKnowledge([...existing, ...newOnes]);
  }

  return { clean, saved };
}

// --- Chat with history (for Chat.jsx) ---

// onToken: optional (token, accumulated) => void — enables streaming
export async function InvokeChatWithHistory({ messages, system_prompt = '', autoMemory = false, onToken = null }) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('NO_API_KEY');

  const knowledgeBlock = buildKnowledgeBlock();
  const memInstruction = autoMemory ? AUTO_MEMORY_INSTRUCTION : '';
  const fullSystemPrompt = [ACE_PERSONALITY, system_prompt, knowledgeBlock, memInstruction].filter(Boolean).join('\n\n');

  const claudeMessages = messages.filter(m => m.role === 'user' || m.role === 'assistant');

  if (onToken) {
    return claudeChatStream(apiKey, claudeMessages, fullSystemPrompt, 4096, onToken);
  }
  return claudeChat(apiKey, claudeMessages, fullSystemPrompt, 4096);
}
