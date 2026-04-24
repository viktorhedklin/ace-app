import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { InvokeLLM } from '@/api/integrations';
import { scrubPII } from '@/lib/SecurityModule';
import { Copy, Check, Loader2, Languages, Sparkles, RotateCcw, ChevronRight, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const CONTENT_TYPES = [
  { key: 'email', label: 'Email Template', icon: '📧', desc: 'Follow-up or case email' },
  { key: 'chat', label: 'Chat Quicktext', icon: '💬', desc: 'Live chat — paste & send' },
  { key: 'lark', label: 'Internal / Lark', icon: '🔧', desc: 'Escalation notes & internal' },
];

const TONE_OPTIONS = [
  { key: 'professional', label: 'Professional', desc: 'Clear, precise, formal-ish' },
  { key: 'balanced', label: 'Balanced', desc: 'Natural sweet spot' },
  { key: 'warm', label: 'Warm & Human', desc: 'Friendly colleague energy' },
];

const SCORE_COLORS = {
  excellent: 'text-ok border-ok/40 bg-ok/10',
  good: 'text-hero border-hero/40 bg-hero/10',
  ok: 'text-warn border-orange-400/40 bg-orange-400/10',
  poor: 'text-crit border-crit/40 bg-crit/10',
};

function scoreColor(n) {
  if (n >= 9) return SCORE_COLORS.excellent;
  if (n >= 7) return SCORE_COLORS.good;
  if (n >= 5) return SCORE_COLORS.ok;
  return SCORE_COLORS.poor;
}

// ─── Prompt builders ──────────────────────────────────────────────────────────

function buildTranslatePrompt(text, contentType, tone) {
  const toneMap = {
    professional: 'Professional but natural. Clear and precise. Slightly more formal — like a polished written voice, not a robot.',
    balanced: 'Balanced — natural, professional Swedish. The sweet spot: not stiff, not too casual. This is how a good CS agent actually talks.',
    warm: 'Warm and conversational. Like a genuinely helpful colleague. Still professional, just human. Customers should feel they\'re talking to a person.',
  };

  const contextMap = {
    email: 'Email template to a customer. Complete sentences. Structured. The tone is slightly more considered than chat — customer will read at their own pace.',
    chat: 'Live chat quicktext. Short. Direct. Easy to read on a screen. Fast to send. The agent needs to paste and go — no waffle.',
    lark: 'Internal Lark message or escalation note. Concise and practical. Keep all @mentions, bullet points, emojis, and formatting exactly as-is. This is internal — no customer-facing fluff needed.',
  };

  return `Translate the following text to Swedish for Bybit customer support.

CONTENT TYPE: ${contextMap[contentType]}
TONE: ${toneMap[tone]}

STRICT TRANSLATION RULES — follow every single one:
1. Use "du" (informal you) throughout — this is the standard in Swedish customer service. NEVER use "Ni" as a formal address.
2. Write natural Swedish — not a word-for-word robot translation. If a phrase doesn't land naturally, rewrite it to convey the same meaning in a way that sounds human.
3. Preserve ALL placeholders exactly as written: [NAME], [CASE_ID], {{{Case.Anti_Phishing_Text__c}}}, {{{Case.Anti_Phishing_Code__c}}}, @Pool Escalation Log EU, etc. Do not translate or modify them.
4. Crypto and Bybit-specific terms stay in English: USDT, BTC, ETH, TXID, UID, KYC, SEPA, P2P, MiCA, API, 2FA, Google Authenticator, Bybit, Lark, SF, etc.
5. Keep formatting: line breaks, bullet points, numbered lists, emojis — structure stays identical.
6. Active voice. Shorter sentences where possible. Avoid passive constructions like "det bör noteras att" — just say the thing.
7. Common natural Swedish CS phrases to draw from: "Tack för att du kontaktade oss", "Tveka inte att höra av dig", "Jag hjälper dig gärna", "Vi beklagar besväret", "Ser över det åt dig nu".

OUTPUT: Only the translated Swedish text. Nothing else — no "Här är översättningen:", no explanations, no quotes around the output.

TEXT TO TRANSLATE:
${text}`;
}

function buildToneCheckPrompt(text, contentType) {
  const contextLabel = contentType === 'email'
    ? 'a customer-facing email template'
    : contentType === 'chat'
    ? 'a live chat quicktext for paste-and-send use'
    : 'an internal Lark / escalation message';

  return `You are a Swedish tone quality checker for customer support at a crypto exchange. You know Swedish CS communication standards inside out.

Analyze the following Swedish text. It was written as ${contextLabel} for Bybit support agents.

Return ONLY a valid JSON object — no markdown, no backticks, no explanation before or after. Just raw JSON.

{
  "score": <integer 1-10>,
  "label": "<one of: Excellent | Natural & Warm | Good | Slightly Robotic | Too Formal | Too Casual | Unnatural>",
  "strengths": ["<specific strength>", "<specific strength>"],
  "improvements": ["<specific improvement — quote the exact phrase and suggest a fix>"],
  "rewrite": "<if score is below 8: rewrite only the most unnatural sentence or phrase in better Swedish. If score 8+: empty string>"
}

SCORING GUIDE:
10: Native-level. Could have been written by a professional Swedish CS agent without edits.
8-9: Very good. Natural, appropriate, minor polish possible.
6-7: Decent. Some phrasing is slightly stiff or over-translated but readable.
4-5: Noticeable issues. Some sentences sound automated or unnatural to a Swedish reader.
1-3: Major problems. Clearly machine-translated or incorrectly formal/informal.

CHECK FOR:
- Is "du" used correctly? (not "Ni" or missing entirely)
- Do any phrases sound like direct English translations that no Swede would say? (e.g. "Vi ber om ursäkt för obehaget" is fine; "Vi ber om ursäkt för eventuella olägenheter som detta kan ha orsakat" is robotic)
- Sentence length — Swedish CS tends toward shorter, cleaner sentences
- Are placeholders left untouched? (if not, flag it)
- Does the warmth/formality match the context?

TEXT TO ANALYZE:
${text}`;
}

function buildApplyImprovementsPrompt(text, toneResult, contentType) {
  const improvementLines = (toneResult.improvements || []).map(s => `- ${s}`).join('\n');
  const rewriteHint = toneResult.rewrite
    ? `\nSPECIFIC REWRITE SUGGESTION FOR THE WEAKEST SECTION:\n${toneResult.rewrite}\n`
    : '';

  const contextMap = {
    email: 'customer-facing email',
    chat: 'live chat quicktext (short, direct, paste-and-send)',
    lark: 'internal Lark message or escalation note',
  };

  return `You are a native Swedish copyeditor for Bybit customer support.

Apply ALL of the following improvements to this Swedish text and return a polished, corrected version. Every issue listed must be fixed.

IMPROVEMENTS TO APPLY:
${improvementLines || '- General polish: make it sound more natural and human'}
${rewriteHint}
CONTEXT: This is a ${contextMap[contentType]}.

RULES — never break these:
- Preserve ALL placeholders exactly as written: [NAME], [CASE_ID], {{{...}}}, @mentions, etc.
- Crypto/Bybit terms stay in English: USDT, BTC, ETH, KYC, SEPA, 2FA, TXID, etc.
- Keep all formatting: line breaks, bullet points, numbered lists, emojis — identical structure
- Use "du" throughout. Never "Ni".
- Active voice, natural rhythm — reads like a real person wrote it

OUTPUT: Only the improved Swedish text. No explanations, no labels, nothing else.

ORIGINAL TEXT:
${text}`;
}

function buildHumanisePrompt(text, contentType) {
  const contextMap = {
    email: 'a customer email. The tone should feel like a thoughtful, helpful human — not a support script.',
    chat: 'a live chat message. It needs to be short, warm, and immediately readable — like a colleague typing in real time.',
    lark: 'an internal team message. Direct, practical, colleague-to-colleague.',
  };

  return `You are a native Swedish speaker giving a final human polish to support communications for a crypto exchange.

The text below is translated Swedish. Your job is to make it sound like a real Swedish person wrote it from scratch — not like it was translated from English.

CONTEXT: This is ${contextMap[contentType]}

HOW TO HUMANISE:
- Read each sentence. If it sounds stiff, foreign, or over-formal to a native Swedish ear — rewrite it
- Replace typical over-translated phrases:
  • "Tveka inte att kontakta oss" → "Hör av dig om du har fler frågor"
  • "Vi ber om ursäkt för eventuella olägenheter" → "Vi beklagar besväret"
  • "Vänligen notera att" → just say the thing directly
  • "Vi hoppas att detta besvarar din fråga" → can be cut or simplified
- Use natural Swedish rhythm: shorter sentences, direct phrasing
- Contractions and everyday connectives where they fit naturally
- "du" throughout — never "Ni"
- Warmth where appropriate, never sycophantic
- Do NOT change meaning, structure, or factual content

KEEP UNTOUCHED:
- All placeholders: [NAME], [CASE_ID], {{{...}}}, @mentions
- All crypto/Bybit terms: USDT, BTC, KYC, 2FA, SEPA, TXID, Bybit, etc.
- All formatting: line breaks, bullet points, emojis — identical structure

OUTPUT: Only the humanised Swedish text. Nothing else.

TEXT TO HUMANISE:
${text}`;
}

function parseToneResult(raw) {
  try {
    const cleaned = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function Translate() {
  const [contentType, setContentType] = useState('chat');
  const [tone, setTone] = useState('balanced');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [translating, setTranslating] = useState(false);
  const [checking, setChecking] = useState(false);
  const [applying, setApplying] = useState(false);
  const [humanising, setHumanising] = useState(false);
  const [toneResult, setToneResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [toneError, setToneError] = useState('');

  async function translate() {
    if (!input.trim()) return;
    setTranslating(true);
    setOutput('');
    setToneResult(null);
    setToneError('');
    try {
      const result = await InvokeLLM({
        prompt: buildTranslatePrompt(scrubPII(input.trim()), contentType, tone),
        system_prompt: 'You are an expert Swedish translator for Bybit customer support. Your translations are natural, human, and professional. You never add explanations — only the translated text.',
      });
      setOutput(result.trim());
    } catch (e) {
      setOutput(`Error: ${e.message}`);
    }
    setTranslating(false);
  }

  async function checkTone() {
    if (!output.trim()) return;
    setChecking(true);
    setToneResult(null);
    setToneError('');
    try {
      const raw = await InvokeLLM({
        prompt: buildToneCheckPrompt(scrubPII(output.trim()), contentType),
        system_prompt: 'You are a strict Swedish tone quality checker. Return only valid JSON — no markdown, no text before or after.',
      });
      const parsed = parseToneResult(raw);
      if (parsed) setToneResult(parsed);
      else setToneError('Could not parse tone analysis. Try again.');
    } catch (e) {
      setToneError(`Error: ${e.message}`);
    }
    setChecking(false);
  }

  // Apply all tone improvements back into the full output text
  async function applyImprovements() {
    if (!output.trim() || !toneResult) return;
    setApplying(true);
    try {
      const result = await InvokeLLM({
        prompt: buildApplyImprovementsPrompt(scrubPII(output.trim()), toneResult, contentType),
        system_prompt: 'You are a native Swedish copyeditor. Apply the listed improvements precisely and return only the corrected Swedish text.',
      });
      setOutput(result.trim());
      setToneResult(null); // stale now — needs a fresh check
    } catch (e) {
      setToneError(`Error applying improvements: ${e.message}`);
    }
    setApplying(false);
  }

  // Dedicated humanising pass — makes Swedish sound truly native
  async function humanise() {
    if (!output.trim()) return;
    setHumanising(true);
    setToneResult(null);
    try {
      const result = await InvokeLLM({
        prompt: buildHumanisePrompt(scrubPII(output.trim()), contentType),
        system_prompt: 'You are a native Swedish speaker polishing customer support copy. Return only the humanised Swedish text — no explanations, no commentary.',
      });
      setOutput(result.trim());
    } catch (e) {
      setToneError(`Error: ${e.message}`);
    }
    setHumanising(false);
  }

  function copy() {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function reset() {
    setInput('');
    setOutput('');
    setToneResult(null);
    setToneError('');
    setCopied(false);
  }

  const outputBusy = translating || applying || humanising;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex items-start justify-between"
      >
        <div>
          <h1 className="text-xl font-bold text-fg-0">🇸🇪 Swedish Translator</h1>
          <p className="text-sm text-fg-2">Translate support texts to natural, human Swedish</p>
        </div>
        <button
          onClick={reset}
          className="flex items-center gap-1 text-xs text-fg-2 hover:text-crit transition-colors"
        >
          <RotateCcw size={13} /> Reset
        </button>
      </motion.div>

      {/* Content type selector */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.05 }}
        className="grid grid-cols-3 gap-3"
      >
        {CONTENT_TYPES.map((t, i) => (
          <motion.button
            key={t.key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.07 + i * 0.04 }}
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => { setContentType(t.key); setToneResult(null); }}
            className={cn(
              'rounded-xl p-3.5 text-left border transition-all duration-200',
              contentType === t.key
                ? 'bg-hero/10 border-hero/40 shadow-lg shadow-hero/5'
                : 'bg-bg-1 border-border-0 hover:border-border-0'
            )}
          >
            <p className="text-lg mb-1">{t.icon}</p>
            <p className={cn('font-medium text-sm', contentType === t.key ? 'text-hero' : 'text-fg-0')}>{t.label}</p>
            <p className="text-xs text-fg-2 mt-0.5">{t.desc}</p>
          </motion.button>
        ))}
      </motion.div>

      {/* Tone selector */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.16 }}
        className="bg-bg-1 border border-border-0 rounded-xl p-4"
      >
        <p className="text-xs font-semibold text-fg-1 mb-3 uppercase tracking-wider">Output tone</p>
        <div className="flex gap-2">
          {TONE_OPTIONS.map(t => (
            <button
              key={t.key}
              onClick={() => setTone(t.key)}
              className={cn(
                'flex-1 rounded-lg px-3 py-2.5 text-left border transition-all duration-150',
                tone === t.key
                  ? 'bg-hero/10 border-hero/40 text-hero'
                  : 'bg-bg-2 border-border-0 text-fg-1 hover:text-fg-0 hover:border-border-1'
              )}
            >
              <p className="text-sm font-medium">{t.label}</p>
              <p className="text-xs opacity-60 mt-0.5">{t.desc}</p>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Translation panels */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.22 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-4"
      >
        {/* English input */}
        <div className="bg-bg-1 border border-border-0 rounded-xl overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-0 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-base">🇬🇧</span>
              <span className="text-sm font-semibold text-fg-1">English</span>
            </div>
            {input && (
              <button onClick={() => setInput('')} className="text-xs text-fg-2 hover:text-fg-1 transition-colors">
                Clear
              </button>
            )}
          </div>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={contentType === 'chat'
              ? 'Paste your chat quicktext here...'
              : contentType === 'lark'
              ? 'Paste your Lark template or internal note here...'
              : 'Paste your email template here...'
            }
            className="flex-1 w-full bg-transparent px-4 py-3 text-sm text-fg-0 placeholder-fg-3 outline-none resize-none font-mono leading-relaxed min-h-52"
          />
          <div className="px-4 py-2.5 border-t border-border-0 shrink-0">
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={translate}
              disabled={!input.trim() || translating}
              className="w-full bg-hero hover:bg-hero disabled:bg-bg-2 disabled:text-fg-2 text-[#021418] font-semibold text-sm py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {translating ? (
                <><Loader2 size={14} className="animate-spin" /> Translating...</>
              ) : (
                <><Languages size={14} /> Translate to Swedish</>
              )}
            </motion.button>
          </div>
        </div>

        {/* Swedish output */}
        <div className={cn(
          'border rounded-xl overflow-hidden flex flex-col transition-all duration-300',
          output ? 'bg-bg-1 border-hero/20' : 'bg-bg-1/50 border-border-0'
        )}>
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-0 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-base">🇸🇪</span>
              <span className={cn('text-sm font-semibold', output ? 'text-hero' : 'text-fg-2')}>Swedish</span>
              {output && !outputBusy && <span className="w-1.5 h-1.5 rounded-full bg-hero" />}
              {outputBusy && <Loader2 size={11} className="animate-spin text-hero/60" />}
            </div>
            {output && (
              <div className="flex items-center gap-2">
                {/* Humanise button */}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={humanise}
                  disabled={humanising || applying || checking}
                  className={cn(
                    'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors duration-150',
                    humanising
                      ? 'bg-purple-500/15 border-purple-500/30 text-purple-300'
                      : 'bg-bg-2 border-border-0 text-fg-1 hover:text-purple-300 hover:border-purple-500/30 disabled:opacity-40'
                  )}
                  title="Humanise — make the Swedish sound truly native"
                >
                  {humanising ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
                  {humanising ? 'Humanising…' : 'Humanise'}
                </motion.button>
                {/* Copy button */}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={copy}
                  className="flex items-center gap-1.5 text-xs bg-hero/20 hover:bg-hero/30 text-hero px-3 py-1.5 rounded-lg transition-colors"
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {copied
                      ? <motion.span key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-1"><Check size={11} /> Copied!</motion.span>
                      : <motion.span key="copy" initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-1"><Copy size={11} /> Copy</motion.span>
                    }
                  </AnimatePresence>
                </motion.button>
              </div>
            )}
          </div>

          <div className="flex-1 relative min-h-52">
            {output ? (
              <pre className={cn(
                'w-full h-full px-4 py-3 text-sm text-fg-0 whitespace-pre-wrap font-mono leading-relaxed overflow-y-auto transition-opacity duration-200',
                outputBusy && 'opacity-40'
              )}>{output}</pre>
            ) : (
              <div className="flex items-center justify-center h-full min-h-52 text-fg-3 text-sm">
                {translating ? (
                  <div className="flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin text-hero/50" />
                    <span className="text-fg-2">Translating...</span>
                  </div>
                ) : (
                  <div className="text-center space-y-1">
                    <p className="text-2xl">🇸🇪</p>
                    <p>Translation will appear here</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {output && (
            <div className="px-4 py-2.5 border-t border-border-0 shrink-0">
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={checkTone}
                disabled={checking || applying || humanising}
                className="w-full bg-bg-2 hover:bg-bg-3 disabled:bg-bg-2/50 disabled:text-fg-2 text-fg-0 text-sm py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 border border-border-0 hover:border-border-1"
              >
                {checking ? (
                  <><Loader2 size={14} className="animate-spin" /> Checking tone...</>
                ) : (
                  <><Sparkles size={14} className="text-hero" /> Check tone</>
                )}
              </motion.button>
            </div>
          )}
        </div>
      </motion.div>

      {/* Tone analysis result */}
      <AnimatePresence>
        {toneResult && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="bg-bg-1 border border-border-0 rounded-xl overflow-hidden"
          >
            {/* Score bar */}
            <div className="flex items-center gap-4 px-5 py-4 border-b border-border-0">
              <div className={cn('text-3xl font-bold tabular-nums border rounded-xl w-16 h-16 flex items-center justify-center shrink-0 flex-col gap-0', scoreColor(toneResult.score))}>
                <span>{toneResult.score}</span>
                <span className="text-xs font-normal opacity-50">/10</span>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-fg-0">{toneResult.label}</p>
                <p className="text-xs text-fg-2 mt-0.5">
                  {toneResult.score >= 9 ? 'Native-level quality. Ready to use.' :
                   toneResult.score >= 7 ? 'Good. Minor improvements possible.' :
                   toneResult.score >= 5 ? 'Passable, but worth refining.' :
                   'Needs work before sending.'}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* Apply improvements — shown when there's something to fix */}
                {(toneResult.improvements?.length > 0 || toneResult.rewrite) && toneResult.score < 10 && (
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={applyImprovements}
                    disabled={applying || humanising || checking}
                    className={cn(
                      'flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border font-medium transition-colors duration-150',
                      applying
                        ? 'bg-hero/15 border-hero/30 text-hero'
                        : 'bg-hero/10 border-hero/40 text-hero hover:bg-hero/20 disabled:opacity-50'
                    )}
                  >
                    {applying
                      ? <><Loader2 size={12} className="animate-spin" /> Applying…</>
                      : <><Sparkles size={12} /> Apply improvements</>
                    }
                  </motion.button>
                )}
                <button
                  onClick={checkTone}
                  disabled={checking}
                  className="text-xs text-fg-2 hover:text-hero transition-colors disabled:opacity-40"
                >
                  Re-check
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Strengths */}
              {toneResult.strengths?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-ok uppercase tracking-wider mb-2">Strengths</p>
                  <ul className="space-y-1.5">
                    {toneResult.strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-fg-1">
                        <span className="text-ok mt-0.5 shrink-0">✓</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Improvements */}
              {toneResult.improvements?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-hero uppercase tracking-wider mb-2">Improvements</p>
                  <ul className="space-y-1.5">
                    {toneResult.improvements.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-fg-1">
                        <span className="text-hero mt-0.5 shrink-0">→</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Suggested rewrite */}
              {toneResult.rewrite && (
                <div className="bg-bg-2/60 border border-border-0 rounded-xl p-4">
                  <p className="text-xs font-semibold text-fg-1 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Sparkles size={11} className="text-hero" />
                    Suggested rewrite
                  </p>
                  <p className="text-sm text-fg-0 leading-relaxed font-mono whitespace-pre-wrap">{toneResult.rewrite}</p>
                  <div className="flex items-center gap-3 mt-3">
                    <button
                      onClick={() => navigator.clipboard.writeText(toneResult.rewrite)}
                      className="text-xs text-fg-2 hover:text-hero transition-colors flex items-center gap-1"
                    >
                      <Copy size={10} /> Copy suggestion
                    </button>
                    <button
                      onClick={applyImprovements}
                      disabled={applying}
                      className="text-xs text-hero/80 hover:text-hero disabled:opacity-40 transition-colors flex items-center gap-1 font-medium"
                    >
                      {applying ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                      Apply all improvements to full text
                    </button>
                  </div>
                </div>
              )}

              {/* After applying — nudge to re-check */}
              {!toneResult.rewrite && !toneResult.improvements?.length && toneResult.score >= 9 && (
                <p className="text-xs text-ok/70 text-center py-2">
                  ✓ This translation is at native quality — ready to send.
                </p>
              )}
            </div>
          </motion.div>
        )}

        {toneError && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-crit/10 border border-crit/30 rounded-xl p-4 text-sm text-crit"
          >
            {toneError}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Usage tips */}
      <AnimatePresence>
        {!output && !translating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-bg-1/50 border border-border-0 rounded-xl p-5"
          >
            <p className="text-xs font-semibold text-fg-2 uppercase tracking-wider mb-3">How it works</p>
            <ul className="space-y-2 text-sm text-fg-2">
              <li className="flex items-start gap-2">
                <ChevronRight size={13} className="text-hero/50 mt-0.5 shrink-0" />
                Paste English → hit <span className="text-fg-1">Translate</span> → get natural Swedish
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight size={13} className="text-hero/50 mt-0.5 shrink-0" />
                Hit <span className="text-fg-1">Check tone</span> → get a score, specific issues, and a suggested rewrite
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight size={13} className="text-hero/50 mt-0.5 shrink-0" />
                Hit <span className="text-hero/80">Apply improvements</span> → every flagged issue is fixed in one click. Re-check after.
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight size={13} className="text-hero/50 mt-0.5 shrink-0" />
                Hit <span className="text-purple-400/80">Humanise</span> → dedicated native-speaker pass. Use this for final polish before sending.
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight size={13} className="text-hero/50 mt-0.5 shrink-0" />
                Placeholders like <code className="text-fg-1 bg-bg-2 px-1 rounded text-xs">[NAME]</code>, <code className="text-fg-1 bg-bg-2 px-1 rounded text-xs">{'{{{Case.Anti_Phishing_Text__c}}}'}</code> are always kept intact
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight size={13} className="text-hero/50 mt-0.5 shrink-0" />
                USDT, KYC, SEPA, TXID, 2FA — always in English. Swedish customers expect this.
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
