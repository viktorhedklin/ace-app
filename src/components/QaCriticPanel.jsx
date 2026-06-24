import { useState } from 'react';
import { Sparkles, X, Loader2 } from 'lucide-react';

/**
 * Dismissible side-panel showing the NVIDIA QA critic's take on a drafted
 * reply. Purely advisory — never auto-inserted into the outgoing message.
 * Renders nothing once dismissed or before there's anything to show.
 */
export default function QaCriticPanel({ loading, text, error }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || (!loading && !text && !error)) return null;

  return (
    <div className="mt-1 px-3 py-2 rounded-lg bg-amber-500/[0.06] border border-amber-500/20 text-xs relative">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-1.5 right-1.5 text-fg-2 hover:text-fg-0 transition-colors duration-150"
        aria-label="Dismiss QA suggestion"
      >
        <X size={11} />
      </button>
      <div className="flex items-center gap-1.5 text-amber-400 font-medium mb-1 pr-4">
        <Sparkles size={11} />
        <span>NVIDIA QA critic — external, unverified</span>
      </div>
      {loading && (
        <div className="flex items-center gap-1.5 text-fg-2">
          <Loader2 size={11} className="animate-spin" /> Reviewing draft…
        </div>
      )}
      {error && <p className="text-fg-2">Critique unavailable — {error}</p>}
      {text && <p className="text-fg-1 whitespace-pre-wrap pr-4">{text}</p>}
    </div>
  );
}
