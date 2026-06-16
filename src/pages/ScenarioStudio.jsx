import { useState } from 'react';
import { Loader2, Copy, Check, Wand2, ClipboardCheck, FileText, Brain, AlertTriangle, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  buildScenario, evaluateTranscript, refineScenario, CANONICAL_CHECKPOINTS,
} from '@/lib/scenarioStudio';

// ── official enums (from the CS Training — Role-play Scenario Creation Guide) ──
const SCOPE_OPTIONS = ['Non-tech', 'Tech', 'MT5'];
const CASE_TYPE_OPTIONS = ['MT5', 'Bybit Card', 'Deposit & Withdrawal', 'Account Matters', 'Spot Trading', 'C&B', 'Others'];
const EMOTION_OPTIONS = ['Low (Calm)', 'Medium (Dissatisfied)', 'High (Angry)'];
const CP_CATEGORIES = ['Probing Questions', 'Accuracy and Product Knowledge', 'Process Handling and Escalation', 'Soft Skills and Empathy', 'Added-Value Support'];

function cpCategory(c) {
  if (c.category) return c.category;
  const d = (c.desc || '').toLowerCase();
  if (/added.?value|bonus/.test(d) || c.bonus) return 'Added-Value Support';
  if (/probing|ask|question/.test(d)) return 'Probing Questions';
  if (/accuracy|product|sop|root cause|policy/.test(d)) return 'Accuracy and Product Knowledge';
  if (/process|escalat|timeframe|document/.test(d)) return 'Process Handling and Escalation';
  if (/soft|empath|tone|frustrat/.test(d)) return 'Soft Skills and Empathy';
  return 'Accuracy and Product Knowledge';
}

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

function baseTotal(cps) {
  return (cps || []).filter(c => !(c.bonus || /added.?value|bonus/i.test(c.desc || '')))
    .reduce((t, c) => t + (Number(c.max) || 0), 0);
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
    const bonus = c.bonus || /added.?value|bonus/i.test(c.desc || '');
    L.push(`[${cpCategory(c)}] ${c.desc}  → ${c.max}${bonus ? ' BONUS' : ''} pts`);
  });
  L.push(`Base total: ${baseTotal(s.checkpoints)}/100 (+5 Added-Value bonus, excluded from base)`);
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

  async function runBuild() {
    if (!transcript.trim()) return;
    setBuilding(true); setErr(''); setScenario(null);
    try {
      const s = await buildScenario(transcript.trim());
      setScenario(s);
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

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-fg-0 flex items-center gap-2"><Brain className="w-5 h-5 text-hero" /> Scenario Studio</h1>
        <p className="text-sm text-fg-2">Turn a real chat transcript into a spec-perfect role-play scenario — grounded in ACE's Bybit knowledge. Then grade agent or bot transcripts against the official rubric.</p>
      </div>

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
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-fg-2">6 · Evaluation Checkpoints</label>
                <span className={cn('text-xs font-medium', cpTotal === 100 ? 'text-ok' : 'text-crit')}>Base total: {cpTotal}/100</span>
              </div>
              <div className="space-y-2">
                {(scenario.checkpoints || []).map((c, i) => {
                  const bonus = c.bonus || /added.?value|bonus/i.test(c.desc || '');
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
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
