import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, AlertTriangle, Globe, Scale, FlaskConical, Loader2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

const RISK_STYLES = {
  low: 'bg-ok/20 text-ok',
  medium: 'bg-amber-500/20 text-amber-400',
  high: 'bg-crit/20 text-crit',
};

/**
 * The Council — a single compact corner badge on each assistant message that
 * unifies the NVIDIA QA critic, its second-opinion cross-check (auto-fired
 * only when risk is flagged), and the live web-knowledge lookup into one
 * violet-branded verdict + expandable detail card. Renders nothing until the
 * QA critic has something to show (critic disabled, or draft too short).
 */
export default function CouncilBadge({ qa, web, crossCheck }) {
  const [open, setOpen] = useState(false);
  if (!qa) return null;

  const loading = qa.loading || web?.loading || crossCheck?.loading;
  const flagged = qa.risk && qa.risk !== 'low';

  const Icon = loading ? Loader2 : flagged ? AlertTriangle : web?.data ? Globe : ShieldCheck;
  const iconColor = loading ? 'text-violet-300' : flagged ? 'text-amber-400' : 'text-violet-400';

  return (
    <div className="relative self-start">
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="The Council — QA review, sourcing, and verdicts"
        className={cn(
          'flex items-center justify-center w-5 h-5 rounded-full bg-bg-1/90 backdrop-blur-md border transition-colors duration-150',
          flagged ? 'border-amber-500/40' : 'border-violet-500/30 hover:border-violet-400/60'
        )}
      >
        <Icon size={11} className={cn(iconColor, loading && 'animate-spin')} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            className="overflow-hidden"
          >
            <div className="mt-1 px-3 py-2 rounded-lg bg-violet-500/[0.06] border border-violet-500/20 text-xs space-y-2 w-[min(420px,calc(100vw-3rem))]">
              <div className="flex items-center gap-1.5 text-violet-400 font-medium">
                <Scale size={11} />
                <span>The Council — external, advisory, never auto-sent</span>
              </div>

              <CouncilRow icon={FlaskConical} label="QA Critic" color="text-violet-300">
                {qa.risk && (
                  <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded uppercase mb-1 inline-block', RISK_STYLES[qa.risk])}>
                    {qa.risk} risk
                  </span>
                )}
                {qa.loading && <Loading text="Reviewing draft…" />}
                {qa.error && <p className="text-fg-2">Critique unavailable — {qa.error}</p>}
                {qa.text && <p className="text-fg-1 whitespace-pre-wrap">{qa.text}</p>}
              </CouncilRow>

              {crossCheck && (
                <CouncilRow icon={Scale} label="Second Opinion" color="text-amber-400">
                  {crossCheck.loading && <Loading text="Getting a second opinion…" />}
                  {crossCheck.error && <p className="text-fg-2">Unavailable — {crossCheck.error}</p>}
                  {crossCheck.text && <p className="text-fg-1 whitespace-pre-wrap">{crossCheck.text}</p>}
                </CouncilRow>
              )}

              {web && (
                <CouncilRow icon={Globe} label="Web Knowledge" color="text-info">
                  {web.loading && <Loading text="Searching the web…" />}
                  {web.error && <p className="text-fg-2">{web.error}</p>}
                  {web.data && (
                    <div className="space-y-1.5">
                      <p className="text-fg-1 whitespace-pre-wrap">{web.data.answer}</p>
                      {web.data.sources?.length > 0 && (
                        <div className="flex flex-col gap-0.5 pt-1 border-t border-info/10">
                          {web.data.sources.map((s, idx) => (
                            <a
                              key={idx}
                              href={s.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-info/80 hover:text-info hover:underline truncate"
                            >
                              <ExternalLink size={9} className="shrink-0" />
                              <span className="truncate">[{idx + 1}] {s.title}</span>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CouncilRow>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CouncilRow({ icon: RowIcon, label, color, children }) {
  return (
    <div className="pt-1.5 border-t border-violet-500/10 first:pt-0 first:border-t-0">
      <div className={cn('flex items-center gap-1.5 font-medium mb-1', color)}>
        <RowIcon size={11} />
        <span>{label}</span>
      </div>
      {children}
    </div>
  );
}

function Loading({ text }) {
  return (
    <div className="flex items-center gap-1.5 text-fg-2">
      <Loader2 size={11} className="animate-spin" /> {text}
    </div>
  );
}
