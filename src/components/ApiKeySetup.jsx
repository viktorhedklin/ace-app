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
    <div className="min-h-screen bg-bg-0 flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="text-5xl mb-4">✦</div>
          <h1 className="text-2xl font-bold text-hero">ACE</h1>
          <p className="text-fg-1 text-sm">Enter your Anthropic API key to get started</p>
        </div>

        <div className="bg-bg-1 border border-border-0 rounded-2xl p-6 space-y-4">
          <div>
            <label className="text-xs text-fg-2 mb-1.5 block">Anthropic API Key</label>
            <input
              type="password"
              value={key}
              onChange={e => { setKey(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && save()}
              placeholder="sk-ant-..."
              className="w-full bg-bg-2 border border-border-0 focus:border-hero/50 rounded-xl px-4 py-3 text-sm text-fg-0 placeholder-fg-3 outline-none transition-colors font-mono"
            />
            {error && <p className="text-xs text-crit mt-1.5">{error}</p>}
          </div>

          <button
            onClick={save}
            disabled={!key.trim() || loading}
            className="w-full bg-hero hover:bg-hero disabled:bg-bg-3 disabled:text-fg-2 text-[#021418] font-semibold py-3 rounded-xl transition-colors"
          >
            {loading ? 'Verifying...' : 'Launch ACE →'}
          </button>
        </div>

        <div className="bg-bg-1/50 border border-border-0 rounded-xl p-4 space-y-2">
          <p className="text-xs font-medium text-fg-1">🔒 Privacy & Safety</p>
          <ul className="space-y-1">
            {[
              'Your key is stored only on this device (localStorage)',
              "Never sent anywhere except Anthropic's API servers",
              'App runs 100% locally — no accounts, no cloud sync',
              'Customer PII is scrubbed before any text reaches the model',
            ].map((t, i) => (
              <li key={i} className="text-xs text-fg-2 flex items-start gap-1.5">
                <span className="text-ok shrink-0">✓</span> {t}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-center text-xs text-fg-3">
          Get your key at console.anthropic.com → API Keys
        </p>
      </div>
    </div>
  );
}
