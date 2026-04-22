import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import { motion, LayoutGroup, AnimatePresence } from 'framer-motion';
import { BYBIT_KB, DOMAINS, DOMAIN_COLORS } from '@/data/bybitKB';
import { cn } from '@/lib/utils';
import { getMacros } from '@/lib/macros';
import { useAce } from '@/context/AceContext';

// Heavy spring — "particle assembly" snap-in feel
const ASSEMBLE_SPRING = { type: 'spring', stiffness: 500, damping: 22, mass: 0.7 };

// Shared spring — consistent with page transitions (ζ=0.75)
const LIST_SPRING = { type: 'spring', stiffness: 400, damping: 30 };

// All navigable destinations
const NAV_ITEMS = [
  // Dashboard
  { id: 'dashboard', label: 'Dashboard', icon: '🏠', path: '/', group: 'Pages' },
  { id: 'knowledge', label: 'Knowledge Base', icon: '🧠', path: '/knowledge', group: 'Pages' },
  { id: 'settings', label: 'Settings', icon: '⚙️', path: '/settings', group: 'Pages' },
  // Chat channels
  { id: 'bybit-eu', label: 'Bybit EU — Email', icon: '🇪🇺', path: '/bybit-eu', group: 'Chat Channels', badge: 'EMAIL' },
  { id: 'eu-live-chat', label: 'EU Live Chat', icon: '🇪🇺', path: '/eu-live-chat', group: 'Chat Channels', badge: 'CHAT' },
  { id: 'bybit-global', label: 'Bybit Global — Email', icon: '🌍', path: '/bybit-global', group: 'Chat Channels', badge: 'EMAIL' },
  { id: 'global-live-chat', label: 'Global Live Chat', icon: '🌍', path: '/global-live-chat', group: 'Chat Channels', badge: 'CHAT' },
  { id: 'personal', label: 'Personal', icon: '✦', path: '/personal', group: 'Chat Channels', badge: 'CHAT' },
  // Tools
  { id: 'workspace', label: 'Workspace', icon: '🗂️', path: '/workspace', group: 'Tools' },
  { id: 'sepa-delay', label: 'SEPA Delay', icon: '💶', path: '/sepa-delay', group: 'Tools' },
  { id: 'quick-lookup', label: 'Quick Lookup', icon: '⚡', path: '/quick-lookup', group: 'Tools' },
  { id: 'campaign', label: 'Campaign', icon: '🎁', path: '/campaign', group: 'Tools' },
  { id: 'shift-tracker', label: 'Shift Tracker', icon: '📊', path: '/shift-tracker', group: 'Tools' },
  { id: 'hack-case', label: 'Hack Case', icon: '🔴', path: '/hack-case', group: 'Tools' },
  { id: 'missing-deposit', label: 'Missing Deposit', icon: '💸', path: '/missing-deposit', group: 'Tools' },
  { id: 'account-matters', label: 'Account Matters', icon: '👤', path: '/account-matters', group: 'Tools' },
  { id: 'p2p-advertiser', label: 'P2P Advertiser', icon: '🤝', path: '/p2p-advertiser', group: 'Tools' },
  { id: 'p2p-dispute', label: 'P2P Dispute', icon: '⚖️', path: '/p2p-dispute', group: 'Tools' },
  { id: 'card-decline', label: 'Card Decline', icon: '💳', path: '/card-decline', group: 'Tools' },
  { id: 'chain-lookup', label: 'Chain Lookup', icon: '🔗', path: '/chain-lookup', group: 'Tools' },
  { id: 'quality-check', label: 'Quality Check', icon: '🎯', path: '/quality-check', group: 'Tools' },
  { id: 'closed-cases', label: 'Closed Cases', icon: '📋', path: '/closed-cases', group: 'Tools' },
  { id: 'probation-prep', label: 'Probation Prep', icon: '🎓', path: '/probation-prep', group: 'Tools' },
  { id: 'quick-templates', label: 'Quick Templates', icon: '💬', path: '/quick-templates', group: 'Tools' },
  { id: 'follow-up', label: 'Follow-up', icon: '📬', path: '/follow-up', group: 'Tools' },
  { id: 'translate', label: 'Translate', icon: '🌐', path: '/translate', group: 'Tools' },
  { id: 'csat-predictor', label: 'CSAT Predictor', icon: '⭐', path: '/csat-predictor', group: 'Tools' },
];

// Build KB items for searching
const KB_ITEMS = BYBIT_KB.map(article => ({
  id: `kb-${article.id}`,
  label: article.title,
  subtitle: article.subtitle,
  icon: DOMAINS.find(d => d.id === article.domain)?.icon || '📄',
  domain: article.domain,
  domainColor: article.domainColor,
  path: '/knowledge',
  group: 'Bybit KB',
  url: article.url,
  isKB: true,
}));

export default function CommandPalette({ open, onClose }) {
  const [search, setSearch] = useState('');
  const [copiedSnippet, setCopiedSnippet] = useState(null);
  const navigate = useNavigate();
  const { snippets, parsedData } = useAce();

  // Reset search when opened
  useEffect(() => {
    if (open) { setSearch(''); setCopiedSnippet(null); }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose();
    }
    if (open) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  function handleSelect(item) {
    if (item.isSnippet) {
      // Personalize: replace [USER_ID] with active UID
      let content = item.content || '';
      if (parsedData?.uid) {
        content = content.replace(/\[USER_ID\]/g, parsedData.uid);
      }
      navigator.clipboard.writeText(content);
      setCopiedSnippet(item.id);
      setTimeout(() => { setCopiedSnippet(null); onClose(); }, 800);
      return;
    }
    onClose();
    if (item.isKB && item.url) {
      navigate('/knowledge');
    } else {
      navigate(item.path);
    }
  }

  return (
    <AnimatePresence>
    {open && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" />

      {/* Panel — particle assembly */}
      <motion.div
        initial={{ opacity: 0, scale: 0.90, y: -12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.93, y: -8 }}
        transition={ASSEMBLE_SPRING}
        className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden"
        style={{ boxShadow: '0 0 0 1px rgba(250,204,21,0.08), 0 25px 50px rgba(0,0,0,0.6)' }}
        onClick={e => e.stopPropagation()}
      >
        <Command className="flex flex-col" shouldFilter={true}>
          {/* Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800">
            <span className="text-slate-500 text-base">⌘</span>
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Jump to any tool, channel, or Bybit guide…"
              className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 outline-none"
              autoFocus
            />
            <kbd className="text-xs text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">ESC</kbd>
          </div>

          {/* Results — layout-animated so panel height shifts smoothly as search filters */}
          <LayoutGroup>
          <motion.div layout transition={LIST_SPRING}>
          <Command.List className="max-h-[420px] overflow-y-auto p-2 space-y-1">
            <Command.Empty className="py-8 text-center text-sm text-slate-600">
              No results for &ldquo;{search}&rdquo;
            </Command.Empty>

            {/* Navigation items — grouped */}
            {['Pages', 'Chat Channels', 'Tools'].map(group => {
              const items = NAV_ITEMS.filter(i => i.group === group);
              return (
                <Command.Group key={group} heading={group}
                  className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-slate-600 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider"
                >
                  {items.map(item => (
                    <Command.Item
                      key={item.id}
                      value={`${item.label} ${item.group}`}
                      onSelect={() => handleSelect(item)}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors duration-100',
                        'text-slate-400 hover:text-slate-100',
                        'aria-selected:bg-yellow-400/10 aria-selected:text-yellow-400',
                        'data-[selected=true]:bg-yellow-400/10 data-[selected=true]:text-yellow-400'
                      )}
                    >
                      <span className="text-base w-5 text-center shrink-0">{item.icon}</span>
                      <span className="flex-1">{item.label}</span>
                      {item.badge && (
                        <span className={cn(
                          'text-xs px-1.5 py-0.5 rounded font-medium shrink-0',
                          item.badge === 'CHAT' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
                        )}>{item.badge}</span>
                      )}
                    </Command.Item>
                  ))}
                </Command.Group>
              );
            })}

            {/* Bybit KB articles */}
            <Command.Group heading="Bybit KB"
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-slate-600 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider"
            >
              {KB_ITEMS.map(item => {
                const colors = DOMAIN_COLORS[item.domainColor];
                return (
                  <Command.Item
                    key={item.id}
                    value={`${item.label} ${item.subtitle} ${item.domain} KB`}
                    onSelect={() => handleSelect(item)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors duration-100',
                      'aria-selected:bg-yellow-400/10',
                      'data-[selected=true]:bg-yellow-400/10'
                    )}
                  >
                    <span className="text-base w-5 text-center shrink-0">{item.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-300 leading-snug truncate aria-selected:text-yellow-400">{item.label}</p>
                      <p className="text-xs text-slate-600 truncate">{item.subtitle}</p>
                    </div>
                    <span className={cn('text-xs px-1.5 py-0.5 rounded border shrink-0', colors.bg, colors.text, colors.border)}>
                      {item.domain}
                    </span>
                  </Command.Item>
                );
              })}
            </Command.Group>

            {/* Macros group — inside Command.List for proper filtering */}
            {(() => {
              const macros = getMacros();
              if (!macros.length) return null;
              return (
                <Command.Group heading="Macros (Alt+1–9)"
                  className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-slate-600 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider"
                >
                  {macros.map(m => (
                    <Command.Item
                      key={m.id}
                      value={`macro ${m.name} ${m.key}`}
                      onSelect={() => { onClose(); handleSelect({ path: m.actions[0]?.path || '/' }); }}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors duration-100 text-slate-400 hover:text-slate-100 aria-selected:bg-yellow-400/10 aria-selected:text-yellow-400 data-[selected=true]:bg-yellow-400/10 data-[selected=true]:text-yellow-400"
                    >
                      <span className="text-base w-5 text-center shrink-0">{m.icon}</span>
                      <span className="flex-1">{m.name}</span>
                      <kbd className="text-xs text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">Alt+{m.key}</kbd>
                    </Command.Item>
                  ))}
                </Command.Group>
              );
            })()}

            {/* Snippets — type "/" to focus, auto-personalizes [USER_ID] */}
            {snippets.length > 0 && (
              <Command.Group heading="Snippets (type /)"
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-slate-600 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider"
              >
                {snippets.map(s => (
                  <Command.Item
                    key={`snippet-${s.id}`}
                    value={`/ snippet ${s.title} ${s.content?.slice(0, 60) || ''}`}
                    onSelect={() => handleSelect({ isSnippet: true, id: s.id, content: s.content })}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors duration-100',
                      'text-slate-400 hover:text-slate-100',
                      'aria-selected:bg-yellow-400/10 aria-selected:text-yellow-400',
                      'data-[selected=true]:bg-yellow-400/10 data-[selected=true]:text-yellow-400'
                    )}
                  >
                    <span className="text-base w-5 text-center shrink-0">
                      {copiedSnippet === s.id ? '✓' : '📋'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-snug truncate">{s.title}</p>
                      <p className="text-xs text-slate-600 truncate">{s.content?.slice(0, 80)}</p>
                    </div>
                    {copiedSnippet === s.id && (
                      <span className="text-xs text-green-400 font-medium shrink-0">Copied!</span>
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
          </motion.div>
          </LayoutGroup>

          {/* Footer hint */}
          <div className="px-4 py-2.5 border-t border-slate-800 flex items-center justify-between">
            <p className="text-xs text-slate-700">
              <kbd className="bg-slate-800 px-1 py-0.5 rounded border border-slate-700 text-slate-600">↑↓</kbd> navigate &nbsp;
              <kbd className="bg-slate-800 px-1 py-0.5 rounded border border-slate-700 text-slate-600">↵</kbd> open &nbsp;
              <kbd className="bg-slate-800 px-1 py-0.5 rounded border border-slate-700 text-slate-600">/</kbd> snippets &nbsp;
              <kbd className="bg-slate-800 px-1 py-0.5 rounded border border-slate-700 text-slate-600">Alt+1–9</kbd> macros
            </p>
            <p className="text-xs text-slate-700">{NAV_ITEMS.length + KB_ITEMS.length + snippets.length} items</p>
          </div>
        </Command>
      </motion.div>
    </motion.div>
    )}
    </AnimatePresence>
  );
}

// Hook: returns open state + keyboard shortcut handler
export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  const handleKeyDown = useCallback((e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setOpen(o => !o);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { open, setOpen };
}
