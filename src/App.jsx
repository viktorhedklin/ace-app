import './App.css'
import { useState, useCallback, useEffect, useRef } from 'react'
import Pages from "@/pages/index.jsx"
import { Toaster } from "@/components/ui/toaster"
import ApiKeySetup from "@/components/ApiKeySetup.jsx"
import { getApiKey, hasAnyApiKey } from '@/api/claude'
import { AceProvider } from '@/context/AceContext'

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes

// ── Terminal Gate — Master Key ────────────────────────────────────────────────
// Local-only auth. No cloud. No tokens. Password hashed client-side with
// SHA-256 and compared against VITE_APP_HASH set in .env.
// If the hash is not set, the gate is disabled (dev mode).

const APP_HASH = import.meta.env.VITE_APP_HASH || '';

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const buffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function TerminalGate({ onUnlock }) {
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!input.trim() || checking) return;
    setChecking(true);
    setError(false);
    const hash = await hashPassword(input.trim());
    if (hash === APP_HASH) {
      sessionStorage.setItem('ace_terminal_unlocked', '1');
      onUnlock();
    } else {
      setError(true);
      setInput('');
    }
    setChecking(false);
  }, [input, checking, onUnlock]);

  return (
    <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4"
      >
        <div className="text-center space-y-1">
          <div className="text-2xl font-bold text-slate-100 tracking-tight">ACE</div>
          <div className="text-xs text-slate-500 uppercase tracking-widest">Terminal Gate</div>
        </div>

        <div className="relative">
          <input
            type="password"
            value={input}
            onChange={e => { setInput(e.target.value); setError(false); }}
            placeholder="Master Key"
            autoFocus
            aria-label="Master Key password"
            className={`w-full bg-[#111926] border rounded-lg px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-blue-500/40 ${
              error ? 'border-red-500/60 focus-visible:ring-red-500/40' : 'border-slate-700/60'
            }`}
          />
        </div>

        {error && (
          <p className="text-xs text-red-400 text-center" role="alert">
            Access denied. Try again.
          </p>
        )}

        <button
          type="submit"
          disabled={!input.trim() || checking}
          className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-600/40 text-slate-200 text-sm font-medium py-2.5 rounded-lg cursor-pointer transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {checking ? 'Verifying...' : 'Unlock'}
        </button>

        <p className="text-[10px] text-slate-600 text-center">
          Local auth only. Zero cloud. Zero tokens.
        </p>
      </form>
    </div>
  );
}

// ── App Root ──────────────────────────────────────────────────────────────────

function App() {
  const gateEnabled = APP_HASH.length === 64;
  const [unlocked, setUnlocked] = useState(() =>
    !gateEnabled || sessionStorage.getItem('ace_terminal_unlocked') === '1'
  );
  const [hasKey, setHasKey] = useState(() => hasAnyApiKey() || sessionStorage.getItem('ace_browse_mode_unlocked') === 'true');

  // ── Dead Man's Switch — 30 min inactivity locks the gate ──────────────────
  const timerRef = useRef(null);

  useEffect(() => {
    if (!gateEnabled || !unlocked) return;

    function resetTimer() {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        sessionStorage.removeItem('ace_terminal_unlocked');
        setUnlocked(false);
      }, INACTIVITY_TIMEOUT);
    }

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(e => document.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      clearTimeout(timerRef.current);
      events.forEach(e => document.removeEventListener(e, resetTimer));
    };
  }, [gateEnabled, unlocked]);

  if (!unlocked) {
    return <TerminalGate onUnlock={() => setUnlocked(true)} />;
  }

  if (!hasKey) {
    return <ApiKeySetup onSaved={() => setHasKey(true)} />;
  }

  return (
    <AceProvider>
      <Pages />
      <Toaster />
    </AceProvider>
  );
}

export default App
