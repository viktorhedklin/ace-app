import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Menu, X, StickyNote, WifiOff } from 'lucide-react';
import CommandPalette, { useCommandPalette } from '@/components/CommandPalette';
import CaseTimeline from '@/components/CaseTimeline';
import SnippetSearch from '@/components/SnippetSearch';
import NebulaBackground from '@/components/NebulaBackground';
import { getMacros, executeMacro } from '@/lib/macros';
import { useAce } from '@/context/AceContext';
import { get as storageGet, set as storageSet, remove as storageRemove, NAMESPACES } from '@/lib/storage';

function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);
  return online;
}

const CHAT_CHANNELS = [
  { name: 'Bybit EU', type: 'EMAIL', flag: '🇪🇺', path: '/bybit-eu' },
  { name: 'EU Live Chat', type: 'CHAT', flag: '🇪🇺', path: '/eu-live-chat' },
  { name: 'Bybit Global', type: 'EMAIL', flag: '🌍', path: '/bybit-global' },
  { name: 'Global Live Chat', type: 'CHAT', flag: '🌍', path: '/global-live-chat' },
  { name: 'Personal', type: 'CHAT', flag: '✦', path: '/personal' },
];

const TOOLS = [
  { name: 'Workflow Hub', icon: '🔄', path: '/workflows' },
  { name: 'Scenario Studio', icon: '🎭', path: '/scenario-studio' },
  { name: 'SEPA Delay', icon: '💶', path: '/sepa-delay' },
  { name: 'Quick Lookup', icon: '⚡', path: '/quick-lookup' },
  { name: 'Campaign', icon: '🎁', path: '/campaign' },
  { name: 'Shift Tracker', icon: '📊', path: '/shift-tracker' },
  { name: 'Hack Case', icon: '🔴', path: '/hack-case' },
  { name: 'Missing Deposit', icon: '💸', path: '/missing-deposit' },
  { name: 'Account Matters', icon: '👤', path: '/account-matters' },
  { name: 'P2P Advertiser', icon: '🤝', path: '/p2p-advertiser' },
  { name: 'P2P Dispute', icon: '⚖️', path: '/p2p-dispute' },
  { name: 'Fiat Deposit', icon: '🏦', path: '/fiat-deposit' },
  { name: 'Fiat Withdrawal', icon: '💶', path: '/fiat-withdrawal' },
  { name: 'Referral Program', icon: '🎁', path: '/referral-program' },
  { name: 'Card Decline', icon: '💳', path: '/card-decline' },
  { name: 'Chain Lookup', icon: '🔗', path: '/chain-lookup' },
  { name: 'Quality Check', icon: '🎯', path: '/quality-check' },
  { name: 'Closed Cases', icon: '📋', path: '/closed-cases' },
  { name: 'Trajectory', icon: '🎯', path: '/trajectory' },
  { name: 'Quick Templates', icon: '💬', path: '/quick-templates' },
  { name: 'Follow-up', icon: '📬', path: '/follow-up' },
  { name: 'Translate 🇸🇪', icon: '🌐', path: '/translate' },
];

function NavLink({ to, icon, label, badge, badgeType, onClick }) {
  const location = useLocation();
  const active = location.pathname === to;
  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn('nav-item', active && 'is-active')}
    >
      <span className="text-base w-5 text-center shrink-0">{icon}</span>
      <span className="truncate flex-1">{label}</span>
      {badge && (
        <span className={cn(
          'type-badge px-1.5 py-0.5 rounded shrink-0',
          badgeType === 'CHAT' ? 'bg-ok/15 text-ok' : 'bg-info/15 text-info'
        )}>{badge}</span>
      )}
    </Link>
  );
}

function SidebarContent({ onNav, onOpenPalette, ghostMode, setGhostMode }) {
  return (
    <div className="flex flex-col h-full w-64 bg-bg-1 border-r border-border-0 relative">
      {/* Vertical accent rail */}
      <div className="absolute top-0 right-0 bottom-0 w-px bg-gradient-to-b from-transparent via-hero/10 to-transparent pointer-events-none" />

      <div className="p-5 border-b border-border-0 shrink-0">
        <Link to="/" onClick={onNav} className="flex items-center gap-2">
          <span
            className={cn(
              'font-display font-bold text-2xl tracking-tight transition-colors duration-220',
              ghostMode ? 'text-fg-3' : 'text-brand-amber'
            )}
            style={!ghostMode ? { textShadow: '0 0 20px rgba(245, 181, 68, 0.35)' } : {}}
          >
            ACE
          </span>
          <span className="type-badge text-fg-3 ml-1">v1.0</span>
          {ghostMode && (
            <span className="type-badge px-1.5 py-0.5 rounded bg-bg-2 text-fg-3 ml-auto">GHOST</span>
          )}
        </Link>
        <p className="type-caption text-fg-2 mt-1">Support Co-Pilot</p>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-4">
        <div className="space-y-0.5">
          <NavLink to="/" icon="🏠" label="Dashboard" onClick={onNav} />
          <NavLink to="/knowledge" icon="🧠" label="Knowledge Base" onClick={onNav} />
        </div>

        <div>
          <p className="type-nav-section px-3 pt-1 pb-2">Chat Channels</p>
          <div className="space-y-0.5">
            <NavLink to="/workspace" icon="🗂️" label="Workspace" badge="4x" badgeType="CHAT" onClick={onNav} />
            <div className="h-px bg-border-0 mx-3 my-1.5" />
            {CHAT_CHANNELS.map(ch => (
              <NavLink key={ch.path} to={ch.path} icon={ch.flag} label={ch.name} badge={ch.type} badgeType={ch.type} onClick={onNav} />
            ))}
          </div>
        </div>

        <div>
          <p className="type-nav-section px-3 pt-1 pb-2">Tools & Workflows</p>
          <div className="space-y-0.5">
            {TOOLS.map(t => (
              <NavLink key={t.path} to={t.path} icon={t.icon} label={t.name} onClick={onNav} />
            ))}
          </div>
        </div>
      </nav>

      <div className="p-3 border-t border-border-0 shrink-0 space-y-1">
        <NavLink to="/models" icon="🧪" label="Models & Usage" onClick={onNav} />
        <NavLink to="/settings" icon="⚙️" label="Settings" onClick={onNav} />
        <button
          onClick={onOpenPalette}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg type-caption text-fg-2 hover:text-fg-0 hover:bg-bg-2 transition-colors duration-220 cursor-pointer"
          aria-label="Open command palette"
        >
          <span>Search everything…</span>
          <kbd className="font-mono bg-bg-2 border border-border-0 px-1.5 py-0.5 rounded text-fg-2 text-[10px]">⌘K</kbd>
        </button>
        <button
          onClick={() => setGhostMode(prev => !prev)}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-1.5 rounded-lg type-caption transition-colors duration-220 cursor-pointer',
            ghostMode ? 'bg-bg-2 text-fg-1 hover:text-fg-0' : 'text-fg-3 hover:text-fg-2 hover:bg-bg-2/50'
          )}
          title="Ghost Mode — hide VIP glow & accents (⌘H)"
          aria-label="Toggle ghost mode"
        >
          <span className="text-base w-5 text-center shrink-0">👻</span>
          <span className="truncate flex-1 text-left">{ghostMode ? 'Ghost Mode ON' : 'Ghost Mode'}</span>
          <kbd className="font-mono bg-bg-2 border border-border-0 px-1.5 py-0.5 rounded text-fg-3 text-[10px] shrink-0">⌘H</kbd>
        </button>
      </div>
    </div>
  );
}

function CasePad() {
  const [open, setOpen] = useState(false);
  // Prefer adapter; fall back to legacy `casepad_notes` key during transition.
  const [notes, setNotes] = useState(() =>
    storageGet(NAMESPACES.SETTINGS, 'casepad_notes') ?? localStorage.getItem('casepad_notes') ?? ''
  );
  const textareaRef = useRef(null);
  const saveTimerRef = useRef(null);

  useEffect(() => {
    if (open && textareaRef.current) textareaRef.current.focus();
  }, [open]);

  // Cleanup pending save on unmount so we don't fire after component is gone.
  useEffect(() => () => clearTimeout(saveTimerRef.current), []);

  function handleChange(e) {
    const val = e.target.value;
    setNotes(val);
    // Debounced cloud write — avoids an upsert per keystroke.
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      storageSet(NAMESPACES.SETTINGS, 'casepad_notes', val);
      localStorage.removeItem('casepad_notes'); // drop legacy once adapter owns it
    }, 600);
  }

  function clear() {
    if (!window.confirm('Clear the scratchpad?')) return;
    clearTimeout(saveTimerRef.current);
    setNotes('');
    storageRemove(NAMESPACES.SETTINGS, 'casepad_notes');
    localStorage.removeItem('casepad_notes');
  }

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        title="CasePad — quick notes"
        className={cn(
          'fixed bottom-5 right-5 z-40 w-11 h-11 rounded-full flex items-center justify-center transition-colors duration-220 cursor-pointer',
          open
            ? 'bg-hero text-[#021418] shadow-glow-2'
            : 'bg-bg-2 border border-border-0 text-fg-1 hover:text-hero hover:border-border-hero'
        )}
        aria-label={open ? 'Close CasePad' : 'Open CasePad'}
      >
        {open ? <X size={16} /> : <StickyNote size={16} />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="fixed bottom-20 right-5 z-40 w-80 bg-bg-1 border border-border-hero rounded-2xl shadow-glow-1 flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-0">
              <span className="type-badge text-hero">📝 CASEPAD</span>
              <button onClick={clear} className="type-caption text-fg-2 hover:text-crit transition-colors">Clear</button>
            </div>
            <textarea
              ref={textareaRef}
              value={notes}
              onChange={handleChange}
              placeholder="Paste UID, order ID, jot case notes, anything mid-shift..."
              rows={10}
              className="w-full bg-transparent px-4 py-3 text-sm text-fg-0 placeholder-fg-3 outline-none resize-none font-mono"
            />
            <div className="px-4 py-2 border-t border-border-0">
              <p className="type-caption text-fg-3">Saved automatically · clears on clear only</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

const CHAT_PATHS = ['/bybit-eu', '/eu-live-chat', '/bybit-global', '/global-live-chat', '/personal', '/workspace'];

export default function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { open: paletteOpen, setOpen: setPaletteOpen } = useCommandPalette();
  const { vipLevel, ghostMode, setGhostMode } = useAce();
  const navigate = useNavigate();
  const location = useLocation();
  const isChatPage = CHAT_PATHS.includes(location.pathname);
  const isOnline = useOnlineStatus();

  // Macro Engine: Alt+1..9 global hotkeys + Ghost Mode ⌘+H
  useEffect(() => {
    function handleKey(e) {
      // Ghost Mode: ⌘+H (Mac) / Ctrl+H
      if ((e.metaKey || e.ctrlKey) && e.key === 'h') {
        e.preventDefault();
        setGhostMode(prev => !prev);
        return;
      }
      // Macros: Alt+1..9
      if (!e.altKey) return;
      const key = parseInt(e.key, 10);
      if (isNaN(key) || key < 1 || key > 9) return;
      const macros = getMacros();
      const macro = macros.find(m => m.key === key);
      if (macro) { e.preventDefault(); executeMacro(macro, navigate); }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [navigate, setGhostMode]);

  return (
    <div className="flex h-screen bg-bg-0 text-fg-0 relative overflow-hidden">
      {!ghostMode && <NebulaBackground vipLevel={vipLevel} />}
      {/* Desktop sidebar */}
      <div className="hidden md:flex flex-shrink-0 relative z-10">
        <SidebarContent onNav={() => {}} onOpenPalette={() => setPaletteOpen(true)} ghostMode={ghostMode} setGhostMode={setGhostMode} />
      </div>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 md:hidden"
          >
            <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="absolute left-0 top-0 h-full z-10"
            >
              <SidebarContent onNav={() => setMobileOpen(false)} onOpenPalette={() => { setMobileOpen(false); setPaletteOpen(true); }} ghostMode={ghostMode} setGhostMode={setGhostMode} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        {/* Mobile topbar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-bg-1 border-b border-border-0 shrink-0">
          <button onClick={() => setMobileOpen(true)} className="text-fg-1 hover:text-fg-0 transition-colors" aria-label="Open menu">
            <Menu size={20} />
          </button>
          <span className="font-display font-bold tracking-tight text-brand-amber" style={{ textShadow: '0 0 12px rgba(245, 181, 68, 0.35)' }}>ACE</span>
          <button
            onClick={() => setPaletteOpen(true)}
            className="ml-auto text-fg-2 hover:text-fg-0 transition-colors duration-220"
            aria-label="Open command palette"
          >
            <span className="type-caption font-mono bg-bg-2 border border-border-0 px-2 py-1 rounded-md">⌘K</span>
          </button>
        </div>
        {/* Offline banner */}
        <AnimatePresence>
          {!isOnline && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-warn/10 border-b border-warn/30 px-4 py-2 flex items-center gap-2 shrink-0"
            >
              <WifiOff size={13} className="text-warn shrink-0" />
              <p className="type-caption text-warn">You are offline. KB articles and cached pages are still available. API features require a connection.</p>
            </motion.div>
          )}
        </AnimatePresence>
        <main className={cn('flex-1 min-h-0', isChatPage ? 'overflow-hidden' : 'overflow-y-auto')}>
          {children}
        </main>
      </div>

      <CasePad />
      <CaseTimeline />
      <SnippetSearch />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
