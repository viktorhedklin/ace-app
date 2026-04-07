import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import TiltCard from '@/components/TiltCard';

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
  try {
    const today = new Date().toISOString().split('T')[0];
    const raw = localStorage.getItem(`shift_${today}`);
    if (!raw) return { cases: 0, closed: 0, csat: '—', escalations: 0 };
    const d = JSON.parse(raw);
    const allCsat = [...(d.csatLiveChat || []), ...(d.csatMessaging || [])];
    const avgCsat = allCsat.length
      ? (allCsat.reduce((a, b) => a + b, 0) / allCsat.length).toFixed(1)
      : '—';
    const cases = (d.chatsTaken || 0) + (d.messagingTaken || 0) + (d.emailProd || 0);
    const escalations = (d.chatEscalations || 0) + (d.msgEscalations || 0);
    return { cases, closed: d.closedCases || 0, csat: avgCsat, escalations };
  } catch {
    return { cases: 0, closed: 0, csat: '—', escalations: 0 };
  }
}

function getCaseEvents() {
  try { return JSON.parse(localStorage.getItem('ace_case_events') || '[]'); }
  catch { return []; }
}

// Returns map of ISO-date → case count for last 91 days
function buildHeatmapData(events) {
  const map = {};
  events.forEach(e => {
    const date = new Date(e.ts).toISOString().split('T')[0];
    map[date] = (map[date] || 0) + 1;
  });
  return map;
}

// Count VIP 3+ case events in the last 60 minutes
function getVIPPressure(events) {
  const cutoff = Date.now() - 60 * 60 * 1000;
  return events.filter(e => e.ts > cutoff && e.vipLevel >= 3).length;
}

// ─── Efficiency Heatmap ───────────────────────────────────────────────────────

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function cellColor(count) {
  if (!count) return 'bg-slate-800 border-slate-700/50';
  if (count < 3) return 'bg-yellow-400/20 border-yellow-400/20';
  if (count < 6) return 'bg-yellow-400/40 border-yellow-400/30';
  if (count < 10) return 'bg-yellow-400/65 border-yellow-400/50';
  return 'bg-yellow-400 border-yellow-500/50';
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
    // Pad start to align to Sunday column
    const firstDow = days[0].dow;
    const padded = [...Array(firstDow).fill(null), ...days];
    // Split into week columns
    const result = [];
    for (let i = 0; i < padded.length; i += 7) result.push(padded.slice(i, i + 7));
    return result;
  }, [data]);

  return (
    <div className="flex gap-0.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
      {/* Day-of-week labels */}
      <div className="flex flex-col gap-0.5 mr-1 shrink-0">
        {DAY_LABELS.map((l, i) => (
          <div key={i} className="w-3 h-3 flex items-center justify-center text-[8px] text-slate-700 select-none">{l}</div>
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
                className={cn('w-3 h-3 rounded-sm border', cellColor(day.count))}
                title={`${day.key}: ${day.count} case${day.count !== 1 ? 's' : ''}`}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.22, delay },
});

export default function Dashboard() {
  const stats = getStats();
  const events = getCaseEvents();
  const heatmapData = buildHeatmapData(events);
  const vipPressure = getVIPPressure(events);
  const isHighPressure = vipPressure >= 2;

  const headerGlow = isHighPressure
    ? { boxShadow: '0 0 30px rgba(250, 204, 21, 0.15) inset' }
    : {};

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Motivational banner */}
      <motion.div {...fadeUp(0)}
        className="bg-gradient-to-r from-yellow-400/10 to-transparent border border-yellow-400/20 rounded-xl p-4"
        style={headerGlow}
      >
        <p className="text-slate-300 text-sm leading-relaxed">
          {isHighPressure
            ? `⚠️ High VIP pressure — ${vipPressure} VIP 3+ case${vipPressure !== 1 ? 's' : ''} in the last 60 minutes. Stay sharp.`
            : "You're three months in. You've already handled things that stumped people with years of experience."
          }
        </p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: '📁', label: 'Cases today', value: stats.cases },
          { icon: '✓', label: 'Closed today', value: stats.closed },
          { icon: '⭐', label: 'Avg CSAT', value: stats.csat },
          { icon: '📤', label: 'Escalations', value: stats.escalations },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.05 + i * 0.06 }}
            whileHover={{ scale: 1.04, borderColor: 'rgba(250,204,21,0.35)' }}
            className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center cursor-default"
          >
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className="text-2xl font-bold text-slate-100">{s.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Start a case */}
      <motion.div {...fadeUp(0.28)}>
        <MotionLink
          to="/shift-tracker"
          whileHover={{ scale: 1.012 }}
          whileTap={{ scale: 0.985 }}
          className="block w-full text-center bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-semibold py-3 rounded-xl transition-colors"
        >
          Start a case
        </MotionLink>
      </motion.div>

      {/* Efficiency Heatmap */}
      <motion.div {...fadeUp(0.32)}>
        <div
          className={cn(
            'bg-slate-900 border rounded-xl p-5 space-y-3 transition-colors duration-300',
            isHighPressure ? 'border-yellow-400/30' : 'border-slate-800'
          )}
          style={isHighPressure ? { boxShadow: '0 0 20px rgba(250,204,21,0.08)' } : {}}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                Efficiency Heatmap
                {isHighPressure && (
                  <span className="text-xs bg-yellow-400/20 text-yellow-400 border border-yellow-400/30 px-2 py-0.5 rounded font-bold animate-pulse">
                    VIP PRESSURE
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">Cases handled — last 90 days</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <div className="w-2.5 h-2.5 rounded-sm bg-slate-800 border border-slate-700/50" />
              <span>0</span>
              <div className="w-2.5 h-2.5 rounded-sm bg-yellow-400/20 border border-yellow-400/20" />
              <div className="w-2.5 h-2.5 rounded-sm bg-yellow-400/65 border border-yellow-400/50" />
              <div className="w-2.5 h-2.5 rounded-sm bg-yellow-400 border border-yellow-500/50" />
              <span>10+</span>
            </div>
          </div>
          <Heatmap data={heatmapData} />
          {events.length === 0 && (
            <p className="text-xs text-slate-700 text-center py-2">No cases recorded yet — heatmap fills as you work.</p>
          )}
        </div>
      </motion.div>

      {/* Chat Channels */}
      <motion.div {...fadeUp(0.38)}>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Chat Channels</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {CHAT_CHANNELS.map((ch, i) => (
            <motion.div
              key={ch.path}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: 0.40 + i * 0.05 }}
              whileHover={{ scale: 1.02, borderColor: 'rgba(250,204,21,0.4)' }}
              whileTap={{ scale: 0.98 }}
            >
              <Link
                to={ch.path}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-3 transition-colors group block"
              >
                <span className="text-2xl">{ch.flag}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-100 group-hover:text-yellow-400 transition-colors">{ch.name}</p>
                  <p className="text-xs text-slate-500 truncate">{ch.subtitle}</p>
                </div>
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded font-medium shrink-0',
                  ch.type === 'CHAT' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
                )}>{ch.type}</span>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Tools */}
      <motion.div {...fadeUp(0.50)}>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Tools & Workflows</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {TOOLS.map((t, i) => (
            <motion.div
              key={t.path}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.16, delay: 0.52 + i * 0.03 }}
            >
              <TiltCard intensity={6} className="h-full">
                <Link
                  to={t.path}
                  className="bg-slate-900/90 border border-slate-800 hover:border-yellow-400/30 rounded-xl p-4 flex flex-col gap-2 group block h-full transition-colors duration-150"
                >
                  <span className="text-2xl">{t.icon}</span>
                  <div>
                    <p className="font-medium text-slate-100 text-sm group-hover:text-yellow-400 transition-colors">{t.name}</p>
                    <p className="text-xs text-slate-500">{t.desc}</p>
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
