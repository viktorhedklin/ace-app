import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import TiltCard from '@/components/TiltCard';
import { ArrowRight, AlertTriangle, Target } from 'lucide-react';
import { loadTrajectory, getRecurringQAIssues } from '@/lib/trajectory';
import { loadShift, listShifts } from '@/lib/shifts';
import { get as storageGet, NAMESPACES } from '@/lib/storage';

const MotionLink = motion.create ? motion.create(Link) : motion(Link);

const CHAT_CHANNELS = [
  { name: 'Bybit EU', subtitle: 'European Exchange · MiCA Regulated', type: 'EMAIL', flag: '🇪🇺', path: '/bybit-eu' },
  { name: 'EU Live Chat', subtitle: 'European Exchange · MiCA Regulated', type: 'CHAT', flag: '🇪🇺', path: '/eu-live-chat' },
  { name: 'Bybit Global', subtitle: 'Global Exchange · 180+ Countries', type: 'EMAIL', flag: '🌍', path: '/bybit-global' },
  { name: 'Global Live Chat', subtitle: 'Global Exchange · 180+ Countries', type: 'CHAT', flag: '🌍', path: '/global-live-chat' },
  { name: 'Personal', subtitle: 'Your space · Powered by Ace', type: 'CHAT', flag: '✦', path: '/personal' },
];

const TOOLS = [
  { name: 'Workspace', icon: '🗂️', desc: 'Up to 4 simultaneous chats', path: '/workspace' },
  { name: 'SEPA Delay', icon: '💶', desc: 'Deposit delay cheat sheet', path: '/sepa-delay' },
  { name: 'Quick Lookup', icon: '⚡', desc: 'Instant SOP/policy card', path: '/quick-lookup' },
  { name: 'Campaign', icon: '🎁', desc: 'Promo & campaign info', path: '/campaign' },
  { name: 'Shift Tracker', icon: '📊', desc: 'Points & CSAT log', path: '/shift-tracker' },
  { name: 'Hack Case', icon: '🔴', desc: 'Account hacked SOP', path: '/hack-case' },
  { name: 'Missing Deposit', icon: '💸', desc: 'Deposit wizard', path: '/missing-deposit' },
  { name: 'Account Matters', icon: '👤', desc: 'E01 email/phone/GA', path: '/account-matters' },
  { name: 'P2P Advertiser', icon: '🤝', desc: 'P2P ad SOP', path: '/p2p-advertiser' },
  { name: 'P2P Dispute', icon: '⚖️', desc: 'Dispute & appeals', path: '/p2p-dispute' },
  { name: 'Card Decline', icon: '💳', desc: 'Decode card errors', path: '/card-decline' },
  { name: 'Chain Lookup', icon: '🔗', desc: 'Chain & network info', path: '/chain-lookup' },
  { name: 'Quality Check', icon: '🎯', desc: 'Tone & draft scoring', path: '/quality-check' },
  { name: 'Closed Cases', icon: '📋', desc: 'Review & reopen', path: '/closed-cases' },
  { name: 'Probation Prep', icon: '🎓', desc: 'Agent development SOP', path: '/probation-prep' },
  { name: 'Quick Templates', icon: '💬', desc: 'Ready-to-send responses', path: '/quick-templates' },
  { name: 'Follow-up', icon: '📬', desc: 'Last-hour case followups', path: '/follow-up' },
  { name: 'Translate 🇸🇪', icon: '🌐', desc: 'EN → SV with tone check', path: '/translate' },
  { name: 'CSAT Predictor', icon: '⭐', desc: 'Predict score before you send', path: '/csat-predictor' },
];

// ─── Case data helpers ────────────────────────────────────────────────────────

function getStats() {
  const today = new Date().toISOString().split('T')[0];
  const d = loadShift(today);
  if (!d) return { cases: 0, closed: 0, csat: '—', escalations: 0 };
  const allCsat = [...(d.csatLiveChat || []), ...(d.csatMessaging || [])];
  const avgCsat = allCsat.length
    ? (allCsat.reduce((a, b) => a + b, 0) / allCsat.length).toFixed(1)
    : '—';
  const cases = (d.chatsTaken || 0) + (d.messagingTaken || 0) + (d.emailProd || 0);
  const escalations = (d.chatEscalations || 0) + (d.msgEscalations || 0);
  return { cases, closed: d.closedCases || 0, csat: avgCsat, escalations };
}

function getCaseEvents() {
  const fromCloud = storageGet(NAMESPACES.SETTINGS, 'case_events');
  if (Array.isArray(fromCloud)) return fromCloud;
  try { return JSON.parse(localStorage.getItem('ace_case_events') || '[]'); }
  catch { return []; }
}

// ─── Shift history helpers ────────────────────────────────────────────────────
// Pulls every persisted shift via the adapter (cloud-mirrored) and flattens
// into the { date, ...metrics } shape the Dashboard consumes.
function getShiftHistory() {
  return listShifts()
    .map(({ date, data }) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// Rolling average over shift history for a given channel's QA scores.
function getAvgQA(history, field) {
  const all = history.flatMap(d => d[field] || []);
  if (!all.length) return '—';
  return (all.reduce((a, b) => a + b, 0) / all.length).toFixed(0);
}

// Consecutive days with any activity (cases logged OR CSAT logged), ending today.
function getStreak(history) {
  if (!history.length) return 0;
  let streak = 0;
  const today = new Date();
  for (let i = 0; ; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    const day = history.find(h => h.date === key);
    if (!day) break;
    const active = (day.chatsTaken || 0) + (day.messagingTaken || 0) + (day.emailProd || 0) +
      (day.csatLiveChat?.length || 0) + (day.csatMessaging?.length || 0);
    if (!active) break;
    streak++;
  }
  return streak;
}

function buildHeatmapData(events) {
  const map = {};
  events.forEach(e => {
    const date = new Date(e.ts).toISOString().split('T')[0];
    map[date] = (map[date] || 0) + 1;
  });
  return map;
}

function getVIPPressure(events) {
  const cutoff = Date.now() - 60 * 60 * 1000;
  return events.filter(e => e.ts > cutoff && e.vipLevel >= 3).length;
}

function getTimeOfDayGreeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Still up';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 22) return 'Good evening';
  return 'Working late';
}

// ─── Efficiency Heatmap (cyan tier) ───────────────────────────────────────────

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function cellClass(count) {
  if (!count) return 'bg-bg-2 border-border-0';
  if (count < 3) return 'bg-hero/15 border-hero/20';
  if (count < 6) return 'bg-hero/35 border-hero/40';
  if (count < 10) return 'bg-hero/60 border-hero/60';
  return 'bg-hero border-hero';
}

function Heatmap({ data }) {
  const weeks = useMemo(() => {
    const days = [];
    const today = new Date();
    for (let i = 90; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      days.push({ key, count: data[key] || 0, dow: d.getDay() });
    }
    const firstDow = days[0].dow;
    const padded = [...Array(firstDow).fill(null), ...days];
    const result = [];
    for (let i = 0; i < padded.length; i += 7) result.push(padded.slice(i, i + 7));
    return result;
  }, [data]);

  return (
    <div className="flex gap-0.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
      <div className="flex flex-col gap-0.5 mr-1.5 shrink-0">
        {DAY_LABELS.map((l, i) => (
          <div key={i} className="w-3 h-3 flex items-center justify-center font-mono text-[8px] text-fg-3 select-none">{l}</div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} className="flex flex-col gap-0.5 shrink-0">
          {Array.from({ length: 7 }).map((_, di) => {
            const day = week[di];
            if (!day) return <div key={di} className="w-3 h-3" />;
            return (
              <div
                key={di}
                className={cn('w-3 h-3 rounded-sm border transition-colors duration-220', cellClass(day.count))}
                title={`${day.key}: ${day.count} case${day.count !== 1 ? 's' : ''}`}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({ label, value, delta, live = false, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.28, delay, ease: [0.2, 0, 0.2, 1] }}
      className={cn('kpi-card', live && 'is-live')}
    >
      {live && <span className="live-dot" aria-hidden="true" />}
      <p className="type-kpi-label text-fg-2">{label}</p>
      <p className="type-kpi text-fg-0 mt-2 tabular-nums">{value}</p>
      {delta && (
        <p className={cn('font-mono text-[11px] mt-1 tabular-nums', typeof delta === 'object' ? delta.cls : 'text-fg-2')}>
          {typeof delta === 'object' ? delta.text : delta}
        </p>
      )}
    </motion.div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 12, filter: 'blur(4px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  transition: { duration: 0.3, delay, ease: [0.2, 0, 0.2, 1] },
});

export default function Dashboard() {
  const stats = getStats();
  const events = getCaseEvents();
  const heatmapData = buildHeatmapData(events);
  const vipPressure = getVIPPressure(events);
  const isHighPressure = vipPressure >= 2;
  const greeting = getTimeOfDayGreeting();

  const history = useMemo(() => getShiftHistory(), []);
  const streak = useMemo(() => getStreak(history), [history]);
  const qaChat = useMemo(() => getAvgQA(history, 'qaChat'), [history]);
  const qaEmail = useMemo(() => getAvgQA(history, 'qaEmail'), [history]);
  const qaCombined = useMemo(() => {
    const all = history.flatMap(d => [...(d.qaChat || []), ...(d.qaEmail || [])]);
    if (!all.length) return '—';
    return (all.reduce((a, b) => a + b, 0) / all.length).toFixed(0);
  }, [history]);

  // Trajectory tie-in
  const trajectory = useMemo(() => loadTrajectory(), []);
  const recurringIssues = useMemo(() => getRecurringQAIssues(), []);
  const weekFocus = trajectory?.plan?.thisWeekFocus;

  // Rotating daily brief — picks a line based on what's most interesting today.
  const dailyBrief = useMemo(() => {
    if (isHighPressure) {
      return {
        icon: <AlertTriangle size={14} className="inline mr-1.5 -mt-0.5" />,
        text: `${vipPressure} VIP 3+ case${vipPressure !== 1 ? 's' : ''} in the last 60 minutes. Stay sharp.`,
        cls: 'text-warn',
      };
    }
    if (recurringIssues.length >= 1) {
      return {
        icon: <span className="mr-1.5">🎯</span>,
        text: `Pattern flagged: "${recurringIssues[0].issue}" × ${recurringIssues[0].count}. Open Trajectory to work on it.`,
        cls: 'text-warn',
      };
    }
    if (weekFocus) {
      return {
        icon: <Target size={14} className="inline mr-1.5 -mt-0.5 text-hero" />,
        text: `Focus this week: ${weekFocus.title}. ${weekFocus.action}`,
        cls: 'text-fg-1',
      };
    }
    if (streak >= 3) {
      return {
        icon: <span className="mr-1.5">🔥</span>,
        text: `${streak}-day streak. You're in flow — keep it rolling.`,
        cls: 'text-fg-1',
      };
    }
    if (qaCombined !== '—' && Number(qaCombined) >= 90) {
      return {
        icon: <span className="mr-1.5">✨</span>,
        text: `QA average ${qaCombined}. Top-tier work — the SOP loops are paying off.`,
        cls: 'text-fg-1',
      };
    }
    return {
      icon: null,
      text: "Three months in. You've handled things that stumped people with years of experience.",
      cls: 'text-fg-1',
    };
  }, [isHighPressure, vipPressure, streak, qaCombined, recurringIssues, weekFocus]);

  const csatDelta = stats.csat !== '—' && parseFloat(stats.csat) >= 4.5
    ? { text: `★ ${stats.csat} / 5.0`, cls: 'text-ok' }
    : { text: 'Tracking…', cls: 'text-fg-2' };

  return (
    <div className="px-6 py-8 lg:px-10 lg:py-10 max-w-6xl mx-auto space-y-8">
      {/* ── GREETING ────────────────────────────────────────────────────── */}
      <motion.div {...fadeUp(0)} className="flex items-start justify-between gap-6 flex-wrap">
        <div>
          <h1 className="type-display text-fg-0">
            {greeting},{' '}
            <span
              className="text-hero animate-hero-shimmer"
              style={{ textShadow: '0 0 24px rgba(34, 211, 238, 0.35)' }}
            >
              Viktor
            </span>
            <span className="text-fg-3">.</span>
          </h1>
          <p className={cn('type-body mt-2', dailyBrief.cls)}>
            {dailyBrief.icon}{dailyBrief.text}
          </p>
        </div>
        {streak >= 1 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.15, ease: [0.2, 0, 0.2, 1] }}
            className="flex items-center gap-2 bg-bg-1 border border-border-0 rounded-xl px-4 py-2"
          >
            <span className="text-xl">🔥</span>
            <div>
              <p className="type-kpi-label text-fg-2">Streak</p>
              <p className="font-display font-bold text-fg-0 tabular-nums text-base leading-tight">
                {streak}<span className="type-caption text-fg-2 font-normal ml-1">day{streak !== 1 ? 's' : ''}</span>
              </p>
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* ── KPI ROW ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="Cases Today" value={stats.cases} live delay={0.04} />
        <KPICard label="Closed" value={stats.closed} delta={stats.closed > 0 ? { text: `${stats.closed} resolved`, cls: 'text-ok' } : '—'} delay={0.08} />
        <KPICard label="Avg CSAT" value={stats.csat} delta={csatDelta} delay={0.12} />
        <KPICard label="Escalations" value={stats.escalations} delta={stats.escalations > 0 ? { text: `${stats.escalations} sent to P2`, cls: 'text-warn' } : 'None'} delay={0.16} />
      </div>

      {/* ── QA PILL ROW ─────────────────────────────────────────────────── */}
      <motion.div {...fadeUp(0.20)} className="grid grid-cols-3 gap-3">
        {[
          { label: 'QA · Chat', value: qaChat },
          { label: 'QA · Email', value: qaEmail },
          { label: 'QA · Combined', value: qaCombined },
        ].map(q => (
          <div key={q.label} className="bg-bg-1 border border-border-0 rounded-xl px-4 py-3 flex items-center justify-between">
            <p className="type-kpi-label text-fg-2">{q.label}</p>
            <p className="font-display font-bold text-fg-0 tabular-nums text-xl">
              {q.value}
              {q.value !== '—' && <span className="type-caption text-fg-3 font-normal ml-0.5">/100</span>}
            </p>
          </div>
        ))}
      </motion.div>

      {/* ── PRIMARY CTA ─────────────────────────────────────────────────── */}
      <motion.div {...fadeUp(0.22)}>
        <MotionLink
          to="/shift-tracker"
          whileTap={{ scale: 0.985 }}
          className="cta-primary w-full"
        >
          <span className="relative z-10">Open Shift Console</span>
          <ArrowRight size={16} className="relative z-10" strokeWidth={2.5} />
        </MotionLink>
      </motion.div>

      {/* ── 2-COLUMN: HEATMAP + NEEDS-ATTENTION ─────────────────────────── */}
      <motion.div {...fadeUp(0.26)} className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
        {/* Heatmap */}
        <div className="panel">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="type-h2 text-fg-0 flex items-center gap-2">
                Efficiency Heatmap
                {isHighPressure && (
                  <span className="type-badge text-warn bg-warn/10 border border-warn/25 px-2 py-0.5 rounded">
                    VIP PRESSURE
                  </span>
                )}
              </h2>
              <p className="type-caption text-fg-2 mt-0.5">Cases handled · last 90 days</p>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-[10px] text-fg-2">
              <span>0</span>
              <div className="w-2.5 h-2.5 rounded-sm bg-bg-2 border border-border-0" />
              <div className="w-2.5 h-2.5 rounded-sm bg-hero/35 border border-hero/40" />
              <div className="w-2.5 h-2.5 rounded-sm bg-hero/60 border border-hero/60" />
              <div className="w-2.5 h-2.5 rounded-sm bg-hero border border-hero" />
              <span>10+</span>
            </div>
          </div>
          {events.length === 0 ? (
            <div className="flex items-center justify-center py-10 border border-dashed border-border-0 rounded-xl">
              <p className="type-caption text-fg-3">Heatmap will populate after your first case.</p>
            </div>
          ) : (
            <Heatmap data={heatmapData} />
          )}
        </div>

        {/* Needs Attention */}
        {isHighPressure ? (
          <div className="alert-crit">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-crit animate-live-pulse" style={{ boxShadow: '0 0 10px var(--crit)' }} />
              <h3 className="type-h3 text-crit flex-1">Needs Attention</h3>
              <span className="type-badge text-crit bg-crit/10 border border-crit/40 px-2 py-0.5 rounded">ESCALATE</span>
            </div>
            <p className="type-body-sm text-fg-1 leading-relaxed mb-4">
              <span className="font-mono text-crit">{vipPressure}</span> VIP 3+ case{vipPressure !== 1 ? 's' : ''} active in the last hour. Prioritise before SLA breach.
            </p>
            <div className="flex items-center gap-2 pt-3 border-t border-crit/20">
              <span className="type-badge font-mono text-fg-2">SLA · LIVE</span>
              <span className="type-badge font-mono text-fg-2 ml-auto">PRIORITY P1</span>
            </div>
          </div>
        ) : (
          <div className="panel">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-ok" style={{ boxShadow: '0 0 8px var(--ok)' }} />
              <h3 className="type-h3 text-fg-0 flex-1">All Clear</h3>
              <span className="type-badge text-ok bg-ok/10 border border-ok/25 px-2 py-0.5 rounded">NOMINAL</span>
            </div>
            <p className="type-body-sm text-fg-1 leading-relaxed mb-4">
              No high-pressure cases right now. Good window to pick up a closed case or clear your CasePad.
            </p>
            <div className="flex items-center gap-2 pt-3 border-t border-border-0">
              <span className="type-badge font-mono text-fg-2">SLA · OK</span>
              <span className="type-badge font-mono text-fg-2 ml-auto">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        )}
      </motion.div>

      {/* ── CHAT CHANNELS ───────────────────────────────────────────────── */}
      <motion.div {...fadeUp(0.3)}>
        <h2 className="type-nav-section mb-4">Chat Channels</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {CHAT_CHANNELS.map((ch, i) => (
            <motion.div
              key={ch.path}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: 0.34 + i * 0.04, ease: [0.2, 0, 0.2, 1] }}
            >
              <Link to={ch.path} className="channel-card flex items-center gap-3 group">
                <span className="text-2xl relative z-10">{ch.flag}</span>
                <div className="flex-1 min-w-0 relative z-10">
                  <p className="font-display font-medium text-fg-0 group-hover:text-hero transition-colors duration-220">{ch.name}</p>
                  <p className="type-caption text-fg-2 truncate">{ch.subtitle}</p>
                </div>
                <span className={cn(
                  'type-badge px-2 py-0.5 rounded shrink-0 relative z-10',
                  ch.type === 'CHAT' ? 'bg-ok/15 text-ok' : 'bg-info/15 text-info'
                )}>{ch.type}</span>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ── TOOLS & WORKFLOWS ───────────────────────────────────────────── */}
      <motion.div {...fadeUp(0.42)}>
        <h2 className="type-nav-section mb-4">Tools & Workflows</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {TOOLS.map((t, i) => (
            <motion.div
              key={t.path}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: 0.44 + i * 0.025, ease: [0.2, 0, 0.2, 1] }}
            >
              <TiltCard intensity={5} className="h-full">
                <Link
                  to={t.path}
                  className="bg-bg-2 border border-border-0 hover:border-border-hero rounded-xl p-4 flex flex-col gap-2 group block h-full transition-colors duration-220"
                >
                  <span className="text-2xl">{t.icon}</span>
                  <div>
                    <p className="font-display font-medium text-fg-0 text-sm group-hover:text-hero transition-colors duration-220">{t.name}</p>
                    <p className="type-caption text-fg-2">{t.desc}</p>
                  </div>
                </Link>
              </TiltCard>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
