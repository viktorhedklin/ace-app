import { useState, useRef, useEffect } from 'react';
import { Loader2, Copy, Check, Wand2, ClipboardCheck, FileText, Brain, AlertTriangle, Sparkles, MessageSquare, ChevronDown, Send, Trash2, Pencil, MessagesSquare, Library as LibraryIcon, BookOpen, Lightbulb, Tag, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  buildScenario, evaluateTranscript, refineScenario, copilotAsk, debriefAsk, extractDebriefLessons, CANONICAL_CHECKPOINTS,
} from '@/lib/scenarioStudio';
import {
  listScenarios, saveScenario, updateScenario, renameScenario, deleteScenario,
} from '@/lib/scenarioLibrary';
import {
  listLessons, saveLessons, deleteLesson,
} from '@/lib/debriefMemory';

// ── official enums (from the CS Training — Role-play Scenario Creation Guide) ──
const SCOPE_OPTIONS = ['Non-tech', 'Tech', 'MT5'];
const CASE_TYPE_OPTIONS = ['MT5', 'Bybit Card', 'Deposit & Withdrawal', 'Account Matters', 'Spot Trading', 'C&B', 'Others'];
const EMOTION_OPTIONS = ['Low (Calm)', 'Medium (Dissatisfied)', 'High (Angry)'];
const CP_CATEGORIES = ['Probing Questions', 'Accuracy and Product Knowledge', 'Process Handling and Escalation', 'Soft Skills and Empathy', 'Added-Value Support', 'Deductions'];

function cpCategory(c) {
  if (c.category) return c.category;
  const d = (c.desc || '').toLowerCase();
  if (/added.?value|bonus/.test(d) || c.bonus) return 'Added-Value Support';
  if (/deduction|deduct|penalt/.test(d) || c.deduction) return 'Deductions';
  if (/probing|probe|ask|question/.test(d)) return 'Probing Questions';
  if (/process|escalat|timeframe|document|self.?correct|pushback/.test(d)) return 'Process Handling and Escalation';
  if (/soft|empath|tone|frustrat|polite/.test(d)) return 'Soft Skills and Empathy';
  if (/accuracy|product|sop|root cause|policy|correct|faq|link/.test(d)) return 'Accuracy and Product Knowledge';
  return 'Accuracy and Product Knowledge';
}
function isBonusCp(c) { return !!(c.bonus || /added.?value|bonus/i.test(c.desc || '') || /added.?value/i.test(c.category || '')); }
function isDeductionCp(c) { return !!(c.deduction || /deduction|deduct|penalt/i.test(c.desc || '') || /deduction/i.test(c.category || '')); }

// ── helpers ─────────────────────────────────────────────────────────────────
const FIELD_LABELS = {
  issue: '1 · Overall Issue Explanation',
  hidden: '2 · Answer Key & Hidden Context',
  flow: '3 · Ideal Agent Flow',
  bot: '4 · Bot Acting Instructions',
  deescalation: '5 · De-escalation Guidance',
  feedbackNotes: '7 · Feedback & Key Knowledge Notes',
  screenshots: '8 · Scenario Screenshots',
  references: '9 · Reference Materials',
};
const ORDER = ['issue', 'hidden', 'flow', 'bot', 'deescalation', 'feedbackNotes', 'screenshots', 'references'];

// Base = everything except bonus (Added-Value) and deduction items.
function baseTotal(cps) {
  return (cps || []).filter(c => !isBonusCp(c) && !isDeductionCp(c))
    .reduce((t, c) => t + (Number(c.max) || 0), 0);
}

// per-category point subtotals (base categories only; Added-Value & Deductions are separate)
function categorySubtotals(cps) {
  const sums = { 'Probing Questions': 0, 'Accuracy and Product Knowledge': 0, 'Process Handling and Escalation': 0, 'Soft Skills and Empathy': 0, 'Added-Value Support': 0, 'Deductions': 0 };
  (cps || []).forEach(c => { const cat = cpCategory(c); if (cat in sums) sums[cat] += Number(c.max) || 0; });
  return sums;
}
// Guide weights — these are RECOMMENDED weights, not hard requirements. A scenario
// may legitimately re-weight categories (e.g. core-knowledge case → Accuracy 60,
// Probing 10, Soft 10). We surface deviation as a soft hint, never an error.
const CAT_TARGET = { 'Probing Questions': 20, 'Accuracy and Product Knowledge': 40, 'Process Handling and Escalation': 20, 'Soft Skills and Empathy': 20 };
const CAT_SHORT = { 'Probing Questions': 'Probing', 'Accuracy and Product Knowledge': 'Accuracy', 'Process Handling and Escalation': 'Process', 'Soft Skills and Empathy': 'Soft', 'Added-Value Support': 'Added-Value', 'Deductions': 'Deductions' };

// pre-Lark readiness check — these break the bot's filtering / won't run if wrong
function readiness(s) {
  if (!s) return { errors: [], warnings: [] };
  const errors = [], warnings = [];
  if (!s.title || !s.title.trim()) errors.push('Scenario Title is empty.');
  if (!CASE_TYPE_OPTIONS.includes(s.type)) errors.push('Case Type is empty or off-spec — the bot filters by it.');
  if (!SCOPE_OPTIONS.includes(s.scope)) errors.push('Scope is empty or off-spec.');
  if (!EMOTION_OPTIONS.includes(s.emotion)) errors.push('Initial Customer Emotion is empty or off-spec.');
  if (!(Number(s.difficulty) >= 1 && Number(s.difficulty) <= 5)) warnings.push('Set a Difficulty (1–5).');
  if (!s.language || !s.language.trim()) warnings.push('Native Language is empty — the bot needs it to open in-language.');
  if (baseTotal(s.checkpoints) !== 100) errors.push(`Checkpoints base total is ${baseTotal(s.checkpoints)}/100 — must be exactly 100.`);
  for (const k of ['issue', 'hidden', 'flow', 'bot']) {
    if (!s[k] || !s[k].trim()) errors.push(`${FIELD_LABELS[k]} is empty.`);
  }
  // Soft guidance only: note categories that deviate a lot from the guide weights,
  // and categories with zero coverage. Re-weighting is allowed as long as base==100.
  const subs = categorySubtotals(s.checkpoints);
  Object.entries(CAT_TARGET).forEach(([cat, tgt]) => {
    if (subs[cat] === 0) warnings.push(`${CAT_SHORT[cat]} has no checkpoint — make sure that's intentional (guide weights it ${tgt}).`);
    else if (Math.abs(subs[cat] - tgt) > 10) warnings.push(`${CAT_SHORT[cat]} is ${subs[cat]} pts vs guide weight ${tgt} — fine if the case justifies it.`);
  });
  if (!s.testCompleted) warnings.push('Test Completed is unchecked — tick it only after the bot test passes.');
  return { errors, warnings };
}

function scenarioToLark(s) {
  if (!s) return '';
  const L = [];
  L.push(`Scenario ID: ${s.id || ''}`);
  L.push(`Title: ${s.title || ''}`);
  L.push(`Case Type: ${s.type || ''}`);
  L.push(`Scope: ${s.scope || ''}`);
  L.push(`Language: ${s.language || ''}`);
  L.push(`Language Team: ${s.languageTeam || '(any)'}`);
  L.push(`Difficulty: ${s.difficulty || ''}/5`);
  L.push(`Initial Customer Emotion: ${s.emotion || ''}`);
  L.push(`Active: ${s.activeStatus ? 'Yes' : 'No'} · Test Completed: ${s.testCompleted ? 'Yes' : 'No'}`);
  L.push('');
  for (const k of ORDER) { L.push(`【${FIELD_LABELS[k]}】`); L.push(s[k] || ''); L.push(''); }
  L.push('【6 · Evaluation Checkpoints】');
  (s.checkpoints || []).forEach(c => {
    const tag = isBonusCp(c) ? ' BONUS' : isDeductionCp(c) ? ' DEDUCTION' : '';
    L.push(`[${cpCategory(c)}] ${c.desc}  → ${isDeductionCp(c) ? '-' : ''}${c.max}${tag} pts`);
  });
  const bonusPts = (s.checkpoints || []).filter(isBonusCp).reduce((t, c) => t + (Number(c.max) || 0), 0);
  L.push(`Base total: ${baseTotal(s.checkpoints)}/100${bonusPts ? ` (+${bonusPts} Added-Value bonus, excluded from base)` : ''}`);
  return L.join('\n');
}

// build the official Lark feedback report from an agent evaluation result
function buildLarkFeedback(result, scenario) {
  if (!result) return '';
  const L = [];
  const id = scenario?.id || 'SC-XXX';
  const total = Number(result.total_score) || 0;
  L.push(`📋 [${id}] Roleplay Feedback Report`);
  L.push(`Case Type: ${scenario?.type || '—'} | Difficulty: ⭐${scenario?.difficulty || '—'} | Emotion: ${scenario?.emotion || '—'}`);
  L.push('');
  L.push('✅ Check Points Evaluation');
  (result.checkpoints || []).forEach((c, i) => {
    const sc = Number(c.score) || 0, mx = Number(c.max) || 0;
    const mark = mx === 0 ? '•' : sc >= mx ? '✅' : sc <= 0 ? '❌' : '⚠️';
    const verdict = mx === 0 ? '' : sc >= mx ? 'PASS' : sc <= 0 ? 'FAIL' : 'PARTIAL';
    L.push(`${i + 1}. ${c.name} (Max ${mx}pts) → ${sc}/${mx} ${mark} ${verdict}`);
    if (c.rationale) L.push(`   - ${c.rationale}`);
  });
  L.push('');
  L.push(`Base Total: ${total}/100 pts (${total}%)`);
  if (result.added_value_note) L.push(`(Added-Value +5 bonus, separate from base): ${result.added_value_note}`);
  if (Array.isArray(result.key_knowledge) && result.key_knowledge.length) {
    L.push(''); L.push('📖 Key Knowledge');
    result.key_knowledge.forEach(k => L.push(`• ${k}`));
  }
  if (Array.isArray(result.key_takeaways) && result.key_takeaways.length) {
    L.push(''); L.push('💡 Key Takeaways');
    result.key_takeaways.forEach((k, i) => L.push(`${i + 1}. ${k}`));
  }
  if (scenario?.scope) { L.push(''); L.push(`Scope: ${scenario.scope}`); }
  return L.join('\n');
}

function CopyBtn({ text, label = 'Copy' }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1800); }}
      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-bg-2 hover:bg-bg-3 text-fg-1 border border-border-0 transition-colors"
    >
      {done ? <Check className="w-3.5 h-3.5 text-ok" /> : <Copy className="w-3.5 h-3.5" />}
      {done ? 'Copied' : label}
    </button>
  );
}

function Field({ label, value, onChange, mono, rows = 4 }) {
  return (
    <div>
      <label className="text-xs text-fg-2 mb-1 block">{label}</label>
      <textarea
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        className={cn(
          'w-full bg-bg-1 border border-border-0 focus:border-hero/50 rounded-xl px-3 py-2 text-sm text-fg-0 placeholder-fg-2 outline-none resize-y transition-colors',
          mono && 'font-mono text-[12px]'
        )}
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options, placeholder = 'Select…' }) {
  const known = options.includes(value);
  return (
    <div>
      <label className="text-xs text-fg-2 mb-1 block">{label}</label>
      <select
        value={known ? value : ''}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-bg-1 border border-border-0 focus:border-hero/50 rounded-xl px-3 py-2 text-sm text-fg-0 outline-none transition-colors">
        <option value="" disabled>{value && !known ? `⚠ ${value} (off-spec)` : placeholder}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function StarsField({ label, value, onChange }) {
  const v = Number(value) || 0;
  return (
    <div>
      <label className="text-xs text-fg-2 mb-1 block">{label}</label>
      <div className="flex items-center gap-1 h-[38px]">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} type="button" onClick={() => onChange(n)}
            className={cn('text-xl leading-none transition-colors', n <= v ? 'text-warn' : 'text-fg-3 hover:text-fg-2')}>★</button>
        ))}
        <span className="text-xs text-fg-2 ml-2">{v ? `${v}/5` : ''}</span>
      </div>
    </div>
  );
}

function CheckField({ label, checked, onChange, hint }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className="flex items-start gap-2.5 text-left w-full bg-bg-1 border border-border-0 rounded-xl px-3 py-2.5 hover:border-hero/40 transition-colors">
      <span className={cn('mt-0.5 w-4 h-4 rounded flex items-center justify-center border shrink-0',
        checked ? 'bg-hero border-hero' : 'border-border-0 bg-bg-2')}>
        {checked && <Check className="w-3 h-3 text-white" />}
      </span>
      <span className="flex-1">
        <span className="text-sm text-fg-0 font-medium block">{label}</span>
        {hint && <span className="text-[11px] text-fg-2 block mt-0.5">{hint}</span>}
      </span>
    </button>
  );
}

// ── Step rail ─────────────────────────────────────────────────────────────────
function StepRail({ step }) {
  const steps = [
    { n: 1, label: 'Build', icon: Wand2 },
    { n: 2, label: 'Review', icon: FileText },
    { n: 3, label: 'Evaluate', icon: ClipboardCheck },
    { n: 4, label: 'Practice', icon: MessagesSquare },
    { n: 5, label: 'Debrief', icon: BookOpen },
  ];
  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center gap-2">
          <div className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border',
            step === s.n ? 'bg-hero/15 text-hero border-hero/30'
              : step > s.n ? 'bg-ok/10 text-ok border-ok/20' : 'bg-bg-1 text-fg-3 border-border-0'
          )}>
            <s.icon className="w-3.5 h-3.5" />{s.label}
          </div>
          {i < steps.length - 1 && <div className={cn('w-6 h-px', step > s.n ? 'bg-ok/40' : 'bg-border-0')} />}
        </div>
      ))}
    </div>
  );
}

// ── Evaluator result blocks ───────────────────────────────────────────────────
function AgentScore({ result }) {
  const total = Number(result.total_score) || 0;
  const color = total >= 85 ? 'text-ok' : total >= 70 ? 'text-hero' : total >= 50 ? 'text-warn' : 'text-crit';
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className={cn('text-4xl font-bold tabular-nums', color)}>{total}<span className="text-fg-3 text-xl">/100</span></div>
        <div className="flex-1 h-2 bg-bg-2 rounded-full overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: `${total}%` }} transition={{ duration: 0.7 }}
            className="h-full rounded-full" style={{ backgroundColor: total >= 85 ? '#4ade80' : total >= 70 ? '#818cf8' : total >= 50 ? '#facc15' : '#f87171' }} />
        </div>
      </div>
      <div className="space-y-2">
        {(result.checkpoints || []).map((c, i) => (
          <div key={i} className="bg-bg-1 border border-border-0 rounded-xl p-3">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-sm text-fg-0 font-medium">{c.name}</span>
              <span className="text-sm tabular-nums text-fg-1">{c.score}/{c.max}</span>
            </div>
            {c.evidence && <div className="text-xs text-fg-2 italic border-l-2 border-border-0 pl-2 my-1">"{c.evidence}"</div>}
            {c.rationale && <div className="text-xs text-fg-2">{c.rationale}</div>}
          </div>
        ))}
      </div>
      {result.added_value_note && (
        <div className="bg-hero/5 border border-hero/20 rounded-xl p-3 text-xs text-fg-1">
          <span className="text-hero font-medium">Added-Value (+5 bonus, separate): </span>{result.added_value_note}
        </div>
      )}
      {Array.isArray(result.key_knowledge) && result.key_knowledge.length > 0 && (
        <div><div className="text-xs font-semibold text-fg-1 mb-1">Key Knowledge</div>
          <ul className="text-xs text-fg-2 list-disc pl-5 space-y-0.5">{result.key_knowledge.map((k, i) => <li key={i}>{k}</li>)}</ul></div>
      )}
      {Array.isArray(result.key_takeaways) && result.key_takeaways.length > 0 && (
        <div><div className="text-xs font-semibold text-fg-1 mb-1">Key Takeaways</div>
          <ul className="text-xs text-fg-2 list-disc pl-5 space-y-0.5">{result.key_takeaways.map((k, i) => <li key={i}>{k}</li>)}</ul></div>
      )}
    </div>
  );
}

function BotQA({ qa }) {
  if (!qa) return null;
  const vColor = qa.verdict === 'PASS' ? 'text-ok bg-ok/10 border-ok/20'
    : qa.verdict === 'FAIL' ? 'text-crit bg-crit/10 border-crit/20' : 'text-warn bg-warn/10 border-warn/20';
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-2xl font-bold tabular-nums text-fg-0">{Number(qa.score) || 0}<span className="text-fg-3 text-base">/100</span></span>
        <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full border', vColor)}>BOT: {qa.verdict || '—'}</span>
      </div>
      {qa.summary && <p className="text-sm text-fg-1">{qa.summary}</p>}
      {Array.isArray(qa.issues) && qa.issues.length > 0 && (
        <div><div className="text-xs font-semibold text-crit mb-1">Issues</div>
          <div className="space-y-1.5">{qa.issues.map((it, i) => (
            <div key={i} className="bg-bg-1 border border-border-0 rounded-lg p-2.5">
              <div className="text-xs text-fg-0">{it.issue}</div>
              {it.evidence && <div className="text-[11px] text-fg-2 italic mt-1">"{it.evidence}"</div>}
            </div>))}</div></div>
      )}
      {Array.isArray(qa.good_points) && qa.good_points.length > 0 && (
        <div><div className="text-xs font-semibold text-ok mb-1">Did well</div>
          <ul className="text-xs text-fg-2 list-disc pl-5 space-y-0.5">{qa.good_points.map((g, i) => <li key={i}>{g}</li>)}</ul></div>
      )}
    </div>
  );
}

// ── Co-pilot chat (collapsible, bottom of Evaluate step) ──────────────────────
function CoPilot({ scenario, transcript, evalResult }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);
  const taRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, busy]);

  async function send() {
    const q = input.trim();
    if (!q || busy) return;
    const next = [...msgs, { role: 'user', content: q }];
    setMsgs(next); setInput(''); setBusy(true);
    try {
      const reply = await copilotAsk({ messages: next, scenario, transcript, evalResult });
      setMsgs(m => [...m, { role: 'assistant', content: reply }]);
    } catch (e) {
      const msg = ['NO_ALIBABA_KEY', 'NO_API_KEY', 'NO_OPENAI_KEY'].includes(e.message)
        ? 'No LLM key configured — set it in Settings.' : ('Error: ' + e.message);
      setMsgs(m => [...m, { role: 'assistant', content: msg, error: true }]);
    }
    setBusy(false);
  }

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  return (
    <div className="mt-4 border border-border-0 rounded-2xl bg-bg-0 overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-bg-1 transition-colors">
        <span className="flex items-center gap-2 text-sm font-medium text-fg-0">
          <MessageSquare className="w-4 h-4 text-hero" /> Ask ACE — live co-pilot
          <span className="text-[11px] font-normal text-fg-3">grounded in the KB · knows this scenario & transcript</span>
        </span>
        <ChevronDown className={cn('w-4 h-4 text-fg-2 transition-transform', open && 'rotate-180')} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="border-t border-border-0">
            <div ref={scrollRef} className="max-h-80 overflow-y-auto px-4 py-3 space-y-3">
              {msgs.length === 0 && (
                <div className="text-xs text-fg-2 bg-bg-1 border border-border-0 rounded-xl p-3">
                  You're the agent — the bot's pushing you. Ask me anything mid-conversation, e.g. <span className="text-fg-1">"the customer is asking why their withdrawal is stuck, how do I respond?"</span> I'll give you the SOP-correct reply (in the customer's language) using this scenario + ACE's knowledge.
                </div>
              )}
              {msgs.map((m, i) => (
                <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cn('max-w-[85%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words',
                    m.role === 'user' ? 'bg-hero text-white rounded-br-sm'
                      : m.error ? 'bg-crit/10 text-crit border border-crit/20 rounded-bl-sm'
                        : 'bg-bg-1 text-fg-0 border border-border-0 rounded-bl-sm')}>
                    {m.content}
                  </div>
                </div>
              ))}
              {busy && (
                <div className="flex justify-start">
                  <div className="bg-bg-1 border border-border-0 rounded-2xl rounded-bl-sm px-3.5 py-2.5">
                    <Loader2 className="w-4 h-4 animate-spin text-hero" />
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-border-0 p-3 flex items-end gap-2">
              <textarea
                ref={taRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKey}
                rows={1}
                placeholder="Ask ACE how to handle the customer… (Enter to send, Shift+Enter for newline)"
                className="flex-1 bg-bg-1 border border-border-0 focus:border-hero/50 rounded-xl px-3 py-2 text-sm text-fg-0 placeholder-fg-2 outline-none resize-none max-h-32 transition-colors"
              />
              {msgs.length > 0 && (
                <button onClick={() => setMsgs([])} title="Clear chat"
                  className="p-2.5 rounded-xl bg-bg-2 hover:bg-bg-3 text-fg-2 border border-border-0 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button onClick={send} disabled={busy || !input.trim()}
                className="p-2.5 rounded-xl bg-hero text-white hover:bg-hero/90 disabled:opacity-40 transition-colors">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Practice chat (Step 4) ────────────────────────────────────────────────────
// The agent practices replying to the in-house bot-customer. They paste what the
// customer (bot) just said; ACE — who knows the full scenario incl. the hidden
// answer key — coaches the ideal reply. Builds a running transcript so ACE has
// full conversation context, and reuses copilotAsk() from the engine.
function PracticeChat({ scenario }) {
  const [msgs, setMsgs] = useState([]);          // {role:'customer'|'agent'|'ace', content, error?}
  const [input, setInput] = useState('');
  const [mode, setMode] = useState('customer');  // 'customer' = paste bot line · 'agent' = log my own reply
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, busy]);

  // Flatten the running convo into the transcript copilotAsk expects.
  function transcriptText(list) {
    return list
      .filter(m => m.role === 'customer' || m.role === 'agent')
      .map(m => `${m.role === 'customer' ? 'Customer' : 'Agent'}: ${m.content}`)
      .join('\n');
  }
  // copilotAsk treats role:'user' as the agent and everything else as ACE.
  function copilotMessages(list) {
    return list
      .filter(m => m.role === 'agent' || m.role === 'ace' || m.role === 'customer')
      .map(m => m.role === 'ace'
        ? { role: 'assistant', content: m.content }
        : m.role === 'customer'
          ? { role: 'user', content: `The customer just said: "${m.content}". How should I reply?` }
          : { role: 'user', content: `(I replied: ${m.content})` });
  }

  async function askAce(list) {
    setBusy(true);
    try {
      const reply = await copilotAsk({
        messages: copilotMessages(list),
        scenario,
        transcript: transcriptText(list),
      });
      setMsgs(m => [...m, { role: 'ace', content: reply }]);
    } catch (e) {
      const msg = ['NO_ALIBABA_KEY', 'NO_API_KEY', 'NO_OPENAI_KEY'].includes(e.message)
        ? 'No LLM key configured — set it in Settings.' : ('Error: ' + e.message);
      setMsgs(m => [...m, { role: 'ace', content: msg, error: true }]);
    }
    setBusy(false);
  }

  async function send() {
    const q = input.trim();
    if (!q || busy) return;
    const entry = { role: mode, content: q };
    const next = [...msgs, entry];
    setMsgs(next); setInput('');
    // When the customer (bot) speaks, ACE coaches a reply. Logging my own reply is silent.
    if (mode === 'customer') await askAce(next);
  }

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  const bubble = {
    customer: 'bg-bg-2 text-fg-0 border border-border-0 rounded-bl-sm',
    agent: 'bg-hero text-white rounded-br-sm',
    ace: 'bg-ok/10 text-fg-0 border border-ok/25 rounded-bl-sm',
  };

  return (
    <div className="space-y-3">
      <div className="bg-ok/5 border border-ok/20 rounded-xl p-3 text-xs text-fg-1 flex gap-2">
        <MessageSquare className="w-4 h-4 text-ok shrink-0 mt-0.5" />
        <span>
          Practice this scenario live. Paste what the <span className="text-fg-0 font-medium">bot-customer</span> says and ACE — who knows the full answer key &amp; hidden context — coaches your ideal reply. Switch to <span className="text-fg-0 font-medium">My reply</span> to log what you actually sent so ACE keeps the thread.
        </span>
      </div>

      {!scenario && (
        <div className="flex items-start gap-2 bg-warn/10 border border-warn/30 rounded-xl p-3 text-xs text-fg-1">
          <AlertTriangle className="w-4 h-4 text-warn shrink-0 mt-0.5" />
          <span>No scenario loaded — build or open one first so ACE knows the answer key. You can still ask general questions.</span>
        </div>
      )}

      {scenario && (
        <div className="text-xs text-fg-2">
          Practicing: <span className="text-fg-1 font-medium">{scenario.title || scenario.id}</span>
          {scenario.emotion ? <span className="text-fg-3"> · {scenario.emotion}</span> : null}
        </div>
      )}

      <div className="border border-border-0 rounded-2xl bg-bg-0 overflow-hidden">
        <div ref={scrollRef} className="min-h-[18rem] max-h-[28rem] overflow-y-auto px-4 py-3 space-y-3">
          {msgs.length === 0 && (
            <div className="text-xs text-fg-2 bg-bg-1 border border-border-0 rounded-xl p-3">
              Start by pasting the customer's opening line (mode <span className="text-fg-1">Customer says</span>). ACE will reply with the SOP-correct move and a ready-to-send message in the customer's language.
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={cn('flex', m.role === 'agent' ? 'justify-end' : 'justify-start')}>
              <div className="max-w-[85%]">
                <div className={cn('text-[10px] mb-0.5 px-1',
                  m.role === 'agent' ? 'text-right text-fg-3' : m.role === 'ace' ? 'text-ok' : 'text-fg-3')}>
                  {m.role === 'customer' ? 'Customer (bot)' : m.role === 'agent' ? 'You' : 'ACE'}
                </div>
                <div className={cn('rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words',
                  m.error ? 'bg-crit/10 text-crit border border-crit/20 rounded-bl-sm' : bubble[m.role])}>
                  {m.content}
                </div>
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex justify-start">
              <div className="bg-ok/10 border border-ok/25 rounded-2xl rounded-bl-sm px-3.5 py-2.5">
                <Loader2 className="w-4 h-4 animate-spin text-ok" />
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border-0 p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <button onClick={() => setMode('customer')}
              className={cn('text-[11px] px-2.5 py-1 rounded-full border transition-colors',
                mode === 'customer' ? 'bg-bg-2 text-fg-0 border-border-1' : 'bg-bg-1 text-fg-2 border-border-0 hover:text-fg-1')}>
              Customer says
            </button>
            <button onClick={() => setMode('agent')}
              className={cn('text-[11px] px-2.5 py-1 rounded-full border transition-colors',
                mode === 'agent' ? 'bg-hero/15 text-hero border-hero/30' : 'bg-bg-1 text-fg-2 border-border-0 hover:text-fg-1')}>
              My reply
            </button>
            <span className="text-[10px] text-fg-3 ml-1">
              {mode === 'customer' ? 'ACE will coach your response' : 'logged silently — ACE keeps the thread'}
            </span>
          </div>
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              rows={1}
              placeholder={mode === 'customer'
                ? 'Paste what the bot-customer just said… (Enter to send)'
                : 'What you actually replied… (Enter to log)'}
              className="flex-1 bg-bg-1 border border-border-0 focus:border-hero/50 rounded-xl px-3 py-2 text-sm text-fg-0 placeholder-fg-2 outline-none resize-none max-h-32 transition-colors"
            />
            {msgs.length > 0 && (
              <button onClick={() => setMsgs([])} title="Clear practice"
                className="p-2.5 rounded-xl bg-bg-2 hover:bg-bg-3 text-fg-2 border border-border-0 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button onClick={send} disabled={busy || !input.trim()}
              className="p-2.5 rounded-xl bg-hero text-white hover:bg-hero/90 disabled:opacity-40 transition-colors">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Saved scenarios library ───────────────────────────────────────────────────
function Library({ items, activeId, onOpen, onRename, onDelete, onRefresh }) {
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');

  function startRename(rec) { setEditing(rec.recordId); setName(rec.name); }
  async function commitRename(rec) {
    await onRename(rec.recordId, name);
    setEditing(null);
    onRefresh();
  }

  if (!items.length) {
    return (
      <div className="text-xs text-fg-2 bg-bg-1 border border-border-0 rounded-xl p-3">
        No saved scenarios yet. Build one — it auto-saves here so you can reopen, practice, rename or delete it later.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {items.map(rec => (
        <div key={rec.recordId}
          className={cn('flex items-center gap-2 rounded-xl border px-3 py-2.5',
            rec.recordId === activeId ? 'bg-hero/10 border-hero/30' : 'bg-bg-1 border-border-0')}>
          <FileText className={cn('w-4 h-4 shrink-0', rec.recordId === activeId ? 'text-hero' : 'text-fg-3')} />
          <div className="flex-1 min-w-0">
            {editing === rec.recordId ? (
              <input
                autoFocus value={name} onChange={e => setName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') commitRename(rec); if (e.key === 'Escape') setEditing(null); }}
                onBlur={() => commitRename(rec)}
                className="w-full bg-bg-2 border border-hero/40 rounded-lg px-2 py-1 text-sm text-fg-0 outline-none" />
            ) : (
              <button onClick={() => onOpen(rec)} className="block w-full text-left">
                <div className="text-sm text-fg-0 truncate">{rec.name}</div>
                <div className="text-[10px] text-fg-3">
                  {rec.scenario?.type || '—'} · updated {new Date(rec.updatedAt || rec.createdAt || Date.now()).toLocaleDateString()}
                </div>
              </button>
            )}
          </div>
          <button onClick={() => onOpen(rec)} title="Open"
            className="text-[11px] px-2 py-1 rounded-lg bg-hero/15 text-hero border border-hero/30 hover:bg-hero/25 transition-colors">Open</button>
          <button onClick={() => startRename(rec)} title="Rename"
            className="p-1.5 rounded-lg bg-bg-2 hover:bg-bg-3 text-fg-2 border border-border-0 transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={async () => { await onDelete(rec.recordId); onRefresh(); }} title="Delete"
            className="p-1.5 rounded-lg bg-bg-2 hover:bg-crit/15 text-fg-2 hover:text-crit border border-border-0 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Debrief chat (Step 5) ─────────────────────────────────────────────────────
// Viktor pastes real bot feedback and debriefs with ACE. ACE always sides with
// Viktor over the bot. At the end, extract lessons and save to memory.
function DebriefChat({ scenario, onLessonsSaved }) {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [userNotes, setUserNotes] = useState('');
  const [savedLessons, setSavedLessons] = useState(() => listLessons());
  const [showMemory, setShowMemory] = useState(false);
  const [saveNote, setSaveNote] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, busy]);

  function refreshLessons() {
    setSavedLessons(listLessons());
  }

  async function send() {
    const q = input.trim();
    if (!q || busy) return;
    const next = [...msgs, { role: 'user', content: q }];
    setMsgs(next); setInput(''); setBusy(true);
    try {
      const reply = await debriefAsk({
        messages: next,
        scenario,
        savedLessons: listLessons(),
      });
      setMsgs(m => [...m, { role: 'assistant', content: reply }]);
    } catch (e) {
      const msg = ['NO_ALIBABA_KEY', 'NO_API_KEY', 'NO_OPENAI_KEY'].includes(e.message)
        ? 'No LLM key configured — set it in Settings.' : ('Error: ' + e.message);
      setMsgs(m => [...m, { role: 'assistant', content: msg, error: true }]);
    }
    setBusy(false);
  }

  async function handleSaveLessons() {
    if (!msgs.length) return;
    setExtracting(true); setSaveNote('');
    try {
      const extracted = await extractDebriefLessons({
        conversation: msgs,
        scenario,
        userNotes: userNotes.trim(),
      });
      await saveLessons(extracted, {
        scenarioId: scenario?.id,
        scenarioTitle: scenario?.title,
      });
      refreshLessons();
      setSaveNote(`Saved ${extracted.length} lesson${extracted.length !== 1 ? 's' : ''} to memory.`);
      if (onLessonsSaved) onLessonsSaved();
    } catch (e) {
      setSaveNote('Failed to extract lessons: ' + e.message);
    }
    setExtracting(false);
  }

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  const TAG_COLOR = {
    policy: 'text-hero border-hero/30 bg-hero/10',
    scenario: 'text-ok border-ok/25 bg-ok/10',
    'soft-skill': 'text-warn border-warn/30 bg-warn/10',
    escalation: 'text-crit border-crit/25 bg-crit/10',
    general: 'text-fg-2 border-border-0 bg-bg-2',
  };

  return (
    <div className="space-y-4">
      {/* Intro banner */}
      <div className="bg-hero/5 border border-hero/20 rounded-xl p-3 text-xs text-fg-1 flex gap-2">
        <BookOpen className="w-4 h-4 text-hero shrink-0 mt-0.5" />
        <span>
          Paste the bot's feedback and discuss it with ACE. ACE <span className="text-fg-0 font-medium">always trusts you over the bot</span> — if the bot was wrong (policy, timeframe, flow), just say so and ACE will pivot. When you're done, save the lessons to memory so future sessions don't repeat the same mistakes.
        </span>
      </div>

      {scenario && (
        <div className="text-xs text-fg-2">
          Debriefing: <span className="text-fg-1 font-medium">{scenario.title || scenario.id}</span>
          {scenario.type ? <span className="text-fg-3"> · {scenario.type}</span> : null}
        </div>
      )}

      {/* Chat window */}
      <div className="border border-border-0 rounded-2xl bg-bg-0 overflow-hidden">
        <div ref={scrollRef} className="min-h-[20rem] max-h-[32rem] overflow-y-auto px-4 py-3 space-y-3">
          {msgs.length === 0 && (
            <div className="text-xs text-fg-2 bg-bg-1 border border-border-0 rounded-xl p-3 space-y-1.5">
              <div className="font-medium text-fg-1">How to start</div>
              <div>• Paste the full bot feedback — e.g. <span className="text-fg-1 italic">"Key knowledge: BankID withdrawals require 24h cooldown. Key takeaway: agent didn't ask for UID."</span></div>
              <div>• Or ask about a specific point — e.g. <span className="text-fg-1 italic">"the bot said the timeframe is 48h but I thought it was 1-72h, who's right?"</span></div>
              <div>• ACE will help you figure out what's correct, what to fix in the scenario, and what to log as a lesson.</div>
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div className="max-w-[88%]">
                <div className={cn('text-[10px] mb-0.5 px-1', m.role === 'user' ? 'text-right text-fg-3' : 'text-hero')}>
                  {m.role === 'user' ? 'You' : 'ACE'}
                </div>
                <div className={cn('rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words',
                  m.role === 'user'
                    ? 'bg-hero text-white rounded-br-sm'
                    : m.error
                      ? 'bg-crit/10 text-crit border border-crit/20 rounded-bl-sm'
                      : 'bg-bg-1 text-fg-0 border border-border-0 rounded-bl-sm')}>
                  {m.content}
                </div>
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex justify-start">
              <div className="bg-bg-1 border border-border-0 rounded-2xl rounded-bl-sm px-3.5 py-2.5">
                <Loader2 className="w-4 h-4 animate-spin text-hero" />
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border-0 p-3 flex items-end gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKey}
            rows={1}
            placeholder="Paste bot feedback or ask ACE about it… (Enter to send)"
            className="flex-1 bg-bg-1 border border-border-0 focus:border-hero/50 rounded-xl px-3 py-2 text-sm text-fg-0 placeholder-fg-2 outline-none resize-none max-h-32 transition-colors"
          />
          {msgs.length > 0 && (
            <button onClick={() => { setMsgs([]); setSaveNote(''); }} title="Clear chat"
              className="p-2.5 rounded-xl bg-bg-2 hover:bg-bg-3 text-fg-2 border border-border-0 transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button onClick={send} disabled={busy || !input.trim()}
            className="p-2.5 rounded-xl bg-hero text-white hover:bg-hero/90 disabled:opacity-40 transition-colors">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Save lessons section */}
      {msgs.length >= 2 && (
        <div className="bg-bg-1 border border-border-0 rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-fg-1">
            <Lightbulb className="w-3.5 h-3.5 text-warn" /> Save lessons to memory
          </div>
          <p className="text-[11px] text-fg-2">ACE will extract key lessons from this conversation and save them. They'll be referenced in future debriefs to avoid repeating mistakes.</p>
          <textarea
            value={userNotes}
            onChange={e => setUserNotes(e.target.value)}
            rows={2}
            placeholder="(Optional) Add your own notes before saving — e.g. 'bot was wrong about BankID, correct policy is X'"
            className="w-full bg-bg-2 border border-border-0 focus:border-hero/50 rounded-lg px-3 py-2 text-xs text-fg-0 placeholder-fg-2 outline-none resize-y transition-colors"
          />
          {saveNote && (
            <div className={cn('flex items-start gap-2 rounded-lg p-2.5 text-xs',
              saveNote.startsWith('Failed') ? 'bg-crit/10 border border-crit/20 text-crit' : 'bg-ok/10 border border-ok/20 text-fg-1')}>
              {!saveNote.startsWith('Failed') && <Check className="w-3.5 h-3.5 text-ok shrink-0 mt-0.5" />}
              {saveNote}
            </div>
          )}
          <button onClick={handleSaveLessons} disabled={extracting}
            className="inline-flex items-center gap-2 text-xs bg-warn/15 text-warn border border-warn/30 font-medium px-3 py-1.5 rounded-lg hover:bg-warn/25 disabled:opacity-40 transition-colors">
            {extracting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lightbulb className="w-3.5 h-3.5" />}
            {extracting ? 'Extracting lessons…' : 'Extract & save lessons'}
          </button>
        </div>
      )}

      {/* Lesson memory viewer */}
      <div className="border border-border-0 rounded-xl overflow-hidden">
        <button onClick={() => setShowMemory(o => !o)}
          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-bg-1 transition-colors">
          <span className="flex items-center gap-2 text-xs font-medium text-fg-1">
            <BookOpen className="w-3.5 h-3.5 text-hero" /> Saved lessons memory
            {savedLessons.length > 0 && (
              <span className="text-[10px] bg-bg-2 text-fg-2 rounded-full px-1.5 py-0.5">{savedLessons.length}</span>
            )}
          </span>
          <ChevronDown className={cn('w-4 h-4 text-fg-2 transition-transform', showMemory && 'rotate-180')} />
        </button>
        <AnimatePresence initial={false}>
          {showMemory && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="border-t border-border-0">
              <div className="p-3 space-y-2 max-h-72 overflow-y-auto">
                {savedLessons.length === 0 ? (
                  <div className="text-xs text-fg-2 bg-bg-1 border border-border-0 rounded-xl p-3">
                    No lessons saved yet. Complete a debrief and save lessons — they'll appear here and be referenced in future sessions.
                  </div>
                ) : (
                  savedLessons.map(l => (
                    <div key={l.id} className="flex items-start gap-2 bg-bg-1 border border-border-0 rounded-xl p-2.5">
                      <Tag className="w-3.5 h-3.5 text-fg-3 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-fg-0">{l.lesson}</div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border', TAG_COLOR[l.tag] || TAG_COLOR.general)}>
                            {l.tag}
                          </span>
                          {l.scenarioTitle && <span className="text-[10px] text-fg-3 truncate">{l.scenarioTitle}</span>}
                          <span className="text-[10px] text-fg-3 ml-auto shrink-0">
                            {new Date(l.savedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <button onClick={async () => { await deleteLesson(l.id); refreshLessons(); }}
                        className="p-1 rounded-lg hover:bg-crit/10 hover:text-crit text-fg-3 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────
export default function ScenarioStudio() {
  const [step, setStep] = useState(1);
  const [transcript, setTranscript] = useState('');
  const [scenario, setScenario] = useState(null);
  const [building, setBuilding] = useState(false);
  const [err, setErr] = useState('');

  // evaluator state
  const [evTranscript, setEvTranscript] = useState('');
  const [evMode, setEvMode] = useState('agent');
  const [evResult, setEvResult] = useState(null);
  const [evaluating, setEvaluating] = useState(false);
  const [evErr, setEvErr] = useState('');

  // refine-from-bot-feedback state
  const [feedback, setFeedback] = useState('');
  const [refining, setRefining] = useState(false);
  const [refErr, setRefErr] = useState('');
  const [refNote, setRefNote] = useState('');

  // saved-scenario library state
  const [library, setLibrary] = useState([]);
  const [activeRecordId, setActiveRecordId] = useState(null);
  const [libOpen, setLibOpen] = useState(false);
  const saveTimer = useRef(null);

  const refreshLibrary = () => setLibrary(listScenarios());
  useEffect(() => { refreshLibrary(); }, []);

  // Auto-save: debounce edits to the active scenario record so renames/tweaks persist.
  useEffect(() => {
    if (!scenario || !activeRecordId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      updateScenario(activeRecordId, scenario).then(refreshLibrary);
    }, 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [scenario, activeRecordId]);

  function openSaved(rec) {
    setScenario(rec.scenario);
    setActiveRecordId(rec.recordId);
    setLibOpen(false);
    setStep(2);
  }

  async function runBuild() {
    if (!transcript.trim()) return;
    setBuilding(true); setErr(''); setScenario(null);
    try {
      const s = await buildScenario(transcript.trim());
      setScenario(s);
      // Auto-save the freshly built scenario into the library.
      const recordId = await saveScenario(s);
      setActiveRecordId(recordId);
      refreshLibrary();
      setStep(2);
    } catch (e) {
      setErr(e.message === 'NO_ALIBABA_KEY' || e.message === 'NO_API_KEY' || e.message === 'NO_OPENAI_KEY'
        ? 'No LLM key configured — set it in Settings.' : ('Build failed: ' + e.message));
    }
    setBuilding(false);
  }

  function patch(k, v) { setScenario(s => ({ ...s, [k]: v })); }
  function patchCp(i, k, v) {
    setScenario(s => {
      const cps = [...(s.checkpoints || [])];
      cps[i] = { ...cps[i], [k]: k === 'max' ? (Number(v) || 0) : v };
      return { ...s, checkpoints: cps };
    });
  }

  async function runEval() {
    if (!evTranscript.trim()) return;
    setEvaluating(true); setEvErr(''); setEvResult(null);
    try {
      const r = await evaluateTranscript({ transcript: evTranscript.trim(), scenario, mode: evMode });
      setEvResult(r);
    } catch (e) {
      setEvErr(e.message === 'NO_ALIBABA_KEY' || e.message === 'NO_API_KEY' || e.message === 'NO_OPENAI_KEY'
        ? 'No LLM key configured — set it in Settings.' : ('Evaluation failed: ' + e.message));
    }
    setEvaluating(false);
  }

  async function runRefine() {
    if (!feedback.trim() || !scenario) return;
    setRefining(true); setRefErr(''); setRefNote('');
    try {
      const { scenario: next, changes } = await refineScenario({ scenario, feedback: feedback.trim() });
      setScenario(next);
      setRefNote(changes || 'Scenario updated from bot feedback.');
      setFeedback('');
    } catch (e) {
      setRefErr(e.message === 'NO_ALIBABA_KEY' || e.message === 'NO_API_KEY' || e.message === 'NO_OPENAI_KEY'
        ? 'No LLM key configured — set it in Settings.' : ('Refine failed: ' + e.message));
    }
    setRefining(false);
  }

  const cpTotal = baseTotal(scenario?.checkpoints);
  const ready = readiness(scenario);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-fg-0 flex items-center gap-2"><Brain className="w-5 h-5 text-hero" /> Scenario Studio</h1>
          <p className="text-sm text-fg-2">Turn a real chat transcript into a spec-perfect role-play scenario — grounded in ACE's Bybit knowledge. Then grade agent or bot transcripts against the official rubric.</p>
        </div>
        <button onClick={() => setLibOpen(o => !o)}
          className={cn('shrink-0 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border transition-colors',
            libOpen ? 'bg-hero/15 text-hero border-hero/30' : 'bg-bg-1 text-fg-1 border-border-0 hover:bg-bg-2')}>
          <LibraryIcon className="w-4 h-4" /> Library
          {library.length > 0 && <span className="text-[10px] bg-bg-2 text-fg-2 rounded-full px-1.5 py-0.5">{library.length}</span>}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {libOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-5">
            <div className="bg-bg-0 border border-border-0 rounded-2xl p-3 space-y-2">
              <div className="text-xs font-semibold text-fg-1 mb-1">Saved scenarios</div>
              <Library
                items={library}
                activeId={activeRecordId}
                onOpen={openSaved}
                onRename={renameScenario}
                onDelete={async (id) => { await deleteScenario(id); if (id === activeRecordId) setActiveRecordId(null); }}
                onRefresh={refreshLibrary}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <StepRail step={step} />

      <AnimatePresence mode="wait">
        {/* STEP 1 — BUILD */}
        {step === 1 && (
          <motion.div key="s1" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-3">
            <div className="bg-hero/5 border border-hero/20 rounded-xl p-3 text-xs text-fg-1 flex gap-2">
              <Brain className="w-4 h-4 text-hero shrink-0 mt-0.5" />
              <span>I'll read this transcript, pull the matching Bybit SOPs from ACE's knowledge (articles, escalation table, error codes, regional policy), and build all 9 scenario sections so the Ideal Flow & Answer Key are SOP-correct — not guesses.</span>
            </div>
            <label className="text-xs text-fg-2 block">Paste the raw live-chat transcript</label>
            <textarea
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
              placeholder={'Chat Started: ...\n( 10s ) Visitor: ...\nGustavo: ...'}
              rows={14}
              className="w-full bg-bg-1 border border-border-0 focus:border-hero/50 rounded-xl px-4 py-3 text-[12px] font-mono text-fg-0 placeholder-fg-2 outline-none resize-y transition-colors"
            />
            {err && <div className="text-xs text-crit">{err}</div>}
            <div className="flex items-center justify-between">
              <span className="text-xs text-fg-3">{transcript.trim() ? `${transcript.length.toLocaleString()} chars` : 'Messy is fine — timestamps & bot menus are handled.'}</span>
              <button onClick={runBuild} disabled={building || !transcript.trim()}
                className="inline-flex items-center gap-2 bg-hero text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-hero/90 disabled:opacity-40 transition-colors">
                {building ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                {building ? 'Analyzing SOPs & building…' : 'Build Scenario'}
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 2 — REVIEW */}
        {step === 2 && scenario && (
          <motion.div key="s2" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Scenario Title" value={scenario.title} onChange={v => patch('title', v)} rows={1} />
              <Field label="Scenario ID" value={scenario.id} onChange={v => patch('id', v)} rows={1} />
              <SelectField label="Case Type" value={scenario.type} onChange={v => patch('type', v)} options={CASE_TYPE_OPTIONS} />
              <SelectField label="Scope" value={scenario.scope} onChange={v => patch('scope', v)} options={SCOPE_OPTIONS} />
              <Field label="Language (native)" value={scenario.language} onChange={v => patch('language', v)} rows={1} />
              <SelectField label="Initial Customer Emotion" value={scenario.emotion} onChange={v => patch('emotion', v)} options={EMOTION_OPTIONS} />
              <StarsField label="Difficulty" value={scenario.difficulty} onChange={v => patch('difficulty', v)} />
              <Field label="Language Team (leave empty = everyone)" value={scenario.languageTeam} onChange={v => patch('languageTeam', v)} rows={1} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <CheckField label="Active Status" checked={!!scenario.activeStatus} onChange={v => patch('activeStatus', v)}
                hint="The bot only picks from active scenarios in a random run." />
              <CheckField label="Test Completed" checked={!!scenario.testCompleted} onChange={v => patch('testCompleted', v)}
                hint="Openclaw won't start a session unless this is checked." />
            </div>
            {!scenario.testCompleted && (
              <div className="flex items-start gap-2 bg-warn/10 border border-warn/30 rounded-xl p-3 text-xs text-fg-1">
                <AlertTriangle className="w-4 h-4 text-warn shrink-0 mt-0.5" />
                <span><span className="font-medium text-warn">Test Completed is unchecked.</span> The bot/Openclaw will refuse to run this scenario until it's tested and this box is checked. Test it in your role-play bot first, then tick it before going live.</span>
              </div>
            )}
            {ORDER.map(k => (
              <Field key={k} label={FIELD_LABELS[k]} value={scenario[k]} onChange={v => patch(k, v)}
                rows={k === 'bot' || k === 'hidden' || k === 'flow' ? 6 : 3} />
            ))}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-fg-2">6 · Evaluation Checkpoints</label>
                <span className={cn('text-xs font-medium', cpTotal === 100 ? 'text-ok' : 'text-crit')}>Base total: {cpTotal}/100</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {Object.entries(categorySubtotals(scenario.checkpoints)).map(([cat, pts]) => {
                  const tgt = CAT_TARGET[cat];
                  const special = cat === 'Added-Value Support' || cat === 'Deductions';
                  if (special && pts === 0) return null; // hide unused special buckets
                  // Soft check: within ±10 of guide weight is "ok"; bigger gap = gentle hint.
                  const ok = special ? true : Math.abs(pts - tgt) <= 10;
                  return (
                    <span key={cat} className={cn('text-[10px] px-2 py-0.5 rounded-full border',
                      special ? 'text-hero border-hero/30 bg-hero/10' : ok ? 'text-ok border-ok/25 bg-ok/10' : 'text-warn border-warn/30 bg-warn/10')}>
                      {CAT_SHORT[cat]} {pts}{cat === 'Added-Value Support' ? ' (bonus)' : cat === 'Deductions' ? ' (deduct)' : `/${tgt}`}
                    </span>
                  );
                })}
              </div>
              <div className="space-y-2">
                {(scenario.checkpoints || []).map((c, i) => {
                  const bonus = isBonusCp(c);
                  return (
                    <div key={i} className="flex gap-2 items-start">
                      <div className="flex-1 space-y-1">
                        <select value={cpCategory(c)} onChange={e => patchCp(i, 'category', e.target.value)}
                          className={cn('w-full bg-bg-2 border border-border-0 rounded-lg px-2 py-1 text-[11px] outline-none focus:border-hero/50',
                            bonus ? 'text-hero' : 'text-fg-1')}>
                          {CP_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                        <textarea value={c.desc} onChange={e => patchCp(i, 'desc', e.target.value)} rows={2}
                          className="w-full bg-bg-1 border border-border-0 rounded-lg px-2.5 py-1.5 text-xs text-fg-0 outline-none focus:border-hero/50 resize-y" />
                      </div>
                      <div className="flex flex-col items-center gap-0.5 pt-6">
                        <input type="number" value={c.max} onChange={e => patchCp(i, 'max', e.target.value)}
                          className="w-16 bg-bg-1 border border-border-0 rounded-lg px-2 py-1.5 text-xs text-fg-0 outline-none focus:border-hero/50 text-center" />
                        {bonus && <span className="text-[10px] text-hero">bonus</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {cpTotal !== 100 && (
              <button onClick={() => patch('checkpoints', CANONICAL_CHECKPOINTS())} className="text-xs text-hero hover:underline">↺ Reset checkpoints to canonical 100 + 5 bonus</button>
            )}

            {/* Refine from bot test feedback */}
            <div className="bg-bg-1 border border-border-0 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-fg-1">
                <Sparkles className="w-3.5 h-3.5 text-hero" /> Refine from bot test feedback
              </div>
              <p className="text-[11px] text-fg-2">After the role-play bot tests this scenario, paste its feedback here and ACE will improve the scenario accordingly — keeping case facts (UID/TXID/amounts/root cause) unchanged.</p>
              <textarea value={feedback} onChange={e => setFeedback(e.target.value)} rows={4}
                placeholder={'Paste the bot\u2019s test feedback / issues found (e.g. "hidden context leaked too early", "emotion never rose", "timeframe wrong")\u2026'}
                className="w-full bg-bg-2 border border-border-0 focus:border-hero/50 rounded-lg px-3 py-2 text-xs text-fg-0 placeholder-fg-2 outline-none resize-y transition-colors" />
              {refErr && <div className="text-xs text-crit">{refErr}</div>}
              {refNote && (
                <div className="flex items-start gap-2 bg-ok/10 border border-ok/20 rounded-lg p-2.5 text-xs text-fg-1">
                  <Check className="w-3.5 h-3.5 text-ok shrink-0 mt-0.5" />
                  <span><span className="text-ok font-medium">Updated. </span>{refNote}</span>
                </div>
              )}
              <button onClick={runRefine} disabled={refining || !feedback.trim()}
                className="inline-flex items-center gap-2 text-xs bg-hero/15 text-hero border border-hero/30 font-medium px-3 py-1.5 rounded-lg hover:bg-hero/25 disabled:opacity-40 transition-colors">
                {refining ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {refining ? 'Refining…' : 'Apply feedback & refine'}
              </button>
            </div>

            {/* Readiness check before copying to Lark */}
            {(ready.errors.length > 0 || ready.warnings.length > 0) && (
              <div className={cn('rounded-xl p-3 text-xs space-y-1.5 border',
                ready.errors.length ? 'bg-crit/10 border-crit/30' : 'bg-warn/10 border-warn/30')}>
                <div className="flex items-center gap-1.5 font-medium">
                  <AlertTriangle className={cn('w-3.5 h-3.5', ready.errors.length ? 'text-crit' : 'text-warn')} />
                  <span className={ready.errors.length ? 'text-crit' : 'text-warn'}>
                    {ready.errors.length ? `${ready.errors.length} thing(s) to fix before this is Lark-ready` : 'Lark-ready — minor suggestions'}
                  </span>
                </div>
                {ready.errors.map((e, i) => <div key={`e${i}`} className="text-fg-1 pl-5">• {e}</div>)}
                {ready.warnings.map((w, i) => <div key={`w${i}`} className="text-fg-2 pl-5">○ {w}</div>)}
              </div>
            )}
            {ready.errors.length === 0 && ready.warnings.length === 0 && (
              <div className="flex items-center gap-1.5 text-xs text-ok bg-ok/10 border border-ok/20 rounded-xl p-2.5">
                <Check className="w-3.5 h-3.5" /> Spec-perfect — ready to paste into the Lark Scenario DB.
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-border-0">
              <div className="flex gap-2">
                <CopyBtn text={scenarioToLark(scenario)} label="Copy Lark-ready scenario" />
                <button onClick={() => setStep(1)} className="text-xs px-3 py-1.5 rounded-lg bg-bg-2 hover:bg-bg-3 text-fg-1 border border-border-0">← Rebuild</button>
              </div>
              <button onClick={() => { setEvTranscript(''); setEvResult(null); setStep(3); }}
                className="inline-flex items-center gap-2 bg-hero text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-hero/90 transition-colors">
                <ClipboardCheck className="w-4 h-4" /> Go to Evaluator →
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 3 — EVALUATE */}
        {step === 3 && (
          <motion.div key="s3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-3">
            <div className="bg-bg-1 border border-border-0 rounded-xl p-3 text-xs text-fg-2">
              Paste the bot↔agent transcript from your in-house role-play. The evaluator grades it against {scenario ? <span className="text-fg-1 font-medium">{scenario.title || scenario.id}</span> : 'the general SOP'} and ACE's knowledge.
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-fg-2">Mode</label>
              <select value={evMode} onChange={e => setEvMode(e.target.value)}
                className="bg-bg-1 border border-border-0 rounded-lg px-3 py-1.5 text-xs text-fg-0 outline-none focus:border-hero/50">
                <option value="agent">Grade the Agent</option>
                <option value="bot">QA the Bot (customer fidelity)</option>
                <option value="both">Both</option>
              </select>
            </div>
            <textarea
              value={evTranscript}
              onChange={e => setEvTranscript(e.target.value)}
              placeholder={'Customer: ...\nAgent: ...\nCustomer: ...'}
              rows={10}
              className="w-full bg-bg-1 border border-border-0 focus:border-hero/50 rounded-xl px-4 py-3 text-[12px] font-mono text-fg-0 placeholder-fg-2 outline-none resize-y transition-colors"
            />
            {evErr && <div className="text-xs text-crit">{evErr}</div>}
            <div className="flex items-center justify-between">
              <button onClick={() => setStep(scenario ? 2 : 1)} className="text-xs px-3 py-1.5 rounded-lg bg-bg-2 hover:bg-bg-3 text-fg-1 border border-border-0">← Back</button>
              <button onClick={runEval} disabled={evaluating || !evTranscript.trim()}
                className="inline-flex items-center gap-2 bg-hero text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-hero/90 disabled:opacity-40 transition-colors">
                {evaluating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
                {evaluating ? 'Grading…' : 'Evaluate'}
              </button>
            </div>

            {evResult && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-bg-0 border border-border-0 rounded-2xl p-4 mt-2 space-y-5">
                {(evResult._mode === 'agent' || evResult._mode === 'both') && evResult.checkpoints && (
                  <div><div className="text-xs font-semibold text-fg-1 mb-2 uppercase tracking-wide">Agent Scorecard</div><AgentScore result={evResult} /></div>
                )}
                {(evResult._mode === 'bot' || evResult._mode === 'both') && evResult.bot_qa && (
                  <div className="pt-1 border-t border-border-0"><div className="text-xs font-semibold text-fg-1 mb-2 uppercase tracking-wide">Bot QA — Customer Fidelity</div><BotQA qa={evResult.bot_qa} /></div>
                )}
                {(evResult._mode === 'agent' || evResult._mode === 'both') && evResult.checkpoints && (
                  <div className="pt-3 border-t border-border-0">
                    <CopyBtn text={buildLarkFeedback(evResult, scenario)} label="Copy Lark feedback report" />
                  </div>
                )}
              </motion.div>
            )}

            <CoPilot scenario={scenario} transcript={evTranscript} evalResult={evResult} />

            <div className="flex justify-end pt-2">
              <button onClick={() => setStep(4)}
                className="inline-flex items-center gap-2 bg-ok/15 text-ok border border-ok/30 text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-ok/25 transition-colors">
                <MessagesSquare className="w-4 h-4" /> Practice with ACE →
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 4 — PRACTICE */}
        {step === 4 && (
          <motion.div key="s4" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-3">
            <PracticeChat scenario={scenario} />
            <div className="flex justify-between pt-2 border-t border-border-0">
              <button onClick={() => setStep(3)} className="text-xs px-3 py-1.5 rounded-lg bg-bg-2 hover:bg-bg-3 text-fg-1 border border-border-0">← Back to Evaluator</button>
              <button onClick={() => setStep(5)}
                className="inline-flex items-center gap-2 bg-hero/15 text-hero border border-hero/30 text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-hero/25 transition-colors">
                <BookOpen className="w-4 h-4" /> Debrief with ACE →
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 5 — DEBRIEF */}
        {step === 5 && (
          <motion.div key="s5" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-3">
            <DebriefChat scenario={scenario} onLessonsSaved={() => {}} />
            <div className="flex justify-between pt-2 border-t border-border-0">
              <button onClick={() => setStep(4)} className="text-xs px-3 py-1.5 rounded-lg bg-bg-2 hover:bg-bg-3 text-fg-1 border border-border-0">← Back to Practice</button>
              <button onClick={() => setStep(scenario ? 2 : 1)} className="text-xs px-3 py-1.5 rounded-lg bg-bg-2 hover:bg-bg-3 text-fg-1 border border-border-0">Edit scenario →</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
