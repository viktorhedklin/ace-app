import { useState } from 'react';
import { InvokeLLM } from '@/api/claude';
import { searchWeb, getSerpApiKey } from '@/api/search';
import { scrubPII } from '@/lib/SecurityModule';
import { Loader2, Search, Plus, Trash2, ExternalLink, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

const PINNED_CAMPAIGNS = [
  { id: 1, name: 'Bybit Launchpad', category: 'Trading', icon: '🚀', desc: 'New token listings with guaranteed allocation for qualifying holders. Requires BIT staking.', details: 'Min BIT requirement varies per project. Snapshot taken 7 days before launch. Subscription period: 48 hours.', link: 'Check Bybit Announcements for current projects' },
  { id: 2, name: 'Referral Program', category: 'Reward', icon: '🎁', desc: 'Earn up to 30% commission on referred users\' trading fees.', details: 'Standard rate: 20% commission. VIP users: up to 30%. Referral code visible in Account > Referral. Payouts: daily in USDT.', link: 'bybit.com/invite' },
  { id: 3, name: 'Bybit Card Cashback', category: 'Card', icon: '💳', desc: 'Earn up to 10% cashback on eligible purchases with the Bybit Card.', details: 'Cashback rate depends on BYB tier. Min spend applies. Cashback paid in USDT within 30 days of transaction.', link: 'Card section in Bybit app' },
  { id: 4, name: 'Copy Trading Rewards', category: 'Trading', icon: '📈', desc: 'Earn profit share as a signal provider, or bonus rewards as a copier.', details: 'Signal providers earn 5–10% profit share. Copiers get welcome bonuses on first copy trade. Min copy amount: 100 USDT.', link: 'Trade > Copy Trading' },
  { id: 5, name: 'Spot/Futures Fee Discount', category: 'Fee', icon: '💰', desc: 'Reduced trading fees for VIP tiers and BIT holders.', details: 'Maker/taker fees start at 0.1%/0.1% spot. Futures: 0.01%/0.06%. Holding BIT provides 15% discount.', link: 'Account > Fee Rate' },
  { id: 6, name: 'Earn (Flexible/Fixed)', category: 'Savings', icon: '🏦', desc: 'Earn passive yield on crypto holdings via flexible or fixed-term savings.', details: 'Flexible: withdraw anytime, lower APY. Fixed: locked period, higher APY. Rates vary by asset and term. Min: 1 USDT.', link: 'Earn section in Bybit app' },
];

function MarkdownText({ text }) {
  if (!text) return null;
  return (
    <span>
      {text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith('**') && part.endsWith('**')
          ? <strong key={i} className="text-slate-100 font-semibold">{part.slice(2, -2)}</strong>
          : <span key={i}>{part}</span>
      )}
    </span>
  );
}

function ResultBlock({ text }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-2" />;
        return (
          <p key={i} className="text-sm text-slate-300 leading-relaxed">
            <MarkdownText text={line} />
          </p>
        );
      })}
    </div>
  );
}

export default function Campaign() {
  const [search, setSearch] = useState('');
  const [lookup, setLookup] = useState({ name: '', region: 'both', context: '' });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [customCampaigns, setCustomCampaigns] = useState(() => {
    try { return JSON.parse(localStorage.getItem('custom_campaigns')) || []; } catch { return []; }
  });
  const [searchLinks, setSearchLinks] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const filtered = PINNED_CAMPAIGNS.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.category.toLowerCase().includes(search.toLowerCase())
  );

  async function fetchCampaign() {
    if (!lookup.name.trim()) return;
    setLoading(true);
    setResult(null);
    setSearchLinks([]);
    try {
      const regionText = lookup.region === 'eu' ? 'Bybit EU (MiCA-regulated, European customers)'
        : lookup.region === 'global' ? 'Bybit Global (worldwide)'
        : 'Bybit EU and Bybit Global';

      // Step 1: Search the web via SerpAPI
      let webContext = '';
      let foundLinks = [];
      if (getSerpApiKey()) {
        try {
          const regionQuery = lookup.region === 'eu' ? 'Bybit EU' : lookup.region === 'global' ? 'Bybit' : 'Bybit';
          const query = `${regionQuery} ${scrubPII(lookup.name)} promotion campaign 2026`;
          const { results, links } = await searchWeb(query);
          webContext = results;
          foundLinks = links;
          setSearchLinks(links);
        } catch (searchErr) {
          // Search failed — fall through to Claude-only mode
          // SerpAPI search failed — fall through to Claude-only mode
        }
      }

      // Step 2: Feed web results + prompt to Claude
      const webBlock = webContext
        ? `\n\nWEB SEARCH RESULTS (use these as your primary source — cite specific details found here):\n${webContext}`
        : '\n\n(No web search results available — answer from your training data and flag that info may be outdated.)';

      const res = await InvokeLLM({
        prompt: `Find details about the Bybit campaign or promotion: "${scrubPII(lookup.name)}" for ${regionText}.${lookup.context ? ` Additional context from agent: ${scrubPII(lookup.context)}` : ''}
${webBlock}

Key Bybit pages for reference:
- Global announcements: https://announcements.bybit.global/en/
- Global welcome gift: https://www.bybit.com/en/promo/events/welcome-gift
- EU Card signup promo: https://www.bybit.eu/en-EU/promo/campaign/Card-New-Signup

Return:
1. What this campaign/promo is
2. Eligibility requirements
3. How to participate / claim
4. Key terms and conditions (expiry, limits, restrictions)
5. The direct URL or page where customers can find it
6. What to tell a customer asking about it

Important: if this is a Bybit EU question, only return EU-applicable terms. Bybit EU and Bybit Global campaigns are separate and may have different conditions.
Use plain text, no asterisk markdown. Be specific with actual numbers, dates and limits if found. If you find a direct link, include it clearly labeled as LINK:`,
        system_prompt: 'You are a Bybit campaigns researcher. Analyze the provided web search results and extract accurate, current Bybit promotion details. Prioritize information from the search results over your training data. Return factual information with direct links where possible. Plain text only, no markdown asterisks. Always distinguish between Bybit EU and Bybit Global campaigns — never mix them.',
      });
      setResult(res);
    } catch (e) {
      setResult(`Error: ${e.message === 'NO_API_KEY' ? 'No Claude API key — add one in Settings.' : e.message}`);
    }
    setLoading(false);
  }

  function addCustom() {
    if (!newName.trim()) return;
    const updated = [...customCampaigns, { id: Date.now(), name: newName, desc: newDesc, icon: '📌', category: 'Custom' }];
    setCustomCampaigns(updated);
    localStorage.setItem('custom_campaigns', JSON.stringify(updated));
    setNewName(''); setNewDesc(''); setShowAdd(false);
  }

  function removeCustom(id) {
    const updated = customCampaigns.filter(c => c.id !== id);
    setCustomCampaigns(updated);
    localStorage.setItem('custom_campaigns', JSON.stringify(updated));
  }

  // Extract links from result text
  function extractLinks(text) {
    const linkMatch = text?.match(/LINK:\s*(https?:\/\/[^\s\n]+)/gi) || [];
    const urlMatch = text?.match(/https?:\/\/[^\s\n)]+/g) || [];
    return [...new Set([...linkMatch.map(l => l.replace(/^LINK:\s*/i, '')), ...urlMatch])];
  }

  const links = result ? [...new Set([...searchLinks, ...extractLinks(result)])] : [];

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">🎁 Campaign</h1>
          <p className="text-sm text-slate-500">Look up any Bybit promo with live web search</p>
        </div>
        <div className="flex gap-2">
          <a href="https://announcements.bybit.global/en/" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-yellow-400 bg-slate-800 border border-slate-700 px-3 py-2 rounded-lg transition-all">
            <ExternalLink size={11} /> Global
          </a>
          <a href="https://www.bybit.eu/en-EU/promo/campaign/Card-New-Signup" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-yellow-400 bg-slate-800 border border-slate-700 px-3 py-2 rounded-lg transition-all">
            <ExternalLink size={11} /> EU Card
          </a>
          <a href="https://www.bybit.com/en/promo/events/welcome-gift" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-yellow-400 bg-slate-800 border border-slate-700 px-3 py-2 rounded-lg transition-all">
            <ExternalLink size={11} /> Welcome
          </a>
        </div>
      </div>

      {/* Web lookup */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <p className="text-sm font-medium text-slate-300">🔍 Live campaign lookup</p>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Campaign / promo name</label>
            <input
              value={lookup.name}
              onChange={e => setLookup(p => ({ ...p, name: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && fetchCampaign()}
              placeholder="e.g. new user welcome gift, deposit bonus, trading competition..."
              className="w-full bg-slate-800 border border-slate-700 focus:border-yellow-400/50 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition-colors"
            />
          </div>

          <div>
            <label className="text-xs text-slate-500 mb-1 block">Region</label>
            <div className="flex gap-2">
              {[
                { val: 'eu', label: '🇪🇺 Bybit EU' },
                { val: 'global', label: '🌍 Global' },
                { val: 'both', label: '🌐 Both' },
              ].map(opt => (
                <button
                  key={opt.val}
                  onClick={() => setLookup(p => ({ ...p, region: opt.val }))}
                  className={cn(
                    'flex-1 text-sm px-3 py-2 rounded-lg border transition-all',
                    lookup.region === opt.val
                      ? 'bg-yellow-400/15 border-yellow-400/40 text-yellow-400'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500 mb-1 block">Extra context <span className="text-slate-700">(optional)</span></label>
            <input
              value={lookup.context}
              onChange={e => setLookup(p => ({ ...p, context: e.target.value }))}
              placeholder="e.g. screenshot shows 'deposit 100 USDT get 20 USDT bonus', customer says they saw it on app homepage..."
              className="w-full bg-slate-800 border border-slate-700 focus:border-yellow-400/50 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition-colors"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchCampaign}
              disabled={!lookup.name.trim() || loading}
              className="flex-1 bg-yellow-400 hover:bg-yellow-300 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
              aria-label="Search Bybit campaigns"
            >
              {loading
                ? <><Loader2 size={15} className="animate-spin" /> Searching...</>
                : <><Search size={15} /> Search Bybit campaigns</>
              }
            </button>
            <div className={cn(
              'flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border shrink-0',
              getSerpApiKey()
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-slate-800 border-slate-700 text-slate-500'
            )}>
              <Globe size={12} />
              {getSerpApiKey() ? 'Live search' : 'No SerpAPI key'}
            </div>
          </div>
        </div>

        {/* Result */}
        {result && !loading && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-3">
            <ResultBlock text={result} />
            {links.length > 0 && (
              <div className="pt-2 border-t border-slate-700 space-y-1">
                <p className="text-xs text-slate-500">Links found:</p>
                {links.slice(0, 3).map((link, i) => (
                  <a key={i} href={link} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-yellow-400 hover:text-yellow-300 transition-colors truncate">
                    <ExternalLink size={11} /> {link}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filter pinned */}
      <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 focus-within:border-yellow-400/50 rounded-xl px-4 py-3">
        <Search size={15} className="text-slate-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filter pinned campaigns..."
          className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 outline-none"
        />
      </div>

      {/* Pinned campaigns */}
      <div className="grid gap-3">
        {filtered.map(c => (
          <div key={c.id} className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-5 transition-colors">
            <div className="flex items-start gap-3">
              <span className="text-2xl">{c.icon}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-slate-100">{c.name}</h3>
                  <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded">{c.category}</span>
                </div>
                <p className="text-sm text-slate-400 mb-2">{c.desc}</p>
                <p className="text-xs text-slate-500">{c.details}</p>
                <p className="text-xs text-yellow-400/70 mt-1">📍 {c.link}</p>
              </div>
            </div>
          </div>
        ))}

        {customCampaigns.map(c => (
          <div key={c.id} className="bg-slate-900 border border-yellow-400/20 rounded-xl p-5 relative">
            <button onClick={() => removeCustom(c.id)} className="absolute top-3 right-3 text-slate-600 hover:text-red-400 transition-colors">
              <Trash2 size={13} />
            </button>
            <div className="flex items-start gap-3">
              <span className="text-2xl">{c.icon}</span>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-slate-100">{c.name}</h3>
                  <span className="text-xs bg-yellow-400/10 text-yellow-400 px-2 py-0.5 rounded">Custom</span>
                </div>
                <p className="text-sm text-slate-400">{c.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showAdd ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-slate-300">Pin a campaign note</p>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Campaign name" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none" />
          <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Details / notes" rows={2} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none resize-none" />
          <div className="flex gap-2">
            <button onClick={addCustom} className="bg-yellow-400/20 text-yellow-400 hover:bg-yellow-400/30 text-sm px-4 py-2 rounded-lg transition-colors">Save</button>
            <button onClick={() => setShowAdd(false)} className="text-slate-500 text-sm px-4 py-2">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 text-sm text-slate-500 hover:text-yellow-400 transition-colors">
          <Plus size={15} /> Pin a campaign note
        </button>
      )}
    </div>
  );
}
