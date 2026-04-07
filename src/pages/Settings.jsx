import { useState } from 'react';
import { getApiKey, setApiKey, clearApiKey } from '@/api/claude';
import { Check, Eye, EyeOff, Trash2, AlertTriangle } from 'lucide-react';

function Section({ title, children }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800">
        <h2 className="font-semibold text-slate-100 text-sm">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function Settings() {
  const [apiKey, setApiKeyState] = useState(getApiKey);
  const [newKey, setNewKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [keyError, setKeyError] = useState('');

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
    { key: 'ace_knowledge', label: 'Knowledge Base', desc: 'All knowledge entries' },
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
        <h1 className="text-xl font-bold text-slate-100">⚙️ Settings</h1>
        <p className="text-sm text-slate-500">API key, data management and app preferences</p>
      </div>

      {/* API Key */}
      <Section title="🔑 Anthropic API Key">
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-800 rounded-lg px-4 py-3">
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Current key</p>
              <p className="text-sm font-mono text-slate-300">{showKey ? apiKey : maskedKey}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowKey(!showKey)} className="text-slate-500 hover:text-slate-300 transition-colors">
                {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
              {apiKey && (
                <button onClick={removeKey} className="text-slate-500 hover:text-red-400 transition-colors">
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">Replace key</label>
            <div className="flex gap-2">
              <input
                type="password"
                value={newKey}
                onChange={e => { setNewKey(e.target.value); setKeyError(''); }}
                placeholder="sk-ant-..."
                className="flex-1 bg-slate-800 border border-slate-700 focus:border-yellow-400/50 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 outline-none font-mono"
              />
              <button
                onClick={saveKey}
                disabled={!newKey.trim()}
                className="bg-yellow-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 font-medium text-sm px-4 rounded-lg hover:bg-yellow-300 transition-colors flex items-center gap-1"
              >
                {saved ? <><Check size={13} /> Saved</> : 'Save'}
              </button>
            </div>
            {keyError && <p className="text-xs text-red-400 mt-1">{keyError}</p>}
          </div>

          <p className="text-xs text-slate-600">Key is stored only in your browser's localStorage. Never sent anywhere except Anthropic's API.</p>
        </div>
      </Section>

      {/* Data management */}
      <Section title="🗄️ Data Management">
        <div className="space-y-3">
          {DATA_STORES.map((store, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
              <div>
                <p className="text-sm text-slate-200">{store.label}</p>
                <p className="text-xs text-slate-500">{store.desc}</p>
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
                className="text-xs text-slate-600 hover:text-red-400 transition-colors shrink-0 ml-4"
              >
                Clear
              </button>
            </div>
          ))}

          {chatHistoryKeys.length > 0 && (
            <div className="flex items-center justify-between py-2 border-b border-slate-800">
              <div>
                <p className="text-sm text-slate-200">Chat histories</p>
                <p className="text-xs text-slate-500">{chatHistoryKeys.length} conversation{chatHistoryKeys.length !== 1 ? 's' : ''} stored</p>
              </div>
              <button
                onClick={() => {
                  if (!confirm('Clear all chat histories?')) return;
                  chatHistoryKeys.forEach(k => localStorage.removeItem(k));
                  window.location.reload();
                }}
                className="text-xs text-slate-600 hover:text-red-400 transition-colors shrink-0 ml-4"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      </Section>

      {/* Danger zone */}
      <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle size={15} className="text-red-400" />
          <h2 className="font-semibold text-red-400 text-sm">Danger Zone</h2>
        </div>
        <p className="text-xs text-slate-500">This will wipe all app data — shift logs, cases, knowledge base, templates, chat history. Your API key will be preserved.</p>
        <button
          onClick={clearAllData}
          className="text-xs bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 px-4 py-2 rounded-lg transition-colors"
        >
          Clear all app data
        </button>
      </div>

      {/* App info */}
      <div className="text-center space-y-1 pt-2">
        <p className="text-xs text-slate-700">ACE Super Agent v1.0</p>
        <p className="text-xs text-slate-700">Running locally · Powered by Claude (claude-opus-4-6)</p>
      </div>
    </div>
  );
}
