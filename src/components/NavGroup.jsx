import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { get as storageGet, set as storageSet, NAMESPACES } from '@/lib/storage';

/**
 * Collapsible sidebar section. Default-open state is the group containing the
 * current route; once the user explicitly toggles a group, that persisted
 * choice wins on future visits. `forceOpen` (active route or live filter
 * match) always visually expands without overwriting the persisted value.
 */
export default function NavGroup({ id, label, tools, forceOpen, filterQuery, onNav }) {
  const location = useLocation();
  const storageKey = `nav_group_${id}`;
  const isActiveGroup = tools.some(t => t.path === location.pathname);

  const [persistedOpen, setPersistedOpen] = useState(() => {
    const stored = storageGet(NAMESPACES.SETTINGS, storageKey);
    return stored ?? isActiveGroup;
  });

  const open = forceOpen || persistedOpen;

  function toggle() {
    const next = !persistedOpen;
    setPersistedOpen(next);
    storageSet(NAMESPACES.SETTINGS, storageKey, next);
  }

  const visibleTools = filterQuery
    ? tools.filter(t => t.name.toLowerCase().includes(filterQuery.toLowerCase()))
    : tools;

  if (filterQuery && visibleTools.length === 0) return null;

  return (
    <div>
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between px-3 pt-1 pb-2 cursor-pointer group"
        aria-expanded={open}
      >
        <span className="type-nav-section group-hover:text-fg-1 transition-colors duration-220">{label}</span>
        <ChevronRight
          size={11}
          className={cn('text-fg-3 group-hover:text-fg-1 transition-transform duration-220', open && 'rotate-90')}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="overflow-hidden"
          >
            <div className="space-y-0.5 pb-1">
              {visibleTools.map(t => {
                const active = location.pathname === t.path;
                return (
                  <Link
                    key={t.path}
                    to={t.path}
                    onClick={onNav}
                    className={cn('nav-item', active && 'is-active')}
                  >
                    <span className="text-base w-5 text-center shrink-0">{t.icon}</span>
                    <span className="truncate flex-1">{t.name}</span>
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
