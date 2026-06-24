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
      'bg-bg-1 border rounded-xl p-4 transition-colors duration-150',
      entry.active === false ? 'border-border-0 opacity-50' : 'border-border-0'
    )}>
      {editing ? (
        <div className="space-y-2">
          <input value={title} onChange={e => setTitle(e.target.value)}
            className="w-full bg-bg-2 border border-border-0 rounded-lg px-3 py-2 text-sm text-fg-0 outline-none focus:border-hero/50" />
          <textarea value={content} onChange={e => setContent(e.target.value)} rows={4}
            className="w-full bg-bg-2 border border-border-0 rounded-lg px-3 py-2 text-sm text-fg-0 outline-none resize-none focus:border-hero/50" />
          <div className="flex gap-2">
            <button onClick={save} className="flex items-center gap-1 text-xs bg-hero/20 text-hero hover:bg-hero/30 px-3 py-1.5 rounded-lg transition-colors duration-150">
              <Check size={12} /> Save
            </button>
            <button onClick={cancel} className="flex items-center gap-1 text-xs text-fg-2 hover:text-fg-1 px-3 py-1.5 transition-colors duration-150">
              <X size={12} /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="font-medium text-fg-0 text-sm">{entry.title}</p>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => onToggle(entry.id)}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-fg-2 hover:text-hero hover:bg-bg-2 transition-colors duration-150 cursor-pointer"
                aria-label={entry.active === false ? 'Enable entry' : 'Disable entry'}>
                {entry.active === false
                  ? <ToggleLeft size={18} />
                  : <ToggleRight size={18} className="text-hero" />}
              </button>
              <button onClick={() => setEditing(true)}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-fg-2 hover:text-fg-1 hover:bg-bg-2 transition-colors duration-150 cursor-pointer"
                aria-label="Edit entry">
                <Edit3 size={14} />
              </button>
              <button onClick={() => onDelete(entry.id)}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-fg-2 hover:text-crit hover:bg-bg-2 transition-colors duration-150 cursor-pointer"
                aria-label="Delete entry">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
          <p className="text-xs text-fg-1 leading-relaxed whitespace-pre-wrap">{entry.content}</p>
          {entry.active === false && <p className="text-xs text-fg-2 mt-2">⏸ Disabled — not injected into AI</p>}
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
          : 'bg-bg-1 text-fg-2 border-border-0 hover:text-fg-1 hover:border-border-0'
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
    <div className="bg-bg-1 border border-border-0 hover:border-border-0 rounded-xl overflow-hidden transition-colors duration-150">
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
              <span className="text-xs px-2 py-0.5 rounded-md bg-info/10 text-info border border-info/20">EU only</span>
            )}
          </div>
          <p className="text-sm font-semibold text-fg-0 leading-snug">{article.title}</p>
          <p className="text-xs text-fg-2 mt-0.5">{article.subtitle}</p>
        </div>
        <div className="shrink-0 text-fg-2 mt-1">
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-border-0">
          {/* Key points */}
          <div className="pt-4">
            <p className="text-xs font-semibold text-fg-1 uppercase tracking-wider mb-2">Key Points</p>
            <ul className="space-y-2">
              {article.keyPoints.map((point, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-fg-1 leading-relaxed">
                  <span className={cn('shrink-0 mt-0.5', colors.text)}>→</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Agent tips */}
          {article.agentTips?.length > 0 && (
            <div className="bg-hero/5 border border-hero/15 rounded-lg p-3 space-y-1.5">
              <p className="text-xs font-semibold text-hero">Agent Tips</p>
              {article.agentTips.map((tip, i) => (
                <p key={i} className="text-xs text-hero/80 flex items-start gap-1.5">
                  <span className="shrink-0">✦</span> {tip}
                </p>
              ))}
            </div>
          )}

          {/* Escalate path */}
          <div className="bg-bg-2/60 border border-border-0/50 rounded-lg px-3 py-2.5 flex items-start gap-2">
            <AlertTriangle size={13} className="text-warn shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-warn mb-0.5">Escalation path</p>
              <p className="text-xs text-fg-1">{article.escalatePath}</p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-fg-3">Updated {article.lastUpdated}</p>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-fg-2 hover:text-hero transition-colors duration-150"
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
      <div className="bg-bg-1/50 border border-border-0 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border-0">
          <p className="text-sm font-semibold text-fg-0">Escalation Decision Matrix</p>
          <p className="text-xs text-fg-2 mt-0.5">Quick reference: what you can resolve vs. what needs a ticket</p>
        </div>
        <div className="divide-y divide-border-0/60">
          {ESCALATION_TABLE.map((row, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-3 hover:bg-bg-2/30 transition-colors duration-150">
              <div className="shrink-0 mt-0.5">
                {row.selfService === true && <CheckCircle2 size={14} className="text-ok" />}
                {row.selfService === false && <X size={14} className="text-crit" />}
                {row.selfService === 'partial' && <Minus size={14} className="text-hero" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-fg-0">{row.situation}</p>
                <p className="text-xs text-fg-2 mt-0.5 leading-relaxed">{row.agentAction}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="px-4 py-3 border-t border-border-0 flex items-center gap-4 text-xs text-fg-2">
          <span className="flex items-center gap-1"><CheckCircle2 size={11} className="text-ok" /> Self-service available</span>
          <span className="flex items-center gap-1"><Minus size={11} className="text-hero" /> Partial</span>
          <span className="flex items-center gap-1"><X size={11} className="text-crit" /> Submit a Case required</span>
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
                ? 'bg-hero/15 text-hero border-hero/30'
                : 'text-fg-2 border-border-0 hover:text-fg-1'
            )}
          >
            {BYBIT_KB.length} Articles
          </button>
          <button
            onClick={() => setView('matrix')}
            className={cn(
              'text-xs px-3 py-1.5 rounded-lg border transition-colors duration-150',
              view === 'matrix'
                ? 'bg-hero/15 text-hero border-hero/30'
                : 'text-fg-2 border-border-0 hover:text-fg-1'
            )}
          >
            Escalation Matrix
          </button>
        </div>
        {view === 'articles' && (
          <p className="text-xs text-fg-2">{filtered.length} article{filtered.length !== 1 ? 's' : ''}</p>
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
                  ? 'bg-bg-3 text-fg-0 border-border-1'
                  : 'bg-bg-1 text-fg-2 border-border-0 hover:text-fg-1'
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
          <div className="bg-bg-1/50 border border-border-0 rounded-xl px-4 py-3 flex items-start gap-3">
            <span className="text-lg shrink-0">🌐</span>
            <div>
              <p className="text-xs font-medium text-fg-1">Bybit Official Help Center</p>
              <p className="text-xs text-fg-2 mt-0.5">
                {BYBIT_KB.length} critical articles for live-chat. Key points and agent tips extracted. Click any article to expand.
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

// One-time migration: tag untagged entries by matching against BYBIT_KB titles
function migrateEntrySources(entries) {
  const kbTitles = new Set(BYBIT_KB.map(a => a.title.toLowerCase()));
  let changed = false;
  const migrated = entries.map(e => {
    if (e.source) return e; // already tagged
    changed = true;
    if (kbTitles.has(e.title.toLowerCase())) {
      return { ...e, source: 'official' };
    }
    return { ...e, source: 'memory' };
  });
  if (changed) saveKnowledge(migrated);
  return migrated;
}

export default function KnowledgeBase() {
  const [tab, setTab] = useState('ace'); // 'ace' | 'bybit'
  const [entries, setEntries] = useState(() => migrateEntrySources(getKnowledge()));
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
    persist([...entries, { id: Date.now(), title: title.trim(), content: content.trim(), active: true, source: 'custom' }]);
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

  // Separate memory entries from official KB entries
  const memoryEntries = entries.filter(e => e.source !== 'official');
  const officialCount = entries.filter(e => e.source === 'official').length;
  const memoryActiveCount = memoryEntries.filter(e => e.active !== false).length;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-fg-0">Knowledge Base</h1>
          <p className="text-sm text-fg-2">Ace memory + Bybit official articles in one place</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-bg-1 border border-border-0 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab('ace')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150',
            tab === 'ace'
              ? 'bg-hero/15 text-hero'
              : 'text-fg-2 hover:text-fg-1'
          )}
        >
          🧠 Ace Memory
          {memoryActiveCount > 0 && (
            <span className="text-xs bg-hero/20 text-hero px-1.5 py-0.5 rounded-md">{memoryActiveCount}</span>
          )}
        </button>
        <button
          onClick={() => setTab('bybit')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150',
            tab === 'bybit'
              ? 'bg-hero/15 text-hero'
              : 'text-fg-2 hover:text-fg-1'
          )}
        >
          🌐 Bybit Official
          <span className="text-xs bg-bg-2 text-fg-2 px-1.5 py-0.5 rounded-md">{BYBIT_KB.length}{officialCount > 0 ? ` + ${officialCount} seeded` : ''}</span>
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
              className="flex items-center gap-1.5 text-xs text-fg-1 hover:text-hero bg-bg-2 hover:bg-bg-3 border border-border-0 px-3 py-2 rounded-lg transition-colors duration-150"
            >
              <Upload size={13} /> Import
            </button>
            <button
              onClick={exportKnowledge}
              disabled={entries.length === 0}
              className="flex items-center gap-1.5 text-xs text-fg-1 hover:text-hero bg-bg-2 hover:bg-bg-3 border border-border-0 px-3 py-2 rounded-lg transition-colors duration-150 disabled:opacity-40"
            >
              <Download size={13} /> Export
            </button>
            <button
              onClick={() => setShowAdd(!showAdd)}
              className="flex items-center gap-1.5 bg-hero/20 hover:bg-hero/30 text-hero text-xs px-3 py-2 rounded-lg transition-colors duration-150"
            >
              <Plus size={13} /> Add entry
            </button>
          </div>

          {importMsg && (
            <div className={cn(
              'rounded-xl px-4 py-2.5 text-sm border',
              importMsg.startsWith('✓') ? 'bg-ok/10 border-ok/20 text-ok' : 'bg-crit/10 border-crit/20 text-crit'
            )}>
              {importMsg}
            </div>
          )}

          {/* Status banner */}
          <div className={cn(
            'rounded-xl px-4 py-3 text-sm border',
            memoryActiveCount > 0
              ? 'bg-ok/10 border-ok/20 text-ok'
              : 'bg-bg-2 border-border-0 text-fg-2'
          )}>
            {memoryActiveCount > 0
              ? `✦ ${memoryActiveCount} memory entr${memoryActiveCount === 1 ? 'y' : 'ies'} active${officialCount > 0 ? ` · ${officialCount} Bybit KB articles loaded separately` : ''}`
              : 'No active memory entries — Ace has no persistent memory yet'
            }
          </div>

          {/* Add form */}
          {showAdd && (
            <div className="bg-bg-1 border border-hero/20 rounded-xl p-5 space-y-3">
              <p className="text-sm font-medium text-fg-1">New memory entry</p>
              <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
                placeholder="Title (e.g. My Role, Escalation Rule, EU Policy note...)"
                className="w-full bg-bg-2 border border-border-0 rounded-lg px-3 py-2.5 text-sm text-fg-0 placeholder-fg-2 outline-none focus:border-hero/50" />
              <textarea value={newContent} onChange={e => setNewContent(e.target.value)}
                placeholder="What should Ace always know and remember..."
                rows={4}
                className="w-full bg-bg-2 border border-border-0 rounded-lg px-3 py-2.5 text-sm text-fg-0 placeholder-fg-2 outline-none resize-none focus:border-hero/50" />
              <div className="flex gap-2">
                <button onClick={() => addEntry(newTitle, newContent)}
                  disabled={!newTitle.trim() || !newContent.trim()}
                  className="bg-hero disabled:bg-bg-3 disabled:text-fg-2 text-[#021418] font-medium text-sm px-5 py-2 rounded-lg hover:bg-hero transition-colors duration-150">
                  Save to memory
                </button>
                <button onClick={() => setShowAdd(false)} className="text-fg-2 text-sm px-4 py-2">Cancel</button>
              </div>
            </div>
          )}

          {/* Entries */}
          {memoryEntries.length > 0 ? (
            <div className="space-y-3">
              {memoryEntries.map(entry => (
                <EntryCard key={entry.id} entry={entry} onToggle={toggleEntry} onDelete={deleteEntry} onEdit={editEntry} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-fg-2 space-y-1">
              <p className="text-3xl">🧠</p>
              <p>No memory entries yet</p>
              <p className="text-sm">Add entries or import a backup</p>
            </div>
          )}

          {/* Suggested starters */}
          {memoryEntries.length === 0 && (
            <div className="space-y-3">
              <p className="text-xs text-fg-2 uppercase tracking-wider">Quick starters</p>
              <div className="grid gap-2">
                {SUGGESTED.map((s, i) => (
                  <button key={i} onClick={() => addEntry(s.title, s.content)}
                    className="flex items-center justify-between bg-bg-1 border border-border-0 hover:border-hero/30 rounded-xl px-4 py-3 text-left transition-colors duration-150 group cursor-pointer">
                    <div>
                      <p className="text-sm font-medium text-fg-1 group-hover:text-hero transition-colors duration-150">{s.title}</p>
                      <p className="text-xs text-fg-2 mt-0.5 truncate">{s.content}</p>
                    </div>
                    <Plus size={15} className="text-fg-2 group-hover:text-hero shrink-0 ml-3 transition-colors duration-150" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="bg-bg-1/50 border border-border-0 rounded-xl p-4 space-y-2">
            <p className="text-xs font-medium text-fg-1">Tips</p>
            {[
              'In any chat, type "remember: [title] — [content]" and Ace saves it automatically',
              'Hover over any Ace reply in chat and click 🧠 to save it directly to memory',
              'Export regularly as a backup — import it back any time to restore',
              'Disable entries temporarily without deleting them using the toggle',
            ].map((t, i) => (
              <p key={i} className="text-xs text-fg-2 flex items-start gap-1.5">
                <span className="text-hero/50 shrink-0">→</span> {t}
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
