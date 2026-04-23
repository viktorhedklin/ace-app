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
  { name: 'Probation Prep', icon: '🎓', path: '/probation-prep' },
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
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all',
        active
          ? 'bg-yellow-400/15 text-yellow-400 font-medium'
          : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
      )}
    >
      <span className="text-base w-5 text-center shrink-0">{icon}</span>
      <span className="truncate flex-1">{label}</span>
      {badge && (
        <span className={cn(
          'text-xs px-1.5 py-0.5 rounded font-medium shrink-0',
          badgeType === 'CHAT' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
        )}>{badge}</span>
      )}
    </Link>
  );
}

function SidebarContent({ onNav, onOpenPalette, ghostMode, setGhostMode }) {
  return (
    <div className="flex flex-col h-full w-64 bg-slate-900 border-r border-slate-800">
      <div className="p-4 border-b border-slate-800 shrink-0">
        <Link to="/" onClick={onNav} className="flex items-center gap-2">
          <span className={cn('font-bold text-xl tracking-tight transition-colors duration-300', ghostMode ? 'text-slate-400' : 'text-yellow-400')}>ACE</span>
          <span className="text-slate-500 text-xs">Super Agent</span>
          {ghostMode && <span className="text-xs text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded font-mono">GHOST</span>}
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto p-2 space-y-3">
        <div className="space-y-0.5">
          <NavLink to="/" icon="🏠" label="Dashboard" onClick={onNav} />
          <NavLink to="/knowledge" icon="🧠" label="Knowledge Base" onClick={onNav} />
        </div>

        <div>
          <p className="px-3 pt-1 pb-1 text-xs font-semibold text-slate-600 uppercase tracking-wider">Chat Channels</p>
          <div className="space-y-0.5">
            <NavLink to="/workspace" icon="🗂️" label="Workspace" badge="4x" badgeType="CHAT" onClick={onNav} />
            <div className="h-px bg-slate-800 mx-3 my-1" />
            {CHAT_CHANNELS.map(ch => (
              <NavLink key={ch.path} to={ch.path} icon={ch.flag} label={ch.name} badge={ch.type} badgeType={ch.type} onClick={onNav} />
            ))}
          </div>
        </div>

        <div>
          <p className="px-3 pt-1 pb-1 text-xs font-semibold text-slate-600 uppercase tracking-wider">Tools & Workflows</p>
          <div className="space-y-0.5">
            {TOOLS.map(t => (
              <NavLink key={t.path} to={t.path} icon={t.icon} label={t.name} onClick={onNav} />
            ))}
          </div>
        </div>
      </nav>

      <div className="p-3 border-t border-slate-800 shrink-0 space-y-1">
        <NavLink to="/models" icon="🧪" label="Models & Usage" onClick={onNav} />
        <NavLink to="/settings" icon="⚙️" label="Settings" onClick={onNav} />
        <button
          onClick={onOpenPalette}
          className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs text-slate-600 hover:text-slate-400 hover:bg-slate-800 transition-colors duration-150 cursor-pointer"
          aria-label="Open command palette"
        >
          <span>Search everything…</span>
          <span className="flex items-center gap-1">
            <kbd className="bg-slate-800 border border-slate-700 px-1 py-0.5 rounded text-slate-600">⌘K</kbd>
          </span>
        </button>
        <button
          onClick={() => setGhostMode(prev => !prev)}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all duration-200 cursor-pointer',
            ghostMode
              ? 'bg-slate-800 text-slate-400 hover:text-slate-300'
              : 'text-slate-700 hover:text-slate-500 hover:bg-slate-800/50'
          )}
          title="Ghost Mode — hide VIP glow & accents (⌘H)"
          aria-label="Toggle ghost mode"
        >
          <span className="text-base w-5 text-center shrink-0">👻</span>
          <span className="truncate flex-1 text-left">{ghostMode ? 'Ghost Mode ON' : 'Ghost Mode'}</span>
          <kbd className="bg-slate-800 border border-slate-700 px-1 py-0.5 rounded text-slate-600 text-xs shrink-0">⌘H</kbd>
        </button>
        <p className="text-xs text-slate-700 text-center pt-1">Ace v1.0</p>
      </div>
    </div>
  );
}

function CasePad() {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(() => localStorage.getItem('casepad_notes') || '');
  const textareaRef = useRef(null);

  useEffect(() => {
    if (open && textareaRef.current) textareaRef.current.focus();
  }, [open]);

  function handleChange(e) {
    setNotes(e.target.value);
    localStorage.setItem('casepad_notes', e.target.value);
  }

  function clear() {
    if (!window.confirm('Clear the scratchpad?')) return;
    setNotes('');
    localStorage.removeItem('casepad_notes');
  }

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        title="CasePad — quick notes"
        className={cn(
          'fixed bottom-5 right-5 z-40 w-11 h-11 rounded-full flex items-center justify-center shadow-lg transition-all',
          open ? 'bg-yellow-400 text-slate-900' : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-yellow-400 hover:border-yellow-400/40'
        )}
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
            className="fixed bottom-20 right-5 z-40 w-80 bg-slate-900 border border-yellow-400/20 rounded-xl shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800">
              <span className="text-xs font-semibold text-yellow-400 tracking-wide">📝 CasePad</span>
              <button onClick={clear} className="text-xs text-slate-600 hover:text-red-400 transition-colors">Clear</button>
            </div>
            <textarea
              ref={textareaRef}
              value={notes}
              onChange={handleChange}
              placeholder="Paste UID, order ID, jot case notes, anything mid-shift..."
              rows={10}
              className="w-full bg-transparent px-4 py-3 text-sm text-slate-200 placeholder-slate-600 outline-none resize-none font-mono"
            />
            <div className="px-4 py-2 border-t border-slate-800">
              <p className="text-xs text-slate-700">Saved automatically · clears on clear only</p>
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
    <div className="flex h-screen bg-slate-950 text-slate-100 relative overflow-hidden">
      <NebulaBackground vipLevel={ghostMode ? 0 : vipLevel} />
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
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-slate-900 border-b border-slate-800 shrink-0">
          <button onClick={() => setMobileOpen(true)} className="text-slate-400 hover:text-slate-100" aria-label="Open menu">
            <Menu size={20} />
          </button>
          <span className="text-yellow-400 font-bold tracking-tight">ACE</span>
          <button
            onClick={() => setPaletteOpen(true)}
            className="ml-auto text-slate-600 hover:text-slate-400 transition-colors duration-150"
            aria-label="Open command palette"
          >
            <span className="text-xs bg-slate-800 border border-slate-700 px-2 py-1 rounded-md">⌘K</span>
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
              className="bg-orange-500/15 border-b border-orange-500/30 px-4 py-2 flex items-center gap-2 shrink-0"
            >
              <WifiOff size={13} className="text-orange-400 shrink-0" />
              <p className="text-xs text-orange-300">You are offline. KB articles and cached pages are still available. API features require a connection.</p>
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
