import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Key, Lock, Sparkles, ShieldCheck, CheckCircle2, AlertTriangle } from 'lucide-react';
import { setApiKey, setProvider } from '@/api/claude';
import { setAlibabaKey } from '@/api/alibaba';
import { enterBrowseMode } from '@/lib/gate';
import { cn } from '@/lib/utils';

/* ─── Tabs ────────────────────────────────────────────────────────────────── */
const TABS = [
  { id: 'key', label: 'API Key', icon: Key, hint: 'Full Ace — AI chat + all workflows' },
  { id: 'browse', label: 'Browse Mode', icon: Sparkles, hint: 'Workflows, SOPs, QA tracker — no AI chat' },
];

export default function ApiKeySetup({ onSaved }) {
  const [tab, setTab] = useState('key');

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

        {/* ── Panel ── */}
        <AnimatePresence mode="wait">
          {tab === 'key' && (
            <motion.div key="key" {...panelMotion}>
              <ApiKeyPanel onSaved={onSaved} />
            </motion.div>
          )}

          {tab === 'browse' && (
            <motion.div key="browse" {...panelMotion}>
              <BrowsePanel onUnlock={onSaved} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Privacy ── */}
        <div className="bg-bg-1/50 border border-border-0 rounded-xl p-4 space-y-2">
          <p className="type-caption font-display font-semibold text-fg-1 flex items-center gap-1.5">
            <ShieldCheck size={12} className="text-hero" /> Privacy &amp; Safety
          </p>
          <ul className="space-y-1">
            {[
              'Sign-in is handled by Supabase — real sessions, no shared passphrase',
              'API keys are proxied server-side; your BYO key stays on this device',
              'Customer PII is scrubbed before any text reaches the model',
              'No analytics — your data syncs only to your own account',
            ].map((t, i) => (
              <li key={i} className="type-caption text-fg-2 flex items-start gap-1.5">
                <CheckCircle2 size={11} className="text-ok shrink-0 mt-0.5" /> {t}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-center type-caption text-fg-3">
          Ace v1.0 · built for night-shift operators
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

    // Auto-detect provider by prefix.
    // Anthropic keys are sk-ant-…; everything else here is treated as an
    // Alibaba Cloud (DashScope) key, which is ACE's default provider.
    const isAnthropic = trimmed.startsWith('sk-ant-');

    if (isAnthropic) {
      setApiKey(trimmed);
    } else {
      // Alibaba Cloud / DashScope (sk-…). Trust the format; the proxy validates
      // on first call. Set the active provider so routing picks Qwen/DeepSeek.
      setAlibabaKey(trimmed);
      setProvider('alibaba');
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
          placeholder="sk-… (Alibaba Cloud / DashScope)"
          className="w-full bg-bg-2 border border-border-0 focus:border-hero/50 rounded-xl px-4 py-3 text-sm text-fg-0 placeholder-fg-3 outline-none transition-colors font-mono"
          autoFocus
        />
        <p className="type-caption text-fg-3 mt-1.5">Paste your Alibaba Cloud (DashScope) key to run Qwen &amp; DeepSeek. Keys stay on this device.</p>
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
function BrowsePanel({ onUnlock }) {
  function enter() {
    enterBrowseMode();
    onUnlock();
  }

  return (
    <div className="bg-bg-1 border border-border-0 rounded-2xl p-6 space-y-4">
      <div className="space-y-2">
        <p className="type-body-sm text-fg-1 flex items-center gap-1.5">
          <Lock size={12} className="text-hero" /> No-key mode
        </p>
        <p className="type-caption text-fg-3">
          Unlocks all workflows, SOPs, quicktexts, heatmap and the QA tracker.
          AI chat stays locked until you add an API key. You can add one anytime in Settings.
        </p>
      </div>

      <button onClick={enter} className="cta-primary w-full">
        <span className="relative z-10">Enter Browse Mode →</span>
      </button>
    </div>
  );
}
