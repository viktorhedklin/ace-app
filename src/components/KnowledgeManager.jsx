import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getKnowledge, saveKnowledge, getKBSyncUrl, setKBSyncUrl, syncKnowledgeFromRemote, getLastSyncTime } from '@/api/claude';
import { BYBIT_KB } from '@/data/bybitKB';
import {
  Brain, Search, Plus, Trash2, Edit3, Check, X, Download, Upload,
  ToggleLeft, ToggleRight, ChevronDown, ChevronUp, Copy, RefreshCw, Globe, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function KnowledgeManager() {
  const [entries, setEntries] = useState(() => getKnowledge());
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [copied, setCopied] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [importMsg, setImportMsg] = useState(null);

  // Remote sync state
  const [syncUrl, setSyncUrlState] = useState(() => getKBSyncUrl());
  const [syncUrlInput, setSyncUrlInput] = useState(() => getKBSyncUrl());
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [lastSync, setLastSync] = useState(() => getLastSyncTime());

  function persist(updated) {
    setEntries(updated);
    saveKnowledge(updated);
  }

  function saveSyncUrl() {
    const trimmed = syncUrlInput.trim();
    setKBSyncUrl(trimmed);
    setSyncUrlState(trimmed);
  }

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    const result = await syncKnowledgeFromRemote();
    if (result.synced) {
      setEntries(getKnowledge());
      setLastSync(getLastSyncTime());
    }
    setSyncResult(result);
    setSyncing(false);
    setTimeout(() => setSyncResult(null), 8000);
  }

  // Seed from built-in Bybit KB — no remote URL needed
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState(null);

  function seedFromBuiltinKB() {
    setSeeding(true);
    const existing = getKnowledge();
    const existingTitles = new Set(existing.map(e => e.title.toLowerCase()));
    const newEntries = BYBIT_KB
      .filter(a => !existingTitles.has(a.title.toLowerCase()))
      .map(a => ({
        id: Date.now() + Math.random(),
        title: a.title,
        content: `${a.subtitle}\n\n${a.steps?.map((s, i) => `${i + 1}. ${s}`).join('\n') || ''}\n\n${a.notes?.join('\n') || ''}`.trim(),
        active: true,
        source: 'official',
      }));
    if (newEntries.length) {
      persist([...existing, ...newEntries]);
    }
    setSeedResult({ added: newEntries.length, skipped: BYBIT_KB.length - newEntries.length });
    setSeeding(false);
    setTimeout(() => setSeedResult(null), 5000);
  }

  function toggleActive(id) {
    persist(entries.map(e => e.id === id ? { ...e, active: e.active === false ? true : false } : e));
  }

  function deleteEntry(id) {
    persist(entries.filter(e => e.id !== id));
  }

  function startEdit(entry) {
    setEditingId(entry.id);
    setEditTitle(entry.title);
    setEditContent(entry.content);
  }

  function saveEdit() {
    if (!editTitle.trim() || !editContent.trim()) return;
    persist(entries.map(e => e.id === editingId ? { ...e, title: editTitle.trim(), content: editContent.trim() } : e));
    setEditingId(null);
  }

  function addEntry() {
    if (!newTitle.trim() || !newContent.trim()) return;
    const entry = { id: Date.now() + Math.random(), title: newTitle.trim(), content: newContent.trim(), active: true, source: 'custom' };
    persist([...entries, entry]);
    setNewTitle('');
    setNewContent('');
    setAdding(false);
  }

  function copyEntry(content, id) {
    navigator.clipboard.writeText(content);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  // ── Export ──────────────────────────────────────────────────────────────────
  const handleExport = useCallback(() => {
    if (!entries.length) return;
    const snapshot = {
      exportedAt: new Date().toISOString(),
      type: 'ace_knowledge_backup',
      count: entries.length,
      entries,
    };
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ace-knowledge-${ts}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [entries]);

  // ── Import (drag-and-drop + click) ─────────────────────────────────────────
  const processImportFile = useCallback((file) => {
    if (!file || !file.name.endsWith('.json')) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        let imported = [];
        if (data.entries && Array.isArray(data.entries)) {
          imported = data.entries; // ace_knowledge_backup format
        } else if (Array.isArray(data)) {
          imported = data; // raw array format
        } else return;

        // Validate and normalize entries
        const valid = imported
          .filter(e => e.title && e.content)
          .map(e => ({
            id: e.id || Date.now() + Math.random(),
            title: String(e.title).trim(),
            content: String(e.content).trim(),
            active: e.active !== false,
          }));

        if (!valid.length) return;

        // Merge: skip duplicates by title
        const existingTitles = new Set(entries.map(e => e.title.toLowerCase()));
        const newOnes = valid.filter(e => !existingTitles.has(e.title.toLowerCase()));
        const dupeCount = valid.length - newOnes.length;

        if (newOnes.length) {
          persist([...entries, ...newOnes]);
        }

        setImportMsg({
          added: newOnes.length,
          dupes: dupeCount,
          total: valid.length,
        });
        setTimeout(() => setImportMsg(null), 4000);
      } catch { /* invalid JSON */ }
    };
    reader.readAsText(file);
  }, [entries]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    processImportFile(e.dataTransfer?.files?.[0]);
  }, [processImportFile]);

  const handleFileInput = useCallback((e) => {
    processImportFile(e.target.files?.[0]);
    e.target.value = ''; // reset so same file can be re-imported
  }, [processImportFile]);

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filtered = entries.filter(e => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return e.title.toLowerCase().includes(q) || e.content.toLowerCase().includes(q);
  });

  const activeCount = entries.filter(e => e.active !== false).length;

  return (
    <div
      className={cn(
        'bg-bg-1 border rounded-xl overflow-hidden transition-colors duration-200',
        dragOver ? 'border-hero/50' : 'border-border-0'
      )}
      onDrop={handleDrop}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-border-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain size={15} className="text-hero" />
            <h2 className="font-semibold text-fg-0 text-sm">Knowledge Base</h2>
            <span className="text-xs text-fg-2">{activeCount}/{entries.length} active</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Import button */}
            <label
              className="flex items-center gap-1 text-xs text-fg-2 hover:text-hero px-2 py-1 rounded-lg hover:bg-bg-2 transition-colors duration-150 cursor-pointer"
              title="Import knowledge from JSON"
            >
              <Upload size={12} />
              Import
              <input type="file" accept=".json" onChange={handleFileInput} className="hidden" />
            </label>
            {/* Export button */}
            <button
              onClick={handleExport}
              disabled={!entries.length}
              className="flex items-center gap-1 text-xs text-fg-2 hover:text-hero disabled:hover:text-fg-2 px-2 py-1 rounded-lg hover:bg-bg-2 disabled:hover:bg-transparent transition-colors duration-150 cursor-pointer disabled:cursor-not-allowed"
              title="Export knowledge to JSON"
              aria-label="Export knowledge base"
            >
              <Download size={12} />
              Export
            </button>
          </div>
        </div>

        {/* Import feedback */}
        <AnimatePresence>
          {importMsg && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <p className="text-xs text-hero mt-2">
                Imported {importMsg.added} new entr{importMsg.added === 1 ? 'y' : 'ies'}
                {importMsg.dupes > 0 && ` (${importMsg.dupes} duplicate${importMsg.dupes === 1 ? '' : 's'} skipped)`}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Drag overlay hint */}
        {dragOver && (
          <div className="mt-2 bg-hero/10 border border-dashed border-hero/30 rounded-lg px-3 py-2 text-center">
            <p className="text-xs text-hero font-medium">Drop JSON to import</p>
          </div>
        )}
      </div>

      {/* Remote Sync */}
      <div className="px-5 py-3 border-b border-border-0 space-y-2">
        <div className="flex items-center gap-2">
          <Globe size={12} className="text-cyan-400 shrink-0" />
          <span className="text-xs font-medium text-fg-1">Remote Sync</span>
          {lastSync && (
            <span className="text-xs text-fg-3 ml-auto">
              Last: {new Date(lastSync).toLocaleDateString()} {new Date(lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <input
            value={syncUrlInput}
            onChange={e => setSyncUrlInput(e.target.value)}
            onBlur={saveSyncUrl}
            onKeyDown={e => { if (e.key === 'Enter') { saveSyncUrl(); handleSync(); } }}
            placeholder="GitHub raw URL or any JSON endpoint"
            className="flex-1 bg-bg-2 border border-border-0 focus:border-cyan-400/50 rounded-lg px-3 py-2 text-xs text-fg-0 placeholder-fg-3 outline-none transition-colors duration-150 font-mono"
          />
          <button
            onClick={handleSync}
            disabled={!syncUrl || syncing}
            className={cn(
              'flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border font-medium transition-colors duration-150 shrink-0 cursor-pointer disabled:cursor-not-allowed',
              syncing
                ? 'bg-cyan-400/10 border-cyan-400/30 text-cyan-400/60'
                : 'bg-cyan-400/15 hover:bg-cyan-400/25 border-cyan-400/30 text-cyan-400 disabled:bg-bg-2 disabled:border-border-0 disabled:text-fg-2'
            )}
            title="Sync knowledge from remote URL now"
            aria-label="Sync now"
          >
            <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing...' : 'Sync'}
          </button>
        </div>

        {/* Sync result feedback */}
        <AnimatePresence>
          {syncResult && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              {syncResult.synced ? (
                <p className="text-xs text-cyan-400">
                  Synced: {syncResult.added} new, {syncResult.updated} updated — {syncResult.total} total
                </p>
              ) : (
                <div className="text-xs space-y-1">
                  <p className="text-crit">{syncResult.reason}</p>
                  <p className="text-fg-2">Check the URL — must return JSON with {"{"}"entries": [...]{"}"} format.</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Seed from built-in KB — always works, no remote needed */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={seedFromBuiltinKB}
            disabled={seeding}
            className="flex items-center gap-1.5 text-xs bg-hero/10 hover:bg-hero/20 border border-hero/20 text-hero px-3 py-1.5 rounded-lg transition-colors duration-150 cursor-pointer disabled:opacity-50"
            title="Import all 45 Bybit KB articles into your Knowledge Base — no URL needed"
          >
            <Zap size={11} />
            Seed from Bybit KB
          </button>
          <span className="text-[10px] text-fg-3">{BYBIT_KB.length} built-in articles — works offline</span>
        </div>

        <AnimatePresence>
          {seedResult && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <p className="text-xs text-hero">
                Seeded {seedResult.added} article{seedResult.added !== 1 ? 's' : ''}
                {seedResult.skipped > 0 && ` (${seedResult.skipped} already existed)`}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Search + Add */}
      <div className="px-5 py-3 border-b border-border-0 flex items-center gap-2">
        <div className="flex-1 relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-2" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search knowledge entries..."
            className="w-full bg-bg-2 border border-border-0 focus:border-hero/50 rounded-lg pl-8 pr-3 py-2 text-xs text-fg-0 placeholder-fg-3 outline-none transition-colors duration-150"
          />
        </div>
        <button
          onClick={() => { setAdding(true); setNewTitle(''); setNewContent(''); }}
          className="flex items-center gap-1 text-xs bg-hero/15 hover:bg-hero/25 border border-hero/30 text-hero px-3 py-2 rounded-lg transition-colors duration-150 shrink-0 cursor-pointer"
          aria-label="Add knowledge entry"
        >
          <Plus size={12} /> Add
        </button>
      </div>

      {/* Add new entry form */}
      <AnimatePresence>
        {adding && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-border-0"
          >
            <div className="px-5 py-4 space-y-3 bg-hero/5">
              <p className="text-xs font-medium text-hero">New Knowledge Entry</p>
              <input
                autoFocus
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="Title (e.g., EU SEPA processing time)"
                className="w-full bg-bg-2 border border-border-0 focus:border-hero/50 rounded-lg px-3 py-2 text-xs text-fg-0 placeholder-fg-2 outline-none transition-colors duration-150"
              />
              <textarea
                value={newContent}
                onChange={e => setNewContent(e.target.value)}
                placeholder="Content — the knowledge to remember..."
                rows={3}
                className="w-full bg-bg-2 border border-border-0 focus:border-hero/50 rounded-lg px-3 py-2 text-xs text-fg-0 placeholder-fg-2 outline-none resize-none transition-colors duration-150"
              />
              <div className="flex gap-2">
                <button
                  onClick={addEntry}
                  disabled={!newTitle.trim() || !newContent.trim()}
                  className="flex items-center gap-1 text-xs bg-hero/20 disabled:bg-bg-2 disabled:text-fg-2 text-hero hover:bg-hero/30 px-3 py-1.5 rounded-lg transition-colors duration-150 cursor-pointer disabled:cursor-not-allowed"
                >
                  <Check size={11} /> Save
                </button>
                <button
                  onClick={() => setAdding(false)}
                  className="flex items-center gap-1 text-xs text-fg-2 hover:text-fg-1 px-2 py-1.5 transition-colors duration-150 cursor-pointer"
                >
                  <X size={11} /> Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Entries list */}
      <div className="max-h-[400px] overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <Brain size={24} className="text-fg-3 mx-auto mb-2" />
            <p className="text-xs text-fg-2">
              {entries.length === 0
                ? 'No knowledge entries yet. Add one or enable Auto-Memory in chat.'
                : 'No matches found.'}
            </p>
          </div>
        ) : (
          filtered.map(entry => {
            const isEditing = editingId === entry.id;
            const isExpanded = expandedId === entry.id;
            const isActive = entry.active !== false;
            return (
              <div
                key={entry.id}
                className={cn(
                  'border-b border-border-0 last:border-0 transition-colors duration-150',
                  !isActive && 'opacity-50'
                )}
              >
                {isEditing ? (
                  /* Edit mode */
                  <div className="px-5 py-4 space-y-3 bg-bg-2/30">
                    <input
                      autoFocus
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      className="w-full bg-bg-2 border border-hero/30 rounded-lg px-3 py-2 text-xs text-fg-0 outline-none"
                    />
                    <textarea
                      value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                      rows={4}
                      className="w-full bg-bg-2 border border-hero/30 rounded-lg px-3 py-2 text-xs text-fg-0 outline-none resize-none"
                    />
                    <div className="flex gap-2">
                      <button onClick={saveEdit} className="flex items-center gap-1 text-xs bg-hero/20 text-hero hover:bg-hero/30 px-3 py-1.5 rounded-lg transition-colors duration-150 cursor-pointer">
                        <Check size={11} /> Save
                      </button>
                      <button onClick={() => setEditingId(null)} className="flex items-center gap-1 text-xs text-fg-2 hover:text-fg-1 px-2 py-1.5 transition-colors duration-150 cursor-pointer">
                        <X size={11} /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* View mode */
                  <div className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      {/* Toggle active */}
                      <button
                        onClick={() => toggleActive(entry.id)}
                        className={cn(
                          'shrink-0 transition-colors duration-150 cursor-pointer',
                          isActive ? 'text-hero' : 'text-fg-2'
                        )}
                        title={isActive ? 'Disable (exclude from prompts)' : 'Enable (include in prompts)'}
                        aria-label={isActive ? 'Disable entry' : 'Enable entry'}
                      >
                        {isActive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                      </button>

                      {/* Title — clickable to expand */}
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                        className="flex-1 text-left flex items-center gap-1.5 min-w-0 cursor-pointer"
                        aria-expanded={isExpanded}
                      >
                        <span className={cn('text-xs font-medium truncate', isActive ? 'text-fg-0' : 'text-fg-2')}>
                          {entry.title}
                        </span>
                        <span className={cn('text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0', {
                          'bg-info/15 text-info': entry.source === 'official',
                          'bg-purple-500/15 text-purple-400': entry.source === 'memory',
                          'bg-hero-soft/15 text-hero': entry.source === 'custom',
                          'bg-cyan-500/15 text-cyan-400': entry.source === 'remote',
                          'bg-bg-3 text-fg-2': !entry.source,
                        })}>
                          {entry.source === 'official' ? 'Bybit' : entry.source === 'memory' ? 'Memory' : entry.source === 'custom' ? 'Custom' : entry.source === 'remote' ? 'Remote' : 'Legacy'}
                        </span>
                        {isExpanded
                          ? <ChevronUp size={10} className="text-fg-2 shrink-0" />
                          : <ChevronDown size={10} className="text-fg-2 shrink-0" />
                        }
                      </button>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => copyEntry(entry.content, entry.id)}
                          className="text-fg-2 hover:text-fg-1 p-1 rounded transition-colors duration-150 cursor-pointer"
                          title="Copy content"
                          aria-label="Copy entry content"
                        >
                          {copied === entry.id ? <Check size={12} className="text-ok" /> : <Copy size={12} />}
                        </button>
                        <button
                          onClick={() => startEdit(entry)}
                          className="text-fg-2 hover:text-hero p-1 rounded transition-colors duration-150 cursor-pointer"
                          title="Edit"
                          aria-label="Edit entry"
                        >
                          <Edit3 size={12} />
                        </button>
                        <button
                          onClick={() => deleteEntry(entry.id)}
                          className="text-fg-2 hover:text-crit p-1 rounded transition-colors duration-150 cursor-pointer"
                          title="Delete"
                          aria-label="Delete entry"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Expanded content */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                          className="overflow-hidden"
                        >
                          <p className="text-xs text-fg-1 mt-2 pl-6 whitespace-pre-wrap leading-relaxed">
                            {entry.content}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-border-0 flex items-center justify-between">
        <p className="text-xs text-fg-3">
          {activeCount} active entr{activeCount === 1 ? 'y' : 'ies'} — injected into Chat only (utility tools skip KB)
        </p>
        {entries.length > 0 && (
          <button
            onClick={() => { if (confirm('Delete ALL knowledge entries? This cannot be undone.')) persist([]); }}
            className="text-xs text-fg-3 hover:text-crit transition-colors duration-150 cursor-pointer"
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}
