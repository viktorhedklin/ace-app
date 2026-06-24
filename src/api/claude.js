import { scrubPII } from '@/lib/SecurityModule';
import { getOpenAIKey, openaiChat, openaiChatStream } from '@/api/openai';
import { llmFetch } from '@/api/proxy';
import { getAlibabaKey, alibabaChat, alibabaChatStream } from '@/api/alibaba';
import { getGeminiKey, geminiChat, geminiChatStream } from '@/api/gemini';
import { retrieveArticles } from '@/lib/semanticSearch';
import {
  get as storageGet, set as storageSet, remove as storageRemove,
  list as storageList, NAMESPACES,
} from '@/lib/storage';
import { getRecurringQAIssues } from '@/lib/trajectory';
import { getCasesByUID } from '@/lib/caseMemory';

export function getApiKey() {
  return localStorage.getItem('claude_api_key') || localStorage.getItem('openai_api_key') || '';
}

// Check if any LLM provider is configured (Claude, OpenAI, Alibaba, or Gemini)
export function hasAnyApiKey() {
  return !!(getApiKey() || getOpenAIKey() || getAlibabaKey() || getGeminiKey());
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
//
// Article storage shape: one row per article in the kb_articles namespace,
// key `article_<id>`. Lets Sentinel upsert individual findings without
// race-overwriting the whole array. Metadata rows (sync_url, last_sync) are
// keyed directly — they live in the same namespace but don't start with
// `article_`, so the list reader filters them out.

const ARTICLE_KEY_PREFIX = 'article_';
const articleKey = (id) => `${ARTICLE_KEY_PREFIX}${id}`;

// One-shot lift: if the old `kb_articles/entries` row exists, split into
// per-article rows and drop the aggregate. Runs at most once per device.
let _perRowMigrationRan = false;
function migrateEntriesRowIfNeeded() {
  if (_perRowMigrationRan) return;
  _perRowMigrationRan = true;
  const legacyArray = storageGet(NAMESPACES.KB, 'entries');
  if (!Array.isArray(legacyArray) || !legacyArray.length) return;
  for (const entry of legacyArray) {
    if (!entry || entry.id == null) continue;
    // Preserve existing row if caller wrote one already with the same id.
    const current = storageGet(NAMESPACES.KB, articleKey(entry.id));
    if (current == null) storageSet(NAMESPACES.KB, articleKey(entry.id), entry);
  }
  storageRemove(NAMESPACES.KB, 'entries');
}

export function getKnowledge() {
  migrateEntriesRowIfNeeded();
  const rows = storageList(NAMESPACES.KB);
  const articles = rows
    .filter(r => r.key.startsWith(ARTICLE_KEY_PREFIX) && r.value)
    .map(r => r.value);
  if (articles.length) return articles;
  // Legacy fallback — raw localStorage pre-cloud-sync. Migration button lifts it.
  try { return JSON.parse(localStorage.getItem('ace_knowledge')) || []; }
  catch { return []; }
}

// Diff-based save: upsert entries that changed, remove rows that were dropped.
// Keeps the existing whole-array API so hand-edit callers don't have to change.
export function saveKnowledge(entries) {
  migrateEntriesRowIfNeeded();
  const next = Array.isArray(entries) ? entries : [];
  const current = storageList(NAMESPACES.KB)
    .filter(r => r.key.startsWith(ARTICLE_KEY_PREFIX));

  const nextById = new Map();
  for (const e of next) {
    if (!e || e.id == null) continue;
    nextById.set(String(e.id), e);
  }

  // Delete rows that are no longer present.
  for (const row of current) {
    const id = row.key.slice(ARTICLE_KEY_PREFIX.length);
    if (!nextById.has(id)) storageRemove(NAMESPACES.KB, row.key);
  }

  // Upsert only rows that changed — avoids needless cloud writes.
  for (const [id, entry] of nextById) {
    const existing = storageGet(NAMESPACES.KB, articleKey(id));
    if (JSON.stringify(existing) !== JSON.stringify(entry)) {
      storageSet(NAMESPACES.KB, articleKey(id), entry);
    }
  }

  localStorage.removeItem('ace_knowledge');
}

// Granular APIs — preferred path for Sentinel autosync. One article in,
// one row updated. Call these directly when upserting a single finding.
export function saveKnowledgeEntry(entry) {
  if (!entry || entry.id == null) return;
  storageSet(NAMESPACES.KB, articleKey(entry.id), entry);
}

export function removeKnowledgeEntry(id) {
  if (id == null) return;
  storageRemove(NAMESPACES.KB, articleKey(id));
}

// --- Remote KB Sync ---

export function getKBSyncUrl() {
  const fromCloud = storageGet(NAMESPACES.KB, 'sync_url');
  if (typeof fromCloud === 'string') return fromCloud;
  return localStorage.getItem('ace_kb_sync_url') || '';
}

export function setKBSyncUrl(url) {
  storageSet(NAMESPACES.KB, 'sync_url', url.trim());
  localStorage.removeItem('ace_kb_sync_url');
}

// Fetch remote KB and merge with local — remote wins on title conflicts
export async function syncKnowledgeFromRemote() {
  const url = getKBSyncUrl();
  if (!url) return { synced: false, reason: 'no_url' };

  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      return { synced: false, reason: `HTTP error ${res.status}`, status: res.status };
    }
    const data = await res.json();

    // Accept both { entries: [...] } and raw [...] formats
    let remote = [];
    if (data.entries && Array.isArray(data.entries)) {
      remote = data.entries;
    } else if (Array.isArray(data)) {
      remote = data;
    } else {
      return { synced: false, reason: 'invalid_format' };
    }

    // Validate entries
    const valid = remote
      .filter(e => e.title && e.content)
      .map(e => ({
        id: e.id || Date.now() + Math.random(),
        title: String(e.title).trim(),
        content: String(e.content).trim(),
        active: e.active !== false,
        source: e.source || 'remote',
      }));

    if (!valid.length) return { synced: false, reason: 'empty' };

    // Merge: remote entries overwrite local entries with same title, new ones added
    const local = getKnowledge();
    const localByTitle = new Map(local.map(e => [e.title.toLowerCase(), e]));
    const merged = [...local];
    let added = 0;
    let updated = 0;

    for (const entry of valid) {
      const key = entry.title.toLowerCase();
      const existing = localByTitle.get(key);
      if (existing) {
        // Update content if different
        if (existing.content !== entry.content) {
          const idx = merged.findIndex(e => e.id === existing.id);
          if (idx !== -1) {
            merged[idx] = { ...existing, content: entry.content, active: entry.active };
            updated++;
          }
        }
      } else {
        merged.push(entry);
        added++;
      }
    }

    saveKnowledge(merged);
    storageSet(NAMESPACES.KB, 'last_sync', new Date().toISOString());
    localStorage.removeItem('ace_kb_last_sync');
    return { synced: true, added, updated, total: merged.length };
  } catch (e) {
    return { synced: false, reason: e.message || 'network_error' };
  }
}

export function getLastSyncTime() {
  const fromCloud = storageGet(NAMESPACES.KB, 'last_sync');
  if (typeof fromCloud === 'string') return fromCloud;
  return localStorage.getItem('ace_kb_last_sync') || null;
}

// User-added KB entries (from KnowledgeManager UI). Small, hand-curated,
// always included — these are the agent's own overrides.
function buildUserKnowledgeBlock() {
  const entries = getKnowledge().filter(e => e.active !== false);
  if (!entries.length) return '';
  const lines = entries.map(e => `[${e.title}]: ${e.content}`).join('\n\n');
  return `\n\n---\nAGENT'S PERSONAL NOTES (always apply):\n${lines}\n---`;
}

// Format a retrieved KB article as first-person domain knowledge.
// Option B framing: presents the article as Ace's own expertise, not as a document.
// Includes the exact URL so Claude can cite it verbatim — never invent URLs.
function formatArticleForPrompt(article) {
  const keyPoints = (article.keyPoints || []).map(p => `  • ${p}`).join('\n');
  const agentTips = (article.agentTips || []).length
    ? '\n  Pro tips:\n' + article.agentTips.map(p => `    - ${p}`).join('\n')
    : '';
  const escalate = article.escalatePath ? `\n  Escalation: ${article.escalatePath}` : '';
  const url = article.url ? `\n  URL (use exactly if citing): ${article.url}` : '';
  return `[${article.domain} — ${article.title}]${url}\n${keyPoints}${agentTips}${escalate}`;
}

// Official BYBIT_KB retrieval — hybrid filter + semantic search.
// Caller passes the user's latest message and optional domain/tag filters.
// Returns a formatted block of the top N articles, framed as Ace's own knowledge.
function buildRetrievedKnowledgeBlock(query, options = {}) {
  if (!query?.trim()) return '';
  const articles = retrieveArticles(query, { limit: 5, ...options });
  if (!articles.length) return '';
  const body = articles.map(formatArticleForPrompt).join('\n\n');
  return `\n\n---\nYOUR KNOWLEDGE ON THIS TOPIC (you know these Bybit policies deeply):\n\n${body}\n---`;
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
- URL CITATION: When citing a Bybit help-center article, ONLY use a URL that appears in the "YOUR KNOWLEDGE ON THIS TOPIC" block (marked "URL (use exactly if citing): ..."). Copy it EXACTLY — do not modify, shorten, or rewrite it. Never invent, guess, or construct a URL from the article title. If the retrieved article has no URL field, name the article by title only — do not fabricate a link.
- CHANNEL AWARENESS: Read the channel context. If this is a LIVE CHAT channel, the customer is ALREADY talking to the agent — NEVER suggest "contact Live Chat" or "reach out to support". If this is an EMAIL channel, this IS the support email — NEVER suggest "email support" or "contact us". When escalation is needed, tell the AGENT what to do internally (submit a case, P2 escalation), do not tell the customer to contact a channel they are already in.

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
- Swedish-speaking customers specifically: default to "du" (informal) unless the customer's own message signals formal "Ni" first — that's modern Swedish digital-CS convention.

SWEDISH LANGUAGE CAPABILITY:
- Draft customer-facing replies natively in Swedish when the conversation is in Swedish — don't route through the Translate tool for this.
- Default register: "du", per the tone register above. Switch to "Ni" only if the customer used it first.
- Keep Bybit/crypto terms untranslated: UID, KYC, P2P, TxID, etc. — same rule as the Translate tool.
- If the agent's own question to you is in English, answer in English even inside a Swedish-channel conversation — don't force-translate your half of the conversation.

CUSTOMER-SUPPORT TECHNIQUE:
- For emotionally-loaded cases (anger, financial loss, repeated failure) — reflect briefly before resolving: one short line that validates without admitting fault, then move straight to the one concrete next action. Skip this for routine cases — it reads as padding per LENGTH CALIBRATION above.
- De-escalation ladder: validate without admitting fault → narrow to one concrete next action → never match an angry tone, even if the customer escalates theirs.
- An empathy line helps when it's specific to what happened ("that's a real delay, I get why you're pushing on this"). It reads as scripted the moment it's generic ("I understand your frustration") — when in doubt, cut it and go straight to the action.
- Handoff triggers: threats, repeated contact on the same unresolved issue, or the customer using legal language — flag to the agent for escalation rather than continuing to iterate on the draft.

KYC/AML/COMPLIANCE GUARDRAIL:
- You give operational guidance only: how to explain the process to the customer, what the SOP says, when to escalate. You never give a legal interpretation of whether a case constitutes money laundering, sanctions evasion, or a MiCA violation — that's a Compliance/Legal call, not yours.
- Any question that asks you to judge or imply a legal/compliance determination ("is this customer laundering money", "does this break MiCA") → say plainly you can't make that call and point to Compliance/Legal.
- This extends the existing rule on EDD/KYC reviews (never speculate on rejection reasons) to AML holds, sanctions screening, and Travel Rule holds specifically — same neutral, process-based posture, no exceptions for "just between us" framing.

You know Bybit inside out: P2P, KYC, deposits, withdrawals, security, MiCA, SEPA, Travel Rule, Bybit Card, campaigns, the lot.`;

// --- Claude API helpers ---


const MODELS = {
  opus: 'claude-opus-4-6',
  sonnet: 'claude-sonnet-4-6',
  'gpt-5.4': 'gpt-5.4',
  'gpt-5.4-mini': 'gpt-5.4-mini',
  'gpt-4.1': 'gpt-4.1',
  'qwen3.7-max': 'qwen3.7-max',
  'qwen3.7-plus': 'qwen3.7-plus',
  'deepseek-v4-flash': 'deepseek-v4-flash',
  'qwen-max': 'qwen-max',
  'qwen-plus': 'qwen-plus',
  'gemini-2.5-pro': 'gemini-2.5-pro',
  'gemini-2.5-flash': 'gemini-2.5-flash',
};

// ── Model catalog — pricing, capabilities, feature suitability ──────────────

export const MODEL_CATALOG = [
  {
    id: 'claude-opus-4-6',
    name: 'Claude Opus 4.6',
    provider: 'anthropic',
    inputPrice: 15,
    outputPrice: 75,
    speed: 'Slow',
    strengths: ['Deep reasoning', 'Policy nuance', 'Complex multi-step cases', 'Compliance audits', 'Best instruction-following'],
    weaknesses: ['Most expensive', 'Slower response time', 'Overkill for simple tasks'],
    features: { chat: 5, campaign: 3, followUp: 3, qualityCheck: 4, translate: 3, csat: 2, escalation: 3, hackCase: 5, quickLookup: 3, nba: 1 },
  },
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    provider: 'anthropic',
    inputPrice: 3,
    outputPrice: 15,
    speed: 'Fast',
    strengths: ['Great balance of quality and cost', 'Fast responses', 'Strong at structured output', 'Prompt caching support'],
    weaknesses: ['Less nuanced than Opus on edge cases', 'May miss subtle policy details'],
    features: { chat: 4, campaign: 4, followUp: 5, qualityCheck: 5, translate: 4, csat: 4, escalation: 5, hackCase: 3, quickLookup: 4, nba: 3 },
  },
  {
    id: 'gpt-5.4',
    name: 'GPT-5.4',
    provider: 'openai',
    inputPrice: 2.50,
    outputPrice: 15,
    speed: 'Fast',
    strengths: ['Frontier-class reasoning', 'Excellent at complex multi-step tasks', 'Strong instruction-following', 'Great for policy and compliance'],
    weaknesses: ['Most expensive OpenAI model', 'Slight latency on long prompts'],
    features: { chat: 5, campaign: 4, followUp: 5, qualityCheck: 5, translate: 5, csat: 4, escalation: 5, hackCase: 5, quickLookup: 4, nba: 3 },
  },
  {
    id: 'gpt-5.4-mini',
    name: 'GPT-5.4 Mini',
    provider: 'openai',
    inputPrice: 0.75,
    outputPrice: 4.50,
    speed: 'Very fast',
    strengths: ['Best value in 2026', '70% cheaper than GPT-4o with better quality', 'Fast and reliable', 'Great for utility tasks'],
    weaknesses: ['Less nuanced than full GPT-5.4 on edge cases', 'Slightly weaker on complex policy reasoning'],
    features: { chat: 4, campaign: 4, followUp: 4, qualityCheck: 4, translate: 5, csat: 4, escalation: 4, hackCase: 3, quickLookup: 4, nba: 4 },
  },
  {
    id: 'gpt-4.1',
    name: 'GPT-4.1',
    provider: 'openai',
    inputPrice: 2,
    outputPrice: 8,
    speed: 'Fast',
    strengths: ['Strong general reasoning', 'Good structured output', 'Reliable for standard tasks', 'Cheaper output than GPT-5.4'],
    weaknesses: ['Outclassed by GPT-5.4 on complex reasoning', 'Older generation'],
    features: { chat: 4, campaign: 4, followUp: 4, qualityCheck: 4, translate: 4, csat: 3, escalation: 4, hackCase: 4, quickLookup: 4, nba: 3 },
  },
  {
    id: 'qwen3.7-max',
    name: 'Qwen3.7 Max',
    provider: 'alibaba',
    inputPrice: 1.60,
    outputPrice: 6.40,
    speed: 'Fast',
    strengths: ['Frontier multilingual reasoning', 'Strong on Asian languages', 'Great for translation', 'Competitive pricing'],
    weaknesses: ['Less Western policy nuance', 'Newer ecosystem'],
    features: { chat: 5, campaign: 4, followUp: 4, qualityCheck: 4, translate: 5, csat: 4, escalation: 4, hackCase: 4, quickLookup: 4, nba: 3 },
  },
  {
    id: 'qwen3.7-plus',
    name: 'Qwen3.7 Plus',
    provider: 'alibaba',
    inputPrice: 0.40,
    outputPrice: 1.20,
    speed: 'Very fast',
    strengths: ['Excellent value', 'Fast multilingual responses', 'Strong structured output', 'Great for utility tasks'],
    weaknesses: ['Less nuanced than Max on edge cases'],
    features: { chat: 4, campaign: 4, followUp: 5, qualityCheck: 4, translate: 5, csat: 4, escalation: 4, hackCase: 3, quickLookup: 5, nba: 4 },
  },
  {
    id: 'deepseek-v4-flash',
    name: 'DeepSeek V4 Flash',
    provider: 'alibaba',
    inputPrice: 0.27,
    outputPrice: 1.10,
    speed: 'Very fast',
    strengths: ['Cheapest frontier-class model', 'Strong reasoning for the price', 'Fast', 'Great for high-volume utility'],
    weaknesses: ['Less polished tone', 'Weaker on subtle policy nuance'],
    features: { chat: 4, campaign: 4, followUp: 4, qualityCheck: 4, translate: 4, csat: 3, escalation: 4, hackCase: 4, quickLookup: 4, nba: 5 },
  },
  {
    id: 'qwen-max',
    name: 'Qwen Max',
    provider: 'alibaba',
    inputPrice: 1.20,
    outputPrice: 4.80,
    speed: 'Fast',
    strengths: ['Reliable general reasoning', 'Good structured output', 'Solid multilingual support'],
    weaknesses: ['Outclassed by Qwen3.7 Max', 'Older generation'],
    features: { chat: 4, campaign: 4, followUp: 4, qualityCheck: 4, translate: 5, csat: 3, escalation: 4, hackCase: 3, quickLookup: 4, nba: 3 },
  },
  {
    id: 'qwen-plus',
    name: 'Qwen Plus',
    provider: 'alibaba',
    inputPrice: 0.30,
    outputPrice: 0.90,
    speed: 'Very fast',
    strengths: ['Strong value', 'Fast responses', 'Good for utility and routing'],
    weaknesses: ['Less capable than Max tier on complex cases'],
    features: { chat: 4, campaign: 4, followUp: 4, qualityCheck: 4, translate: 4, csat: 3, escalation: 4, hackCase: 3, quickLookup: 4, nba: 4 },
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'gemini',
    inputPrice: 1.25,
    outputPrice: 10,
    speed: 'Fast',
    strengths: ['Strong reasoning', 'Very large context window', 'Good multilingual support', 'Competitive pricing'],
    weaknesses: ['Less battle-tested on support tone than Anthropic/OpenAI', 'Newer to this stack'],
    features: { chat: 4, campaign: 4, followUp: 4, qualityCheck: 4, translate: 4, csat: 3, escalation: 4, hackCase: 4, quickLookup: 4, nba: 3 },
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'gemini',
    inputPrice: 0.15,
    outputPrice: 0.60,
    speed: 'Very fast',
    strengths: ['Very cheap', 'Fast responses', 'Good for utility and routing tasks'],
    weaknesses: ['Less nuanced than Pro on complex policy cases'],
    features: { chat: 3, campaign: 4, followUp: 4, qualityCheck: 3, translate: 4, csat: 3, escalation: 3, hackCase: 3, quickLookup: 5, nba: 4 },
  },
];

// Feature labels for the catalog
export const FEATURE_LABELS = {
  chat: 'Chat (Main)',
  campaign: 'Campaign',
  followUp: 'Follow-up',
  qualityCheck: 'Quality Check',
  translate: 'Translate',
  csat: 'CSAT Predictor',
  escalation: 'Escalation',
  hackCase: 'Hack Case',
  quickLookup: 'Quick Lookup',
  nba: 'NBA Routing',
};

// ── Cost mode + provider — controls model selection per feature tier ─────────

const COST_MODE_KEY = 'ace_cost_mode';
const PROVIDER_KEY = 'ace_provider';
const MODEL_OVERRIDES_KEY = 'ace_model_overrides';

export function getCostMode() {
  return localStorage.getItem(COST_MODE_KEY) || 'balanced';
}

export function setCostMode(mode) {
  localStorage.setItem(COST_MODE_KEY, mode);
}

export function getProvider() {
  return localStorage.getItem(PROVIDER_KEY) || 'alibaba';
}

export function setProvider(provider) {
  localStorage.setItem(PROVIDER_KEY, provider);
}

export function getModelOverrides() {
  try {
    const parsed = JSON.parse(localStorage.getItem(MODEL_OVERRIDES_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function getModelOverride(tier) {
  const modelId = getModelOverrides()[tier];
  return MODEL_CATALOG.some(m => m.id === modelId) ? modelId : '';
}

export function setModelOverride(tier, modelId) {
  const overrides = getModelOverrides();
  if (!modelId) {
    delete overrides[tier];
  } else if (MODEL_CATALOG.some(m => m.id === modelId)) {
    overrides[tier] = modelId;
  }
  localStorage.setItem(MODEL_OVERRIDES_KEY, JSON.stringify(overrides));
}

export function clearModelOverrides() {
  localStorage.removeItem(MODEL_OVERRIDES_KEY);
}

// tier: 'chat' (main conversation), 'utility' (tools/features), 'routing' (NBA)
export function resolveModel(tier = 'utility') {
  const override = getModelOverride(tier);
  if (override) return override;

  const mode = getCostMode();
  const provider = getProvider();

  if (provider === 'openai') {
    if (mode === 'performance') return MODELS['gpt-5.4'];
    if (mode === 'economy') return MODELS['gpt-5.4-mini'];
    // balanced: gpt-5.4 for chat, gpt-5.4-mini for utility/routing
    return tier === 'chat' ? MODELS['gpt-5.4'] : MODELS['gpt-5.4-mini'];
  }

  if (provider === 'alibaba') {
    if (mode === 'performance') return MODELS['qwen3.7-max'];
    if (mode === 'economy') return MODELS['deepseek-v4-flash'];
    // balanced: qwen3.7-max for chat, qwen3.7-plus for utility/routing
    return tier === 'chat' ? MODELS['qwen3.7-max'] : MODELS['qwen3.7-plus'];
  }

  if (provider === 'gemini') {
    if (mode === 'performance') return MODELS['gemini-2.5-pro'];
    if (mode === 'economy') return MODELS['gemini-2.5-flash'];
    // balanced: pro for chat, flash for utility/routing
    return tier === 'chat' ? MODELS['gemini-2.5-pro'] : MODELS['gemini-2.5-flash'];
  }

  // Anthropic (default) — Sonnet default, Opus only for heavy tasks
  if (mode === 'performance') return MODELS.opus;
  if (mode === 'economy') return MODELS.sonnet;
  // balanced: Opus for chat, Sonnet for tools + routing
  if (tier === 'chat') return MODELS.opus;
  return MODELS.sonnet;
}

function isQuotaOrRateLimitError(error) {
  return /quota|rate.?limit|429|insufficient|exceed|exceeded|balance|credit/i.test(error?.message || '');
}

function alibabaFallbackModel(model) {
  if (model === MODELS['qwen3.7-max']) return MODELS['qwen3.7-plus'];
  if (model === MODELS['qwen3.7-plus']) return MODELS['qwen-plus'];
  if (model === MODELS['deepseek-v4-flash']) return MODELS['qwen-plus'];
  return '';
}

// Determine provider from model ID
function getModelProvider(modelId) {
  if (modelId.startsWith('qwen') || modelId.startsWith('deepseek')) return 'alibaba';
  if (modelId.startsWith('gpt-') || modelId.startsWith('o1') || modelId.startsWith('o3')) return 'openai';
  if (modelId.startsWith('gemini')) return 'gemini';
  return 'anthropic';
}

// ── Usage tracking ──────────────────────────────────────────────────────────

const USAGE_KEY = 'ace_usage';

export function trackUsage(modelId, inputTokens, outputTokens, cacheCreate = 0, cacheRead = 0) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const all = JSON.parse(localStorage.getItem(USAGE_KEY) || '{}');
    if (!all[today]) all[today] = {};
    if (!all[today][modelId]) all[today][modelId] = { input: 0, output: 0, calls: 0, cacheCreate: 0, cacheRead: 0 };
    all[today][modelId].input += inputTokens || 0;
    all[today][modelId].output += outputTokens || 0;
    all[today][modelId].cacheCreate = (all[today][modelId].cacheCreate || 0) + (cacheCreate || 0);
    all[today][modelId].cacheRead = (all[today][modelId].cacheRead || 0) + (cacheRead || 0);
    all[today][modelId].calls += 1;
    const keys = Object.keys(all).sort();
    while (keys.length > 30) { delete all[keys.shift()]; }
    localStorage.setItem(USAGE_KEY, JSON.stringify(all));
  } catch { /* non-critical */ }
}

export function getUsageStats() {
  try {
    return JSON.parse(localStorage.getItem(USAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

export function clearUsage() {
  localStorage.removeItem(USAGE_KEY);
}

// Build system prompt with caching — stable parts (personality + KB) get cached.
// Stable block uses ttl:"1h" so cache survives full shift patterns with long gaps
// between customer messages (default 5-min TTL expires too quickly during live chat).
function buildCachedSystem(stableText, dynamicText) {
  const blocks = [];
  if (stableText) {
    blocks.push({
      type: 'text',
      text: stableText,
      cache_control: { type: 'ephemeral', ttl: '1h' },
    });
  }
  if (dynamicText) {
    blocks.push({ type: 'text', text: dynamicText });
  }
  return blocks.length ? blocks : undefined;
}

// Mark the LAST message in the history with cache_control so each turn builds
// on the cached history from the previous turn. Saves ~70% on multi-turn chats.
// Returns a new array — does not mutate the input.
function withHistoryCacheBreakpoint(messages) {
  if (!messages?.length) return messages;
  const last = messages[messages.length - 1];
  const cachedLast = { ...last };
  if (typeof last.content === 'string') {
    cachedLast.content = [{ type: 'text', text: last.content, cache_control: { type: 'ephemeral' } }];
  } else if (Array.isArray(last.content) && last.content.length) {
    const lastBlock = last.content[last.content.length - 1];
    cachedLast.content = [
      ...last.content.slice(0, -1),
      { ...lastBlock, cache_control: { type: 'ephemeral' } },
    ];
  }
  return [...messages.slice(0, -1), cachedLast];
}

// Scrub message content — handles both string and content-array formats (vision)
function scrubContent(content) {
  if (typeof content === 'string') return scrubPII(content);
  if (Array.isArray(content)) {
    return content.map(block => {
      if (block.type === 'text') return { ...block, text: scrubPII(block.text) };
      return block; // image blocks pass through untouched
    });
  }
  return content;
}

// Streaming via SSE — calls onToken(token, accumulated) for each chunk
async function claudeChatStream(apiKey, messages, systemPrompt, maxTokens, onToken, model = MODELS.opus) {
  // GDPR gate — scrub all user messages before they leave the browser
  const safeMessages = messages.map(m => ({
    ...m,
    content: m.role === 'user' ? scrubContent(m.content) : m.content,
  }));
  // Cache breakpoint on the last message so each turn reuses the history cache
  const cachedMessages = withHistoryCacheBreakpoint(safeMessages);
  const body = { model, max_tokens: maxTokens, messages: cachedMessages, stream: true };
  if (systemPrompt) body.system = systemPrompt;

  const res = await llmFetch('anthropic', apiKey, body);

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Anthropic error ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';
  let usageIn = 0, usageOut = 0, cacheCreate = 0, cacheRead = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop(); // keep incomplete line
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') {
        trackUsage(model, usageIn, usageOut, cacheCreate, cacheRead);
        return fullText;
      }
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
          fullText += parsed.delta.text;
          onToken(parsed.delta.text, fullText);
        }
        if (parsed.type === 'message_start' && parsed.message?.usage) {
          usageIn = parsed.message.usage.input_tokens || 0;
          cacheCreate = parsed.message.usage.cache_creation_input_tokens || 0;
          cacheRead = parsed.message.usage.cache_read_input_tokens || 0;
        }
        if (parsed.type === 'message_delta' && parsed.usage) {
          usageOut = parsed.usage.output_tokens || 0;
        }
      } catch { /* ignore malformed lines */ }
    }
  }
  trackUsage(model, usageIn, usageOut, cacheCreate, cacheRead);
  return fullText;
}

async function claudeChat(apiKey, messages, systemPrompt, maxTokens = 2048, model = MODELS.sonnet, opts = {}) {
  // GDPR gate — scrub all user messages before they leave the browser
  const safeMessages = messages.map(m => ({
    ...m,
    content: m.role === 'user' ? scrubContent(m.content) : m.content,
  }));
  const cachedMessages = withHistoryCacheBreakpoint(safeMessages);
  const body = {
    model,
    max_tokens: maxTokens,
    messages: cachedMessages,
  };
  if (systemPrompt) body.system = systemPrompt;

  const res = await llmFetch('anthropic', apiKey, body, opts.signal);

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Anthropic error ${res.status}`);
  }

  const data = await res.json();
  if (data.usage) {
    trackUsage(
      model,
      data.usage.input_tokens,
      data.usage.output_tokens,
      data.usage.cache_creation_input_tokens || 0,
      data.usage.cache_read_input_tokens || 0,
    );
  }
  return data.content?.[0]?.text || '';
}

// --- InvokeLLM ---

export async function InvokeLLM({
  prompt, system_prompt = '', useKB = false, kbDomains, kbTags, kbCaseType,
  maxTokens = 2048, json = false, enableThinking, temperature, signal,
}) {
  const model = resolveModel('utility');
  const provider = getModelProvider(model);

  // Stable (cacheable): personality + user-curated notes. Same across all requests.
  const userKB = useKB ? buildUserKnowledgeBlock() : '';
  const stableText = [ACE_PERSONALITY, userKB].filter(Boolean).join('\n\n');

  // Dynamic (query-specific): retrieved KB articles — varies per message, NOT cached.
  const retrieved = useKB
    ? buildRetrievedKnowledgeBlock(prompt, { domains: kbDomains, tags: kbTags, caseType: kbCaseType })
    : '';
  const dynamicText = [retrieved, system_prompt].filter(Boolean).join('\n\n');

  const systemBlocks = buildCachedSystem(stableText, dynamicText);
  const aliOpts = { json, enableThinking, temperature, signal };
  const oaiOpts = { json, temperature, signal };

  if (provider === 'openai') {
    const oaiKey = getOpenAIKey();
    if (!oaiKey) throw new Error('NO_OPENAI_KEY');
    const { text, usage } = await openaiChat(oaiKey, [{ role: 'user', content: prompt }], systemBlocks, maxTokens, model, oaiOpts);
    trackUsage(model, usage.input_tokens, usage.output_tokens);
    return text;
  }

  if (provider === 'alibaba') {
    const aliKey = getAlibabaKey();
    if (!aliKey) throw new Error('NO_ALIBABA_KEY');
    try {
      const { text, usage } = await alibabaChat(aliKey, [{ role: 'user', content: prompt }], systemBlocks, maxTokens, model, aliOpts);
      trackUsage(model, usage.input_tokens, usage.output_tokens);
      return text;
    } catch (e) {
      const fallback = !signal?.aborted && isQuotaOrRateLimitError(e) ? alibabaFallbackModel(model) : '';
      if (!fallback) throw e;
      const { text, usage } = await alibabaChat(aliKey, [{ role: 'user', content: prompt }], systemBlocks, maxTokens, fallback, aliOpts);
      trackUsage(fallback, usage.input_tokens, usage.output_tokens);
      setModelOverride('utility', fallback);
      return text;
    }
  }

  if (provider === 'gemini') {
    const gemKey = getGeminiKey();
    if (!gemKey) throw new Error('NO_GEMINI_KEY');
    const { text, usage } = await geminiChat(gemKey, [{ role: 'user', content: prompt }], systemBlocks, maxTokens, model, oaiOpts);
    trackUsage(model, usage.input_tokens, usage.output_tokens);
    return text;
  }

  const apiKey = getApiKey();
  if (!apiKey) throw new Error('NO_API_KEY');
  return claudeChat(apiKey, [{ role: 'user', content: prompt }], systemBlocks, maxTokens, model, { signal });
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
  if (!apiKey && !getOpenAIKey() && !getAlibabaKey() && !getGeminiKey()) return [];

  const recent = messages.slice(-6)
    .map(m => `${m.role === 'user' ? 'AGENT' : 'ACE'}: ${scrubPII(m.content.slice(0, 300))}`)
    .join('\n');

  const contextLines = [
    vipLevel > 0 ? `VIP Level: ${vipLevel}${vipLevel >= 3 ? ' ⚠️ HIGH-VALUE ACCOUNT' : ''}` : '',
    parsedData.uid ? `UID: [USER_ID]` : '',
    parsedData.orderId ? `Order ID: ${scrubPII(parsedData.orderId)}` : '',
    parsedData.issue ? `Stated issue: ${scrubPII(parsedData.issue)}` : '',
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
    const model = resolveModel('routing');
    const provider = getModelProvider(model);
    let text;
    if (provider === 'openai') {
      const oaiKey = getOpenAIKey();
      if (!oaiKey) return [];
      const result = await openaiChat(oaiKey, [{ role: 'user', content: prompt }], null, 400, model);
      trackUsage(model, result.usage.input_tokens, result.usage.output_tokens);
      text = result.text;
    } else if (provider === 'alibaba') {
      const aliKey = getAlibabaKey();
      if (!aliKey) return [];
      let result;
      try {
        result = await alibabaChat(aliKey, [{ role: 'user', content: prompt }], null, 400, model);
        trackUsage(model, result.usage.input_tokens, result.usage.output_tokens);
      } catch (e) {
        const fallback = isQuotaOrRateLimitError(e) ? alibabaFallbackModel(model) : '';
        if (!fallback) return [];
        result = await alibabaChat(aliKey, [{ role: 'user', content: prompt }], null, 400, fallback);
        trackUsage(fallback, result.usage.input_tokens, result.usage.output_tokens);
        setModelOverride('routing', fallback);
      }
      text = result.text;
    } else if (provider === 'gemini') {
      const gemKey = getGeminiKey();
      if (!gemKey) return [];
      const result = await geminiChat(gemKey, [{ role: 'user', content: prompt }], null, 400, model);
      trackUsage(model, result.usage.input_tokens, result.usage.output_tokens);
      text = result.text;
    } else {
      if (!apiKey) return [];
      text = await claudeChat(apiKey, [{ role: 'user', content: prompt }], null, 400, model);
    }
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
Region detected: [EU / HK / Dubai / Global — from agent context or paste signals]
PASS 1 — POLICY: [Specific Bybit rule, SOP, or restriction that applies. Quote it precisely.]
PASS 2 — REGIONAL: [EU: check MiCA restrictions — derivatives blocked for retail, USDT restricted, Travel Rule >€1K, USDC primary stablecoin, SEPA only for fiat, formal complaint right within 15 business days. | HK: check SFC restrictions — retail limited to approved large-cap assets, derivatives NOT available for retail, HKD via FPS, licensed custodian required. | Dubai: check VARA rules — AED fiat available, derivatives for qualified investors, Travel Rule >AED 3675. | Global: full product suite, check country-specific restrictions. | CRITICAL: If user is EU or HK, you MUST explicitly state the relevant regional restriction or confirmation before drafting. Do not default to Global rules for EU/HK users.]
PASS 2b — POLICY CITATION: [CITE: <framework> — <specific rule from REGIONAL_POLICIES that applies>. Example: "CITE: MiCA — Derivatives/futures/options: RESTRICTED for retail users — professional classification required." If no regional policy is relevant, write "CITE: N/A — no regional constraint on this issue." This citation is MANDATORY for EU, HK, and Dubai users.]
PASS 3 — COMPLIANCE CHECK: [Active voice ✓/✗ | No forbidden phrases ✓/✗ | Specific CTA ✓/✗ | No assumed outcomes ✓/✗ | Policy cited ✓/✗ | Regional policy verified ✓/✗ | CITE tag present ✓/✗]
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
    if (t && c) saved.push({ id: Date.now() + Math.random(), title: t, content: c, active: true, source: 'memory' });
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

// Build a short block of recent coaching feedback. Keeps Ace honest about
// patterns that get flagged in QA reviews — e.g. "rushing first response",
// "tone too formal". Injected into the dynamic (non-cached) block so it
// reflects the newest feedback without breaking the cache prefix.
function buildQAFeedbackBlock() {
  try {
    const issues = getRecurringQAIssues();
    if (!issues.length) return '';
    const lines = issues.slice(0, 5).map(i => `- ${i.issue} (flagged ${i.count}x)`);
    return `\n\n---\nRECENT QA FEEDBACK — things you've been flagged on before; avoid repeating:\n${lines.join('\n')}\n---`;
  } catch (e) {
    console.warn('[claude] buildQAFeedbackBlock failed', e);
    return '';
  }
}

// If the agent's latest message or parsed context contains a UID, pull a
// short summary of prior cases for that customer so Ace can reference
// history instead of starting from zero.
async function buildCaseHistoryBlock(uid) {
  if (!uid) return '';
  try {
    const cases = await getCasesByUID(uid);
    if (!cases.length) return '';
    const recent = cases.slice(0, 5);
    const lines = recent.map(c => {
      const when = new Date(c.ts).toISOString().slice(0, 10);
      const vip = c.vipLevel ? ` VIP${c.vipLevel}` : '';
      const notes = c.notes ? ` — ${c.notes}` : '';
      return `- [${when}] ${c.tool || 'chat'}${vip}${notes}`;
    });
    return `\n\n---\nPRIOR CASES FOR THIS CUSTOMER (${cases.length} total, showing ${recent.length}):\n${lines.join('\n')}\nUse this to recognise patterns — but never reveal the history to the customer directly.\n---`;
  } catch (e) {
    console.warn('[claude] buildCaseHistoryBlock failed', e);
    return '';
  }
}

// onToken: optional (token, accumulated) => void — enables streaming
// kbUid: optional scrubbed UID for pulling prior case history
export async function InvokeChatWithHistory({ messages, system_prompt = '', autoMemory = false, onToken = null, kbDomains, kbTags, kbCaseType, kbUid }) {
  const model = resolveModel('chat');
  const provider = getModelProvider(model);

  // Stable (cacheable): personality + user-curated notes. Same across all requests.
  const userKB = buildUserKnowledgeBlock();
  const stableText = [ACE_PERSONALITY, userKB].filter(Boolean).join('\n\n');

  // Dynamic (query-specific): retrieved KB articles based on the latest user message.
  // Varies per message, so NOT cached — but it's ~3K tokens vs ~25K for stuff-all.
  const latestUserMsg = [...messages].reverse().find(m => m.role === 'user');
  const query = typeof latestUserMsg?.content === 'string'
    ? latestUserMsg.content
    : latestUserMsg?.content?.find?.(b => b.type === 'text')?.text || '';
  const retrieved = buildRetrievedKnowledgeBlock(query, { domains: kbDomains, tags: kbTags, caseType: kbCaseType });

  // Feedback loops — inject recurring QA issues + prior case history.
  // Both go in the dynamic (non-cached) block so updates take effect
  // immediately without busting the cache prefix.
  const qaFeedback = buildQAFeedbackBlock();
  const caseHistory = await buildCaseHistoryBlock(kbUid);

  const memInstruction = autoMemory ? AUTO_MEMORY_INSTRUCTION : '';
  const dynamicText = [retrieved, qaFeedback, caseHistory, system_prompt, memInstruction].filter(Boolean).join('\n\n');
  const systemBlocks = buildCachedSystem(stableText, dynamicText);

  const filteredMessages = messages.filter(m => m.role === 'user' || m.role === 'assistant');

  if (provider === 'openai') {
    const oaiKey = getOpenAIKey();
    if (!oaiKey) throw new Error('NO_OPENAI_KEY');
    if (onToken) {
      const { text, usage } = await openaiChatStream(oaiKey, filteredMessages, systemBlocks, 4096, onToken, model);
      trackUsage(model, usage.input_tokens, usage.output_tokens);
      return text;
    }
    const { text, usage } = await openaiChat(oaiKey, filteredMessages, systemBlocks, 4096, model);
    trackUsage(model, usage.input_tokens, usage.output_tokens);
    return text;
  }

  if (provider === 'alibaba') {
    const aliKey = getAlibabaKey();
    if (!aliKey) throw new Error('NO_ALIBABA_KEY');
    try {
      if (onToken) {
        const { text, usage } = await alibabaChatStream(aliKey, filteredMessages, systemBlocks, 4096, onToken, model);
        trackUsage(model, usage.input_tokens, usage.output_tokens);
        return text;
      }
      const { text, usage } = await alibabaChat(aliKey, filteredMessages, systemBlocks, 4096, model);
      trackUsage(model, usage.input_tokens, usage.output_tokens);
      return text;
    } catch (e) {
      const fallback = isQuotaOrRateLimitError(e) ? alibabaFallbackModel(model) : '';
      if (!fallback) throw e;
      if (onToken) {
        const { text, usage } = await alibabaChatStream(aliKey, filteredMessages, systemBlocks, 4096, onToken, fallback);
        trackUsage(fallback, usage.input_tokens, usage.output_tokens);
        setModelOverride('chat', fallback);
        return text;
      }
      const { text, usage } = await alibabaChat(aliKey, filteredMessages, systemBlocks, 4096, fallback);
      trackUsage(fallback, usage.input_tokens, usage.output_tokens);
      setModelOverride('chat', fallback);
      return text;
    }
  }

  if (provider === 'gemini') {
    const gemKey = getGeminiKey();
    if (!gemKey) throw new Error('NO_GEMINI_KEY');
    if (onToken) {
      const { text, usage } = await geminiChatStream(gemKey, filteredMessages, systemBlocks, 4096, onToken, model);
      trackUsage(model, usage.input_tokens, usage.output_tokens);
      return text;
    }
    const { text, usage } = await geminiChat(gemKey, filteredMessages, systemBlocks, 4096, model);
    trackUsage(model, usage.input_tokens, usage.output_tokens);
    return text;
  }

  const apiKey = getApiKey();
  if (!apiKey) throw new Error('NO_API_KEY');
  if (onToken) {
    return claudeChatStream(apiKey, filteredMessages, systemBlocks, 4096, onToken, model);
  }
  return claudeChat(apiKey, filteredMessages, systemBlocks, 4096, model);
}
