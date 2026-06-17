// ─── Scenario Studio engine ─────────────────────────────────────────────────
// Turns a raw Bybit live-chat transcript into a spec-perfect role-play training
// scenario (Auto-Builder), and grades agent/bot transcripts against the official
// rubric (Evaluator). Everything is GROUNDED in ACE's own brain:
//   - retrieveArticles()  → the matched Bybit KB articles (SOP key points/tips)
//   - ESCALATION_TABLE    → correct self-service vs escalation routing
//   - BYBIT_ERROR_CODES   → exact error-code SOPs + escalate paths
//   - REGIONAL_POLICIES   → EU/Global/Dubai/HK regulatory nuance
// so Ideal Agent Flow / Answer Key / Feedback Notes are SOP-correct, not guesses.

import { InvokeLLM } from '@/api/claude';
import { retrieveArticles, inferDomains } from '@/lib/semanticSearch';
import {
  ESCALATION_TABLE, REGIONAL_POLICIES, parseErrorCodes,
} from '@/data/bybitKB';

// ── Tolerant JSON extraction from an LLM response ───────────────────────────
export function parseLLMJson(raw) {
  let s = String(raw || '').trim();
  if (s.startsWith('```')) s = s.replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
  try { return JSON.parse(s); } catch { /* fall through */ }
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a !== -1 && b !== -1 && b > a) return JSON.parse(s.slice(a, b + 1));
  throw new Error('Could not parse JSON from model response.');
}

// ── Knowledge pack: pull the SOP truth that matches THIS transcript ─────────
// Returns a compact text block injected into the builder/evaluator prompts so
// the model reasons from real Bybit policy, not its imagination.
export function buildKnowledgePack(transcript) {
  const text = String(transcript || '');
  const domains = inferDomains(text);

  // 1) Matched KB articles (top 5, hybrid TF-IDF retrieval).
  const articles = retrieveArticles(text, { domains: domains.length ? domains : undefined, limit: 5 });
  const artBlock = articles.length
    ? articles.map(a => {
        const kp = (a.keyPoints || []).map(p => `   • ${p}`).join('\n');
        const tips = (a.agentTips || []).map(p => `   – ${p}`).join('\n');
        return `■ ${a.title}${a.platform ? ` [${a.platform}]` : ''}\n` +
               (a.escalatePath ? `   Escalation: ${a.escalatePath}\n` : '') +
               (kp ? `   Key points:\n${kp}\n` : '') +
               (tips ? `   Agent tips:\n${tips}\n` : '') +
               (a.url ? `   Article: ${a.url}` : '');
      }).join('\n\n')
    : '(no exact article match — rely on the escalation table + general SOP below)';

  // 2) Error codes detected in the transcript.
  const codes = parseErrorCodes(text);
  const codeBlock = codes.length
    ? codes.map(c => `■ ${c.code} — ${c.label} (${c.severity})\n   Action: ${c.agentAction}\n   Escalate: ${c.escalatePath}`).join('\n\n')
    : '';

  // 3) Escalation routing relevant to the inferred domains (keeps it compact).
  const escRows = ESCALATION_TABLE.filter(r => {
    const hay = `${r.situation} ${r.agentAction}`.toLowerCase();
    if (!domains.length) return true;
    return domains.some(d => hay.includes(d.toLowerCase())) ||
           /kyc|withdraw|deposit|2fa|email|card|sepa|fiat|p2p|account/i.test(hay);
  }).slice(0, 10);
  const escBlock = escRows
    .map(r => `■ ${r.situation} → ${r.selfService === true ? 'self-service' : r.selfService === false ? 'NOT self-service (escalate)' : 'partial'}: ${r.agentAction}`)
    .join('\n');

  // 4) Regional policy — detect EU vs Global from the transcript.
  const isEU = /bybit\.eu|\beu\b|mica|sepa|euro|travel rule|\beuropean\b/i.test(text);
  const region = isEU ? 'EU' : 'GLOBAL';
  const pol = REGIONAL_POLICIES[region];
  const polBlock = pol
    ? `Region: ${region} — ${pol.framework}\n` +
      pol.keyRules.slice(0, 8).map(r => `   • ${r}`).join('\n') +
      `\n   Guidance: ${pol.agentGuidance}`
    : '';

  return [
    'AUTHORITATIVE BYBIT SOP REFERENCE (build the scenario FROM these official sources — do not contradict them; this reference is internal scaffolding, NEVER quote or name it in the output):',
    '',
    '── MATCHED KNOWLEDGE-BASE ARTICLES ──',
    artBlock,
    codeBlock ? `\n── ERROR CODES DETECTED IN TRANSCRIPT ──\n${codeBlock}` : '',
    escBlock ? `\n── ESCALATION ROUTING ──\n${escBlock}` : '',
    polBlock ? `\n── REGIONAL POLICY ──\n${polBlock}` : '',
  ].filter(Boolean).join('\n');
}

// ── Self-reference scrubber ─────────────────────────────────────────────────
// Safety net: scenario text is pasted into the official company training DB, so
// it must never name the tool or its internal scaffolding. If the model slips a
// meta-reference ("as of ACE's knowledge", "the knowledge pack says…"), rewrite
// it to a direct statement. Operates on whole-string fields after coercion.
export function scrubSelfReference(text) {
  let t = String(text || '');
  // Lead-in phrases that turn a direct policy statement into a meta-reference.
  // Strip the lead-in and keep the actual policy that follows.
  const leadIns = [
    /\b(?:as|so)\s+(?:of|per)\s+ace(?:'s|s)?(?:\s+(?:knowledge|knowledge\s*base|brain|sop[s]?|reference))?\s*,?\s*/gi,
    /\baccording\s+to\s+ace(?:'s|s)?(?:\s+(?:knowledge|knowledge\s*base|brain|reference))?\s*,?\s*/gi,
    /\b(?:per|from|based\s+on|using)\s+(?:the\s+)?(?:ace\s+)?knowledge\s*pack\s*,?\s*/gi,
    /\b(?:per|from|based\s+on|as\s+stated\s+in)\s+(?:the\s+)?(?:sop\s+)?reference\s+(?:provided|given|above)\s*,?\s*/gi,
    /\bace(?:'s|s)?\s+knowledge\s*base\s+(?:says|states|indicates|notes)\s+(?:that\s+)?/gi,
    /\bthe\s+knowledge\s*pack\s+(?:says|states|lists|indicates|notes)\s+(?:that\s+)?/gi,
  ];
  for (const re of leadIns) t = t.replace(re, '');
  // Bare residual mentions → neutral wording.
  t = t.replace(/\bace(?:'s|s)?\s+knowledge\s*base\b/gi, 'the official Bybit SOPs')
       .replace(/\bthe\s+(?:ace\s+)?knowledge\s*pack\b/gi, 'the official Bybit SOPs')
       .replace(/\bace(?:'s|s)?\s+(?:brain|knowledge)\b/gi, 'the official Bybit SOPs');
  // Recapitalize a sentence start left lowercase after stripping a lead-in.
  t = t.replace(/(^|[.!?]\n?\s+|\n\s*\d+\.\s*|\n\s*[-•]\s*)([a-z])/g, (m, pre, ch) => pre + ch.toUpperCase());
  return t.replace(/[ \t]{2,}/g, ' ').trim();
}

// ── Normalizer: coerce model output into the shape the editor expects ───────
export function normalizeBuiltScenario(raw) {
  const s = (raw && typeof raw === 'object') ? raw : {};
  const toText = v => {
    if (v == null || v === true || v === false) return '';
    if (Array.isArray(v)) {
      return v.map(x => (typeof x === 'object' ? Object.values(x).join(' — ') : String(x)))
              .map((t, i) => `${i + 1}. ${t}`).join('\n');
    }
    if (typeof v === 'object') return Object.entries(v).map(([k, val]) => `${k}: ${val}`).join('\n');
    return String(v);
  };
  const strFields = ['title', 'type', 'scope', 'languageTeam', 'language', 'emotion',
    'issue', 'hidden', 'flow', 'bot', 'deescalation', 'feedbackNotes', 'screenshots', 'references'];
  for (const f of strFields) s[f] = scrubSelfReference(toText(s[f]).trim());

  if (!s.type) s.type = 'Others';
  if (!s.scope) s.scope = 'Non-tech';
  if (!s.language) s.language = '';
  if (!s.emotion) s.emotion = 'Medium (Dissatisfied)';
  if (!s.screenshots) s.screenshots = 'Not applicable';
  if (!s.references) s.references = 'Not applicable';

  let d = parseInt(s.difficulty, 10);
  if (!Number.isFinite(d)) d = /low|easy/i.test(s.difficulty) ? 2 : /high|hard/i.test(s.difficulty) ? 4 : 3;
  s.difficulty = Math.min(5, Math.max(1, d));
  s.activeStatus = s.activeStatus !== false;
  s.testCompleted = !!s.testCompleted;

  // Checkpoints: accept ANY number of base checkpoints (the builder/refiner
  // routinely splits a category into specific, weighted sub-checks — e.g.
  // "Accuracy: BankID IS supported" 40 + "Accuracy: correct FAQ link" 20, plus
  // explicit Deduction items). The ONLY hard requirements are:
  //   • at least one base checkpoint, base total == 100
  //   • each checkpoint carries a category (inferred if missing)
  // We DO NOT force exactly 4 categories and we NEVER silently wipe a valid,
  // hand/AI-weighted rubric back to the generic canonical one.
  const cps = Array.isArray(s.checkpoints) ? s.checkpoints.filter(c => c && typeof c === 'object') : [];
  const isBonus = c => !!(c.bonus || /added.?value|bonus/i.test(c.desc || '') || /added.?value/i.test(c.category || ''));
  const isDeduction = c => !!(c.deduction || /deduction|deduct|penalt/i.test(c.desc || '') || /deduction/i.test(c.category || ''));
  const base = cps.filter(c => !isBonus(c) && !isDeduction(c));
  const baseTotal = base.reduce((t, c) => t + (Number(c.max) || 0), 0);
  const valid = base.length >= 1 && baseTotal === 100;
  if (!valid) {
    s.checkpoints = CANONICAL_CHECKPOINTS();
  } else {
    s.checkpoints = cps.map(c => ({
      desc: scrubSelfReference(String(c.desc || '')),
      max: Number(c.max) || 0,
      category: String(c.category || inferCheckpointCategory(c)),
      ...(isBonus(c) ? { bonus: true } : {}),
      ...(isDeduction(c) ? { deduction: true } : {}),
    }));
  }
  if (!s.id) s.id = 'SC-' + Math.floor(Math.random() * 1000);
  return s;
}

// Infer a checkpoint's official category from its text when the model didn't tag one.
export function inferCheckpointCategory(c) {
  const d = `${c.category || ''} ${c.desc || ''}`.toLowerCase();
  if (c.bonus || /added.?value|bonus/.test(d)) return 'Added-Value Support';
  if (c.deduction || /deduction|deduct|penalt/.test(d)) return 'Deductions';
  if (/probing|probe|\bask(ed)?\b|question|identify the (real )?concern|uid|txid/.test(d)) return 'Probing Questions';
  if (/process|escalat|timeframe|sla|document|self.?correct|pushback|handling/.test(d)) return 'Process Handling and Escalation';
  if (/soft|empath|tone|frustrat|polite|native|wording|de.?escalat/.test(d)) return 'Soft Skills and Empathy';
  if (/accuracy|product|sop|root cause|policy|correct|faq|link|bankid|supported/.test(d)) return 'Accuracy and Product Knowledge';
  return 'Accuracy and Product Knowledge';
}

export function CANONICAL_CHECKPOINTS() {
  return [
    { desc: 'Probing Questions: asked the correct & necessary questions to identify the real concern (UID, TXID, chain/contract type, amount, etc.)', max: 20 },
    { desc: 'Accuracy and Product Knowledge: correct SOP/product/policy answer; identified the true root cause; no wrong/unsafe info or overpromising', max: 40 },
    { desc: 'Process Handling and Escalation: correct internal process, escalation path, timeframe and documentation/expectations', max: 20 },
    { desc: 'Soft Skills and Empathy: empathy, professional tone, natural native-language wording, handled frustration well', max: 20 },
    { desc: 'Added-Value Support: proactively gave helpful extra guidance (e.g. alternative product, verify deposit address) without over-explaining', max: 5, bonus: true },
  ];
}

// ── BUILDER ─────────────────────────────────────────────────────────────────
const BUILDER_SYSTEM = `You are an expert Bybit Customer Support Training Manager. You convert a RAW support chat transcript into a high-quality role-play training scenario that follows the OFFICIAL "CS Training — Role-play Scenario Creation Guide". The output must be copy-paste ready into the Scenario DB, with ALL management fields and ALL 9 content sections.

You have been given an AUTHORITATIVE BYBIT SOP REFERENCE for this case. Build the scenario FROM those SOPs — the Ideal Agent Flow, Answer Key, Feedback Notes, escalation paths and timeframes MUST match the real Bybit SOPs and must NOT contradict them. If the reference lists an escalation path or error-code action, use it verbatim in the relevant field.

OUTPUT VOICE — CRITICAL: This scenario is pasted directly into the official company training database. It must read as standalone, official Bybit CS training material. NEVER mention or reference any tool, assistant, or internal system. NEVER write phrases like "as of ACE's knowledge", "according to ACE", "ACE knowledge base", "the knowledge pack", "ACE's brain", "per the SOP reference provided", "based on the reference given", or any meta-reference to how you were built or what you were given. State SOPs and policies DIRECTLY as Bybit policy (e.g. "BankID is supported for Swedish customers" — not "ACE's knowledge says BankID is supported"). The reader must never know an AI or any named tool produced this.

HOW TO READ THE RAW TRANSCRIPT (it is messy):
- Ignore timestamps ("( 1m 9s )", "Chat Started:", ISO times), routing notes, inactivity warnings, and canned bot menus.
- Roles: "USER:"/"Visitor:" = customer; a named person (e.g. "Gustavo:") = the support agent; "BOT:" = automation (not the human agent).
- Detect the customer's LANGUAGE from THEIR messages and set "language" to it. The opening line and quoted customer dialogue must be in that language.
- Preserve concrete facts verbatim: UID, order/TXID, card txn ID, amounts, coin, chain/contract type, dates, error codes, region/site (Bybit EU / bybit.eu).
- NUMBER & RANGE INTEGRITY (CRITICAL — wrong numbers are dangerous in training): Reproduce every numeric value, range and timeframe EXACTLY as written. NEVER drop, merge, or reformat the digits of a range. "1-72 hours" must stay "1-72 hours" (NOT "172h", "72h" or "1 to 72"). "1-3 working days" stays "1-3 working days". Always keep the separating hyphen/word in ranges, keep the unit ("hours"/"working days"/"%"/"USDT"), and do not invent a different SLA than the transcript or the SOP reference states. If a timeframe is a range, write it as "<low>-<high> <unit>".

RULES:
- Mask PII: replace real emails/names/phone with placeholders (old_email@example.com). KEEP UID/TXID/amounts (needed for probing).
- "hidden" = what the agent must uncover: real root cause, internal/BOS findings, the customer's misunderstanding, the real ask, and the exact info the agent must collect. The bot must NOT reveal this without probing.
- "bot" (Bot Acting Instructions) is the most important field: the customer's OPENING message in native language (mention the date if one exists), what they share first vs only after probing, how emotion changes, how to push back on wrong answers, when to accept resolution.
- EVALUATION CHECKPOINTS — the base checkpoints MUST total EXACTLY 100 points. Distribute them across the FOUR official categories: Probing Questions, Accuracy and Product Knowledge (the highest-weighted — this is core knowledge), Process Handling and Escalation, Soft Skills and Empathy. Guide weights are roughly Probing ~20 / Accuracy ~40 / Process ~20 / Soft ~20, but you SHOULD re-weight to fit THIS case (e.g. a pure product-knowledge case can be Probing 10 / Accuracy 60 / Process 20 / Soft 10) as long as the base still sums to 100.
- You MAY use MORE THAN ONE checkpoint per category to call out the specific things being tested — e.g. split Accuracy into "Accuracy: BankID IS supported (40)" and "Accuracy: gave the correct FAQ link (20)". Give EACH checkpoint a "category" field (one of the four), a clear measurable "desc", and a "max".
- Then ADD a SEPARATE Added-Value Support checkpoint with "max":5, "bonus":true and "category":"Added-Value Support" (NOT part of the 100 base).
- OPTIONALLY add Deduction items for specific mistakes (e.g. "Deduction: said BankID is Norway-only (-10)") with "category":"Deductions", "deduction":true and the points in "max" (positive number; the minus is implied). Deductions are NOT part of the 100 base.

CRITICAL OUTPUT TYPING: EVERY field except "difficulty" (number 1-5), "activeStatus", "testCompleted" and "checkpoints" MUST be a single STRING (use "\\n" for line breaks / numbered lists). Do NOT output arrays or booleans for "flow", "bot", "deescalation", etc. Fill EVERY field with real content — never leave a field empty or as true/false.

Output ONLY a JSON object (no markdown fences) with EXACTLY these keys:
{
  "id":"SC-AUTO","title":"<short English title>","type":"<MT5|Bybit Card|Deposit & Withdrawal|Account Matters|Spot Trading|C&B|Others>","scope":"<Non-tech|Tech|MT5>","languageTeam":"<empty or why team-specific>","language":"<detected native language>","difficulty":3,"emotion":"<High (Angry)|Medium (Dissatisfied)|Low (Calm)>","activeStatus":true,"testCompleted":false,
  "issue":"1. Overall Issue Explanation (English, for trainer): problem, when, which feature/product/transaction, what tried, misunderstanding, what they want, why they feel that way, site/region, date.",
  "hidden":"2. Answer Key & Hidden Context (English, hidden from agent): real root cause, internal findings, misunderstanding, real request, exact info to collect.",
  "flow":"3. Ideal Agent Flow: numbered SOP-correct steps (greet/empathize, probe, confirm details, identify root cause, explain SOP/limitation, set correct expectations/escalation, close). State steps directly as Bybit procedure — no meta-references.",
  "bot":"4. Bot Acting Instructions: opening message in native language (mention date if any), reveal order, emotion changes, pushback on wrong answers, when to accept resolution.",
  "deescalation":"5. De-escalation Guidance: tone, expressions to avoid, how to receive frustration, how to politely decline impossible requests.",
  "feedbackNotes":"7. Feedback & Key Knowledge Notes: real Bybit SOP references and rules (one per line, stated directly as official policy — no meta-references to any tool or reference source), common mistakes, internal-note template.",
  "screenshots":"8. Scenario Screenshots: describe screenshots the customer would show when asked, or 'Not applicable'.",
  "references":"9. Reference Materials: extra references (article links from the pack, CoinMarketCap, etc.) or 'Not applicable'.",
  "checkpoints":[{"category":"Probing Questions","desc":"...","max":10},{"category":"Accuracy and Product Knowledge","desc":"... (core knowledge being tested)","max":40},{"category":"Accuracy and Product Knowledge","desc":"... (a second specific accuracy check, optional)","max":20},{"category":"Process Handling and Escalation","desc":"...","max":20},{"category":"Soft Skills and Empathy","desc":"...","max":10},{"category":"Added-Value Support","desc":"...","max":5,"bonus":true},{"category":"Deductions","desc":"Deduction: <specific mistake> ...","max":10,"deduction":true}]
}
(The checkpoints array above is illustrative — base items must sum to 100; the bonus and any deductions are separate. Use as many or as few base checkpoints as the case needs, each with its category.)`;

export async function buildScenario(transcript) {
  const pack = buildKnowledgePack(transcript);
  const prompt = `${pack}\n\n========================================\nRAW TRANSCRIPT TO CONVERT:\n\n${transcript}`;
  const raw = await InvokeLLM({
    prompt,
    system_prompt: BUILDER_SYSTEM,
    useKB: true,            // ACE also auto-injects retrieved KB into the system block
    maxTokens: 4000,
    json: true,
    enableThinking: false,  // keeps build ~17s, under the serverless time limit
    temperature: 0.4,
  });
  return normalizeBuiltScenario(parseLLMJson(raw));
}

// ── EVALUATOR ───────────────────────────────────────────────────────────────
// mode: 'agent' (grade the agent) | 'bot' (QA how the bot played the customer) | 'both'
export async function evaluateTranscript({ transcript, scenario, mode = 'agent' }) {
  const pack = buildKnowledgePack(`${scenario?.issue || ''}\n${scenario?.hidden || ''}\n${transcript}`);
  const cps = Array.isArray(scenario?.checkpoints) && scenario.checkpoints.length
    ? scenario.checkpoints : CANONICAL_CHECKPOINTS();
  const isBonus = c => !!(c.bonus || /added.?value|bonus/i.test(c.desc || '') || /added.?value/i.test(c.category || ''));
  const isDeduction = c => !!(c.deduction || /deduction|deduct|penalt/i.test(c.desc || '') || /deduction/i.test(c.category || ''));
  const baseCps = cps.filter(c => !isBonus(c) && !isDeduction(c));
  const bonusCps = cps.filter(isBonus);
  const dedCps = cps.filter(isDeduction);
  const cpList = baseCps.map((c, i) => `${i + 1}. [${c.category || 'Accuracy and Product Knowledge'}] (${c.max} pts) ${c.desc}`).join('\n');
  const bonusList = bonusCps.length ? '\nSEPARATE BONUS (added on top, not in the /100):\n' + bonusCps.map(c => `• (+${c.max} max) ${c.desc}`).join('\n') : '';
  const dedList = dedCps.length ? '\nSEPARATE DEDUCTIONS (subtract from the base if the mistake occurred):\n' + dedCps.map(c => `• (−${c.max} max) ${c.desc}`).join('\n') : '';

  const scenarioBlock = scenario ? `SCENARIO UNDER TEST:
Title: ${scenario.title || ''}
Type: ${scenario.type || ''} · Difficulty: ${scenario.difficulty || ''} · Initial emotion: ${scenario.emotion || ''}
Language: ${scenario.language || ''}
Issue: ${scenario.issue || ''}
Answer Key / Hidden Context (ground truth): ${scenario.hidden || ''}
Ideal Agent Flow: ${scenario.flow || ''}
Bot Acting Instructions: ${scenario.bot || ''}` : '(no scenario provided — evaluate against the knowledge pack + general SOP)';

  const agentSchema = `"checkpoints":[{"name":"...","max":<int>,"score":<int>,"evidence":"<exact transcript quote>","rationale":"..."}],"total_score":<int 0-100>,"key_knowledge":["..."],"key_takeaways":["..."],"added_value_note":"<+5 bonus note, separate from the 100 base>"`;
  const botSchema = `"bot_qa":{"score":<int 0-100>,"verdict":"PASS|NEEDS_WORK|FAIL","issues":[{"issue":"...","evidence":"<quote>"}],"good_points":["..."],"summary":"..."}`;

  let schema, task;
  if (mode === 'bot') {
    task = `QA how well the in-house BOT played the CUSTOMER (not the agent). Judge fidelity to the Empathy-Information Loop: stayed in the customer's native language, did NOT leak hidden context prematurely, revealed only ONE clue at a time and only when earned, emotion shifted correctly (rose on bad handling, dropped on good), applied termination rules (3 wrong answers → end; give-up → end; correct resolution → end), mentioned the scenario date in the opening if specified, and stayed dialogue-only (no narration/labels).`;
    schema = `{${botSchema}}`;
  } else if (mode === 'both') {
    task = `Do BOTH: (A) grade the AGENT against the checkpoints, AND (B) QA how the BOT played the customer (Empathy-Information Loop fidelity).`;
    schema = `{${agentSchema},${botSchema}}`;
  } else {
    task = `Grade the AGENT's performance against the checkpoints below.`;
    schema = `{${agentSchema}}`;
  }

  const EVAL_SYSTEM = `You are a STRICT but FAIR Bybit CS Training Evaluator. You grade against the OFFICIAL rubric and the AUTHORITATIVE BYBIT SOP REFERENCE provided. Use that reference as ground truth — if the agent gave info that contradicts the SOPs, that is an Accuracy failure; if they followed them, credit it. In your written output (rationale, key knowledge, takeaways), state SOPs directly as Bybit policy — never name or quote any tool, assistant, or "knowledge pack".

NUMBER & RANGE INTEGRITY: When you quote numbers, timeframes or SLAs from the transcript/scenario, reproduce them EXACTLY (e.g. "1-72 hours" stays "1-72 hours", never "172h"). Keep the hyphen/word in ranges and the unit. Wrong numbers in feedback are dangerous.

${pack}

${scenarioBlock}

EVALUATION CHECKPOINTS (base = exactly 100 pts):
${cpList}
${bonusList}${dedList}
(Added-Value bonus is added ON TOP and is NEVER included in the /100 base or denominator. Deductions are subtracted from the base ONLY when the specific mistake actually occurred — quote the evidence.)

TASK: ${task}

Be evidence-based: quote EXACT lines from the transcript to justify every score. Reason step by step BEFORE assigning numbers, but output ONLY the final JSON. Never inflate scores. Output ONLY a JSON object matching:
${schema}`;

  const raw = await InvokeLLM({
    prompt: `Here is the transcript to evaluate:\n\n${transcript}`,
    system_prompt: EVAL_SYSTEM,
    useKB: true,
    maxTokens: 2400,
    json: true,
    enableThinking: false,
    temperature: 0.1,
  });
  const result = parseLLMJson(raw);
  result._mode = mode;
  return result;
}

// ── REFINER ─────────────────────────────────────────────────────────────────
// Takes the current scenario + the role-play bot's TEST feedback and improves the
// scenario accordingly, WITHOUT changing the hard case facts (UID/TXID/amounts/
// root cause). Stays grounded in the same ACE knowledge pack so fixes are SOP-correct.
const REFINER_SYSTEM = `You are an expert Bybit CS Training Manager refining a role-play scenario after the in-house role-play bot TESTED it and returned feedback. Improve the scenario so the next test passes, following the OFFICIAL "CS Training — Role-play Scenario Creation Guide".

You are given an AUTHORITATIVE BYBIT SOP REFERENCE — keep every fix consistent with it. This reference is internal scaffolding; NEVER name or quote it in the output.

OUTPUT VOICE — CRITICAL: The refined scenario is pasted directly into the official company training database. It must read as standalone, official Bybit CS training material. NEVER mention any tool, assistant, or internal system, and NEVER write phrases like "as of ACE's knowledge", "according to ACE", "ACE knowledge base", "the knowledge pack", "per the reference provided", etc. State all SOPs/policies DIRECTLY as Bybit policy. If the current scenario already contains such a self-reference, REMOVE it as part of the refinement.

HARD RULES:
- DO NOT change the core case facts: keep UID, order/TXID, amounts, coin, chain/contract type, dates, error codes, region/site and the real root cause EXACTLY as in the current scenario. Only fix what the feedback flags (clarity, probing/reveal order, emotion changes, escalation path, timeframe wording, checkpoint measurability, de-escalation, missing detail).
- NUMBER & RANGE INTEGRITY: reproduce numbers/timeframes/SLAs exactly — "1-72 hours" stays "1-72 hours", never "172h". Keep the hyphen and unit.
- Hidden Context must stay hidden (bot must not leak it before probing). If feedback says the bot leaked it early, tighten the Bot Acting Instructions reveal order — do NOT delete the hidden info.
- Base Evaluation checkpoints MUST total EXACTLY 100. Distribute across the four official categories (Probing / Accuracy / Process / Soft); re-weight to fit the case (guide weights ~20/40/20/20 but the case can justify e.g. Probing 10 / Accuracy 60 / Soft 10). You MAY use multiple checkpoints per category to name the specific things tested (e.g. split Accuracy into a 40-pt core-knowledge check + a 20-pt FAQ-link check). Add a SEPARATE Added-Value bonus (max 5, "bonus":true), excluded from the 100. You MAY add Deduction items ("deduction":true, "category":"Deductions") for specific mistakes — also excluded from the 100.
- Every checkpoint gets a "category" from: Probing Questions | Accuracy and Product Knowledge | Process Handling and Escalation | Soft Skills and Empathy | Added-Value Support | Deductions.
- If the bot feedback proposes a specific checkpoint breakdown or point split, ADOPT it (as long as base sums to 100) — do not flatten it back to a generic 4-line rubric.

CRITICAL OUTPUT TYPING: every field except "difficulty" (1-5 number), "activeStatus", "testCompleted" and "checkpoints" MUST be a single STRING (use "\\n" for line breaks). Output ONLY a JSON object (no markdown fences) with keys:
{ "id","title","type","scope","languageTeam","language","difficulty","emotion","activeStatus","testCompleted","issue","hidden","flow","bot","deescalation","feedbackNotes","screenshots","references","checkpoints":[{"category":"...","desc":"...","max":<int>,"bonus":<true only for Added-Value>,"deduction":<true only for Deductions>}...],"_changes":"<one-paragraph plain-English summary of what you changed and why>" }`;

export async function refineScenario({ scenario, feedback }) {
  const pack = buildKnowledgePack(`${scenario?.issue || ''}\n${scenario?.hidden || ''}\n${scenario?.bot || ''}`);
  const current = JSON.stringify(scenario, null, 2);
  const prompt = `${pack}\n\n========================================\nCURRENT SCENARIO (JSON):\n${current}\n\n========================================\nROLE-PLAY BOT TEST FEEDBACK (fix the scenario to address this):\n${feedback}`;
  const raw = await InvokeLLM({
    prompt,
    system_prompt: REFINER_SYSTEM,
    useKB: true,
    maxTokens: 4000,
    json: true,
    enableThinking: false,
    temperature: 0.3,
  });
  const parsed = parseLLMJson(raw);
  const changes = parsed._changes || '';
  delete parsed._changes;
  const next = normalizeBuiltScenario(parsed);
  // preserve immutable management bits the user already set
  if (scenario?.id) next.id = scenario.id;
  return { scenario: next, changes };
}

// ── CO-PILOT CHAT ────────────────────────────────────────────────────────────
// Live assistant inside the Evaluate step. The user plays the AGENT against the
// in-house bot-customer; when the bot pushes, they ask ACE how to respond — just
// like ACE assisting in a real Bybit live-chat. Grounded in the KB + auto-aware
// of the built scenario, the evaluation transcript and the latest grading result.
const COPILOT_SYSTEM = `You are ACE, a sharp Bybit Customer Support co-pilot helping a HUMAN AGENT in real time. The agent is in a training role-play: an in-house bot plays the CUSTOMER and pushes them with questions/objections; the agent is answering live and may ask you for help mid-conversation.

Your job: give the agent the BEST next move — what to say, what to ask, the correct SOP/policy, the right escalation path/timeframe, and how to keep the customer calm — grounded ONLY in the authoritative ACE KNOWLEDGE PACK and Bybit SOPs you are given. If you are not sure or the pack doesn't cover it, say so plainly and say what to verify — never invent policy, limits, timeframes or error-code actions.

STYLE:
- Be fast and practical, like a senior agent whispering in their ear. Lead with the answer.
- When useful, give a ready-to-send reply the agent can paste, in the CUSTOMER'S language, professional and empathetic. Mark it clearly (e.g. "Say this:").
- Keep numbers, ranges and timeframes EXACT (e.g. "1-72 hours" stays "1-72 hours", never "172h").
- Respect SOP: don't overpromise, don't guarantee recovery/refunds, escalate when the SOP says to.
- Short. No filler. Bullet points over paragraphs.`;

function copilotContext({ scenario, transcript, evalResult }) {
  const lines = [];
  if (scenario) {
    lines.push('── SCENARIO UNDER TEST ──');
    lines.push(`Title: ${scenario.title || ''}  ·  Type: ${scenario.type || ''}  ·  Difficulty: ${scenario.difficulty || ''}  ·  Emotion: ${scenario.emotion || ''}`);
    lines.push(`Language: ${scenario.language || ''}`);
    if (scenario.issue) lines.push(`Issue: ${scenario.issue}`);
    if (scenario.hidden) lines.push(`Answer Key / Hidden Context (ground truth — DO NOT reveal verbatim to the customer, use it to guide the agent): ${scenario.hidden}`);
    if (scenario.flow) lines.push(`Ideal Agent Flow: ${scenario.flow}`);
    if (scenario.feedbackNotes) lines.push(`Key Knowledge Notes: ${scenario.feedbackNotes}`);
  }
  if (transcript && transcript.trim()) {
    lines.push('\n── CONVERSATION SO FAR (bot-customer ↔ agent) ──');
    lines.push(transcript.trim().slice(-4000));
  }
  if (evalResult && (evalResult.total_score != null || evalResult.bot_qa)) {
    lines.push('\n── LATEST GRADING RESULT ──');
    if (evalResult.total_score != null) lines.push(`Agent base score: ${evalResult.total_score}/100`);
    if (Array.isArray(evalResult.checkpoints)) {
      evalResult.checkpoints.forEach(c => lines.push(`• ${c.name}: ${c.score}/${c.max}${c.rationale ? ` — ${c.rationale}` : ''}`));
    }
    if (evalResult.bot_qa) lines.push(`Bot QA: ${evalResult.bot_qa.score}/100 (${evalResult.bot_qa.verdict})`);
  }
  return lines.join('\n');
}

export async function copilotAsk({ messages, scenario, transcript, evalResult }) {
  const ctx = copilotContext({ scenario, transcript, evalResult });
  const history = (messages || []).slice(-10)
    .map(m => `${m.role === 'user' ? 'AGENT' : 'ACE'}: ${m.content}`).join('\n');
  const last = (messages || []).filter(m => m.role === 'user').slice(-1)[0]?.content || '';
  const pack = buildKnowledgePack(`${scenario?.issue || ''}\n${scenario?.hidden || ''}\n${last}`);

  const prompt = `${pack}\n\n========================================\nLIVE ROLE-PLAY CONTEXT:\n${ctx}\n\n========================================\nCHAT WITH THE AGENT (most recent last):\n${history}\n\n========================================\nAnswer the agent's latest message as their live co-pilot.`;

  return InvokeLLM({
    prompt,
    system_prompt: COPILOT_SYSTEM,
    useKB: true,
    maxTokens: 1200,
    enableThinking: false,
    temperature: 0.4,
  });
}
