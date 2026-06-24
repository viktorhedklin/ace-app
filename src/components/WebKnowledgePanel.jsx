import { useState } from 'react';
import { Globe, X, Loader2, ExternalLink } from 'lucide-react';

/**
 * Dismissible panel for the opt-in NVIDIA + Brave web-knowledge injector.
 * Distinct (blue/external) styling from KB-grounded answers — this is
 * unverified third-party content and must never be auto-inserted into a
 * customer-facing reply. Agent copies it manually if they choose to use it.
 */
export default function WebKnowledgePanel({ loading, data, error }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || (!loading && !data && !error)) return null;

  return (
    <div className="mt-1 px-3 py-2 rounded-lg bg-info/[0.06] border border-info/25 text-xs relative">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-1.5 right-1.5 text-fg-2 hover:text-fg-0 transition-colors duration-150"
        aria-label="Dismiss web-knowledge suggestion"
      >
        <X size={11} />
      </button>
      <div className="flex items-center gap-1.5 text-info font-medium mb-1 pr-4">
        <Globe size={11} />
        <span>External source — verify before sending</span>
      </div>
      {loading && (
        <div className="flex items-center gap-1.5 text-fg-2">
          <Loader2 size={11} className="animate-spin" /> Searching the web…
        </div>
      )}
      {error && <p className="text-fg-2">{error}</p>}
      {data && (
        <div className="space-y-1.5">
          <p className="text-fg-1 whitespace-pre-wrap pr-4">{data.answer}</p>
          {data.sources?.length > 0 && (
            <div className="flex flex-col gap-0.5 pt-1 border-t border-info/10">
              {data.sources.map((s, i) => (
                <a
                  key={i}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-info/80 hover:text-info hover:underline truncate"
                >
                  <ExternalLink size={9} className="shrink-0" />
                  <span className="truncate">[{i + 1}] {s.title}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
