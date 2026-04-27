import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { checkMessageLinks } from '@/lib/linkHealth';

/**
 * Renders a warning pill under an assistant message if any Bybit help-center
 * link in the message is dead. Runs async — never blocks the message from
 * showing. Silent when all links are healthy or no links are present.
 */
export default function LinkHealthBadge({ content, streaming }) {
  const [dead, setDead] = useState([]);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (streaming || !content) return;
    let cancelled = false;
    checkMessageLinks(content).then(({ dead }) => {
      if (!cancelled) {
        setDead(dead);
        setChecked(true);
      }
    });
    return () => { cancelled = true; };
  }, [content, streaming]);

  if (!checked || dead.length === 0) return null;

  return (
    <div className="mt-1 flex items-start gap-1.5 text-[11px] text-crit/80 px-1" role="alert">
      <AlertTriangle size={12} className="mt-0.5 shrink-0" />
      <div className="flex-1">
        <span className="font-medium">
          {dead.length === 1 ? 'Cited link appears dead' : `${dead.length} cited links appear dead`} —
          verify before sending:
        </span>
        <ul className="mt-0.5 space-y-0.5">
          {dead.map(url => (
            <li key={url}>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-crit break-all"
              >
                {url}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
