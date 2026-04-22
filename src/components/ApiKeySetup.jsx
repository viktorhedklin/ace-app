import { useState } from 'react';
import { setApiKey } from '@/api/claude';

export default function ApiKeySetup({ onSaved }) {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function save() {
    const trimmed = key.trim();
    if (!trimmed.startsWith('sk-ant-')) {
      setError('Anthropic keys start with sk-ant-');
      return;
    }
    setLoading(true);
    setError('');
    // Quick validation ping — list models endpoint
    try {
      const res = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': trimmed,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
      });
      if (!res.ok) {
        setError('Invalid API key — Anthropic rejected it.');
        setLoading(false);
        return;
      }
    } catch {
      setError('Could not reach Anthropic. Check your internet connection.');
      setLoading(false);
      return;
    }
    setApiKey(trimmed);
    setLoading(false);
    onSaved();
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="text-5xl mb-4">✦</div>
          <h1 className="text-2xl font-bold text-yellow-400">ACE</h1>
          <p className="text-slate-400 text-sm">Enter your Anthropic API key to get started</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">Anthropic API Key</label>
            <input
              type="password"
              value={key}
              onChange={e => { setKey(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && save()}
              placeholder="sk-ant-..."
              className="w-full bg-slate-800 border border-slate-700 focus:border-yellow-400/50 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 outline-none transition-colors font-mono"
            />
            {error && <p className="text-xs text-red-400 mt-1.5">{error}</p>}
          </div>

          <button
            onClick={save}
            disabled={!key.trim() || loading}
            className="w-full bg-yellow-400 hover:bg-yellow-300 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 font-semibold py-3 rounded-xl transition-colors"
          >
            {loading ? 'Verifying...' : 'Launch ACE →'}
          </button>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-2">
          <p className="text-xs font-medium text-slate-400">🔒 Privacy & Safety</p>
          <ul className="space-y-1">
            {[
              'Your key is stored only on this device (localStorage)',
              "Never sent anywhere except Anthropic's API servers",
              'App runs 100% locally — no accounts, no cloud sync',
              'Customer PII is scrubbed before any text reaches the model',
            ].map((t, i) => (
              <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                <span className="text-green-500 shrink-0">✓</span> {t}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-center text-xs text-slate-700">
          Get your key at console.anthropic.com → API Keys
        </p>
      </div>
    </div>
  );
}
