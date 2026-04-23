import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Plus, Trash2, Copy } from 'lucide-react';
import { useAce } from '@/context/AceContext';
import { cn } from '@/lib/utils';

export default function SnippetSearch() {
  const { snippets, addSnippet, removeSnippet, snippetSearchOpen, setSnippetSearchOpen } = useAce();
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [copied, setCopied] = useState(null);
  const inputRef = useRef(null);

  // Focus search input on open
  useEffect(() => {
    if (snippetSearchOpen) {
      setQuery('');
      setAdding(false);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [snippetSearchOpen]);

  // Close on Escape
  useEffect(() => {
    if (!snippetSearchOpen) return;
    function handleKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setSnippetSearchOpen(false);
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [snippetSearchOpen, setSnippetSearchOpen]);

  const filtered = query.trim()
    ? snippets.filter(s =>
        s.title.toLowerCase().includes(query.toLowerCase()) ||
        s.content.toLowerCase().includes(query.toLowerCase())
      )
    : snippets;

  const handleAdd = useCallback(() => {
    if (!newTitle.trim() || !newContent.trim()) return;
    addSnippet(newTitle.trim(), newContent.trim());
    setNewTitle('');
    setNewContent('');
    setAdding(false);
  }, [newTitle, newContent, addSnippet]);

  const handleCopy = useCallback((content, id) => {
    navigator.clipboard.writeText(content);
    setCopied(id);
    setTimeout(() => setCopied(null), 1200);
  }, []);

  return (
    <AnimatePresence>
      {snippetSearchOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-black/60"
            onClick={() => setSnippetSearchOpen(false)}
          />
          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed top-[15%] left-1/2 -translate-x-1/2 z-50 w-full max-w-lg"
          >
            <div className="bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
              {/* Search header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800">
                <Search size={14} className="text-slate-500 shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search snippets..."
                  className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-600 outline-none"
                  aria-label="Search snippets"
                />
                <button
                  onClick={() => setAdding(a => !a)}
                  className="text-slate-500 hover:text-yellow-400 transition-colors duration-150 flex items-center justify-center w-7 h-7 rounded-lg hover:bg-slate-800 cursor-pointer"
                  aria-label="Add new snippet"
                  title="Add snippet"
                >
                  <Plus size={14} />
                </button>
                <button
                  onClick={() => setSnippetSearchOpen(false)}
                  className="text-slate-500 hover:text-slate-300 transition-colors duration-150 flex items-center justify-center w-7 h-7 rounded-lg hover:bg-slate-800 cursor-pointer"
                  aria-label="Close snippet search"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Add new snippet form */}
              <AnimatePresence>
                {adding && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 py-3 border-b border-slate-800 space-y-2">
                      <input
                        type="text"
                        value={newTitle}
                        onChange={e => setNewTitle(e.target.value)}
                        placeholder="Snippet title"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/30"
                        aria-label="Snippet title"
                      />
                      <textarea
                        value={newContent}
                        onChange={e => setNewContent(e.target.value)}
                        placeholder="Snippet content (templates, SOPs, macros...)"
                        rows={3}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 outline-none resize-none focus-visible:ring-2 focus-visible:ring-yellow-400/30"
                        aria-label="Snippet content"
                      />
                      <button
                        onClick={handleAdd}
                        disabled={!newTitle.trim() || !newContent.trim()}
                        className="w-full bg-yellow-400/10 text-yellow-400 text-xs font-medium py-2 rounded-lg hover:bg-yellow-400/20 transition-colors duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Save Snippet
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Results */}
              <div className="max-h-72 overflow-y-auto">
                {filtered.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <p className="text-xs text-slate-600">
                      {snippets.length === 0
                        ? 'No snippets yet. Click + to add one.'
                        : 'No matches found.'}
                    </p>
                  </div>
                ) : (
                  filtered.map(s => (
                    <div
                      key={s.id}
                      className="px-4 py-2.5 border-b border-slate-800/50 hover:bg-slate-900/60 transition-colors duration-100 group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-slate-300 truncate">{s.title}</span>
                        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                          <button
                            onClick={() => handleCopy(s.content, s.id)}
                            className="text-slate-600 hover:text-yellow-400 transition-colors duration-150 flex items-center justify-center w-6 h-6 rounded cursor-pointer"
                            aria-label={`Copy ${s.title}`}
                            title="Copy to clipboard"
                          >
                            <Copy size={11} />
                          </button>
                          <button
                            onClick={() => removeSnippet(s.id)}
                            className="text-slate-600 hover:text-red-400 transition-colors duration-150 flex items-center justify-center w-6 h-6 rounded cursor-pointer"
                            aria-label={`Delete ${s.title}`}
                            title="Delete snippet"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2 leading-relaxed">
                        {copied === s.id ? <span className="text-yellow-400">Copied</span> : s.content}
                      </p>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-2 border-t border-slate-800">
                <p className="text-[10px] text-slate-700 text-center">
                  {snippets.length} snippet{snippets.length !== 1 ? 's' : ''} · local storage only · Esc to close
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
