import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { getKnowledge, saveKnowledge } from '@/api/claude';
import { BYBIT_KB, ESCALATION_TABLE, DOMAINS, DOMAIN_COLORS } from '@/data/bybitKB';
import { Plus, Trash2, Edit3, Check, X, ToggleLeft, ToggleRight, Download, Upload, ExternalLink, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

// Stagger: 0.05s delay per card — "power on" sequence
// Spring: stiffness 400, damping 30 (ζ=0.75, settles ~261ms, 2.8% overshoot)
const STAGGER_CONTAINER = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0 } },
};
const CARD_VARIANT = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 400, damping: 30 },
  },
};

// ─── Ace Memory Tab ──────────────────────────────────────────────────────────

const SUGGESTED = [
  { title: 'My Name & Role', content: 'I am [YOUR NAME], a Bybit live chat support agent.' },
  { title: 'My Team & Shift', content: 'I work on the [EU/Global] team, [shift hours]. My Team Lead is [TL NAME].' },
  { title: 'My Agent Level', content: 'I am a Level [X] agent, 3 months in. I handle both email and live chat queues.' },
  { title: 'Bybit EU Notes', content: 'Bybit EU operates under MiCA regulation. EU customers have stricter compliance requirements. Always mention MiCA context when relevant.' },
  { title: 'Escalation Rule', content: 'Always check the internal KB before escalating. Escalation threshold: 2 failed resolution attempts.' },
];

function EntryCard({ entry, onToggle, onDelete, onEdit }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(entry.title);
  const [content, setContent] = useState(entry.content);

  function save() {
    if (!title.trim() || !content.trim()) return;
    onEdit(entry.id, { title: title.trim(), content: content.trim() });
    setEditing(false);
  }

  function cancel() {
    setTitle(entry.title);
    setContent(entry.content);
    setEditing(false);
  }

  return (
    <div className={cn(
      'bg-slate-900 border rounded-xl p-4 transition-colors duration-150',
      entry.active === false ? 'border-slate-800 opacity-50' : 'border-slate-700'
    )}>
      {editing ? (
        <div className="space-y-2">
          <input value={title} onChange={e => setTitle(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-yellow-400/50" />
          <textarea value={content} onChange={e => setContent(e.target.value)} rows={4}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none resize-none focus:border-yellow-400/50" />
          <div className="flex gap-2">
            <button onClick={save} className="flex items-center gap-1 text-xs bg-yellow-400/20 text-yellow-400 hover:bg-yellow-400/30 px-3 py-1.5 rounded-lg transition-colors duration-150">
              <Check size={12} /> Save
            </button>
            <button onClick={cancel} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 px-3 py-1.5 transition-colors duration-150">
              <X size={12} /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="font-medium text-slate-100 text-sm">{entry.title}</p>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => onToggle(entry.id)}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-600 hover:text-yellow-400 hover:bg-slate-800 transition-colors duration-150 cursor-pointer"
                aria-label={entry.active === false ? 'Enable entry' : 'Disable entry'}>
                {entry.active === false
                  ? <ToggleLeft size={18} />
                  : <ToggleRight size={18} className="text-yellow-400" />}
              </button>
              <button onClick={() => setEditing(true)}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-slate-800 transition-colors duration-150 cursor-pointer"
                aria-label="Edit entry">
                <Edit3 size={14} />
              </button>
              <button onClick={() => onDelete(entry.id)}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-600 hover:text-red-400 hover:bg-slate-800 transition-colors duration-150 cursor-pointer"
                aria-label="Delete entry">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap">{entry.content}</p>
          {entry.active === false && <p className="text-xs text-slate-600 mt-2">⏸ Disabled — not injected into AI</p>}
        </div>
      )}
    </div>
  );
}

// ─── Bybit Official Tab ──────────────────────────────────────────────────────

function DomainPill({ domain, active, onClick }) {
  const meta = DOMAINS.find(d => d.id === domain) || { label: domain, icon: '•', color: 'yellow' };
  const colors = DOMAIN_COLORS[meta.color];
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors duration-150 cursor-pointer',
        active
          ? cn(colors.bg, colors.text, colors.border)
          : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300 hover:border-slate-700'
      )}
    >
      <span>{meta.icon}</span>
      <span>{meta.label}</span>
    </button>
  );
}

function ArticleCard({ article }) {
  const [expanded, setExpanded] = useState(false);
  const colors = DOMAIN_COLORS[article.domainColor];
  const domainMeta = DOMAINS.find(d => d.id === article.domain);

  return (
    <div className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl overflow-hidden transition-colors duration-150">
      {/* Header */}
      <button
        className="w-full flex items-start gap-3 p-4 text-left cursor-pointer"
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
      >
        <span className="text-lg shrink-0 mt-0.5">{domainMeta?.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={cn('text-xs font-medium px-2 py-0.5 rounded-md border', colors.bg, colors.text, colors.border)}>
              {article.domain}
            </span>
            {article.platform === 'eu' && (
              <span className="text-xs px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">EU only</span>
            )}
          </div>
          <p className="text-sm font-semibold text-slate-100 leading-snug">{article.title}</p>
          <p className="text-xs text-slate-500 mt-0.5">{article.subtitle}</p>
        </div>
        <div className="shrink-0 text-slate-600 mt-1">
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-slate-800">
          {/* Key points */}
          <div className="pt-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Key Points</p>
            <ul className="space-y-2">
              {article.keyPoints.map((point, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-300 leading-relaxed">
                  <span className={cn('shrink-0 mt-0.5', colors.text)}>→</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Agent tips */}
          {article.agentTips?.length > 0 && (
            <div className="bg-yellow-400/5 border border-yellow-400/15 rounded-lg p-3 space-y-1.5">
              <p className="text-xs font-semibold text-yellow-400">Agent Tips</p>
              {article.agentTips.map((tip, i) => (
                <p key={i} className="text-xs text-yellow-400/80 flex items-start gap-1.5">
                  <span className="shrink-0">✦</span> {tip}
                </p>
              ))}
            </div>
          )}

          {/* Escalate path */}
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2.5 flex items-start gap-2">
            <AlertTriangle size={13} className="text-orange-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-orange-400 mb-0.5">Escalation path</p>
              <p className="text-xs text-slate-400">{article.escalatePath}</p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-slate-700">Updated {article.lastUpdated}</p>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-yellow-400 transition-colors duration-150"
              onClick={e => e.stopPropagation()}
            >
              Bybit Help Center <ExternalLink size={11} />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function EscalationMatrix() {
  return (
    <div className="space-y-3">
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800">
          <p className="text-sm font-semibold text-slate-100">Escalation Decision Matrix</p>
          <p className="text-xs text-slate-500 mt-0.5">Quick reference: what you can resolve vs. what needs a ticket</p>
        </div>
        <div className="divide-y divide-slate-800/60">
          {ESCALATION_TABLE.map((row, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-800/30 transition-colors duration-150">
              <div className="shrink-0 mt-0.5">
                {row.selfService === true && <CheckCircle2 size={14} className="text-green-400" />}
                {row.selfService === false && <X size={14} className="text-red-400" />}
                {row.selfService === 'partial' && <Minus size={14} className="text-yellow-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-200">{row.situation}</p>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{row.agentAction}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="px-4 py-3 border-t border-slate-800 flex items-center gap-4 text-xs text-slate-600">
          <span className="flex items-center gap-1"><CheckCircle2 size={11} className="text-green-400" /> Self-service available</span>
          <span className="flex items-center gap-1"><Minus size={11} className="text-yellow-400" /> Partial</span>
          <span className="flex items-center gap-1"><X size={11} className="text-red-400" /> Submit a Case required</span>
        </div>
      </div>
    </div>
  );
}

function BybitOfficialTab() {
  const [activeDomain, setActiveDomain] = useState(null);
  const [view, setView] = useState('articles'); // 'articles' | 'matrix'

  const filtered = activeDomain
    ? BYBIT_KB.filter(a => a.domain === activeDomain)
    : BYBIT_KB;

  return (
    <div className="space-y-4">
      {/* Sub-nav */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-2">
          <button
            onClick={() => setView('articles')}
            className={cn(
              'text-xs px-3 py-1.5 rounded-lg border transition-colors duration-150',
              view === 'articles'
                ? 'bg-yellow-400/15 text-yellow-400 border-yellow-400/30'
                : 'text-slate-500 border-slate-800 hover:text-slate-300'
            )}
          >
            15 Articles
          </button>
          <button
            onClick={() => setView('matrix')}
            className={cn(
              'text-xs px-3 py-1.5 rounded-lg border transition-colors duration-150',
              view === 'matrix'
                ? 'bg-yellow-400/15 text-yellow-400 border-yellow-400/30'
                : 'text-slate-500 border-slate-800 hover:text-slate-300'
            )}
          >
            Escalation Matrix
          </button>
        </div>
        {view === 'articles' && (
          <p className="text-xs text-slate-600">{filtered.length} article{filtered.length !== 1 ? 's' : ''}</p>
        )}
      </div>

      {view === 'matrix' ? (
        <EscalationMatrix />
      ) : (
        <>
          {/* Domain filter pills */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveDomain(null)}
              className={cn(
                'text-xs px-3 py-1.5 rounded-lg border transition-colors duration-150',
                !activeDomain
                  ? 'bg-slate-700 text-slate-100 border-slate-600'
                  : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300'
              )}
            >
              All
            </button>
            {DOMAINS.map(d => (
              <DomainPill
                key={d.id}
                domain={d.id}
                active={activeDomain === d.id}
                onClick={() => setActiveDomain(activeDomain === d.id ? null : d.id)}
              />
            ))}
          </div>

          {/* Info banner */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3 flex items-start gap-3">
            <span className="text-lg shrink-0">🌐</span>
            <div>
              <p className="text-xs font-medium text-slate-300">Bybit Official Help Center</p>
              <p className="text-xs text-slate-500 mt-0.5">
                15 critical articles for live-chat. Key points and agent tips extracted. Click any article to expand.
              </p>
            </div>
          </div>

          {/* Articles — stagger on mount + on domain filter change */}
          <motion.div
            key={activeDomain ?? 'all'}
            variants={STAGGER_CONTAINER}
            initial="hidden"
            animate="show"
            className="space-y-2"
          >
            {filtered.map(article => (
              <motion.div key={article.id} variants={CARD_VARIANT}>
                <ArticleCard article={article} />
              </motion.div>
            ))}
          </motion.div>
        </>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function KnowledgeBase() {
  const [tab, setTab] = useState('ace'); // 'ace' | 'bybit'
  const [entries, setEntries] = useState(getKnowledge);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [importMsg, setImportMsg] = useState('');
  const fileRef = useRef(null);

  function persist(updated) {
    setEntries(updated);
    saveKnowledge(updated);
  }

  function addEntry(title, content) {
    if (!title.trim() || !content.trim()) return;
    persist([...entries, { id: Date.now(), title: title.trim(), content: content.trim(), active: true }]);
    setNewTitle('');
    setNewContent('');
    setShowAdd(false);
  }

  function editEntry(id, updates) {
    persist(entries.map(e => e.id === id ? { ...e, ...updates } : e));
  }

  function toggleEntry(id) {
    persist(entries.map(e => e.id === id ? { ...e, active: e.active === false ? true : false } : e));
  }

  function deleteEntry(id) {
    if (!confirm('Remove this entry?')) return;
    persist(entries.filter(e => e.id !== id));
  }

  function exportKnowledge() {
    const data = { exported: new Date().toISOString(), version: 1, entries };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ace-memory-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        const incoming = parsed.entries || parsed;
        if (!Array.isArray(incoming)) throw new Error('Invalid format');

        const confirmed = confirm(`Import ${incoming.length} entries?\n\nMerge (keeps existing + adds new) or Replace (wipes current memory)?`);
        if (!confirmed) return;

        const choice = confirm('Merge into existing memory?\n\nOK = Merge  |  Cancel = Replace');
        if (choice) {
          const existingTitles = new Set(entries.map(e => e.title.toLowerCase()));
          const newOnes = incoming.filter(e => !existingTitles.has(e.title.toLowerCase()));
          persist([...entries, ...newOnes.map(e => ({ ...e, id: Date.now() + Math.random() }))]);
          setImportMsg(`✓ Merged ${newOnes.length} new entries`);
        } else {
          persist(incoming.map(e => ({ ...e, id: Date.now() + Math.random() })));
          setImportMsg(`✓ Replaced with ${incoming.length} entries`);
        }
        setTimeout(() => setImportMsg(''), 3000);
      } catch {
        setImportMsg('✗ Invalid file — must be an Ace memory export');
        setTimeout(() => setImportMsg(''), 3000);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  const activeCount = entries.filter(e => e.active !== false).length;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Knowledge Base</h1>
          <p className="text-sm text-slate-500">Ace memory + Bybit official articles in one place</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab('ace')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150',
            tab === 'ace'
              ? 'bg-yellow-400/15 text-yellow-400'
              : 'text-slate-500 hover:text-slate-300'
          )}
        >
          🧠 Ace Memory
          {activeCount > 0 && (
            <span className="text-xs bg-yellow-400/20 text-yellow-400 px-1.5 py-0.5 rounded-md">{activeCount}</span>
          )}
        </button>
        <button
          onClick={() => setTab('bybit')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150',
            tab === 'bybit'
              ? 'bg-yellow-400/15 text-yellow-400'
              : 'text-slate-500 hover:text-slate-300'
          )}
        >
          🌐 Bybit Official
          <span className="text-xs bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded-md">15</span>
        </button>
      </div>

      {/* ── ACE MEMORY TAB ── */}
      {tab === 'ace' && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-yellow-400 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-2 rounded-lg transition-colors duration-150"
            >
              <Upload size={13} /> Import
            </button>
            <button
              onClick={exportKnowledge}
              disabled={entries.length === 0}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-yellow-400 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-2 rounded-lg transition-colors duration-150 disabled:opacity-40"
            >
              <Download size={13} /> Export
            </button>
            <button
              onClick={() => setShowAdd(!showAdd)}
              className="flex items-center gap-1.5 bg-yellow-400/20 hover:bg-yellow-400/30 text-yellow-400 text-xs px-3 py-2 rounded-lg transition-colors duration-150"
            >
              <Plus size={13} /> Add entry
            </button>
          </div>

          {importMsg && (
            <div className={cn(
              'rounded-xl px-4 py-2.5 text-sm border',
              importMsg.startsWith('✓') ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
            )}>
              {importMsg}
            </div>
          )}

          {/* Status banner */}
          <div className={cn(
            'rounded-xl px-4 py-3 text-sm border',
            activeCount > 0
              ? 'bg-green-500/10 border-green-500/20 text-green-400'
              : 'bg-slate-800 border-slate-700 text-slate-500'
          )}>
            {activeCount > 0
              ? `✦ ${activeCount} entr${activeCount === 1 ? 'y' : 'ies'} active — Ace carries this into every conversation`
              : 'No active entries — Ace has no persistent memory yet'
            }
          </div>

          {/* Add form */}
          {showAdd && (
            <div className="bg-slate-900 border border-yellow-400/20 rounded-xl p-5 space-y-3">
              <p className="text-sm font-medium text-slate-300">New memory entry</p>
              <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
                placeholder="Title (e.g. My Role, Escalation Rule, EU Policy note...)"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-yellow-400/50" />
              <textarea value={newContent} onChange={e => setNewContent(e.target.value)}
                placeholder="What should Ace always know and remember..."
                rows={4}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none resize-none focus:border-yellow-400/50" />
              <div className="flex gap-2">
                <button onClick={() => addEntry(newTitle, newContent)}
                  disabled={!newTitle.trim() || !newContent.trim()}
                  className="bg-yellow-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 font-medium text-sm px-5 py-2 rounded-lg hover:bg-yellow-300 transition-colors duration-150">
                  Save to memory
                </button>
                <button onClick={() => setShowAdd(false)} className="text-slate-500 text-sm px-4 py-2">Cancel</button>
              </div>
            </div>
          )}

          {/* Entries */}
          {entries.length > 0 ? (
            <div className="space-y-3">
              {entries.map(entry => (
                <EntryCard key={entry.id} entry={entry} onToggle={toggleEntry} onDelete={deleteEntry} onEdit={editEntry} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-600 space-y-1">
              <p className="text-3xl">🧠</p>
              <p>No memory entries yet</p>
              <p className="text-sm">Add entries or import a backup</p>
            </div>
          )}

          {/* Suggested starters */}
          {entries.length === 0 && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Quick starters</p>
              <div className="grid gap-2">
                {SUGGESTED.map((s, i) => (
                  <button key={i} onClick={() => addEntry(s.title, s.content)}
                    className="flex items-center justify-between bg-slate-900 border border-slate-800 hover:border-yellow-400/30 rounded-xl px-4 py-3 text-left transition-colors duration-150 group cursor-pointer">
                    <div>
                      <p className="text-sm font-medium text-slate-300 group-hover:text-yellow-400 transition-colors duration-150">{s.title}</p>
                      <p className="text-xs text-slate-600 mt-0.5 truncate">{s.content}</p>
                    </div>
                    <Plus size={15} className="text-slate-600 group-hover:text-yellow-400 shrink-0 ml-3 transition-colors duration-150" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-2">
            <p className="text-xs font-medium text-slate-400">Tips</p>
            {[
              'In any chat, type "remember: [title] — [content]" and Ace saves it automatically',
              'Hover over any Ace reply in chat and click 🧠 to save it directly to memory',
              'Export regularly as a backup — import it back any time to restore',
              'Disable entries temporarily without deleting them using the toggle',
            ].map((t, i) => (
              <p key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                <span className="text-yellow-400/50 shrink-0">→</span> {t}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* ── BYBIT OFFICIAL TAB ── */}
      {tab === 'bybit' && <BybitOfficialTab />}
    </div>
  );
}
