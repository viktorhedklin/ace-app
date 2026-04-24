import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check } from 'lucide-react';
import { LANGUAGES, QUICK_REPLIES } from '@/data/quickReplies';
import { cn } from '@/lib/utils';

export default function QuickReplies({ open, onClose, onInsert }) {
  const [lang, setLang] = useState('en');
  const [copied, setCopied] = useState(null);

  function handleInsert(text, idx) {
    onInsert(text);
    setCopied(idx);
    setTimeout(() => setCopied(null), 1200);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="absolute bottom-full left-0 right-0 mb-2 mx-4 bg-bg-1 border border-border-0 rounded-xl shadow-2xl overflow-hidden"
          style={{ maxHeight: '50vh', zIndex: 20 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-0">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-fg-0">Quick Replies</span>
              <div className="flex gap-1">
                {LANGUAGES.map(l => (
                  <button
                    key={l.id}
                    onClick={() => setLang(l.id)}
                    className={cn(
                      'flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors duration-150 cursor-pointer',
                      lang === l.id
                        ? 'bg-hero/15 border-hero/30 text-hero'
                        : 'bg-bg-2 border-border-0 text-fg-2 hover:text-fg-1'
                    )}
                    aria-label={`Switch to ${l.label}`}
                  >
                    <span>{l.flag}</span> {l.label}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-fg-2 hover:text-fg-1 transition-colors duration-150 cursor-pointer"
              aria-label="Close quick replies"
            >
              <X size={15} />
            </button>
          </div>

          {/* Replies list */}
          <div className="overflow-y-auto p-2 space-y-1" style={{ maxHeight: 'calc(50vh - 52px)' }}>
            {QUICK_REPLIES.map((r, i) => (
              <button
                key={i}
                onClick={() => handleInsert(r.replies[lang], i)}
                className="w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-bg-2/60 transition-colors duration-150 group cursor-pointer"
              >
                <span className="text-sm shrink-0 mt-0.5">{r.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-medium text-fg-1">{r.category}</span>
                    {copied === i && <Check size={10} className="text-ok" />}
                  </div>
                  <p className="text-xs text-fg-2 group-hover:text-fg-1 transition-colors duration-150 line-clamp-2">
                    {r.replies[lang]}
                  </p>
                </div>
                <Copy size={11} className="text-fg-3 group-hover:text-fg-2 transition-colors duration-150 shrink-0 mt-1" />
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
