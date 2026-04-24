import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, X, ChevronRight, Download, Upload, Shield } from 'lucide-react';
import { getRecentCases, getCasesByUID } from '@/lib/caseMemory';
import { scrubPII } from '@/lib/SecurityModule';
import { useAce } from '@/context/AceContext';
import { cn } from '@/lib/utils';

const TOOL_ICONS = {
  '/bybit-eu': '🇪🇺', '/eu-live-chat': '🇪🇺', '/bybit-global': '🌍', '/global-live-chat': '🌍',
  '/personal': '✦', '/p2p-dispute': '⚖️', '/missing-deposit': '💸', '/hack-case': '🔴',
  '/account-matters': '👤', '/card-decline': '💳', '/sepa-delay': '💶', '/quick-lookup': '⚡',
  '/translate': '🌐', '/quality-check': '🎯', '/shift-tracker': '📊', '/chain-lookup': '🔗',
};

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function relTime(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m ago`;
}

const VIP_LABELS = ['', 'VIP 1', 'VIP 2', 'VIP 3', 'VIP 4', 'VIP 5'];

// Risk-associated tools
const RISK_TOOLS = ['/hack-case', '/p2p-dispute', '/account-matters', '/missing-deposit'];

function HealthRadar({ uid }) {
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    if (!uid) { setMetrics(null); return; }
    (async () => {
      const userCases = await getCasesByUID(uid);
      if (!userCases.length) { setMetrics(null); return; }
      const volume = Math.min(5, userCases.length);
      const riskCases = userCases.filter(c => RISK_TOOLS.includes(c.tool));
      const risk = Math.min(5, riskCases.length);
      const withNotes = userCases.filter(c => c.notes?.trim());
      const reliability = userCases.length > 0 ? Math.round((withNotes.length / userCases.length) * 5) : 0;
      setMetrics({ volume, risk, reliability, total: userCases.length });
    })();
  }, [uid]);

  if (!metrics) return null;

  const bars = [
    { label: 'Volume', value: metrics.volume, color: 'bg-cyan-400', desc: `${metrics.total} cases` },
    { label: 'Risk', value: metrics.risk, color: metrics.risk >= 3 ? 'bg-crit' : 'bg-hero', desc: `${metrics.risk} flags` },
    { label: 'Resolved', value: metrics.reliability, color: 'bg-emerald-400', desc: `${metrics.reliability}/5` },
  ];

  return (
    <div className="px-4 py-3 border-b border-border-0 space-y-2">
      <div className="flex items-center gap-2">
        <Shield size={11} className="text-cyan-400" />
        <span className="text-[10px] font-semibold text-fg-1 uppercase tracking-wider">Health Radar</span>
      </div>
      {bars.map(b => (
        <div key={b.label} className="flex items-center gap-2">
          <span className="text-[10px] text-fg-2 w-14 shrink-0">{b.label}</span>
          <div className="flex-1 h-1.5 bg-bg-2 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-500', b.color)}
              style={{ width: `${(b.value / 5) * 100}%` }}
            />
          </div>
          <span className="text-[10px] text-fg-2 w-12 text-right shrink-0">{b.desc}</span>
        </div>
      ))}
    </div>
  );
}

export default function CaseTimeline() {
  const { parsedData } = useAce();
  const [open, setOpen] = useState(false);
  const [cases, setCases] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [restored, setRestored] = useState(null); // { count, ts } on successful restore

  // Poll IndexedDB every 30s when panel is open
  useEffect(() => {
    if (!open) return;
    async function load() {
      const recent = await getRecentCases(4);
      setCases(recent);
    }
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [open]);

  // ── Black Box Export: bundle cases into downloadable JSON ────────────────────
  const handleExportSnapshot = useCallback(() => {
    if (cases.length === 0 || exporting) return;
    setExporting(true);
    try {
      const snapshot = {
        exportedAt: new Date().toISOString(),
        agentSession: sessionStorage.getItem('ace_terminal_unlocked') === '1' ? 'authenticated' : 'unknown',
        caseCount: cases.length,
        windowHours: 4,
        cases: cases.map(c => ({
          id: c.id,
          tool: c.tool || 'unknown',
          vipLevel: c.vipLevel || 0,
          timestamp: new Date(c.ts).toISOString(),
          uid: c.uid || null,
          channel: c.channel || null,
          summary: c.summary || null,
        })),
      };
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ace-snapshot-${ts}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setTimeout(() => setExporting(false), 1500);
    }
  }, [cases, exporting]);

  // ── Case Re-Hydrator: drag-and-drop JSON restore ───────────────────────────
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (!file || !file.name.endsWith('.json')) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.cases || !Array.isArray(data.cases)) return;
        const hydrated = data.cases.map(c => ({
          id: c.id || Date.now() + Math.random(),
          tool: c.tool || 'unknown',
          vipLevel: c.vipLevel || 0,
          ts: c.timestamp ? new Date(c.timestamp).getTime() : Date.now(),
          uid: c.uid || '',
          channel: c.channel || '',
          summary: c.summary || '',
        }));
        setCases(hydrated);
        setRestored({ count: hydrated.length, ts: data.exportedAt || 'unknown' });
        setTimeout(() => setRestored(null), 4000);
      } catch { /* invalid JSON — silently ignore */ }
    };
    reader.readAsText(file);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  return (
    <>
      {/* Trigger button — fixed right side of screen */}
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'fixed top-1/2 right-0 -translate-y-1/2 z-30 flex flex-col items-center justify-center gap-1',
          'w-7 h-20 rounded-l-lg border border-r-0 text-xs transition-colors duration-150',
          open
            ? 'bg-hero/15 border-hero/30 text-hero'
            : 'bg-bg-1 border-border-0 text-fg-2 hover:text-fg-1'
        )}
        aria-label="Toggle Case Timeline"
        title="Case Timeline — last 4 hours"
      >
        <Clock size={12} />
        <span style={{ writingMode: 'vertical-rl', fontSize: 9, letterSpacing: 1 }}>HUD</span>
      </button>

      {/* Slide-in panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ x: 320 }}
            animate={{ x: 0 }}
            exit={{ x: 320 }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            className={cn(
              'fixed top-0 right-0 h-full w-72 z-30 bg-bg-0 border-l flex flex-col shadow-2xl transition-colors duration-200',
              dragOver ? 'border-hero/60' : 'border-border-0'
            )}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-0 shrink-0">
              <div>
                <h2 className="text-sm font-semibold text-fg-0 flex items-center gap-2">
                  <Clock size={13} className="text-hero" />
                  Case Timeline
                </h2>
                <p className="text-xs text-fg-2 mt-0.5">Last 4 hours · {cases.length} events</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-fg-2 hover:text-fg-1 flex items-center justify-center w-7 h-7 rounded-lg hover:bg-bg-2 transition-colors duration-150"
                aria-label="Close timeline"
              >
                <X size={13} />
              </button>
            </div>

            {/* Drag-over overlay */}
            {dragOver && (
              <div className="absolute inset-0 z-10 bg-hero/5 border-2 border-dashed border-hero/40 rounded-xl flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <Upload size={24} className="text-hero mx-auto mb-2" />
                  <p className="text-xs text-hero font-medium">Drop JSON to restore</p>
                </div>
              </div>
            )}

            {/* Restored feedback banner */}
            <AnimatePresence>
              {restored && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-4 py-2 bg-hero/10 border-b border-hero/20 text-center overflow-hidden"
                >
                  <p className="text-xs text-hero font-medium">
                    Restored {restored.count} case{restored.count !== 1 ? 's' : ''} from snapshot
                  </p>
                  <p className="text-[10px] text-hero/60 mt-0.5">Exported: {restored.ts}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Health Radar — active UID */}
            {parsedData?.uid && <HealthRadar uid={parsedData.uid} />}

            {/* Timeline */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {cases.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-12">
                  <Clock size={28} className="text-fg-3" />
                  <p className="text-xs text-fg-2">No cases in the last 4 hours.<br />Events appear as you work.</p>
                </div>
              ) : (
                cases.map((c, i) => {
                  const isVIP5 = c.vipLevel >= 5;
                  const isVIP3 = c.vipLevel >= 3;
                  const icon = TOOL_ICONS[c.tool] || '🗂️';
                  return (
                    <motion.div
                      key={c.id ?? i}
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30, delay: i * 0.03 }}
                      className={cn(
                        'relative flex items-start gap-3 px-3 py-2.5 rounded-xl border text-xs transition-colors duration-150',
                        isVIP5
                          ? 'bg-hero/10 border-hero/40'
                          : isVIP3
                          ? 'bg-hero/5 border-hero/20'
                          : 'bg-bg-1 border-border-0'
                      )}
                      style={isVIP5 ? { boxShadow: '0 0 16px rgba(250,204,21,0.25)' } : {}}
                    >
                      <span className="text-base shrink-0 mt-0.5">{icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className={cn('font-medium truncate', isVIP5 ? 'text-hero' : 'text-fg-1')}>
                            {c.tool?.replace('/', '').replace(/-/g, ' ') || 'case'}
                          </span>
                          {c.vipLevel > 0 && (
                            <span className={cn(
                              'text-xs px-1.5 py-0.5 rounded font-bold shrink-0',
                              isVIP5 ? 'bg-hero/30 text-hero' :
                              isVIP3 ? 'bg-hero/15 text-hero' :
                              'bg-info/20 text-info'
                            )}>
                              {VIP_LABELS[c.vipLevel]}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-fg-2">
                          <span>{formatTime(c.ts)}</span>
                          <ChevronRight size={9} />
                          <span>{relTime(c.ts)}</span>
                        </div>
                        {c.uid && <span className="text-fg-3 font-mono text-[10px]">{scrubPII(c.uid)}</span>}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-border-0 shrink-0 space-y-2">
              {cases.length > 0 && (
                <button
                  onClick={handleExportSnapshot}
                  disabled={exporting}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors duration-150',
                    exporting
                      ? 'bg-hero/10 text-hero/60 cursor-not-allowed'
                      : 'bg-bg-2 text-fg-1 hover:bg-hero/15 hover:text-hero cursor-pointer'
                  )}
                  aria-label="Save Case Snapshot"
                >
                  <Download size={12} />
                  {exporting ? 'Saved' : 'Save Case Snapshot'}
                </button>
              )}
              <p className="text-xs text-fg-3 text-center">Events sourced from IndexedDB · zero PII</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
