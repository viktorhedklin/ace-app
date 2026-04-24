import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { InvokeLLM, getApiKey, hasAnyApiKey } from '@/api/claude';
import { BYBIT_KB } from '@/data/bybitKB';
import {
  CheckCircle2, Circle, ChevronDown, ChevronUp, Calendar, Users,
  AlertTriangle, Mic, Target, Building2, Package, HelpCircle, Timer,
  Play, Pause, RotateCcw, Sparkles, Loader2, Shuffle, BookOpen,
  TrendingUp, MessageSquare, FileText,
} from 'lucide-react';

// ─── Constants ───────────────────────────────────────────────────────────────
const DEADLINE = new Date('2026-04-18T00:00:00');
const STORAGE_KEY = 'ace_probation_prep';

function daysUntil(date) {
  const diff = date - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

// ─── KB topic mapping — auto-fill product walkthroughs with real KB data ────
const KB_TOPIC_MAP = {
  kyc: ['kyc-faq', 'kyc-how-to', 'kyc-failures', 'edd', 'eu-kyc-sop'],
  p2p: ['p2p-appeal', 'p2p-scam', 'p2p-payment-methods-global', 'p2p-order-timeout-global', 'eu-p2p-rules'],
  fiat: ['fiat-error', 'fiat-deposit-faq', 'eu-sepa-guide', 'eu-card-guide', 'eu-fiat-deposit-methods'],
  bybit_card: ['eu-card-guide', 'fiat-error'],
  deposit_withdrawal: ['withdrawal-failures', 'missing-deposit', 'deposit-networks-global', 'withdrawal-limits-global', 'eu-withdrawal-limits'],
  bybit_pay: [],
  spot_x: [],
  promotions: [],
};

function getKBForTopic(topicId) {
  const ids = KB_TOPIC_MAP[topicId] || [];
  return BYBIT_KB.filter(a => ids.includes(a.id));
}

// ─── Daily Focus Logic ───────────────────────────────────────────────────────
function getDailyFocus(daysLeft) {
  if (daysLeft >= 9) return { label: 'Plan', detail: 'Lock your date, confirm attendees, pick your 2 product topics.', color: 'text-ok' };
  if (daysLeft >= 7) return { label: 'Build', detail: 'Build your slides. Start with Self Intro — use real numbers. Screenshot your badge.', color: 'text-info' };
  if (daysLeft >= 5) return { label: 'Build', detail: 'Finish product walkthrough slides. Fill in Department section. Use "Coach Me" to get AI feedback.', color: 'text-info' };
  if (daysLeft >= 3) return { label: 'Polish', detail: 'Complete draft. Do a timed rehearsal. Run Q&A drill. Tweak based on coaching feedback.', color: 'text-hero' };
  if (daysLeft >= 1) return { label: 'Deliver', detail: 'Final rehearsal today. You know this. Stay calm, be specific, use real examples. You got this.', color: 'text-warn' };
  return { label: 'OVERDUE', detail: 'Presentation deadline passed. Schedule immediately to avoid extension.', color: 'text-crit' };
}

// ─── Readiness Score ─────────────────────────────────────────────────────────
function calcReadiness(state) {
  const checked = state.checked || {};
  const notes = state.notes || {};
  const topics = state.selectedTopics || [];

  let score = 0;
  let max = 0;

  // Checklist (25%)
  const checkItems = PRE_CHECKLIST.length;
  const checkDone = PRE_CHECKLIST.filter(c => checked[c.id]).length;
  score += (checkDone / checkItems) * 25;
  max += 25;

  // Self intro notes filled (25%)
  const selfFilled = SELF_INTRO_POINTS.filter((_, i) => (notes[`self_${i}`] || '').trim().length > 10).length;
  score += (selfFilled / SELF_INTRO_POINTS.length) * 25;
  max += 25;

  // Department notes filled (10%)
  const deptFilled = DEPT_INTRO_POINTS.filter((_, i) => (notes[`dept_${i}`] || '').trim().length > 10).length;
  score += (deptFilled / DEPT_INTRO_POINTS.length) * 10;
  max += 10;

  // Topics selected + notes (25%)
  const topicScore = topics.length * 5;
  const topicNotes = topics.filter(t => (notes[`product_${t}`] || '').trim().length > 20).length;
  score += topicScore + (topicNotes * 7.5);
  max += 25;

  // Q&A prep (15%)
  const qaFilled = QA_QUESTIONS.filter((_, i) => (notes[`qa_${i}`] || '').trim().length > 10).length;
  score += (qaFilled / QA_QUESTIONS.length) * 15;
  max += 15;

  return Math.min(100, Math.round((score / max) * 100));
}

function readinessLabel(score) {
  if (score >= 90) return { text: 'Ready to present', color: 'text-ok', bg: 'bg-ok' };
  if (score >= 70) return { text: 'Almost there', color: 'text-hero', bg: 'bg-hero' };
  if (score >= 40) return { text: 'In progress', color: 'text-warn', bg: 'bg-orange-400' };
  return { text: 'Just getting started', color: 'text-crit', bg: 'bg-crit' };
}

// ─── AI Coach ────────────────────────────────────────────────────────────────
function useAICoach() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const ask = useCallback(async (prompt) => {
    if (!hasAnyApiKey()) { setError('Set your API key in Settings to use AI coaching.'); return; }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await InvokeLLM({
        prompt,
        system_prompt: `You are a presentation coach helping a Bybit customer support agent prepare their 3-month probation review presentation. Be specific, actionable, and encouraging. Keep feedback under 200 words. Use bullet points. Focus on what's strong and what needs improvement. Don't use emojis.`,
      });
      setResult(response);
    } catch (e) {
      setError(e.message === 'NO_API_KEY' ? 'Set your API key in Settings first.' : e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => { setResult(null); setError(null); }, []);

  return { loading, result, error, ask, clear };
}

// AI feedback display component
function AIFeedback({ loading, result, error }) {
  if (!loading && !result && !error) return null;
  return (
    <div className="mt-3 rounded-lg border border-hero/20 bg-hero/5 px-4 py-3">
      {loading && (
        <div className="flex items-center gap-2 text-xs text-hero">
          <Loader2 size={13} className="animate-spin" /> Ace is reviewing...
        </div>
      )}
      {error && <p className="text-xs text-crit">{error}</p>}
      {result && (
        <div className="text-xs text-fg-1 whitespace-pre-wrap leading-relaxed">{result}</div>
      )}
    </div>
  );
}

// ─── Rehearsal Timer ─────────────────────────────────────────────────────────
function RehearsalTimer() {
  const TOTAL = 30 * 60;
  const [seconds, setSeconds] = useState(TOTAL);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running || seconds <= 0) return;
    const id = setInterval(() => setSeconds(s => s - 1), 1000);
    return () => clearInterval(id);
  }, [running, seconds]);

  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  const pct = ((TOTAL - seconds) / TOTAL) * 100;
  const elapsed = TOTAL - seconds;
  const zone = elapsed < 10 * 60 ? 'text-ok' : elapsed < 15 * 60 ? 'text-info' : elapsed < 25 * 60 ? 'text-hero' : 'text-crit';
  const barColor = elapsed < 10 * 60 ? 'bg-ok' : elapsed < 15 * 60 ? 'bg-info' : elapsed < 25 * 60 ? 'bg-hero' : 'bg-crit';

  // Section markers
  const markers = [
    { at: 0, label: 'Start', color: 'text-fg-2' },
    { at: 33, label: 'Self Intro done (10m)', color: 'text-info/40' },
    { at: 50, label: 'Dept done (15m)', color: 'text-purple-400/40' },
    { at: 100, label: 'Product done (30m)', color: 'text-warn/40' },
  ];

  return (
    <div className="bg-bg-1/50 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-fg-1">Presentation Timer</span>
        <span className={cn('text-3xl font-mono font-bold tabular-nums', zone)}>
          {String(min).padStart(2, '0')}:{String(sec).padStart(2, '0')}
        </span>
      </div>
      <div className="relative">
        <div className="h-2.5 bg-bg-2 rounded-full overflow-hidden">
          <div className={cn('h-full rounded-full transition-all duration-1000', barColor)} style={{ width: `${pct}%` }} />
        </div>
        {/* Section markers on the bar */}
        <div className="absolute inset-0 flex justify-between pointer-events-none px-0.5">
          {markers.map((m, i) => (
            <div key={i} className="relative" style={{ left: `${m.at}%` }}>
              <div className={cn('text-[9px] mt-3 whitespace-nowrap', m.color)}>{m.label}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="h-4" />
      <div className="flex gap-2">
        <button
          onClick={() => setRunning(!running)}
          className={cn(
            'flex items-center gap-1.5 text-xs px-4 py-2.5 rounded-lg border font-medium transition-colors duration-150 cursor-pointer',
            running
              ? 'bg-crit/15 border-crit/30 text-crit hover:bg-crit/25'
              : 'bg-ok/15 border-ok/30 text-ok hover:bg-ok/25'
          )}
          aria-label={running ? 'Pause timer' : 'Start timer'}
        >
          {running ? <Pause size={13} /> : <Play size={13} />}
          {running ? 'Pause' : 'Start'}
        </button>
        <button
          onClick={() => { setRunning(false); setSeconds(TOTAL); }}
          className="flex items-center gap-1.5 text-xs px-3 py-2.5 rounded-lg border border-border-0 text-fg-1 hover:text-fg-0 hover:bg-bg-2 transition-colors duration-150 cursor-pointer"
          aria-label="Reset timer"
        >
          <RotateCcw size={12} /> Reset
        </button>
      </div>
    </div>
  );
}

// ─── Q&A Drill Mode ──────────────────────────────────────────────────────────
function QADrill() {
  const [currentQ, setCurrentQ] = useState(null);
  const [answer, setAnswer] = useState('');
  const coach = useAICoach();

  function pickRandom() {
    const idx = Math.floor(Math.random() * QA_QUESTIONS.length);
    setCurrentQ(QA_QUESTIONS[idx]);
    setAnswer('');
    coach.clear();
  }

  function evaluate() {
    if (!answer.trim() || !currentQ) return;
    coach.ask(
      `You are evaluating a Bybit support agent's answer during their 3-month service review Q&A session.\n\nQuestion: "${currentQ.q}"\n\nTheir answer: "${answer}"\n\nEvaluate this answer. Give:\n1. Score (1-10)\n2. What was good\n3. What could be better\n4. A stronger version of their answer (2-3 sentences)\n\nBe specific and constructive.`
    );
  }

  return (
    <div className="space-y-3">
      {!currentQ ? (
        <button
          onClick={pickRandom}
          className="flex items-center gap-2 text-xs bg-cyan-400/15 hover:bg-cyan-400/25 border border-cyan-400/30 text-cyan-400 px-4 py-2.5 rounded-lg transition-colors duration-150 cursor-pointer font-medium"
          aria-label="Start Q&A drill"
        >
          <Shuffle size={13} /> Start Q&A Drill
        </button>
      ) : (
        <div className="bg-bg-1/50 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-cyan-400">Drill Mode</span>
            <button
              onClick={pickRandom}
              className="flex items-center gap-1 text-[10px] text-fg-2 hover:text-cyan-400 transition-colors duration-150 cursor-pointer"
              aria-label="Next random question"
            >
              <Shuffle size={10} /> Next question
            </button>
          </div>
          <p className="text-sm font-medium text-fg-0">{currentQ.q}</p>
          <textarea
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            placeholder="Type your answer as if you're in the meeting..."
            rows={4}
            autoFocus
            className="w-full bg-bg-2 rounded-lg px-3 py-2 text-sm text-fg-1 outline-none placeholder-fg-3 border border-border-0 focus:border-cyan-400/50 resize-none transition-colors duration-150"
          />
          <div className="flex gap-2">
            <button
              onClick={evaluate}
              disabled={!answer.trim() || coach.loading}
              className="flex items-center gap-1.5 text-xs bg-cyan-400/15 hover:bg-cyan-400/25 border border-cyan-400/30 text-cyan-400 px-4 py-2 rounded-lg transition-colors duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed font-medium"
              aria-label="Evaluate my answer"
            >
              <Sparkles size={12} /> Evaluate My Answer
            </button>
            <button
              onClick={() => { setCurrentQ(null); setAnswer(''); coach.clear(); }}
              className="text-xs text-fg-2 hover:text-fg-1 px-3 py-2 transition-colors duration-150 cursor-pointer"
            >
              End drill
            </button>
          </div>
          <AIFeedback loading={coach.loading} result={coach.result} error={coach.error} />
          {!coach.result && !coach.loading && (
            <p className="text-[10px] text-fg-2">Tip: {currentQ.tip}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Data ────────────────────────────────────────────────────────────────────

const ATTENDEES = [
  { role: 'Language Leader', name: 'TBD — confirm with your TL' },
  { role: 'Operations Manager', name: '@Jinsun.Lee_CS_SG (KR)' },
  { role: 'ChatOps Manager', name: '@Manh.Tri_CS_SG' },
  { role: 'HRBP', name: '@jerina.ang' },
  { role: 'Shift Coordinator', name: 'TBD — your current ShiftCo' },
  { role: 'Mentor / Senior', name: 'TBD — pick someone who knows your work' },
];

const PRE_CHECKLIST = [
  { id: 'date', label: 'Set presentation date (aim for April 14-16)', critical: true },
  { id: 'calendar', label: 'Create calendar event and invite all 6 attendees', critical: true },
  { id: 'confirm', label: 'Confirm all attendees can make the date', critical: true },
  { id: 'annemein', label: 'Reach out to @Annemein.Lancel_CS_Remote (NL) for presentation tips', critical: false },
  { id: 'badge', label: 'Screenshot your "New Hire Must Learn" badge', critical: true },
  { id: 'eval_form', label: 'Complete the 3rd month Evaluation Form', critical: true },
  { id: 'share_form', label: 'Share evaluation form with direct leader', critical: true },
  { id: 'slides', label: 'Finish presentation slides', critical: true },
  { id: 'rehearse', label: 'Do at least 1 full timed rehearsal', critical: false },
  { id: 'timer', label: 'Prepare timer/countdown for the meeting', critical: false },
];

const PRODUCT_TOPICS = [
  { id: 'bybit_card', label: 'Bybit Card', emoji: '💳' },
  { id: 'bybit_pay', label: 'Bybit Pay', emoji: '📱' },
  { id: 'fiat', label: 'Fiat Deposit/Withdrawal', emoji: '💶' },
  { id: 'p2p', label: 'P2P', emoji: '🤝' },
  { id: 'spot_x', label: 'Spot X', emoji: '📊' },
  { id: 'promotions', label: 'Promotions', emoji: '🎁' },
  { id: 'deposit_withdrawal', label: 'Deposit/Withdrawal', emoji: '₿' },
  { id: 'kyc', label: 'KYC', emoji: '🪪' },
];

const SELF_INTRO_POINTS = [
  { title: 'Who you are', detail: 'Background, what brought you to Bybit, why crypto and customer support' },
  { title: 'Your role & responsibilities', detail: 'EU + Global live chat agent. What does a typical shift look like? What channels and queues do you handle?' },
  { title: '3-month journey', detail: 'What you learned, what surprised you, how you grew. Key milestones and turning points.' },
  { title: 'Key results & accomplishments', detail: 'CSAT scores, cases handled, QA scores, AHT, any special recognitions. USE REAL NUMBERS.' },
  { title: 'Goals & plans', detail: 'Where you want to be in 6 months. Skills to develop. Areas you want to deepen.' },
  { title: 'Areas for improvement', detail: 'Be honest but frame it forward: "I identified X as a gap, and I\'m addressing it by doing Y"' },
  { title: 'Suggestions & feedback', detail: 'Share ideas to help the team/department. Process improvements, tool suggestions (ACE!), workflow enhancements.' },
  { title: 'Experience highlights', detail: 'A memorable case, a difficult situation you handled well, a time you went above and beyond.' },
];

const DEPT_INTRO_POINTS = [
  { title: 'ChatOps structure', detail: 'Where ChatOps sits within CS → where CS sits within Bybit. Who reports to whom.' },
  { title: 'Team composition', detail: 'Language teams, Language Leaders, Operations Manager, ChatOps Manager, shift system, how shifts are coordinated.' },
  { title: 'OKRs & targets', detail: 'What is the department measured on? CSAT targets, response times, resolution rates, capacity goals.' },
  { title: 'Challenges', detail: 'Current challenges: volume spikes, EU regulatory complexity (MiCA), tooling gaps, training needs.' },
  { title: 'Key updates', detail: 'Recent changes: MiCA rollout, new processes, tool updates, team changes, anything notable from the past 3 months.' },
];

const QA_QUESTIONS = [
  { q: 'What was the most difficult case you handled and how did you resolve it?', tip: 'Pick a real case. Explain the problem, your reasoning, the outcome. Show decision-making.' },
  { q: 'How do you handle a VIP 3+ customer who is angry and threatening to leave?', tip: 'Show VIP awareness. Acknowledge frustration, prioritize, follow VIP SOP, escalate if needed.' },
  { q: 'Explain the difference between EU and Global platform for your product topic.', tip: 'Know MiCA cold: derivatives blocked for EU retail, USDT restricted, Travel Rule >€1K, USDC primary.' },
  { q: 'A customer says a previous agent promised something you can\'t deliver. What do you do?', tip: 'Frame forward: "Let me make sure we sort this out now." Broken promise → escalate, don\'t improvise.' },
  { q: 'What suggestions do you have to improve our processes?', tip: 'Come with 1-2 specific, actionable ideas. ACE is a great example of taking initiative.' },
  { q: 'How do you prioritize when you have multiple chats and one is a VIP escalation?', tip: 'VIP 3+ gets priority. Don\'t ghost others — set expectations with a hold message.' },
  { q: 'What do you do when you don\'t know the answer to a customer\'s question?', tip: 'Never guess. Check KB, ask a senior, escalate. "Let me check this for you."' },
  { q: 'Where do you see yourself in 6 months at Bybit?', tip: 'Show ambition tied to the role. Deepening expertise, mentoring, specializing in a domain.' },
  { q: 'How do you handle EDD/compliance questions when the customer is frustrated?', tip: 'Neutral, process-based. Never speculate on why EDD triggered.' },
  { q: 'Walk us through how you would handle a P2P scam report in real time.', tip: 'Step 1: STOP (don\'t release). Step 2: Collect evidence. Step 3: Submit appeal. Step 4: Law enforcement if needed.' },
  { q: 'What is the Travel Rule and when does it apply?', tip: 'EU TFR: all crypto transfers >€1K need beneficiary info. It\'s EU law, not Bybit policy.' },
  { q: 'How would you explain the USDT restriction to an EU customer who wants to buy it?', tip: 'MiCA requires EU-licensed issuer. USDT issuer (Tether) isn\'t compliant. USDC (Circle) is. Can still hold/withdraw existing USDT.' },
];

// ─── Section Colors ──────────────────────────────────────────────────────────
const sectionColors = {
  deadline: 'border-crit/30 bg-crit/5',
  checklist: 'border-hero/30 bg-hero-soft/5',
  self: 'border-info/30 bg-info/5',
  dept: 'border-purple-500/30 bg-purple-500/5',
  product: 'border-warn/30 bg-warn/5',
  qa: 'border-cyan-500/30 bg-cyan-500/5',
  timer: 'border-ok/30 bg-ok/5',
  script: 'border-pink-500/30 bg-pink-500/5',
};

// ─── Main Component ──────────────────────────────────────────────────────────
export default function ProbationPrep() {
  const days = daysUntil(DEADLINE);
  const focus = getDailyFocus(days);

  // Persist state
  const [state, setState] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
  });

  const save = useCallback((updates) => {
    setState(prev => {
      const next = { ...prev, ...updates };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const checked = state.checked || {};
  const selectedTopics = state.selectedTopics || [];
  const notes = state.notes || {};

  const [openSections, setOpenSections] = useState({
    deadline: true, checklist: true, self: false, dept: false, product: false, qa: false, timer: false, script: false,
  });

  function toggleSection(id) { setOpenSections(p => ({ ...p, [id]: !p[id] })); }
  function toggleCheck(id) { save({ checked: { ...checked, [id]: !checked[id] } }); }
  function toggleTopic(id) {
    const current = [...selectedTopics];
    if (current.includes(id)) save({ selectedTopics: current.filter(t => t !== id) });
    else if (current.length < 2) save({ selectedTopics: [...current, id] });
  }
  function setNote(key, value) { save({ notes: { ...notes, [key]: value } }); }

  // AI coaches for each section
  const selfCoach = useAICoach();
  const deptCoach = useAICoach();
  const productCoach = useAICoach();
  const scriptCoach = useAICoach();

  // Readiness
  const readiness = calcReadiness(state);
  const readLabel = readinessLabel(readiness);

  const checklistDone = PRE_CHECKLIST.filter(c => checked[c.id]).length;
  const criticalDone = PRE_CHECKLIST.filter(c => c.critical && checked[c.id]).length;
  const criticalTotal = PRE_CHECKLIST.filter(c => c.critical).length;

  const urgencyColor = days <= 3 ? 'text-crit' : days <= 7 ? 'text-hero' : 'text-ok';
  const urgencyBg = days <= 3 ? 'bg-crit/10 border-crit/30' : days <= 7 ? 'bg-hero-soft/10 border-hero/30' : 'bg-ok/10 border-ok/30';

  // Coach section helper
  function coachSection(sectionName, pointsArray, prefix, coach) {
    const filledNotes = pointsArray
      .map((p, i) => ({ title: p.title, text: (notes[`${prefix}_${i}`] || '').trim() }))
      .filter(n => n.text.length > 5);

    if (!filledNotes.length) { coach.clear(); return; }

    const notesText = filledNotes.map(n => `**${n.title}:** ${n.text}`).join('\n');
    coach.ask(
      `Review these talking points for the "${sectionName}" section of a Bybit CS agent's 3-month probation presentation:\n\n${notesText}\n\nGive specific feedback:\n1. What's strong — what will impress the evaluators\n2. What's missing or weak — what needs more detail\n3. Delivery tip — how to present this section confidently\n4. Timing check — will this fit in the allocated time?\n\nBe direct. This person needs to pass their probation.`
    );
  }

  // Generate full script
  function generateScript() {
    const selfNotes = SELF_INTRO_POINTS.map((p, i) => `${p.title}: ${(notes[`self_${i}`] || '').trim()}`).filter(n => !n.endsWith(': ')).join('\n');
    const deptNotes = DEPT_INTRO_POINTS.map((p, i) => `${p.title}: ${(notes[`dept_${i}`] || '').trim()}`).filter(n => !n.endsWith(': ')).join('\n');
    const topicNames = selectedTopics.map(t => PRODUCT_TOPICS.find(p => p.id === t)?.label).filter(Boolean).join(' and ');
    const productNotes = selectedTopics.map(t => `${PRODUCT_TOPICS.find(p => p.id === t)?.label}: ${(notes[`product_${t}`] || '').trim()}`).join('\n');

    scriptCoach.ask(
      `Generate a natural, confident presentation script for a Bybit customer support agent's 3-month service review. The audience is: Language Leader, Operations Manager, ChatOps Manager, HRBP, Shift Coordinator, and a Senior agent.\n\nTotal time: 30 minutes. Structure:\n\n1. Self Introduction (8 min):\n${selfNotes || 'No notes provided — use generic structure'}\n\n2. Department Introduction (5 min):\n${deptNotes || 'No notes provided — use generic structure'}\n\n3. Product Walkthrough — ${topicNames || 'topics not selected'} (17 min):\n${productNotes || 'No notes provided'}\n\nWrite a complete script the agent can practice reading aloud. Use natural, professional language — not robotic. Include transition phrases between sections. Add [PAUSE] markers where the speaker should breathe. Add [SLIDE] markers where a new slide would appear. Keep it exactly the right length for 30 minutes of speaking.`
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-fg-0">🎓 3-Month Presentation Prep</h1>
        <p className="text-sm text-fg-2 mt-1">AI-powered coach, checklist, Q&A drill, and rehearsal timer</p>
      </div>

      {/* ── Readiness + Deadline + Daily Focus ─────────────────────────────── */}
      <div className={cn('border rounded-xl px-5 py-4 space-y-4', urgencyBg)}>
        {/* Readiness score */}
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16 shrink-0">
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="2" className="text-bg-2" />
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray={`${readiness}, 100`} className={readLabel.color} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={cn('text-sm font-bold', readLabel.color)}>{readiness}%</span>
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <p className={cn('text-sm font-semibold', readLabel.color)}>{readLabel.text}</p>
              <div className="flex items-center gap-2">
                <Calendar size={14} className={urgencyColor} />
                <span className={cn('text-lg font-bold tabular-nums', urgencyColor)}>{days}d</span>
              </div>
            </div>
            <p className="text-xs text-fg-2 mt-0.5">Hard deadline: April 18 — present BEFORE this date</p>
          </div>
        </div>

        {/* Daily focus */}
        <div className="bg-bg-1/40 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={12} className={focus.color} />
            <span className={cn('text-xs font-semibold', focus.color)}>Today's Focus: {focus.label}</span>
          </div>
          <p className="text-xs text-fg-1">{focus.detail}</p>
        </div>

        {/* Urgent warnings */}
        {days <= 5 && !checked['date'] && (
          <div className="flex items-center gap-2 bg-crit/10 rounded-lg px-3 py-2">
            <AlertTriangle size={14} className="text-crit shrink-0" />
            <p className="text-xs text-crit font-medium">You haven't set a date yet. Probation extends automatically if not done by April 18.</p>
          </div>
        )}
      </div>

      {/* ── Attendees ────────────────────────────────────────────────────── */}
      <div className={cn('border rounded-xl overflow-hidden', sectionColors.deadline)}>
        <button onClick={() => toggleSection('attendees')} className="w-full flex items-center justify-between px-5 py-4 text-left cursor-pointer">
          <h2 className="font-semibold text-fg-0 flex items-center gap-2">
            <Users size={16} className="text-crit" /> Attendees (6 required)
          </h2>
          {openSections.attendees ? <ChevronUp size={16} className="text-fg-2" /> : <ChevronDown size={16} className="text-fg-2" />}
        </button>
        {openSections.attendees && (
          <div className="px-5 pb-5 space-y-2">
            {ATTENDEES.map((a, i) => (
              <div key={i} className="flex items-center gap-3 bg-bg-1/50 rounded-lg px-4 py-3">
                <span className="text-xs font-medium text-fg-2 w-36 shrink-0">{a.role}</span>
                <span className="text-sm text-fg-1">{a.name}</span>
              </div>
            ))}
            <p className="text-[10px] text-fg-2 pt-1">HRBP (@jerina.ang) hosts the meeting. You send the calendar invite.</p>
          </div>
        )}
      </div>

      {/* ── Pre-Presentation Checklist ────────────────────────────────────── */}
      <div className={cn('border rounded-xl overflow-hidden', sectionColors.checklist)}>
        <button onClick={() => toggleSection('checklist')} className="w-full flex items-center justify-between px-5 py-4 text-left cursor-pointer">
          <h2 className="font-semibold text-fg-0 flex items-center gap-2">
            <Target size={16} className="text-hero" /> Checklist
            <span className="text-xs text-fg-2 font-normal">{checklistDone}/{PRE_CHECKLIST.length}</span>
          </h2>
          {openSections.checklist ? <ChevronUp size={16} className="text-fg-2" /> : <ChevronDown size={16} className="text-fg-2" />}
        </button>
        {openSections.checklist && (
          <div className="px-5 pb-5 space-y-2">
            <div className="mb-3">
              <div className="h-1.5 bg-bg-2 rounded-full overflow-hidden">
                <div className="h-full bg-hero rounded-full transition-all duration-300" style={{ width: `${(checklistDone / PRE_CHECKLIST.length) * 100}%` }} />
              </div>
              <p className="text-[10px] text-fg-2 mt-1">{criticalDone}/{criticalTotal} critical items done</p>
            </div>
            {PRE_CHECKLIST.map(item => (
              <button key={item.id} onClick={() => toggleCheck(item.id)} className="flex items-start gap-3 w-full text-left py-1.5 cursor-pointer">
                {checked[item.id]
                  ? <CheckCircle2 size={16} className="text-ok shrink-0 mt-0.5" />
                  : <Circle size={16} className={cn('shrink-0 mt-0.5', item.critical ? 'text-hero' : 'text-fg-2')} />
                }
                <span className={cn('text-sm', checked[item.id] ? 'line-through text-fg-2' : 'text-fg-1')}>
                  {item.label}
                  {item.critical && !checked[item.id] && <span className="text-[10px] text-hero ml-2">REQUIRED</span>}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Self Introduction ─────────────────────────────────────────────── */}
      <div className={cn('border rounded-xl overflow-hidden', sectionColors.self)}>
        <button onClick={() => toggleSection('self')} className="w-full flex items-center justify-between px-5 py-4 text-left cursor-pointer">
          <h2 className="font-semibold text-fg-0 flex items-center gap-2">
            <Mic size={16} className="text-info" /> Self Introduction
            <span className="text-xs text-fg-2 font-normal ml-1">5-10 min</span>
          </h2>
          {openSections.self ? <ChevronUp size={16} className="text-fg-2" /> : <ChevronDown size={16} className="text-fg-2" />}
        </button>
        {openSections.self && (
          <div className="px-5 pb-5 space-y-3">
            <p className="text-xs text-info/70">Main focus of your presentation. Show who you are, what you delivered, and where you're going.</p>
            {SELF_INTRO_POINTS.map((point, i) => (
              <div key={i} className="bg-bg-1/50 rounded-lg p-4">
                <p className="font-medium text-fg-0 text-sm mb-1">{point.title}</p>
                <p className="text-xs text-fg-2 mb-2">{point.detail}</p>
                <textarea
                  value={notes[`self_${i}`] || ''}
                  onChange={e => setNote(`self_${i}`, e.target.value)}
                  placeholder="Your talking points..."
                  rows={2}
                  className="w-full bg-bg-2 rounded-lg px-3 py-2 text-xs text-fg-1 outline-none placeholder-fg-3 border border-border-0 focus:border-info/50 resize-none transition-colors duration-150"
                />
              </div>
            ))}
            {/* Coach Me button */}
            <button
              onClick={() => coachSection('Self Introduction', SELF_INTRO_POINTS, 'self', selfCoach)}
              disabled={selfCoach.loading}
              className="flex items-center gap-1.5 text-xs bg-hero/10 hover:bg-hero/20 border border-hero/20 text-hero px-4 py-2.5 rounded-lg transition-colors duration-150 cursor-pointer disabled:opacity-50 font-medium"
              aria-label="Get AI coaching on self introduction"
            >
              <Sparkles size={13} /> {selfCoach.loading ? 'Reviewing...' : 'Coach Me'}
            </button>
            <AIFeedback loading={selfCoach.loading} result={selfCoach.result} error={selfCoach.error} />
          </div>
        )}
      </div>

      {/* ── Department Introduction ────────────────────────────────────────── */}
      <div className={cn('border rounded-xl overflow-hidden', sectionColors.dept)}>
        <button onClick={() => toggleSection('dept')} className="w-full flex items-center justify-between px-5 py-4 text-left cursor-pointer">
          <h2 className="font-semibold text-fg-0 flex items-center gap-2">
            <Building2 size={16} className="text-purple-400" /> Department Introduction
            <span className="text-xs text-fg-2 font-normal ml-1">5 min</span>
          </h2>
          {openSections.dept ? <ChevronUp size={16} className="text-fg-2" /> : <ChevronDown size={16} className="text-fg-2" />}
        </button>
        {openSections.dept && (
          <div className="px-5 pb-5 space-y-3">
            <p className="text-xs text-purple-400/70">Show you understand the bigger picture — where your team fits and what it's working toward.</p>
            {DEPT_INTRO_POINTS.map((point, i) => (
              <div key={i} className="bg-bg-1/50 rounded-lg p-4">
                <p className="font-medium text-fg-0 text-sm mb-1">{point.title}</p>
                <p className="text-xs text-fg-2 mb-2">{point.detail}</p>
                <textarea
                  value={notes[`dept_${i}`] || ''}
                  onChange={e => setNote(`dept_${i}`, e.target.value)}
                  placeholder="Your talking points..."
                  rows={2}
                  className="w-full bg-bg-2 rounded-lg px-3 py-2 text-xs text-fg-1 outline-none placeholder-fg-3 border border-border-0 focus:border-purple-400/50 resize-none transition-colors duration-150"
                />
              </div>
            ))}
            <button
              onClick={() => coachSection('Department Introduction', DEPT_INTRO_POINTS, 'dept', deptCoach)}
              disabled={deptCoach.loading}
              className="flex items-center gap-1.5 text-xs bg-hero/10 hover:bg-hero/20 border border-hero/20 text-hero px-4 py-2.5 rounded-lg transition-colors duration-150 cursor-pointer disabled:opacity-50 font-medium"
              aria-label="Get AI coaching on department introduction"
            >
              <Sparkles size={13} /> {deptCoach.loading ? 'Reviewing...' : 'Coach Me'}
            </button>
            <AIFeedback loading={deptCoach.loading} result={deptCoach.result} error={deptCoach.error} />
          </div>
        )}
      </div>

      {/* ── Product Walkthrough ─────────────────────────────────────────────── */}
      <div className={cn('border rounded-xl overflow-hidden', sectionColors.product)}>
        <button onClick={() => toggleSection('product')} className="w-full flex items-center justify-between px-5 py-4 text-left cursor-pointer">
          <h2 className="font-semibold text-fg-0 flex items-center gap-2">
            <Package size={16} className="text-warn" /> Product Walkthrough
            <span className="text-xs text-fg-2 font-normal ml-1">15-20 min</span>
          </h2>
          {openSections.product ? <ChevronUp size={16} className="text-fg-2" /> : <ChevronDown size={16} className="text-fg-2" />}
        </button>
        {openSections.product && (
          <div className="px-5 pb-5 space-y-4">
            <div>
              <p className="text-xs text-warn/70 mb-1">Select 2 topics. Present as if attendees are new users.</p>
              <p className="text-xs text-fg-2">Show advantages, disadvantages, unique selling points. Compare with competitors.</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {PRODUCT_TOPICS.map(topic => {
                const selected = selectedTopics.includes(topic.id);
                const disabled = !selected && selectedTopics.length >= 2;
                return (
                  <button
                    key={topic.id}
                    onClick={() => !disabled && toggleTopic(topic.id)}
                    disabled={disabled}
                    className={cn(
                      'flex items-center gap-2 px-4 py-3 rounded-lg border text-left transition-all duration-150 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40',
                      selected
                        ? 'bg-orange-400/15 border-orange-400/40 text-warn'
                        : 'bg-bg-1/50 border-border-0 text-fg-1 hover:border-border-1'
                    )}
                  >
                    <span>{topic.emoji}</span>
                    <span className="text-sm">{topic.label}</span>
                    {selected && <CheckCircle2 size={14} className="ml-auto text-warn" />}
                  </button>
                );
              })}
            </div>

            {/* Badge reminder */}
            <div className="bg-orange-400/5 border border-orange-400/20 rounded-lg px-4 py-3">
              <p className="text-xs text-warn font-medium">First slide: show your "New Hire Must Learn" badge screenshot</p>
            </div>

            {/* Selected topics with KB reference + notes */}
            {selectedTopics.map(topicId => {
              const topic = PRODUCT_TOPICS.find(t => t.id === topicId);
              const kbArticles = getKBForTopic(topicId);

              return (
                <div key={topicId} className="space-y-3">
                  <div className="bg-bg-1/50 rounded-lg p-4">
                    <p className="font-medium text-fg-0 text-sm mb-1">{topic.emoji} {topic.label}</p>
                    <p className="text-xs text-fg-2 mb-2">Walk us through it step by step. Advantages? Disadvantages? How does Bybit compare?</p>
                    <textarea
                      value={notes[`product_${topicId}`] || ''}
                      onChange={e => setNote(`product_${topicId}`, e.target.value)}
                      placeholder="Your walkthrough script and talking points..."
                      rows={4}
                      className="w-full bg-bg-2 rounded-lg px-3 py-2 text-xs text-fg-1 outline-none placeholder-fg-3 border border-border-0 focus:border-orange-400/50 resize-none transition-colors duration-150"
                    />
                  </div>

                  {/* KB Auto-Reference */}
                  {kbArticles.length > 0 && (
                    <div className="bg-orange-400/5 border border-orange-400/15 rounded-lg px-4 py-3">
                      <div className="flex items-center gap-2 mb-2">
                        <BookOpen size={12} className="text-warn/70" />
                        <span className="text-xs font-medium text-warn/70">KB Reference — key points to weave into your walkthrough</span>
                      </div>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {kbArticles.map(article => (
                          <div key={article.id}>
                            <p className="text-[10px] font-medium text-fg-1">{article.title}</p>
                            <ul className="mt-1 space-y-0.5">
                              {article.keyPoints?.slice(0, 3).map((kp, j) => (
                                <li key={j} className="text-[10px] text-fg-2 pl-2 border-l border-border-0">{kp}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {selectedTopics.length > 0 && (
              <>
                <button
                  onClick={() => {
                    const topicNotes = selectedTopics.map(t => {
                      const topic = PRODUCT_TOPICS.find(p => p.id === t);
                      const kb = getKBForTopic(t);
                      const kbText = kb.map(a => `${a.title}: ${a.keyPoints?.join('; ')}`).join('\n');
                      return `Topic: ${topic.label}\nAgent's notes: ${(notes[`product_${t}`] || 'No notes yet').trim()}\nKB reference: ${kbText}`;
                    }).join('\n\n');
                    productCoach.ask(
                      `Review this product walkthrough prep for a Bybit agent's probation presentation (15-20 minutes for this section, presenting as if audience are new users):\n\n${topicNotes}\n\nGive feedback on:\n1. Coverage — are they hitting the key points?\n2. Structure — good flow for a walkthrough?\n3. Missing angles — what would impress the evaluators?\n4. EU vs Global — should they mention platform differences?\n5. Competitor comparison — what should they highlight?\n\nBe specific and actionable.`
                    );
                  }}
                  disabled={productCoach.loading}
                  className="flex items-center gap-1.5 text-xs bg-hero/10 hover:bg-hero/20 border border-hero/20 text-hero px-4 py-2.5 rounded-lg transition-colors duration-150 cursor-pointer disabled:opacity-50 font-medium"
                  aria-label="Get AI coaching on product walkthrough"
                >
                  <Sparkles size={13} /> {productCoach.loading ? 'Reviewing...' : 'Coach Me'}
                </button>
                <AIFeedback loading={productCoach.loading} result={productCoach.result} error={productCoach.error} />
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Q&A Prep + Drill ──────────────────────────────────────────────── */}
      <div className={cn('border rounded-xl overflow-hidden', sectionColors.qa)}>
        <button onClick={() => toggleSection('qa')} className="w-full flex items-center justify-between px-5 py-4 text-left cursor-pointer">
          <h2 className="font-semibold text-fg-0 flex items-center gap-2">
            <HelpCircle size={16} className="text-cyan-400" /> Q&A Prep
            <span className="text-xs text-fg-2 font-normal ml-1">up to 30 min</span>
          </h2>
          {openSections.qa ? <ChevronUp size={16} className="text-fg-2" /> : <ChevronDown size={16} className="text-fg-2" />}
        </button>
        {openSections.qa && (
          <div className="px-5 pb-5 space-y-4">
            {/* Drill mode */}
            <div>
              <p className="text-xs text-cyan-400/70 mb-3">Practice with the AI drill — it picks a random question and evaluates your answer.</p>
              <QADrill />
            </div>

            {/* Static Q&A list */}
            <div className="border-t border-border-0 pt-4">
              <p className="text-xs font-medium text-fg-1 mb-3 flex items-center gap-1.5">
                <MessageSquare size={12} /> All {QA_QUESTIONS.length} practice questions
              </p>
              {QA_QUESTIONS.map((item, i) => (
                <div key={i} className="bg-bg-1/50 rounded-lg p-4 mb-2">
                  <p className="font-medium text-fg-0 text-sm mb-1">{item.q}</p>
                  <p className="text-[10px] text-cyan-400/50 mb-2">Tip: {item.tip}</p>
                  <textarea
                    value={notes[`qa_${i}`] || ''}
                    onChange={e => setNote(`qa_${i}`, e.target.value)}
                    placeholder="Your answer..."
                    rows={2}
                    className="w-full bg-bg-2 rounded-lg px-3 py-2 text-xs text-fg-1 outline-none placeholder-fg-3 border border-border-0 focus:border-cyan-400/50 resize-none transition-colors duration-150"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Generate Full Script ───────────────────────────────────────────── */}
      <div className={cn('border rounded-xl overflow-hidden', sectionColors.script)}>
        <button onClick={() => toggleSection('script')} className="w-full flex items-center justify-between px-5 py-4 text-left cursor-pointer">
          <h2 className="font-semibold text-fg-0 flex items-center gap-2">
            <FileText size={16} className="text-pink-400" /> Generate Presentation Script
          </h2>
          {openSections.script ? <ChevronUp size={16} className="text-fg-2" /> : <ChevronDown size={16} className="text-fg-2" />}
        </button>
        {openSections.script && (
          <div className="px-5 pb-5 space-y-3">
            <p className="text-xs text-pink-400/70">Fill in your notes above, then generate a full script you can practice reading aloud.</p>
            <button
              onClick={generateScript}
              disabled={scriptCoach.loading}
              className="flex items-center gap-1.5 text-xs bg-pink-400/10 hover:bg-pink-400/20 border border-pink-400/20 text-pink-400 px-4 py-2.5 rounded-lg transition-colors duration-150 cursor-pointer disabled:opacity-50 font-medium"
              aria-label="Generate full presentation script"
            >
              <Sparkles size={13} /> {scriptCoach.loading ? 'Generating...' : 'Generate Full Script'}
            </button>
            <AIFeedback loading={scriptCoach.loading} result={scriptCoach.result} error={scriptCoach.error} />
          </div>
        )}
      </div>

      {/* ── Rehearsal Timer ────────────────────────────────────────────────── */}
      <div className={cn('border rounded-xl overflow-hidden', sectionColors.timer)}>
        <button onClick={() => toggleSection('timer')} className="w-full flex items-center justify-between px-5 py-4 text-left cursor-pointer">
          <h2 className="font-semibold text-fg-0 flex items-center gap-2">
            <Timer size={16} className="text-ok" /> Rehearsal Timer
          </h2>
          {openSections.timer ? <ChevronUp size={16} className="text-fg-2" /> : <ChevronDown size={16} className="text-fg-2" />}
        </button>
        {openSections.timer && (
          <div className="px-5 pb-5">
            <p className="text-xs text-ok/70 mb-3">30-min timer with section markers. Practice your full presentation.</p>
            <RehearsalTimer />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center pt-2 pb-8">
        <p className="text-xs text-fg-3">All notes auto-save locally. Your progress is yours.</p>
      </div>
    </div>
  );
}
