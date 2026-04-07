import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, X, ChevronRight } from 'lucide-react';
import { getRecentCases } from '@/lib/caseMemory';
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

export default function CaseTimeline() {
  const [open, setOpen] = useState(false);
  const [cases, setCases] = useState([]);

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

  return (
    <>
      {/* Trigger button — fixed right side of screen */}
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'fixed top-1/2 right-0 -translate-y-1/2 z-30 flex flex-col items-center justify-center gap-1',
          'w-7 h-20 rounded-l-lg border border-r-0 text-xs transition-colors duration-150',
          open
            ? 'bg-yellow-400/15 border-yellow-400/30 text-yellow-400'
            : 'bg-slate-900 border-slate-700 text-slate-600 hover:text-slate-400'
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
            className="fixed top-0 right-0 h-full w-72 z-30 bg-slate-950 border-l border-slate-800 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0">
              <div>
                <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Clock size={13} className="text-yellow-400" />
                  Case Timeline
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">Last 4 hours · {cases.length} events</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-600 hover:text-slate-400 flex items-center justify-center w-7 h-7 rounded-lg hover:bg-slate-800 transition-colors duration-150"
                aria-label="Close timeline"
              >
                <X size={13} />
              </button>
            </div>

            {/* Timeline */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {cases.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-12">
                  <Clock size={28} className="text-slate-700" />
                  <p className="text-xs text-slate-600">No cases in the last 4 hours.<br />Events appear as you work.</p>
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
                          ? 'bg-yellow-400/10 border-yellow-400/40'
                          : isVIP3
                          ? 'bg-yellow-400/5 border-yellow-400/20'
                          : 'bg-slate-900 border-slate-800'
                      )}
                      style={isVIP5 ? { boxShadow: '0 0 16px rgba(250,204,21,0.25)' } : {}}
                    >
                      <span className="text-base shrink-0 mt-0.5">{icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className={cn('font-medium truncate', isVIP5 ? 'text-yellow-300' : 'text-slate-300')}>
                            {c.tool?.replace('/', '').replace(/-/g, ' ') || 'case'}
                          </span>
                          {c.vipLevel > 0 && (
                            <span className={cn(
                              'text-xs px-1.5 py-0.5 rounded font-bold shrink-0',
                              isVIP5 ? 'bg-yellow-400/30 text-yellow-300' :
                              isVIP3 ? 'bg-yellow-400/15 text-yellow-400' :
                              'bg-blue-500/20 text-blue-400'
                            )}>
                              {VIP_LABELS[c.vipLevel]}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-slate-600">
                          <span>{formatTime(c.ts)}</span>
                          <ChevronRight size={9} />
                          <span>{relTime(c.ts)}</span>
                        </div>
                        {c.uid && <span className="text-slate-700 font-mono text-[10px]">{c.uid}</span>}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-slate-800 shrink-0">
              <p className="text-xs text-slate-700 text-center">Events sourced from IndexedDB · zero PII</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
