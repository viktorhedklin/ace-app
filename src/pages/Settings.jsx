import { useState, useEffect, useRef, useCallback } from 'react';
import { getApiKey, setApiKey, clearApiKey, getCostMode, setCostMode } from '@/api/claude';
import { getSerpApiKey, setSerpApiKey, clearSerpApiKey } from '@/api/search';
import { getOpenAIKey, setOpenAIKey, clearOpenAIKey } from '@/api/openai';
import { Check, Eye, EyeOff, Trash2, AlertTriangle, ShieldCheck, FolderOpen, Loader2, Globe, Zap, Scale, Leaf, Cloud, CloudOff, Mail, LogOut, RefreshCw, Upload } from 'lucide-react';
import KnowledgeManager from '@/components/KnowledgeManager';
import { getAllCases } from '@/lib/caseMemory';
import { isConfigured as supabaseConfigured, sendMagicLink, signOut as supabaseSignOut, getSession, getUserEmail, onAuthChange } from '@/lib/supabase';
import { pullAll, flushQueue, migrateFromLocalStorage } from '@/lib/storage';

function Section({ title, children }) {
  return (
    <div className="bg-bg-1 border border-border-0 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border-0">
        <h2 className="font-semibold text-fg-0 text-sm">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ── Auto-Vault — encrypted local snapshots ──────────────────────────────────

const VAULT_INTERVAL = 15 * 60 * 1000; // 15 minutes

async function deriveVaultKey() {
  const hash = import.meta.env.VITE_APP_HASH || '';
  // Use Terminal Gate hash as key material; fall back to a static salt if no gate
  const material = hash.length === 64 ? hash : 'ace-vault-default-key-2026';
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(material), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode('ace-vault-salt'), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  );
}

async function encryptData(data) {
  const key = await deriveVaultKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(data));
  // Combine IV + ciphertext into a single buffer
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  return combined;
}

async function collectSnapshot() {
  // Gather all localStorage data (except API key)
  const store = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k === 'claude_api_key' || k === 'openai_api_key') continue; // never vault secrets
    store[k] = localStorage.getItem(k);
  }
  // Gather IndexedDB cases
  let cases = [];
  try { cases = await getAllCases(); } catch { /* non-critical */ }
  return JSON.stringify({ ts: new Date().toISOString(), localStorage: store, indexedDB: { cases } });
}

function AutoVault() {
  const [dirHandle, setDirHandle] = useState(null);
  const [lastSave, setLastSave] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const intervalRef = useRef(null);

  const isSupported = typeof window.showDirectoryPicker === 'function';

  const saveSnapshot = useCallback(async (handle) => {
    if (!handle || saving) return;
    setSaving(true);
    setError('');
    try {
      const raw = await collectSnapshot();
      const encrypted = await encryptData(raw);
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const fileName = `ace-vault-${ts}.vault`;
      const fileHandle = await handle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(encrypted);
      await writable.close();
      setLastSave(new Date());
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [saving]);

  const enableVault = useCallback(async () => {
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      setDirHandle(handle);
      setError('');
      // Immediate first save
      await saveSnapshot(handle);
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message || 'Permission denied');
    }
  }, [saveSnapshot]);

  // Auto-save interval
  useEffect(() => {
    if (!dirHandle) return;
    intervalRef.current = setInterval(() => saveSnapshot(dirHandle), VAULT_INTERVAL);
    return () => clearInterval(intervalRef.current);
  }, [dirHandle, saveSnapshot]);

  function disableVault() {
    clearInterval(intervalRef.current);
    setDirHandle(null);
    setLastSave(null);
  }

  return (
    <Section title="🔐 Auto-Vault">
      <div className="space-y-3">
        <p className="text-xs text-fg-2">
          Automatically saves an AES-256 encrypted session snapshot to a local folder every 15 minutes.
          No cloud. Data never leaves your machine.
        </p>

        {!isSupported ? (
          <p className="text-xs text-hero/80 bg-hero/5 border border-hero/20 rounded-lg px-3 py-2">
            File System Access API not supported in this browser. Use Chrome or Edge.
          </p>
        ) : dirHandle ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
              <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-emerald-400 font-medium">Auto-Vault active</p>
                <p className="text-[10px] text-fg-2">
                  {saving ? 'Saving...' : lastSave ? `Last saved: ${lastSave.toLocaleTimeString()}` : 'Waiting for first save...'}
                </p>
              </div>
              <button
                onClick={() => saveSnapshot(dirHandle)}
                disabled={saving}
                className="text-xs text-fg-2 hover:text-fg-1 transition-colors cursor-pointer disabled:opacity-50"
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : 'Save now'}
              </button>
            </div>
            <button
              onClick={disableVault}
              className="text-xs text-fg-2 hover:text-crit transition-colors cursor-pointer"
            >
              Disable Auto-Vault
            </button>
          </div>
        ) : (
          <button
            onClick={enableVault}
            className="flex items-center gap-2 text-xs bg-bg-2 hover:bg-hero/15 border border-border-0 hover:border-hero/30 text-fg-1 hover:text-hero px-4 py-2.5 rounded-lg transition-colors duration-150 cursor-pointer"
          >
            <FolderOpen size={14} />
            Select vault folder
          </button>
        )}

        {error && <p className="text-xs text-crit">{error}</p>}

        <p className="text-[10px] text-fg-3">
          Encrypted with AES-256-GCM. Key derived from Terminal Gate hash via PBKDF2 (100k iterations).
        </p>
      </div>
    </Section>
  );
}

// ── Cloud Sync — Supabase-backed persistence ───────────────────────────────

function CloudSync() {
  const [email, setEmail] = useState('');
  const [sendingLink, setSendingLink] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [userEmail, setUserEmailState] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  // Track auth state so the panel reacts to sign-in / sign-out.
  useEffect(() => {
    let mounted = true;
    getSession().then(session => {
      if (mounted) setUserEmailState(session?.user?.email || null);
    });
    const unsub = onAuthChange(session => {
      if (mounted) {
        setUserEmailState(session?.user?.email || null);
        setLinkSent(false);
      }
    });
    return () => { mounted = false; unsub(); };
  }, []);

  async function handleSendLink() {
    setError('');
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) { setError('Enter a valid email address.'); return; }
    setSendingLink(true);
    try {
      await sendMagicLink(trimmed);
      setLinkSent(true);
    } catch (err) {
      setError(err.message || 'Could not send magic link.');
    } finally {
      setSendingLink(false);
    }
  }

  async function handleSyncNow() {
    setError('');
    setStatus('');
    setSyncing(true);
    try {
      const flushed = await flushQueue();
      const pulled = await pullAll();
      const parts = [];
      if (flushed.flushed > 0) parts.push(`pushed ${flushed.flushed} queued`);
      if (pulled.ok) parts.push(`pulled ${pulled.count} rows`);
      setStatus(parts.join(' · ') || 'Already in sync.');
    } catch (err) {
      setError(err.message || 'Sync failed.');
    } finally {
      setSyncing(false);
    }
  }

  async function handleMigrate() {
    if (!confirm('Upload your existing localStorage data (shifts, trajectory, QA memory, saved cases) to the cloud? This is a one-time one-way push.')) return;
    setError('');
    setStatus('');
    setMigrating(true);
    try {
      const res = await migrateFromLocalStorage();
      if (!res.ok) setError(res.reason || 'Migration failed.');
      else setStatus(`Migrated ${res.migrated} item${res.migrated === 1 ? '' : 's'} to cloud.`);
    } catch (err) {
      setError(err.message || 'Migration failed.');
    } finally {
      setMigrating(false);
    }
  }

  async function handleSignOut() {
    if (!confirm('Sign out of cloud sync? Your local data stays on this device but will no longer sync.')) return;
    await supabaseSignOut();
  }

  if (!supabaseConfigured) {
    return (
      <Section title="☁️ Cloud Sync">
        <div className="flex items-center gap-2 bg-warn/10 border border-warn/30 rounded-lg px-3 py-2">
          <CloudOff size={14} className="text-warn shrink-0" />
          <div className="flex-1">
            <p className="text-xs text-warn font-medium">Not configured</p>
            <p className="text-[10px] text-fg-2">Add <span className="font-mono">VITE_SUPABASE_URL</span> and <span className="font-mono">VITE_SUPABASE_ANON_KEY</span> to <span className="font-mono">.env.local</span> and restart the dev server.</p>
          </div>
        </div>
      </Section>
    );
  }

  return (
    <Section title="☁️ Cloud Sync">
      <div className="space-y-3">
        <p className="text-xs text-fg-2">
          Keeps your trajectory, shifts, QA memory, saved cases, and knowledge base in sync across devices. End-to-end in your own Supabase project. Row-level security + magic-link auth.
        </p>

        {userEmail ? (
          <>
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
              <Cloud size={14} className="text-emerald-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-emerald-400 font-medium">Signed in as {userEmail}</p>
                <p className="text-[10px] text-fg-2">Writes sync automatically. Pull happens on app boot.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleSyncNow}
                disabled={syncing}
                className="flex items-center justify-center gap-2 text-xs bg-bg-2 hover:bg-hero/15 border border-border-0 hover:border-hero/30 text-fg-1 hover:text-hero px-3 py-2 rounded-lg transition-colors duration-150 cursor-pointer disabled:opacity-50"
                aria-label="Sync now"
              >
                {syncing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                {syncing ? 'Syncing…' : 'Sync now'}
              </button>
              <button
                onClick={handleMigrate}
                disabled={migrating}
                className="flex items-center justify-center gap-2 text-xs bg-bg-2 hover:bg-hero/15 border border-border-0 hover:border-hero/30 text-fg-1 hover:text-hero px-3 py-2 rounded-lg transition-colors duration-150 cursor-pointer disabled:opacity-50"
                aria-label="Migrate localStorage to cloud"
              >
                {migrating ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                {migrating ? 'Migrating…' : 'Push local → cloud'}
              </button>
            </div>

            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 text-xs text-fg-2 hover:text-crit transition-colors cursor-pointer"
              aria-label="Sign out of cloud sync"
            >
              <LogOut size={12} /> Sign out
            </button>
          </>
        ) : linkSent ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 bg-hero/10 border border-hero/30 rounded-lg px-3 py-2">
              <Mail size={14} className="text-hero shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-hero font-medium">Magic link sent to {email}</p>
                <p className="text-[10px] text-fg-2">Click the link in your inbox. You'll be redirected back to Ace signed in.</p>
              </div>
            </div>
            <button
              onClick={() => { setLinkSent(false); setEmail(''); }}
              className="text-xs text-fg-2 hover:text-fg-1 transition-colors cursor-pointer"
            >
              Send to a different email
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <label htmlFor="cloud-email" className="text-xs text-fg-2 block">Email address</label>
            <div className="flex gap-2">
              <input
                id="cloud-email"
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleSendLink()}
                placeholder="you@example.com"
                className="flex-1 bg-bg-2 border border-border-0 focus:border-hero/50 rounded-lg px-3 py-2 text-sm text-fg-0 placeholder-fg-3 outline-none"
              />
              <button
                onClick={handleSendLink}
                disabled={sendingLink || !email.trim()}
                className="bg-hero disabled:bg-bg-3 disabled:text-fg-2 text-[#021418] font-medium text-sm px-4 rounded-lg hover:bg-hero transition-colors flex items-center gap-1 cursor-pointer"
                aria-label="Send magic link"
              >
                {sendingLink ? <Loader2 size={13} className="animate-spin" /> : <><Mail size={13} /> Send link</>}
              </button>
            </div>
            <p className="text-[10px] text-fg-3">No password. Click the link we email you to sign in on this device.</p>
          </div>
        )}

        {status && <p className="text-xs text-emerald-400">{status}</p>}
        {error && <p className="text-xs text-crit">{error}</p>}
      </div>
    </Section>
  );
}

const COST_MODES = [
  {
    key: 'performance',
    label: 'Performance',
    icon: Zap,
    desc: 'Opus everywhere — best quality, highest cost',
    color: 'text-warn',
    bg: 'bg-orange-400/10 border-orange-400/30',
  },
  {
    key: 'balanced',
    label: 'Balanced',
    icon: Scale,
    desc: 'Opus for chat, Sonnet for tools + routing',
    color: 'text-hero',
    bg: 'bg-hero/10 border-hero/30',
  },
  {
    key: 'economy',
    label: 'Economy',
    icon: Leaf,
    desc: 'Sonnet everywhere — lowest cost',
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10 border-emerald-400/30',
  },
];

function CostModeSection() {
  const [mode, setMode] = useState(getCostMode);

  function pick(key) {
    setCostMode(key);
    setMode(key);
  }

  return (
    <Section title="💰 Cost Mode">
      <div className="space-y-3">
        <p className="text-xs text-fg-2">
          Controls which Claude model each feature uses. Prompt caching is always on — repeated system prompts cost 90% less automatically.
        </p>
        <div className="space-y-2">
          {COST_MODES.map(m => {
            const Icon = m.icon;
            const active = mode === m.key;
            return (
              <button
                key={m.key}
                onClick={() => pick(m.key)}
                aria-label={`Select ${m.label} cost mode`}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all duration-150 cursor-pointer ${
                  active ? m.bg : 'bg-bg-2 border-border-0 hover:border-border-1'
                }`}
              >
                <Icon size={16} className={active ? m.color : 'text-fg-2'} />
                <div className="flex-1">
                  <p className={`text-sm font-medium ${active ? m.color : 'text-fg-0'}`}>{m.label}</p>
                  <p className="text-xs text-fg-2">{m.desc}</p>
                </div>
                {active && (
                  <div className="w-5 h-5 rounded-full bg-hero flex items-center justify-center shrink-0">
                    <Check size={10} className="text-[#021418]" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-fg-3">
          Balanced saves ~60-70% vs Performance with minimal quality difference on utility tools.
        </p>
      </div>
    </Section>
  );
}

export default function Settings() {
  const [apiKey, setApiKeyState] = useState(getApiKey);
  const [newKey, setNewKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [keyError, setKeyError] = useState('');

  // SerpAPI
  const [serpKey, setSerpKeyState] = useState(getSerpApiKey);
  const [newSerpKey, setNewSerpKey] = useState('');
  const [showSerpKey, setShowSerpKey] = useState(false);
  const [serpSaved, setSerpSaved] = useState(false);
  const [serpError, setSerpError] = useState('');

  // OpenAI
  const [oaiKey, setOaiKeyState] = useState(getOpenAIKey);
  const [newOaiKey, setNewOaiKey] = useState('');
  const [showOaiKey, setShowOaiKey] = useState(false);
  const [oaiSaved, setOaiSaved] = useState(false);
  const [oaiError, setOaiError] = useState('');

  function saveKey() {
    const trimmed = newKey.trim();
    if (!trimmed.startsWith('sk-ant-')) { setKeyError('Anthropic keys start with sk-ant-'); return; }
    setApiKey(trimmed);
    setApiKeyState(trimmed);
    setNewKey('');
    setSaved(true);
    setKeyError('');
    setTimeout(() => setSaved(false), 2000);
  }

  function removeKey() {
    if (!confirm('Remove API key? The app will ask you to enter it again on next load.')) return;
    clearApiKey();
    setApiKeyState('');
    window.location.reload();
  }

  function saveSerpKey() {
    const trimmed = newSerpKey.trim();
    if (!trimmed) { setSerpError('Enter a SerpAPI key'); return; }
    setSerpApiKey(trimmed);
    setSerpKeyState(trimmed);
    setNewSerpKey('');
    setSerpSaved(true);
    setSerpError('');
    setTimeout(() => setSerpSaved(false), 2000);
  }

  function removeSerpKey() {
    if (!confirm('Remove SerpAPI key? Campaign web search will stop working.')) return;
    clearSerpApiKey();
    setSerpKeyState('');
  }

  function saveOaiKey() {
    const trimmed = newOaiKey.trim();
    if (!trimmed.startsWith('sk-')) { setOaiError('OpenAI keys start with sk-'); return; }
    setOpenAIKey(trimmed);
    setOaiKeyState(trimmed);
    setNewOaiKey('');
    setOaiSaved(true);
    setOaiError('');
    setTimeout(() => setOaiSaved(false), 2000);
  }

  function removeOaiKey() {
    if (!confirm('Remove OpenAI key? GPT models will be unavailable.')) return;
    clearOpenAIKey();
    setOaiKeyState('');
  }

  function clearData(key, label) {
    if (!confirm(`Clear all ${label}? This cannot be undone.`)) return;
    localStorage.removeItem(key);
    window.location.reload();
  }

  function clearAllData() {
    if (!confirm('Clear ALL app data? This removes shift logs, cases, templates, knowledge base, and chat history. Cannot be undone.')) return;
    const keepKey = getApiKey();
    localStorage.clear();
    if (keepKey) setApiKey(keepKey);
    window.location.reload();
  }

  const maskedKey = apiKey ? `sk-...${apiKey.slice(-6)}` : 'Not set';

  const DATA_STORES = [
    { key: null, label: 'Shift Tracker logs', desc: 'Daily case counts, CSAT scores, points', keys: Object.keys(localStorage).filter(k => k.startsWith('shift_')) },
    { key: 'closed_cases', label: 'Closed Cases', desc: 'All logged case records' },
    // Knowledge Base managed by KnowledgeManager component above
    { key: 'custom_campaigns', label: 'Campaign notes', desc: 'Custom campaign entries' },
    { key: 'custom_templates', label: 'Custom Templates', desc: 'User-added response templates' },
    { key: 'pinned_templates', label: 'Pinned Templates', desc: 'Template pin preferences' },
    { key: 'casepad_notes', label: 'CasePad notes', desc: 'Sticky note scratchpad' },
  ];

  // Chat histories
  const chatHistoryKeys = Object.keys(localStorage).filter(k => k.startsWith('chat_history_'));

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-fg-0">⚙️ Settings</h1>
        <p className="text-sm text-fg-2">API key, data management and app preferences</p>
      </div>

      {/* API Key */}
      <Section title="🔑 Anthropic API Key">
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-bg-2 rounded-lg px-4 py-3">
            <div>
              <p className="text-xs text-fg-2 mb-0.5">Current key</p>
              <p className="text-sm font-mono text-fg-1">{showKey ? apiKey : maskedKey}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowKey(!showKey)} className="text-fg-2 hover:text-fg-1 transition-colors">
                {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
              {apiKey && (
                <button onClick={removeKey} className="text-fg-2 hover:text-crit transition-colors">
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs text-fg-2 mb-1.5 block">Replace key</label>
            <div className="flex gap-2">
              <input
                type="password"
                value={newKey}
                onChange={e => { setNewKey(e.target.value); setKeyError(''); }}
                placeholder="sk-ant-..."
                className="flex-1 bg-bg-2 border border-border-0 focus:border-hero/50 rounded-lg px-3 py-2 text-sm text-fg-0 placeholder-fg-3 outline-none font-mono"
              />
              <button
                onClick={saveKey}
                disabled={!newKey.trim()}
                className="bg-hero disabled:bg-bg-3 disabled:text-fg-2 text-[#021418] font-medium text-sm px-4 rounded-lg hover:bg-hero transition-colors flex items-center gap-1"
              >
                {saved ? <><Check size={13} /> Saved</> : 'Save'}
              </button>
            </div>
            {keyError && <p className="text-xs text-crit mt-1">{keyError}</p>}
          </div>

          <p className="text-xs text-fg-2">Key is stored only in your browser's localStorage. Never sent anywhere except Anthropic's API.</p>
        </div>
      </Section>

      {/* SerpAPI Key */}
      <Section title="🌐 SerpAPI Key (Web Search)">
        <div className="space-y-4">
          <p className="text-xs text-fg-2">Powers live web search in Campaign lookup and other tools. Get a key at serpapi.com.</p>
          <div className="flex items-center justify-between bg-bg-2 rounded-lg px-4 py-3">
            <div>
              <p className="text-xs text-fg-2 mb-0.5">Current key</p>
              <p className="text-sm font-mono text-fg-1">{serpKey ? (showSerpKey ? serpKey : `...${serpKey.slice(-6)}`) : 'Not set'}</p>
            </div>
            <div className="flex items-center gap-2">
              {serpKey && (
                <>
                  <button onClick={() => setShowSerpKey(!showSerpKey)} className="text-fg-2 hover:text-fg-1 transition-colors cursor-pointer" aria-label={showSerpKey ? 'Hide SerpAPI key' : 'Show SerpAPI key'}>
                    {showSerpKey ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                  <button onClick={removeSerpKey} className="text-fg-2 hover:text-crit transition-colors cursor-pointer" aria-label="Remove SerpAPI key">
                    <Trash2 size={15} />
                  </button>
                </>
              )}
            </div>
          </div>
          <div>
            <label htmlFor="serp-key-input" className="text-xs text-fg-2 mb-1.5 block">{serpKey ? 'Replace key' : 'Add key'}</label>
            <div className="flex gap-2">
              <input
                id="serp-key-input"
                type="password"
                value={newSerpKey}
                onChange={e => { setNewSerpKey(e.target.value); setSerpError(''); }}
                onKeyDown={e => e.key === 'Enter' && saveSerpKey()}
                placeholder="Paste SerpAPI key..."
                className="flex-1 bg-bg-2 border border-border-0 focus:border-hero/50 rounded-lg px-3 py-2 text-sm text-fg-0 placeholder-fg-3 outline-none font-mono"
              />
              <button
                onClick={saveSerpKey}
                disabled={!newSerpKey.trim()}
                className="bg-hero disabled:bg-bg-3 disabled:text-fg-2 text-[#021418] font-medium text-sm px-4 rounded-lg hover:bg-hero transition-colors flex items-center gap-1 cursor-pointer"
                aria-label="Save SerpAPI key"
              >
                {serpSaved ? <><Check size={13} /> Saved</> : 'Save'}
              </button>
            </div>
            {serpError && <p className="text-xs text-crit mt-1">{serpError}</p>}
          </div>
        </div>
      </Section>

      {/* OpenAI API Key */}
      <Section title="🟢 OpenAI API Key">
        <div className="space-y-4">
          <p className="text-xs text-fg-2">Enables GPT-5.4, GPT-5.4 Mini and GPT-4.1 as model options. Switch provider in Models & Usage page.</p>
          <div className="flex items-center justify-between bg-bg-2 rounded-lg px-4 py-3">
            <div>
              <p className="text-xs text-fg-2 mb-0.5">Current key</p>
              <p className="text-sm font-mono text-fg-1">{oaiKey ? (showOaiKey ? oaiKey : `sk-...${oaiKey.slice(-6)}`) : 'Not set'}</p>
            </div>
            <div className="flex items-center gap-2">
              {oaiKey && (
                <>
                  <button onClick={() => setShowOaiKey(!showOaiKey)} className="text-fg-2 hover:text-fg-1 transition-colors cursor-pointer" aria-label={showOaiKey ? 'Hide OpenAI key' : 'Show OpenAI key'}>
                    {showOaiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                  <button onClick={removeOaiKey} className="text-fg-2 hover:text-crit transition-colors cursor-pointer" aria-label="Remove OpenAI key">
                    <Trash2 size={15} />
                  </button>
                </>
              )}
            </div>
          </div>
          <div>
            <label htmlFor="oai-key-input" className="text-xs text-fg-2 mb-1.5 block">{oaiKey ? 'Replace key' : 'Add key'}</label>
            <div className="flex gap-2">
              <input
                id="oai-key-input"
                type="password"
                value={newOaiKey}
                onChange={e => { setNewOaiKey(e.target.value); setOaiError(''); }}
                onKeyDown={e => e.key === 'Enter' && saveOaiKey()}
                placeholder="sk-..."
                className="flex-1 bg-bg-2 border border-border-0 focus:border-hero/50 rounded-lg px-3 py-2 text-sm text-fg-0 placeholder-fg-3 outline-none font-mono"
              />
              <button
                onClick={saveOaiKey}
                disabled={!newOaiKey.trim()}
                className="bg-hero disabled:bg-bg-3 disabled:text-fg-2 text-[#021418] font-medium text-sm px-4 rounded-lg hover:bg-hero transition-colors flex items-center gap-1 cursor-pointer"
                aria-label="Save OpenAI key"
              >
                {oaiSaved ? <><Check size={13} /> Saved</> : 'Save'}
              </button>
            </div>
            {oaiError && <p className="text-xs text-crit mt-1">{oaiError}</p>}
          </div>
        </div>
      </Section>

      {/* Cost Mode */}
      <CostModeSection />

      {/* Knowledge Base Manager */}
      <KnowledgeManager />

      {/* Data management */}
      <Section title="🗄️ Data Management">
        <div className="space-y-3">
          {DATA_STORES.map((store, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-border-0 last:border-0">
              <div>
                <p className="text-sm text-fg-0">{store.label}</p>
                <p className="text-xs text-fg-2">{store.desc}</p>
              </div>
              <button
                onClick={() => {
                  if (store.keys) {
                    if (!confirm(`Clear all ${store.label}?`)) return;
                    store.keys.forEach(k => localStorage.removeItem(k));
                    window.location.reload();
                  } else {
                    clearData(store.key, store.label);
                  }
                }}
                className="text-xs text-fg-2 hover:text-crit transition-colors shrink-0 ml-4"
              >
                Clear
              </button>
            </div>
          ))}

          {chatHistoryKeys.length > 0 && (
            <div className="flex items-center justify-between py-2 border-b border-border-0">
              <div>
                <p className="text-sm text-fg-0">Chat histories</p>
                <p className="text-xs text-fg-2">{chatHistoryKeys.length} conversation{chatHistoryKeys.length !== 1 ? 's' : ''} stored</p>
              </div>
              <button
                onClick={() => {
                  if (!confirm('Clear all chat histories?')) return;
                  chatHistoryKeys.forEach(k => localStorage.removeItem(k));
                  window.location.reload();
                }}
                className="text-xs text-fg-2 hover:text-crit transition-colors shrink-0 ml-4"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      </Section>

      {/* Cloud Sync */}
      <CloudSync />

      {/* Auto-Vault */}
      <AutoVault />

      {/* Danger zone */}
      <div className="bg-crit/5 border border-crit/20 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle size={15} className="text-crit" />
          <h2 className="font-semibold text-crit text-sm">Danger Zone</h2>
        </div>
        <p className="text-xs text-fg-2">This will wipe all app data — shift logs, cases, knowledge base, templates, chat history. Your API key will be preserved.</p>
        <button
          onClick={clearAllData}
          className="text-xs bg-crit/10 hover:bg-crit/20 border border-crit/30 text-crit px-4 py-2 rounded-lg transition-colors"
        >
          Clear all app data
        </button>
      </div>

      {/* App info */}
      <div className="text-center space-y-1 pt-2">
        <p className="text-xs text-fg-3">ACE Super Agent v1.0</p>
        <p className="text-xs text-fg-3">Running locally · Powered by Claude (Sonnet 4.6 / Opus 4.6)</p>
      </div>
    </div>
  );
}
