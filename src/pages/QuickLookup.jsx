import { useState } from 'react';
import { InvokeLLM } from '@/api/integrations';
import { BYBIT_KB, DOMAINS, DOMAIN_COLORS } from '@/data/bybitKB';
import { Search, Loader2, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

function ResultBlock({ text }) {
  return (
    <div className="space-y-1">
      {text.split('\n').map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-2" />;
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <p key={i} className="text-sm text-slate-300 leading-relaxed">
            {parts.map((part, j) =>
              part.startsWith('**') && part.endsWith('**')
                ? <strong key={j} className="text-slate-100 font-semibold">{part.slice(2, -2)}</strong>
                : <span key={j}>{part}</span>
            )}
          </p>
        );
      })}
    </div>
  );
}

// KB quick-hit card — shows matching article inline without opening the KB
function KBHit({ article }) {
  const [open, setOpen] = useState(false);
  const colors = DOMAIN_COLORS[article.domainColor];
  const domainMeta = DOMAINS.find(d => d.id === article.domain);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-start gap-3 px-4 py-3 text-left cursor-pointer hover:bg-slate-800/40 transition-colors duration-150"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="text-base shrink-0 mt-0.5">{domainMeta?.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded border', colors.bg, colors.text, colors.border)}>
              {article.domain}
            </span>
            <span className="text-xs text-slate-400 font-medium">{article.title}</span>
          </div>
          <p className="text-xs text-slate-600">{article.subtitle}</p>
        </div>
        {open ? <ChevronUp size={14} className="text-slate-600 shrink-0 mt-1" /> : <ChevronDown size={14} className="text-slate-600 shrink-0 mt-1" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-800/60">
          <ul className="pt-3 space-y-1.5">
            {article.keyPoints.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                <span className={cn('shrink-0 mt-0.5', colors.text)}>→</span> {p}
              </li>
            ))}
          </ul>
          {article.agentTips?.length > 0 && (
            <div className="bg-yellow-400/5 border border-yellow-400/15 rounded-lg p-2.5 space-y-1">
              {article.agentTips.map((t, i) => (
                <p key={i} className="text-xs text-yellow-400/80 flex items-start gap-1.5">
                  <span className="shrink-0">✦</span> {t}
                </p>
              ))}
            </div>
          )}
          <a href={article.url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-yellow-400 transition-colors duration-150">
            Open in Bybit Help Center <ExternalLink size={11} />
          </a>
        </div>
      )}
    </div>
  );
}

// Domain-grouped quick topics seeded from KB
const DOMAIN_TOPICS = DOMAINS.map(domain => ({
  ...domain,
  topics: BYBIT_KB
    .filter(a => a.domain === domain.id)
    .map(a => ({ label: a.title, query: a.title, articleId: a.id })),
}));

// Additional ad-hoc topics not covered by the KB articles
const EXTRA_TOPICS = [
  'P2P frozen ad', 'Futures liquidation', 'API key setup',
  'Referral program', 'Spot trading fees', 'Withdrawal limits',
];

export default function QuickLookup() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [kbHits, setKbHits] = useState([]);
  const [activeDomain, setActiveDomain] = useState(null);

  function findKBHits(text) {
    const lower = text.toLowerCase();
    return BYBIT_KB.filter(a =>
      a.title.toLowerCase().includes(lower) ||
      a.subtitle.toLowerCase().includes(lower) ||
      a.domain.toLowerCase().includes(lower) ||
      a.keyPoints.some(kp => kp.toLowerCase().includes(lower))
    ).slice(0, 3);
  }

  async function lookup(q) {
    const text = (q || query).trim();
    if (!text) return;

    // Instant KB hits — no API call needed for these
    const hits = findKBHits(text);
    setKbHits(hits);

    setLoading(true);
    setResult('');
    try {
      const res = await InvokeLLM({
        prompt: `A Bybit live chat agent needs help with: "${text}". Provide a concise SOP/policy card covering: 1) What this is, 2) Step-by-step action, 3) Key policies/limits to know, 4) What to tell the customer. Format clearly with headers.`,
        system_prompt: 'You are a Bybit expert with full knowledge of all SOPs, policies, and customer service procedures. Provide accurate, actionable guidance for support agents.',
      });
      setResult(res);
    } catch {
      setResult('⚠️ Could not retrieve SOP. Check connection and try again.');
    }
    setLoading(false);
  }

  const displayTopics = activeDomain
    ? (DOMAIN_TOPICS.find(d => d.id === activeDomain)?.topics || [])
    : null;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Quick Lookup</h1>
        <p className="text-sm text-slate-500">Instant SOP cards + Bybit KB hits for any issue</p>
      </div>

      {/* Search bar */}
      <div className="flex gap-2">
        <div className="flex-1 flex items-center gap-2 bg-slate-900 border border-slate-700 focus-within:border-yellow-400/50 rounded-xl px-4 py-3 transition-colors duration-150">
          <Search size={16} className="text-slate-500 shrink-0" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && lookup()}
            placeholder="e.g. KYC failed, missing ETH deposit, P2P scam, card declined..."
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 outline-none"
          />
        </div>
        <button
          onClick={() => lookup()}
          disabled={!query.trim() || loading}
          className="bg-yellow-400 hover:bg-yellow-300 disabled:bg-slate-700 text-slate-900 disabled:text-slate-500 font-medium px-5 rounded-xl transition-colors duration-150 text-sm min-w-[80px] flex items-center justify-center"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : 'Look up'}
        </button>
      </div>

      {/* Domain filter */}
      <div className="space-y-2">
        <p className="text-xs text-slate-600">Browse by topic</p>
        <div className="flex flex-wrap gap-2">
          {DOMAINS.map(d => {
            const colors = DOMAIN_COLORS[d.color];
            const active = activeDomain === d.id;
            return (
              <button
                key={d.id}
                onClick={() => setActiveDomain(active ? null : d.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150 cursor-pointer',
                  active
                    ? cn(colors.bg, colors.text, colors.border)
                    : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300 hover:border-slate-700'
                )}
              >
                <span>{d.icon}</span> {d.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Domain topics OR extra quick topics */}
      {displayTopics ? (
        <div className="space-y-1.5">
          {displayTopics.map(t => (
            <button
              key={t.articleId}
              onClick={() => { setQuery(t.label); lookup(t.label); }}
              className="w-full text-left text-xs bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 px-3 py-2 rounded-lg transition-colors duration-150 border border-slate-700"
            >
              {t.label}
            </button>
          ))}
        </div>
      ) : (
        <div>
          <p className="text-xs text-slate-600 mb-2">Common topics</p>
          <div className="flex flex-wrap gap-2">
            {EXTRA_TOPICS.map(t => (
              <button
                key={t}
                onClick={() => { setQuery(t); lookup(t); }}
                className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg transition-colors duration-150 border border-slate-700"
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Instant KB hits */}
      {kbHits.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <span className="text-yellow-400">⚡</span> Matching Bybit articles
          </p>
          {kbHits.map(article => (
            <KBHit key={article.id} article={article} />
          ))}
        </div>
      )}

      {/* AI result */}
      {loading && (
        <div className="flex items-center gap-3 text-slate-500 py-8 justify-center">
          <Loader2 size={20} className="animate-spin text-yellow-400" />
          <span className="text-sm">Generating SOP card...</span>
        </div>
      )}
      {result && !loading && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <p className="text-xs text-slate-600 mb-3 flex items-center gap-1.5">
            <span className="text-yellow-400">✦</span> Ace SOP card
          </p>
          <ResultBlock text={result} />
        </div>
      )}
    </div>
  );
}
