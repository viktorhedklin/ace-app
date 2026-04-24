import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Key, Lock, Sparkles, ShieldCheck, CheckCircle2, AlertTriangle } from 'lucide-react';
import { setApiKey } from '@/api/claude';
import { setOpenAIKey } from '@/api/openai';
import {
  verifyPassphrase,
  verifyMasterReset,
  enterBrowseMode,
  setNewPassphrase,
  clearPassphraseOverride,
} from '@/lib/gate';
import { cn } from '@/lib/utils';

/* ─── Tabs ────────────────────────────────────────────────────────────────── */
const TABS = [
  { id: 'key', label: 'API Key', icon: Key, hint: 'Full Ace — AI chat + all workflows' },
  { id: 'browse', label: 'Browse Mode', icon: Sparkles, hint: 'Workflows, SOPs, QA tracker — no AI chat' },
];

export default function ApiKeySetup({ onSaved }) {
  const [tab, setTab] = useState('key');
  const [showReset, setShowReset] = useState(false);

  return (
    <div className="min-h-screen bg-bg-0 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Atmospheric backdrop — extra on this screen */}
      <div
        className="absolute inset-0 pointer-events-none opacity-60"
        style={{
          background:
            'radial-gradient(ellipse 900px 500px at 50% 0%, var(--hero-glow-a) 0%, transparent 65%), radial-gradient(ellipse 600px 400px at 10% 100%, rgba(14,116,144,0.12) 0%, transparent 60%)',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 12, filter: 'blur(6px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.4, ease: [0.2, 0, 0.2, 1] }}
        className="w-full max-w-md space-y-6 relative z-10"
      >
        {/* ── Hero ── */}
        <div className="text-center space-y-2">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: [0.2, 0, 0.2, 1] }}
            className="text-5xl mb-4"
          >
            ✦
          </motion.div>
          <h1
            className="type-display text-brand-amber"
            style={{ textShadow: '0 0 28px rgba(245, 181, 68, 0.4)' }}
          >
            ACE
          </h1>
          <p className="type-body-sm text-fg-1">Bybit Support Co-Pilot — unlock to launch</p>
        </div>

        {/* ── Tabs ── */}
        {!showReset && (
          <div className="grid grid-cols-2 gap-2">
            {TABS.map(t => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'relative flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg type-caption transition-colors duration-220 cursor-pointer',
                    active ? 'bg-hero/10 text-hero border border-border-hero' : 'bg-bg-1 text-fg-2 border border-border-0 hover:border-border-1 hover:text-fg-1'
                  )}
                >
                  <Icon size={14} />
                  <span className="font-display font-semibold">{t.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Panel ── */}
        <AnimatePresence mode="wait">
          {!showReset && tab === 'key' && (
            <motion.div key="key" {...panelMotion}>
              <ApiKeyPanel onSaved={onSaved} />
            </motion.div>
          )}

          {!showReset && tab === 'browse' && (
            <motion.div key="browse" {...panelMotion}>
              <BrowsePanel onUnlock={onSaved} onOpenReset={() => setShowReset(true)} />
            </motion.div>
          )}

          {showReset && (
            <motion.div key="reset" {...panelMotion}>
              <ResetPanel onBack={() => setShowReset(false)} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Privacy ── */}
        {!showReset && (
          <div className="bg-bg-1/50 border border-border-0 rounded-xl p-4 space-y-2">
            <p className="type-caption font-display font-semibold text-fg-1 flex items-center gap-1.5">
              <ShieldCheck size={12} className="text-hero" /> Privacy &amp; Safety
            </p>
            <ul className="space-y-1">
              {[
                'Your key & passphrase live only on this device (localStorage)',
                'No backend, no analytics, no cloud sync',
                'Customer PII scrubbed before any text reaches the model',
                'Passphrases are SHA-256 hashed — plaintext is never stored',
              ].map((t, i) => (
                <li key={i} className="type-caption text-fg-2 flex items-start gap-1.5">
                  <CheckCircle2 size={11} className="text-ok shrink-0 mt-0.5" /> {t}
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-center type-caption text-fg-3">
          {showReset ? 'Master reset phrase required' : 'Ace v1.0 · built for night-shift operators'}
        </p>
      </motion.div>
    </div>
  );
}

const panelMotion = {
  initial: { opacity: 0, y: 10, filter: 'blur(4px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -10, filter: 'blur(4px)' },
  transition: { duration: 0.26, ease: [0.2, 0, 0.2, 1] },
};

/* ─── API Key Panel ───────────────────────────────────────────────────────── */
function ApiKeyPanel({ onSaved }) {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function save() {
    const trimmed = key.trim();
    if (!trimmed) return;

    setLoading(true);
    setError('');

    // Auto-detect provider by prefix
    const isAnthropic = trimmed.startsWith('sk-ant-');
    const isOpenAI = trimmed.startsWith('sk-') && !isAnthropic;

    if (!isAnthropic && !isOpenAI) {
      setError('Expected sk-ant-… (Anthropic) or sk-… (OpenAI)');
      setLoading(false);
      return;
    }

    try {
      if (isAnthropic) {
        const res = await fetch('https://api.anthropic.com/v1/models', {
          headers: {
            'x-api-key': trimmed,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
        });
        if (!res.ok) {
          setError('Invalid key — Anthropic rejected it.');
          setLoading(false);
          return;
        }
        setApiKey(trimmed);
      } else {
        // Skip validation for OpenAI to avoid extra request; trust format.
        setOpenAIKey(trimmed);
      }
    } catch {
      setError('Could not reach provider. Check your internet connection.');
      setLoading(false);
      return;
    }

    setLoading(false);
    onSaved();
  }

  return (
    <div className="bg-bg-1 border border-border-0 rounded-2xl p-6 space-y-4">
      <div>
        <label className="type-kpi-label text-fg-2 mb-2 block">API KEY</label>
        <input
          type="password"
          value={key}
          onChange={e => { setKey(e.target.value); setError(''); }}
          onKeyDown={e => e.key === 'Enter' && save()}
          placeholder="sk-ant-… or sk-…"
          className="w-full bg-bg-2 border border-border-0 focus:border-hero/50 rounded-xl px-4 py-3 text-sm text-fg-0 placeholder-fg-3 outline-none transition-colors font-mono"
          autoFocus
        />
        <p className="type-caption text-fg-3 mt-1.5">Auto-detects Anthropic or OpenAI. Pasted keys never leave your browser.</p>
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="type-caption text-crit mt-2 flex items-center gap-1.5"
            >
              <AlertTriangle size={11} /> {error}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <button
        onClick={save}
        disabled={!key.trim() || loading}
        className="cta-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="relative z-10">{loading ? 'Verifying…' : 'Launch ACE →'}</span>
      </button>
    </div>
  );
}

/* ─── Browse Mode Panel ───────────────────────────────────────────────────── */
function BrowsePanel({ onUnlock, onOpenReset }) {
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    const trimmed = passphrase.trim();
    if (!trimmed) return;
    setLoading(true);
    setError('');
    const ok = await verifyPassphrase(trimmed);
    if (!ok) {
      setError('Incorrect passphrase.');
      setLoading(false);
      return;
    }
    enterBrowseMode();
    setLoading(false);
    onUnlock();
  }

  return (
    <div className="bg-bg-1 border border-border-0 rounded-2xl p-6 space-y-4">
      <div>
        <label className="type-kpi-label text-fg-2 mb-2 block flex items-center gap-1.5">
          <Lock size={11} /> PASSPHRASE
        </label>
        <input
          type="password"
          value={passphrase}
          onChange={e => { setPassphrase(e.target.value); setError(''); }}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="Enter your passphrase…"
          className="w-full bg-bg-2 border border-border-0 focus:border-hero/50 rounded-xl px-4 py-3 text-sm text-fg-0 placeholder-fg-3 outline-none transition-colors font-mono"
          autoFocus
        />
        <p className="type-caption text-fg-3 mt-1.5">Unlocks all workflows, SOPs, quicktexts, heatmap, QA tracker. AI chat stays locked until you add an API key later.</p>
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="type-caption text-crit mt-2 flex items-center gap-1.5"
            >
              <AlertTriangle size={11} /> {error}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <button
        onClick={submit}
        disabled={!passphrase.trim() || loading}
        className="cta-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="relative z-10">{loading ? 'Verifying…' : 'Enter Browse Mode →'}</span>
      </button>

      <button
        onClick={onOpenReset}
        className="w-full type-caption text-fg-2 hover:text-hero transition-colors duration-220 cursor-pointer"
      >
        Forgot passphrase?
      </button>
    </div>
  );
}

/* ─── Reset Panel ─────────────────────────────────────────────────────────── */
function ResetPanel({ onBack }) {
  const [stage, setStage] = useState('verify'); // verify → new → done
  const [masterPhrase, setMasterPhrase] = useState('');
  const [newPhrase, setNewPhrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function verify() {
    setLoading(true);
    setError('');
    const ok = await verifyMasterReset(masterPhrase);
    setLoading(false);
    if (!ok) {
      setError('Incorrect master reset phrase.');
      return;
    }
    setStage('new');
  }

  async function applyNew() {
    if (!newPhrase.trim()) return;
    if (newPhrase !== confirm) {
      setError('New passphrases do not match.');
      return;
    }
    if (newPhrase.length < 8) {
      setError('New passphrase must be at least 8 characters.');
      return;
    }
    setLoading(true);
    await setNewPassphrase(newPhrase);
    setLoading(false);
    setStage('done');
  }

  function revertToDefault() {
    clearPassphraseOverride();
    setStage('done');
  }

  return (
    <div className="bg-bg-1 border border-border-0 rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-border-0">
        <Lock size={14} className="text-hero" />
        <h3 className="type-h3 text-fg-0">Reset Passphrase</h3>
      </div>

      {stage === 'verify' && (
        <>
          <div>
            <label className="type-kpi-label text-fg-2 mb-2 block">MASTER RESET PHRASE</label>
            <input
              type="password"
              value={masterPhrase}
              onChange={e => { setMasterPhrase(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && verify()}
              placeholder="Your master reset phrase…"
              className="w-full bg-bg-2 border border-border-0 focus:border-hero/50 rounded-xl px-4 py-3 text-sm text-fg-0 placeholder-fg-3 outline-none transition-colors font-mono"
              autoFocus
            />
            <p className="type-caption text-fg-3 mt-1.5">The one-time phrase you saved when Ace was installed. Cannot be recovered if lost.</p>
            {error && <p className="type-caption text-crit mt-2">{error}</p>}
          </div>
          <button
            onClick={verify}
            disabled={!masterPhrase.trim() || loading}
            className="cta-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="relative z-10">{loading ? 'Verifying…' : 'Verify →'}</span>
          </button>
        </>
      )}

      {stage === 'new' && (
        <>
          <div className="space-y-3">
            <div>
              <label className="type-kpi-label text-fg-2 mb-2 block">NEW PASSPHRASE</label>
              <input
                type="password"
                value={newPhrase}
                onChange={e => { setNewPhrase(e.target.value); setError(''); }}
                placeholder="New passphrase (min 8 chars)…"
                className="w-full bg-bg-2 border border-border-0 focus:border-hero/50 rounded-xl px-4 py-3 text-sm text-fg-0 placeholder-fg-3 outline-none transition-colors font-mono"
                autoFocus
              />
            </div>
            <div>
              <label className="type-kpi-label text-fg-2 mb-2 block">CONFIRM</label>
              <input
                type="password"
                value={confirm}
                onChange={e => { setConfirm(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && applyNew()}
                placeholder="Confirm new passphrase…"
                className="w-full bg-bg-2 border border-border-0 focus:border-hero/50 rounded-xl px-4 py-3 text-sm text-fg-0 placeholder-fg-3 outline-none transition-colors font-mono"
              />
            </div>
            {error && <p className="type-caption text-crit mt-1">{error}</p>}
          </div>
          <button
            onClick={applyNew}
            disabled={!newPhrase.trim() || !confirm.trim() || loading}
            className="cta-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="relative z-10">{loading ? 'Saving…' : 'Set new passphrase →'}</span>
          </button>
          <button
            onClick={revertToDefault}
            className="w-full type-caption text-fg-2 hover:text-hero transition-colors duration-220 cursor-pointer"
          >
            Revert to default passphrase instead
          </button>
        </>
      )}

      {stage === 'done' && (
        <div className="text-center py-4 space-y-3">
          <CheckCircle2 size={32} className="text-ok mx-auto" />
          <p className="type-body text-fg-0">Passphrase updated.</p>
          <button onClick={onBack} className="cta-primary">
            <span className="relative z-10">Back to launch</span>
          </button>
        </div>
      )}

      {stage !== 'done' && (
        <button
          onClick={onBack}
          className="w-full type-caption text-fg-2 hover:text-hero transition-colors duration-220 cursor-pointer"
        >
          ← Cancel
        </button>
      )}
    </div>
  );
}
