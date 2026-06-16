import { useState, useMemo } from 'react';
import { MODEL_CATALOG, FEATURE_LABELS, getUsageStats, clearUsage, getCostMode, setCostMode, getProvider, setProvider } from '@/api/claude';
import { getApiKey } from '@/api/claude';
import { getOpenAIKey } from '@/api/openai';
import { getAlibabaKey } from '@/api/alibaba';
import { Check, Trash2, Zap, Scale, Leaf, BarChart3, DollarSign, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

const SCORE_COLORS = ['', 'bg-crit/30 text-crit', 'bg-warn/25 text-warn', 'bg-hero-soft/20 text-hero', 'bg-emerald-500/20 text-emerald-300', 'bg-emerald-500/35 text-emerald-200'];
const SCORE_LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Best'];

const COST_MODES = [
  { key: 'performance', label: 'Performance', icon: Zap, desc: 'Best model everywhere', color: 'text-warn', bg: 'bg-orange-400/10 border-orange-400/30' },
  { key: 'balanced', label: 'Balanced', icon: Scale, desc: 'Smart tiering per feature', color: 'text-hero', bg: 'bg-hero/10 border-hero/30' },
  { key: 'economy', label: 'Economy', icon: Leaf, desc: 'Cheapest viable option', color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/30' },
];

const PROVIDERS = [
  { key: 'alibaba', label: 'Alibaba Cloud', icon: '🔶', models: 'Qwen3.7 · DeepSeek' },
  { key: 'anthropic', label: 'Anthropic', icon: '🟣', models: 'Opus · Sonnet' },
  { key: 'openai', label: 'OpenAI', icon: '🟢', models: 'GPT-5.4 · GPT-5.4 Mini · GPT-4.1' },
];

function providerIcon(p) {
  if (p === 'openai') return '🟢';
  if (p === 'alibaba') return '🔶';
  return '🟣';
}

function ScoreBadge({ score }) {
  return (
    <span className={cn('inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold', SCORE_COLORS[score] || 'bg-bg-2 text-fg-2')}>
      {score}
    </span>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <div className="bg-bg-1 border border-border-0 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border-0 flex items-center gap-2">
        {Icon && <Icon size={15} className="text-hero" />}
        <h2 className="font-semibold text-fg-0 text-sm">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function UsageSection() {
  const [usage, setUsage] = useState(getUsageStats);
  const days = Object.keys(usage).sort().reverse();

  const totals = useMemo(() => {
    const result = {};
    for (const day of days) {
      for (const [modelId, data] of Object.entries(usage[day])) {
        if (!result[modelId]) result[modelId] = { input: 0, output: 0, calls: 0, cost: 0, cacheCreate: 0, cacheRead: 0, costNoCache: 0 };
        const catalog = MODEL_CATALOG.find(m => m.id === modelId);
        result[modelId].input += data.input;
        result[modelId].output += data.output;
        result[modelId].calls += data.calls;
        result[modelId].cacheCreate += data.cacheCreate || 0;
        result[modelId].cacheRead += data.cacheRead || 0;
        if (catalog) {
          // Anthropic pricing: cache writes = 1.25x input, cache reads = 0.1x input.
          // Actual cost uses the standard rates on non-cached tokens only — cache
          // tokens are billed separately by Anthropic. data.input already excludes
          // cached tokens, so regular cost is accurate.
          const inP = catalog.inputPrice / 1_000_000;
          const outP = catalog.outputPrice / 1_000_000;
          const actual = data.input * inP + data.output * outP
            + (data.cacheCreate || 0) * inP * 1.25
            + (data.cacheRead || 0) * inP * 0.1;
          const wouldHaveBeen = (data.input + (data.cacheCreate || 0) + (data.cacheRead || 0)) * inP + data.output * outP;
          result[modelId].cost += actual;
          result[modelId].costNoCache += wouldHaveBeen;
        }
      }
    }
    return result;
  }, [usage, days]);

  const totalCost = Object.values(totals).reduce((sum, t) => sum + t.cost, 0);
  const totalCalls = Object.values(totals).reduce((sum, t) => sum + t.calls, 0);
  const totalCacheRead = Object.values(totals).reduce((sum, t) => sum + t.cacheRead, 0);
  const totalCacheCreate = Object.values(totals).reduce((sum, t) => sum + t.cacheCreate, 0);
  const totalInput = Object.values(totals).reduce((sum, t) => sum + t.input, 0);
  const cacheHitPct = (totalInput + totalCacheRead) > 0
    ? Math.round((totalCacheRead / (totalInput + totalCacheRead)) * 100)
    : 0;
  const totalSaved = Object.values(totals).reduce((sum, t) => sum + (t.costNoCache - t.cost), 0);

  if (!days.length) {
    return (
      <Section title="Usage & Cost" icon={BarChart3}>
        <p className="text-sm text-fg-2">No usage data yet. Start using ACE and token counts will appear here.</p>
      </Section>
    );
  }

  return (
    <Section title="Usage & Cost (last 30 days)" icon={BarChart3}>
      <div className="space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-bg-2 rounded-lg px-4 py-3 text-center">
            <p className="text-xs text-fg-2">Total cost</p>
            <p className="text-lg font-bold text-hero">${totalCost.toFixed(2)}</p>
          </div>
          <div className="bg-bg-2 rounded-lg px-4 py-3 text-center">
            <p className="text-xs text-fg-2">API calls</p>
            <p className="text-lg font-bold text-fg-0">{totalCalls.toLocaleString()}</p>
          </div>
          <div className="bg-bg-2 rounded-lg px-4 py-3 text-center" title="% of input tokens that came from cache. Higher = cheaper.">
            <p className="text-xs text-fg-2">Cache hit</p>
            <p className="text-lg font-bold text-ok">{cacheHitPct}%</p>
          </div>
          <div className="bg-bg-2 rounded-lg px-4 py-3 text-center" title="Estimated savings from prompt caching vs. no-cache baseline.">
            <p className="text-xs text-fg-2">Saved</p>
            <p className="text-lg font-bold text-ok">${totalSaved.toFixed(2)}</p>
          </div>
        </div>

        {(totalCacheRead > 0 || totalCacheCreate > 0) && (
          <p className="text-[11px] text-fg-2 px-1">
            Cache: {(totalCacheRead / 1000).toFixed(1)}K tokens read from cache,
            {' '}{(totalCacheCreate / 1000).toFixed(1)}K written.
            {days.length} days tracked.
          </p>
        )}

        {/* Per-model breakdown */}
        <div className="space-y-2">
          {Object.entries(totals).sort((a, b) => b[1].cost - a[1].cost).map(([modelId, data]) => {
            const catalog = MODEL_CATALOG.find(m => m.id === modelId);
            return (
              <div key={modelId} className="flex items-center justify-between bg-bg-2/50 rounded-lg px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="text-sm">{providerIcon(catalog?.provider)}</span>
                  <div>
                    <p className="text-sm text-fg-0">{catalog?.name || modelId}</p>
                    <p className="text-xs text-fg-2">{data.calls} calls · {((data.input + data.output) / 1000).toFixed(1)}K tokens</p>
                  </div>
                </div>
                <p className="text-sm font-mono font-medium text-fg-1">${data.cost.toFixed(2)}</p>
              </div>
            );
          })}
        </div>

        <button
          onClick={() => { if (window.confirm('Clear all usage data?')) { clearUsage(); setUsage({}); } }}
          className="flex items-center gap-1.5 text-xs text-fg-2 hover:text-crit transition-colors cursor-pointer"
          aria-label="Clear usage data"
        >
          <Trash2 size={11} /> Clear usage data
        </button>
      </div>
    </Section>
  );
}

export default function Models() {
  const [costMode, setCostModeState] = useState(getCostMode);
  const [provider, setProviderState] = useState(getProvider);
  const hasAnthropicKey = !!getApiKey();
  const hasOpenAIKey = !!getOpenAIKey();
  const hasAlibabaKey = !!getAlibabaKey();

  function pickMode(key) { setCostMode(key); setCostModeState(key); }
  function pickProvider(key) { setProvider(key); setProviderState(key); }

  // Determine active models based on current settings
  const activeModels = useMemo(() => {
    const p = provider;
    const m = costMode;
    if (p === 'openai') {
      if (m === 'performance') return { chat: 'gpt-5.4', utility: 'gpt-5.4', routing: 'gpt-5.4' };
      if (m === 'economy') return { chat: 'gpt-5.4-mini', utility: 'gpt-5.4-mini', routing: 'gpt-5.4-mini' };
      return { chat: 'gpt-5.4', utility: 'gpt-5.4-mini', routing: 'gpt-5.4-mini' };
    }
    if (p === 'alibaba') {
      if (m === 'performance') return { chat: 'qwen3.7-max', utility: 'qwen3.7-max', routing: 'qwen3.7-max' };
      if (m === 'economy') return { chat: 'deepseek-v4-flash', utility: 'deepseek-v4-flash', routing: 'deepseek-v4-flash' };
      return { chat: 'qwen3.7-max', utility: 'qwen3.7-plus', routing: 'qwen3.7-plus' };
    }
    if (m === 'performance') return { chat: 'claude-opus-4-6', utility: 'claude-opus-4-6', routing: 'claude-opus-4-6' };
    if (m === 'economy') return { chat: 'claude-sonnet-4-6', utility: 'claude-sonnet-4-6', routing: 'claude-sonnet-4-6' };
    return { chat: 'claude-opus-4-6', utility: 'claude-sonnet-4-6', routing: 'claude-sonnet-4-6' };
  }, [provider, costMode]);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-fg-0">🧪 Models & Usage</h1>
        <p className="text-sm text-fg-2">Compare models, track costs, pick the best fit per feature</p>
      </div>

      {/* API Key status */}
      {(() => {
        const missingActive =
          (provider === 'anthropic' && !hasAnthropicKey) ||
          (provider === 'openai' && !hasOpenAIKey) ||
          (provider === 'alibaba' && !hasAlibabaKey);
        const noneSet = !hasAnthropicKey && !hasOpenAIKey && !hasAlibabaKey;
        if (!missingActive && !noneSet) return null;
        const msg = noneSet
          ? 'No API keys set. Add them in Settings to start using models.'
          : provider === 'anthropic' ? 'No Anthropic key set — Claude models unavailable. Add one in Settings.'
          : provider === 'openai' ? 'No OpenAI key set — GPT models unavailable. Add one in Settings.'
          : 'No Alibaba Cloud key set — Qwen/DeepSeek models unavailable. Add one in Settings.';
        return (
        <div className="flex items-start gap-2 bg-hero/5 border border-hero/20 rounded-xl px-4 py-3">
          <AlertTriangle size={14} className="text-hero shrink-0 mt-0.5" />
          <p className="text-xs text-fg-1">{msg}</p>
        </div>
        );
      })()}

      {/* Provider + Cost Mode selector */}
      <Section title="Active Configuration" icon={Zap}>
        <div className="space-y-4">
          <div>
            <p className="text-xs text-fg-2 mb-2">Provider</p>
            <div className="grid grid-cols-3 gap-2">
              {PROVIDERS.map(p => (
                <button
                  key={p.key}
                  onClick={() => pickProvider(p.key)}
                  aria-label={`Select ${p.label} provider`}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all duration-150 cursor-pointer',
                    provider === p.key ? 'bg-hero/10 border-hero/30' : 'bg-bg-2 border-border-0 hover:border-border-1'
                  )}
                >
                  <span className="text-lg">{p.icon}</span>
                  <div className="flex-1">
                    <p className={cn('text-sm font-medium', provider === p.key ? 'text-hero' : 'text-fg-0')}>{p.label}</p>
                    <p className="text-xs text-fg-2">{p.models}</p>
                  </div>
                  {provider === p.key && (
                    <div className="w-5 h-5 rounded-full bg-hero flex items-center justify-center shrink-0">
                      <Check size={10} className="text-[#021418]" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-fg-2 mb-2">Cost mode</p>
            <div className="grid grid-cols-3 gap-2">
              {COST_MODES.map(m => {
                const Icon = m.icon;
                const active = costMode === m.key;
                return (
                  <button
                    key={m.key}
                    onClick={() => pickMode(m.key)}
                    aria-label={`Select ${m.label} cost mode`}
                    className={cn(
                      'flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border text-center transition-all duration-150 cursor-pointer',
                      active ? m.bg : 'bg-bg-2 border-border-0 hover:border-border-1'
                    )}
                  >
                    <Icon size={16} className={active ? m.color : 'text-fg-2'} />
                    <p className={cn('text-xs font-medium', active ? m.color : 'text-fg-1')}>{m.label}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active model summary */}
          <div className="bg-bg-2/50 rounded-lg px-4 py-3 space-y-1.5">
            <p className="text-xs text-fg-2 font-medium">Current model assignment</p>
            {[
              { tier: 'Chat (main conversation)', model: activeModels.chat },
              { tier: 'Utility tools (Campaign, QC, etc.)', model: activeModels.utility },
              { tier: 'NBA routing', model: activeModels.routing },
            ].map(row => {
              const catalog = MODEL_CATALOG.find(m => m.id === row.model);
              return (
                <div key={row.tier} className="flex items-center justify-between">
                  <span className="text-xs text-fg-1">{row.tier}</span>
                  <span className="text-xs font-medium text-fg-0">
                    {providerIcon(catalog?.provider)} {catalog?.name || row.model}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </Section>

      {/* Model comparison table */}
      <Section title="Model Comparison" icon={DollarSign}>
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-0">
                <th className="text-left py-2 pr-3 text-fg-2 font-medium">Model</th>
                <th className="text-right py-2 px-2 text-fg-2 font-medium">Input $/MTok</th>
                <th className="text-right py-2 px-2 text-fg-2 font-medium">Output $/MTok</th>
                <th className="text-center py-2 px-2 text-fg-2 font-medium">Speed</th>
                <th className="text-left py-2 pl-3 text-fg-2 font-medium">Best for</th>
              </tr>
            </thead>
            <tbody>
              {MODEL_CATALOG.map(m => (
                <tr key={m.id} className="border-b border-border-0/50 hover:bg-bg-2/30 transition-colors">
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-2">
                      <span>{providerIcon(m.provider)}</span>
                      <span className="text-fg-0 font-medium">{m.name}</span>
                    </div>
                  </td>
                  <td className="text-right py-2.5 px-2 font-mono text-fg-1">${m.inputPrice}</td>
                  <td className="text-right py-2.5 px-2 font-mono text-fg-1">${m.outputPrice}</td>
                  <td className="text-center py-2.5 px-2">
                    <span className={cn('px-2 py-0.5 rounded text-xs',
                      m.speed === 'Very fast' ? 'bg-emerald-500/20 text-emerald-400' :
                      m.speed === 'Fast' ? 'bg-hero-soft/15 text-hero' :
                      'bg-warn/15 text-warn'
                    )}>{m.speed}</span>
                  </td>
                  <td className="py-2.5 pl-3 text-fg-1">{m.strengths.slice(0, 2).join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Feature suitability matrix */}
      <Section title="Feature Suitability Matrix" icon={Clock}>
        <div className="space-y-3">
          <p className="text-xs text-fg-2">Score 1-5 — how well each model handles each ACE feature. Higher is better.</p>
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-0">
                  <th className="text-left py-2 pr-3 text-fg-2 font-medium">Feature</th>
                  {MODEL_CATALOG.map(m => (
                    <th key={m.id} className="text-center py-2 px-1.5 text-fg-2 font-medium whitespace-nowrap">
                      {providerIcon(m.provider)} {m.name.split(' ').pop()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(FEATURE_LABELS).map(([key, label]) => (
                  <tr key={key} className="border-b border-border-0/50">
                    <td className="py-2 pr-3 text-fg-1 font-medium">{label}</td>
                    {MODEL_CATALOG.map(m => {
                      const score = m.features[key] || 0;
                      return (
                        <td key={m.id} className="text-center py-2 px-1.5">
                          <div className="flex flex-col items-center gap-0.5">
                            <ScoreBadge score={score} />
                            <span className="text-[10px] text-fg-2">{SCORE_LABELS[score]}</span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      {/* Strengths & Weaknesses */}
      <Section title="Strengths & Weaknesses" icon={BarChart3}>
        <div className="grid gap-4 md:grid-cols-2">
          {MODEL_CATALOG.map(m => (
            <div key={m.id} className="bg-bg-2/50 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span>{providerIcon(m.provider)}</span>
                <h3 className="text-sm font-semibold text-fg-0">{m.name}</h3>
                <span className="text-xs text-fg-2 font-mono">${m.inputPrice}/${m.outputPrice}</span>
              </div>
              <div>
                <p className="text-[10px] text-emerald-400 font-medium mb-1">STRENGTHS</p>
                <ul className="space-y-0.5">
                  {m.strengths.map((s, i) => (
                    <li key={i} className="text-xs text-fg-1 flex items-start gap-1.5">
                      <span className="text-emerald-500 mt-0.5 shrink-0">+</span> {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-[10px] text-crit font-medium mb-1">WEAKNESSES</p>
                <ul className="space-y-0.5">
                  {m.weaknesses.map((w, i) => (
                    <li key={i} className="text-xs text-fg-1 flex items-start gap-1.5">
                      <span className="text-crit mt-0.5 shrink-0">-</span> {w}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Usage */}
      <UsageSection />

      {/* Cost estimation */}
      <div className="bg-bg-2/30 border border-border-0 rounded-xl p-5 space-y-2">
        <p className="text-xs font-medium text-fg-1">Cost estimation tip</p>
        <p className="text-xs text-fg-2 leading-relaxed">
          A typical shift with ~50 chat messages + 10 tool uses costs roughly:
          <strong className="text-fg-1"> $2.50/shift</strong> on Balanced (Anthropic),
          <strong className="text-fg-1"> $1.00/shift</strong> on Balanced (OpenAI), or
          <strong className="text-fg-1"> $0.30/shift</strong> on Economy (OpenAI).
          Prompt caching saves an additional 40-60% on Anthropic models.
        </p>
      </div>
    </div>
  );
}
