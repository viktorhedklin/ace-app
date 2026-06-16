// ─── Supabase Auth Gate ───────────────────────────────────────────────────────
// Real authentication gate. Replaces the old client-side SHA-256 passphrase.
// Sign-in is via Supabase magic link (cross-device, implicit flow).
//
// Behaviour:
//   • Supabase configured  → require a live session before the app loads.
//   • Supabase NOT configured (dev) → render children immediately (local-only),
//     so the app never hard-locks during local development.
//
// The parent (App.jsx) owns the dead-man's-switch; this component owns sign-in.

import { useState, useCallback, useEffect } from 'react';
import { isConfigured, sendMagicLink, getSession, onAuthChange } from '@/lib/supabase';

export default function SupabaseAuthGate({ children }) {
  // When Supabase isn't configured we treat the gate as "open" (dev mode).
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(!isConfigured);

  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  // Resolve the current session once on mount, then keep it in sync.
  useEffect(() => {
    if (!isConfigured) return;
    let active = true;
    getSession()
      .then(s => { if (active) { setSession(s); setReady(true); } })
      .catch(() => { if (active) setReady(true); });
    const unsub = onAuthChange(s => {
      setSession(s);
      setReady(true);
      if (s) { setSent(false); setEmail(''); }
    });
    return () => { active = false; unsub(); };
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || sending) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Enter a valid email address.');
      return;
    }
    setSending(true);
    setError('');
    try {
      await sendMagicLink(trimmed);
      setSent(true);
    } catch (err) {
      setError(err?.message || 'Could not send the sign-in link. Try again.');
    } finally {
      setSending(false);
    }
  }, [email, sending]);

  // Dev mode or signed in → render the app.
  if (!isConfigured || session) {
    return children;
  }

  // Still resolving the initial session — avoid a sign-in flash.
  if (!ready) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center">
        <div className="text-xs text-slate-500 uppercase tracking-widest animate-pulse">ACE</div>
      </div>
    );
  }

  // No session → sign-in screen.
  return (
    <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <div className="text-center space-y-1">
          <div className="text-2xl font-bold text-slate-100 tracking-tight">ACE</div>
          <div className="text-xs text-slate-500 uppercase tracking-widest">Sign in to continue</div>
        </div>

        {sent ? (
          <div className="space-y-3 text-center">
            <p className="text-sm text-slate-200">Check your inbox.</p>
            <p className="text-xs text-slate-500">
              We sent a sign-in link to <span className="text-slate-300">{email.trim()}</span>.
              Open it on any device to continue.
            </p>
            <button
              type="button"
              onClick={() => { setSent(false); setError(''); }}
              className="text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2 cursor-pointer"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(''); }}
              placeholder="you@company.com"
              autoFocus
              autoComplete="email"
              aria-label="Email address"
              className={`w-full bg-[#111926] border rounded-lg px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-blue-500/40 ${
                error ? 'border-red-500/60 focus-visible:ring-red-500/40' : 'border-slate-700/60'
              }`}
            />

            {error && (
              <p className="text-xs text-red-400 text-center" role="alert">{error}</p>
            )}

            <button
              type="submit"
              disabled={!email.trim() || sending}
              className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-600/40 text-slate-200 text-sm font-medium py-2.5 rounded-lg cursor-pointer transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {sending ? 'Sending link…' : 'Send sign-in link'}
            </button>

            <p className="text-[10px] text-slate-600 text-center">
              Passwordless sign-in via secure magic link.
            </p>
          </>
        )}
      </form>
    </div>
  );
}
