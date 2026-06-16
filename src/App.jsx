import './App.css'
import { useState, useEffect, useRef } from 'react'
import Pages from "@/pages/index.jsx"
import { Toaster } from "@/components/ui/toaster"
import ApiKeySetup from "@/components/ApiKeySetup.jsx"
import SupabaseAuthGate from "@/components/SupabaseAuthGate.jsx"
import { hasAnyApiKey } from '@/api/claude'
import { AceProvider } from '@/context/AceContext'
import { syncOnBoot } from '@/lib/storage'
import { isConfigured, onAuthChange, signOut } from '@/lib/supabase'

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes

// ── App Root ──────────────────────────────────────────────────────────────────
// Auth is handled by SupabaseAuthGate (real magic-link sessions). After auth,
// the user still needs an LLM provider key (or browse mode) to reach the app.

function App() {
  const [hasKey, setHasKey] = useState(
    () => hasAnyApiKey() || sessionStorage.getItem('ace_browse_mode_unlocked') === 'true'
  );

  // ── Cloud sync: pull latest state on boot, re-sync on sign-in ─────────────
  useEffect(() => {
    syncOnBoot().catch(() => { /* storage stays local-first on failure */ });
    const unsub = onAuthChange(session => {
      if (session) syncOnBoot().catch(() => {});
    });
    return () => unsub();
  }, []);

  // ── Dead Man's Switch — 30 min inactivity signs the user out ──────────────
  // Only meaningful when Supabase auth is active.
  const timerRef = useRef(null);

  useEffect(() => {
    if (!isConfigured) return;

    function resetTimer() {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        signOut().catch(() => {});
      }, INACTIVITY_TIMEOUT);
    }

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(e => document.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      clearTimeout(timerRef.current);
      events.forEach(e => document.removeEventListener(e, resetTimer));
    };
  }, []);

  return (
    <SupabaseAuthGate>
      {hasKey ? (
        <AceProvider>
          <Pages />
          <Toaster />
        </AceProvider>
      ) : (
        <ApiKeySetup onSaved={() => setHasKey(true)} />
      )}
    </SupabaseAuthGate>
  );
}

export default App
