import { useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { pushEntry } from '@/lib/qaMemory';
import { cn } from '@/lib/utils';

/**
 * Thumbs up/down rating on assistant messages. Stores feedback to
 * qaMemory so it feeds into trajectory.buildCoachContext + the dynamic
 * system prompt. Closes the QA feedback loop — previously drafts were
 * just rendered and forgotten.
 *
 * A thumbs-down prompts for a one-line reason (optional) and records as
 * a QA issue so getRecurringQAIssues() will surface the pattern.
 */
export default function DraftRating({ messageContent, messageIndex }) {
  const [rating, setRating] = useState(null); // 'up' | 'down' | null
  const [reason, setReason] = useState('');
  const [askingReason, setAskingReason] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleUp() {
    if (rating) return;
    setRating('up');
    await pushEntry({
      ts: Date.now(),
      rating: 'up',
      sourceEntry: { issues: [] },
      body: `✓ Agent marked draft as good: ${messageContent.slice(0, 120).replace(/\s+/g, ' ')}...`,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  async function handleDown() {
    if (rating) return;
    setAskingReason(true);
  }

  async function submitDown() {
    setRating('down');
    setAskingReason(false);
    const trimmed = reason.trim();
    await pushEntry({
      ts: Date.now(),
      rating: 'down',
      sourceEntry: {
        issues: trimmed ? [trimmed] : ['agent flagged draft as flopped (no reason given)'],
      },
      body: `✗ Agent marked draft as flopped${trimmed ? `: ${trimmed}` : ''}. Draft preview: ${messageContent.slice(0, 100).replace(/\s+/g, ' ')}...`,
    });
    setReason('');
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  if (askingReason) {
    return (
      <div className="mt-1 flex items-center gap-1.5 px-1">
        <input
          autoFocus
          value={reason}
          onChange={e => setReason(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') submitDown();
            if (e.key === 'Escape') { setAskingReason(false); setReason(''); }
          }}
          placeholder="What was off? (enter to save, esc to cancel)"
          className="flex-1 text-[11px] bg-bg-2 border border-crit/30 rounded px-2 py-1 text-fg-0 focus:outline-none focus:border-crit/60"
        />
        <button
          onClick={submitDown}
          className="text-[11px] text-crit hover:text-crit/80 px-2"
          aria-label="Save feedback"
        >
          save
        </button>
      </div>
    );
  }

  return (
    <div className="mt-1 flex items-center gap-2 px-1">
      <button
        onClick={handleUp}
        disabled={!!rating}
        className={cn(
          'text-fg-2 hover:text-ok transition-colors duration-150 disabled:opacity-30 disabled:cursor-default',
          rating === 'up' && 'text-ok'
        )}
        aria-label="Draft worked"
        title="Worked — reinforce this pattern"
      >
        <ThumbsUp size={12} />
      </button>
      <button
        onClick={handleDown}
        disabled={!!rating}
        className={cn(
          'text-fg-2 hover:text-crit transition-colors duration-150 disabled:opacity-30 disabled:cursor-default',
          rating === 'down' && 'text-crit'
        )}
        aria-label="Draft flopped"
        title="Flopped — feed back to trajectory coach"
      >
        <ThumbsDown size={12} />
      </button>
      {saved && <span className="text-[10px] text-ok">saved</span>}
    </div>
  );
}
