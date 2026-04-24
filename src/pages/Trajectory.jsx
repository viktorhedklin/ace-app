import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target, Sparkles, Loader2, CheckCircle2, Circle, ArrowRight, ArrowLeft,
  RefreshCw, Send, Flame, AlertTriangle, TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { hasAnyApiKey, InvokeChatWithHistory } from '@/api/claude';
import {
  loadTrajectory, saveTrajectory, clearTrajectory, isOnboarded,
  generatePlan, buildCoachContext, getRecurringQAIssues,
} from '@/lib/trajectory';

/* ═══════════════════════════════════════════════════════════════
   ONBOARDING WIZARD
   ═══════════════════════════════════════════════════════════════ */

const QUESTIONS = [
  {
    id: 'goal',
    title: 'What are you aiming for?',
    hint: 'Your north star. Be specific — "SME promotion" beats "grow".',
    placeholder: 'e.g. Promote to SME · 90+ QA consistently · Lead EU escalations',
    type: 'text',
    required: true,
  },
  {
    id: 'horizon',
    title: 'Over what time horizon?',
    hint: "Pick what feels honest — you can change this later.",
    type: 'choice',
    options: [
      { value: '1 month',  label: '1 month',  desc: 'Short sprint' },
      { value: '3 months', label: '3 months', desc: 'Quarter arc' },
      { value: '6 months', label: '6 months', desc: 'Half-year push' },
      { value: '12 months', label: '12 months', desc: 'Full year' },
    ],
    required: true,
  },
  {
    id: 'skillGap',
    title: "What's your biggest skill gap right now?",
    hint: 'The one thing you know you need to level up on.',
    placeholder: 'e.g. Crypto on-chain tracing · P2P dispute judgment · SEPA compliance',
    type: 'text',
    required: false,
  },
  {
    id: 'experience',
    title: 'Prior experience?',
    hint: 'Support, crypto, anything relevant. Optional.',
    placeholder: 'e.g. 2 years Binance chat · self-taught crypto since 2019',
    type: 'text',
    required: false,
  },
  {
    id: 'successMetric',
    title: 'How will you know you hit it?',
    hint: 'One concrete, measurable signal.',
    placeholder: 'e.g. SME interview scheduled · 3 consecutive weeks above 90 QA',
    type: 'text',
    required: false,
  },
];

function OnboardingWizard({ onComplete }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const q = QUESTIONS[step];
  const isLast = step === QUESTIONS.length - 1;
  const canAdvance = !q.required || (answers[q.id] && answers[q.id].trim());

  function next() {
    if (!canAdvance) return;
    if (isLast) {
      finish();
    } else {
      setStep(s => s + 1);
    }
  }

  async function finish() {
    setGenerating(true);
    setError('');
    try {
      const plan = await generatePlan({
        goal: answers.goal,
        horizon: answers.horizon,
        skillGap: answers.skillGap,
        experience: answers.experience,
        successMetric: answers.successMetric,
      });
      const trajectory = {
        onboarded: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ...answers,
        plan,
      };
      saveTrajectory(trajectory);
      onComplete(trajectory);
    } catch (err) {
      setError(err.message || 'Could not generate plan. Check your API key or try again.');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 lg:py-16">
      {/* Progress */}
      <div className="flex items-center gap-1.5 mb-8">
        {QUESTIONS.map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-1 rounded-full flex-1 transition-colors duration-220',
              i < step ? 'bg-hero' : i === step ? 'bg-hero/60' : 'bg-bg-2'
            )}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
          transition={{ duration: 0.26, ease: [0.2, 0, 0.2, 1] }}
        >
          <p className="type-kpi-label text-fg-2 mb-3">Step {step + 1} of {QUESTIONS.length}</p>
          <h1 className="type-display text-fg-0 mb-2">{q.title}</h1>
          <p className="type-body text-fg-1 mb-8">{q.hint}</p>

          {q.type === 'text' && (
            <input
              type="text"
              autoFocus
              value={answers[q.id] || ''}
              onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && canAdvance && next()}
              placeholder={q.placeholder}
              className="w-full bg-bg-1 border border-border-0 focus:border-hero/50 rounded-xl px-5 py-4 text-lg text-fg-0 placeholder-fg-3 outline-none transition-colors font-display"
            />
          )}

          {q.type === 'choice' && (
            <div className="grid grid-cols-2 gap-3">
              {q.options.map(opt => {
                const active = answers[q.id] === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setAnswers(a => ({ ...a, [q.id]: opt.value }))}
                    className={cn(
                      'text-left p-4 rounded-xl border transition-all duration-220 cursor-pointer',
                      active
                        ? 'bg-hero/10 border-border-hero shadow-glow-1'
                        : 'bg-bg-1 border-border-0 hover:border-border-1'
                    )}
                  >
                    <p className="font-display font-semibold text-fg-0 text-lg">{opt.label}</p>
                    <p className="type-caption text-fg-2 mt-1">{opt.desc}</p>
                  </button>
                );
              })}
            </div>
          )}

          {error && (
            <p className="type-caption text-crit mt-4 flex items-center gap-1.5">
              <AlertTriangle size={11} /> {error}
            </p>
          )}

          <div className="flex items-center gap-3 mt-8">
            {step > 0 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="flex items-center gap-1.5 type-caption text-fg-1 hover:text-fg-0 transition-colors duration-220 cursor-pointer"
              >
                <ArrowLeft size={13} /> Back
              </button>
            )}
            <button
              onClick={next}
              disabled={!canAdvance || generating}
              className="cta-primary ml-auto disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? (
                <><Loader2 size={14} className="animate-spin" /> Ace is building your plan…</>
              ) : isLast ? (
                <>Generate my plan <ArrowRight size={14} /></>
              ) : (
                <>Next <ArrowRight size={14} /></>
              )}
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   COACH VIEW
   ═══════════════════════════════════════════════════════════════ */

function CoachView({ trajectory, onReset, onRegenerate, regenerating }) {
  const [doneMilestones, setDoneMilestones] = useState(() => trajectory.doneMilestones || []);
  const recurringIssues = useMemo(() => getRecurringQAIssues(), []);

  useEffect(() => {
    saveTrajectory({ ...trajectory, doneMilestones });
  }, [doneMilestones]);

  function toggleMilestone(idx) {
    setDoneMilestones(d => d.includes(idx) ? d.filter(i => i !== idx) : [...d, idx]);
  }

  const plan = trajectory.plan || {};
  const milestones = plan.milestones || [];
  const completion = milestones.length ? Math.round((doneMilestones.length / milestones.length) * 100) : 0;

  return (
    <div className="px-6 py-8 lg:px-10 lg:py-10 max-w-5xl mx-auto space-y-6">
      {/* ── HEADER ────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div>
          <h1 className="type-h1 text-fg-0 flex items-center gap-2">
            <Target size={20} className="text-hero" />
            Trajectory
          </h1>
          <p className="type-body-sm text-fg-2 mt-1">Your coach, your arc, your metrics.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRegenerate}
            disabled={regenerating}
            className="flex items-center gap-1.5 type-caption text-fg-1 hover:text-hero bg-bg-1 border border-border-0 hover:border-border-hero rounded-lg px-3 py-2 transition-colors duration-220 cursor-pointer disabled:opacity-50"
          >
            {regenerating ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {regenerating ? 'Regenerating…' : 'Refresh plan'}
          </button>
          <button
            onClick={() => window.confirm('Reset your entire trajectory? This clears your goal and plan.') && onReset()}
            className="type-caption text-fg-3 hover:text-crit transition-colors duration-220 cursor-pointer"
          >
            Reset
          </button>
        </div>
      </div>

      {/* ── GOAL CARD ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.2, 0, 0.2, 1] }}
        className="panel"
      >
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div className="flex-1 min-w-0">
            <p className="type-kpi-label text-fg-2 mb-2">GOAL · {trajectory.horizon}</p>
            <h2 className="font-display font-bold text-2xl text-fg-0 leading-tight">{trajectory.goal}</h2>
            {trajectory.successMetric && (
              <p className="type-body-sm text-fg-1 mt-2">
                <span className="text-fg-2">Win condition: </span>{trajectory.successMetric}
              </p>
            )}
          </div>
          {completion > 0 && (
            <div className="bg-bg-2 border border-border-0 rounded-xl px-4 py-3 text-center">
              <p className="font-display font-bold text-2xl text-hero tabular-nums">{completion}%</p>
              <p className="type-kpi-label text-fg-2 mt-0.5">PROGRESS</p>
            </div>
          )}
        </div>
        {plan.summary && (
          <p className="type-body text-fg-1 leading-relaxed border-t border-border-0 pt-4">{plan.summary}</p>
        )}
      </motion.div>

      {/* ── THIS WEEK'S FOCUS — Tier 2 ───────────────────────────── */}
      {plan.thisWeekFocus && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.08, ease: [0.2, 0, 0.2, 1] }}
          className="relative overflow-hidden rounded-2xl p-5"
          style={{
            background: 'linear-gradient(135deg, var(--hero-deep) 0%, var(--hero-soft) 50%, var(--hero) 180%)',
            boxShadow: 'var(--glow-2)',
          }}
        >
          <div className="relative z-10">
            <p className="type-kpi-label text-[#021418]/70 mb-1">THIS WEEK · FOCUS</p>
            <h3 className="font-display font-bold text-2xl text-[#021418] leading-tight">{plan.thisWeekFocus.title}</h3>
            <p className="type-body-sm text-[#021418]/80 mt-2 leading-relaxed">{plan.thisWeekFocus.why}</p>
            <div className="mt-4 bg-[#021418]/20 backdrop-blur-sm rounded-lg px-4 py-3 flex items-start gap-2">
              <Sparkles size={14} className="text-[#021418] shrink-0 mt-0.5" />
              <p className="type-body-sm text-[#021418] font-medium">{plan.thisWeekFocus.action}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── PATTERN DETECTED (from QA memory) ────────────────────── */}
      {recurringIssues.length >= 1 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.12, ease: [0.2, 0, 0.2, 1] }}
          className="bg-warn/10 border border-warn/25 rounded-2xl p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} className="text-warn" />
            <h3 className="type-h3 text-warn">Pattern detected</h3>
          </div>
          <p className="type-body-sm text-fg-1 mb-3">QA reviewers have flagged these issues repeatedly. Direct opportunity to level up.</p>
          <ul className="space-y-1.5">
            {recurringIssues.map((item, i) => (
              <li key={i} className="flex items-center gap-2 type-caption text-fg-1">
                <span className="w-1 h-1 rounded-full bg-warn shrink-0" />
                <span className="flex-1">{item.issue}</span>
                <span className="type-badge text-warn bg-warn/15 px-1.5 py-0.5 rounded">×{item.count}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      {/* ── MILESTONES ────────────────────────────────────────────── */}
      {milestones.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.16, ease: [0.2, 0, 0.2, 1] }}
          className="panel"
        >
          <h3 className="type-h3 text-fg-0 mb-4 flex items-center gap-2">
            <Flame size={14} className="text-hero" />
            Milestones
          </h3>
          <div className="space-y-2">
            {milestones.map((m, i) => {
              const done = doneMilestones.includes(i);
              return (
                <button
                  key={i}
                  onClick={() => toggleMilestone(i)}
                  className={cn(
                    'w-full text-left flex items-start gap-3 p-3 rounded-lg transition-colors duration-220 cursor-pointer',
                    done ? 'bg-ok/5 border border-ok/20' : 'bg-bg-2 border border-border-0 hover:border-border-1'
                  )}
                >
                  {done ? (
                    <CheckCircle2 size={16} className="text-ok shrink-0 mt-0.5" />
                  ) : (
                    <Circle size={16} className="text-fg-3 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={cn('font-display font-semibold text-fg-0', done && 'line-through text-fg-2')}>{m.title}</p>
                    <p className="type-caption text-fg-2 mt-0.5">{m.target}</p>
                  </div>
                  <span className="type-badge text-hero bg-hero/10 border border-border-hero px-2 py-0.5 rounded shrink-0">{m.eta}</span>
                </button>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ── SKILL GAPS + RECOMMENDED FOCUS ──────────────────────── */}
      {(plan.skillGaps?.length || plan.recommendedFocus?.length) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {plan.skillGaps?.length > 0 && (
            <div className="panel">
              <h4 className="type-h3 text-fg-0 mb-3">Skill gaps to close</h4>
              <ul className="space-y-1.5">
                {plan.skillGaps.map((s, i) => (
                  <li key={i} className="flex gap-2 type-body-sm text-fg-1">
                    <span className="text-hero/60 shrink-0">→</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {plan.recommendedFocus?.length > 0 && (
            <div className="panel">
              <h4 className="type-h3 text-fg-0 mb-3">Brush up on</h4>
              <ul className="space-y-1.5">
                {plan.recommendedFocus.map((s, i) => (
                  <li key={i} className="flex gap-2 type-body-sm text-fg-1">
                    <span className="text-hero/60 shrink-0">•</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── COACH CHAT ─────────────────────────────────────────── */}
      <CoachChat trajectoryGoal={trajectory.goal} />
    </div>
  );
}

/* ─── Coach Chat (rich-context) ───────────────────────────────── */

const COACH_SYSTEM_BASE = `You are Ace, the agent's personal support coach — not a lookup tool, not a workflow helper. Act like a senior mentor who's been in the trenches.

Voice: direct, concrete, warm-but-honest. Short sentences. Use "you" and "we". Never corporate.

Always ground your answer in the context block below — reference specific numbers, milestones, or QA issues when relevant. Don't invent data.

When asked "what should I focus on?":
- Look at this week's focus, recent QA issues, CSAT trend
- Pick ONE specific thing, not three
- Give a concrete action they can take on their next shift

When asked for feedback on a case or message:
- Score it 1–10 against the milestone metrics
- Name one thing that works, one thing to tighten
- If it relates to a recurring QA issue, call that link out

Keep replies under 180 words unless they ask for depth.`;

function CoachChat({ trajectoryGoal }) {
  const [open, setOpen] = useState(true);
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  if (!hasAnyApiKey()) {
    return (
      <div className="bg-bg-1 border border-border-0 rounded-2xl p-5 text-center">
        <Sparkles size={18} className="text-fg-2 mx-auto mb-2" />
        <p className="type-body-sm text-fg-2">Coach chat is locked. Add an API key in Settings to chat with your Ace coach.</p>
      </div>
    );
  }

  async function send(text) {
    const q = (text || input).trim();
    if (!q || loading) return;
    setInput('');
    const newMsgs = [...msgs, { role: 'user', content: q }];
    setMsgs(newMsgs);
    setLoading(true);
    try {
      const coachContext = buildCoachContext();
      const sys = `${COACH_SYSTEM_BASE}\n\n${coachContext}`;
      const result = await InvokeChatWithHistory({ messages: newMsgs, system_prompt: sys });
      setMsgs(prev => [...prev, { role: 'assistant', content: result }]);
    } catch (err) {
      setMsgs(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    }
    setLoading(false);
  }

  const starters = useMemo(() => ([
    `What should I focus on this week?`,
    `Am I on track for "${trajectoryGoal.slice(0, 40)}${trajectoryGoal.length > 40 ? '…' : ''}"?`,
    'Score my last QA performance',
    'What is my biggest blind spot right now?',
  ]), [trajectoryGoal]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2, ease: [0.2, 0, 0.2, 1] }}
      className="bg-bg-1 border border-border-hero rounded-2xl overflow-hidden shadow-glow-1"
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border-0">
        <span className="w-2 h-2 rounded-full bg-hero" style={{ boxShadow: '0 0 8px var(--hero)' }} />
        <h3 className="type-h3 text-hero flex-1">Coach · Ask Ace</h3>
      </div>

      <div className="max-h-80 overflow-y-auto p-4 space-y-3">
        {msgs.length === 0 && (
          <div>
            <p className="type-caption text-fg-2 mb-2">Jump in with:</p>
            <div className="flex flex-wrap gap-2">
              {starters.map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="type-caption bg-bg-2 border border-border-0 hover:border-border-hero text-fg-1 hover:text-hero px-3 py-1.5 rounded-lg transition-colors duration-220 cursor-pointer"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div
            key={i}
            className={cn(
              'rounded-xl px-4 py-2.5 max-w-[85%] whitespace-pre-wrap type-body-sm leading-relaxed',
              m.role === 'user'
                ? 'bg-hero/10 text-fg-0 ml-auto border border-border-hero'
                : 'bg-bg-2 text-fg-1 border border-border-0'
            )}
          >
            {m.content}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 type-caption text-fg-2">
            <Loader2 size={12} className="animate-spin" /> Ace is thinking…
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-border-0 px-3 py-3 flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Ask your coach anything…"
          className="flex-1 bg-bg-2 border border-border-0 focus:border-hero/50 rounded-lg px-3 py-2 type-body-sm text-fg-0 placeholder-fg-3 outline-none transition-colors"
        />
        <button
          onClick={() => send()}
          disabled={loading || !input.trim()}
          className="bg-hero hover:bg-hero/90 disabled:opacity-40 text-[#021418] rounded-lg px-3 transition-colors cursor-pointer"
          aria-label="Send"
        >
          <Send size={14} />
        </button>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE WRAPPER
   ═══════════════════════════════════════════════════════════════ */

export default function Trajectory() {
  const [trajectory, setTrajectory] = useState(() => loadTrajectory());
  const [regenerating, setRegenerating] = useState(false);
  const [regenError, setRegenError] = useState('');

  async function regenerate() {
    if (!trajectory) return;
    setRegenerating(true);
    setRegenError('');
    try {
      const plan = await generatePlan({
        goal: trajectory.goal,
        horizon: trajectory.horizon,
        skillGap: trajectory.skillGap,
        experience: trajectory.experience,
        successMetric: trajectory.successMetric,
      });
      const updated = { ...trajectory, plan, updatedAt: Date.now() };
      saveTrajectory(updated);
      setTrajectory(updated);
    } catch (err) {
      setRegenError(err.message || 'Could not regenerate plan.');
    } finally {
      setRegenerating(false);
    }
  }

  function reset() {
    clearTrajectory();
    setTrajectory(null);
  }

  if (!trajectory || !isOnboarded()) {
    if (!hasAnyApiKey()) {
      return (
        <div className="px-6 py-12 max-w-xl mx-auto text-center space-y-4">
          <Target size={32} className="text-fg-2 mx-auto" />
          <h1 className="type-h1 text-fg-0">Trajectory</h1>
          <p className="type-body text-fg-1">
            Your personal support coach — tracks your goals, reviews your QA, and pushes you toward the next level.
            Needs an API key to generate your plan.
          </p>
          <p className="type-caption text-fg-3">Add an API key in Settings, then come back here to start.</p>
        </div>
      );
    }
    return <OnboardingWizard onComplete={setTrajectory} />;
  }

  return (
    <>
      {regenError && (
        <p className="max-w-5xl mx-auto px-6 pt-4 type-caption text-crit flex items-center gap-1.5">
          <AlertTriangle size={11} /> {regenError}
        </p>
      )}
      <CoachView
        trajectory={trajectory}
        onReset={reset}
        onRegenerate={regenerate}
        regenerating={regenerating}
      />
    </>
  );
}
