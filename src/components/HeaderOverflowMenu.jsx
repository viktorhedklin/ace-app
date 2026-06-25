import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * Hand-rolled overflow dropdown for infrequent header controls — same
 * trigger + expand-card pattern as CouncilBadge, styled with ACE tokens.
 */
export default function HeaderOverflowMenu({ triggerIcon: TriggerIcon, items, ariaLabel }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        aria-label={ariaLabel}
        aria-expanded={open}
        className={cn(
          'flex items-center justify-center w-7 h-7 rounded-lg border transition-colors duration-220 cursor-pointer',
          open ? 'bg-bg-2 border-border-hero text-fg-0' : 'border-border-0 text-fg-2 hover:text-fg-0 hover:bg-bg-2'
        )}
      >
        <TriggerIcon size={14} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            className="absolute right-0 top-full mt-1.5 overflow-hidden z-30"
          >
            <div className="bg-bg-1 border border-border-0 rounded-lg shadow-glow-1 py-1 w-48">
              {items.map((item, idx) => {
                const ItemIcon = item.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      item.onClick();
                      setOpen(false);
                    }}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left transition-colors duration-220 cursor-pointer',
                      item.danger
                        ? 'text-crit hover:bg-crit/10'
                        : item.active
                        ? 'text-hero hover:bg-bg-2'
                        : 'text-fg-1 hover:bg-bg-2 hover:text-fg-0'
                    )}
                  >
                    {ItemIcon && <ItemIcon size={13} className="shrink-0" />}
                    <span className="truncate flex-1">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
