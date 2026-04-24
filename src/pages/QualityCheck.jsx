import { useState } from 'react';
import { InvokeLLM } from '@/api/claude';
import { scrubPII } from '@/lib/SecurityModule';
import { Loader2 } from 'lucide-react';

const CRITERIA = [
  { key: 'tone', label: 'Tone & Empathy', weight: 25, desc: 'Professional, warm, and empathetic' },
  { key: 'clarity', label: 'Clarity', weight: 25, desc: 'Clear, concise, no jargon' },
  { key: 'resolution', label: 'Resolution', weight: 25, desc: 'Issue addressed fully and correctly' },
  { key: 'policy', label: 'Policy Accuracy', weight: 25, desc: 'Bybit policies stated correctly' },
];

export default function QualityCheck() {
  const [draft, setDraft] = useState('');
  const [context, setContext] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function analyze() {
    if (!draft.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await InvokeLLM({
        useKB: true,
        prompt: `Please review this Bybit customer support response for quality. ${context ? `Context: ${scrubPII(context)}` : ''}

RESPONSE TO REVIEW:
"${scrubPII(draft)}"

Score each category out of 100 and provide specific feedback. Return ONLY valid JSON in this exact format:
{
  "scores": {
    "tone": <0-100>,
    "clarity": <0-100>,
    "resolution": <0-100>,
    "policy": <0-100>
  },
  "overall": <0-100>,
  "grade": "<A/B/C/D/F>",
  "strengths": ["<point>", "<point>"],
  "improvements": ["<specific suggestion>", "<specific suggestion>"],
  "revised": "<improved version of the response>"
}`,
        system_prompt: 'You are a Bybit quality assurance specialist. Evaluate customer support responses for tone, clarity, resolution quality, and policy accuracy. Be constructive and specific. Return only valid JSON.',
      });

      try {
        const jsonMatch = res.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : res);
        setResult(parsed);
      } catch {
        setResult({ error: res });
      }
    } catch {
      setResult({ error: 'Failed to analyze. Please try again.' });
    }
    setLoading(false);
  }

  const gradeColor = {
    A: 'text-ok', B: 'text-info', C: 'text-hero', D: 'text-warn', F: 'text-crit',
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-fg-0">🎯 Quality Check</h1>
        <p className="text-sm text-fg-2">AI-powered tone, clarity and policy scoring for your responses</p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-fg-2 mb-1 block">Case context (optional)</label>
          <input
            value={context}
            onChange={e => setContext(e.target.value)}
            placeholder="e.g. Customer asking about missing USDT deposit on TRC-20"
            className="w-full bg-bg-1 border border-border-0 focus:border-hero/50 rounded-xl px-4 py-3 text-sm text-fg-0 placeholder-fg-2 outline-none"
          />
        </div>
        <div>
          <label className="text-xs text-fg-2 mb-1 block">Your response draft</label>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Paste your customer response here..."
            rows={7}
            className="w-full bg-bg-1 border border-border-0 focus:border-hero/50 rounded-xl px-4 py-3 text-sm text-fg-0 placeholder-fg-2 outline-none resize-none"
          />
        </div>
        <button
          onClick={analyze}
          disabled={!draft.trim() || loading}
          className="w-full bg-hero hover:bg-hero disabled:bg-bg-3 disabled:text-fg-2 text-[#021418] font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {loading ? <><Loader2 size={16} className="animate-spin" /> Analyzing...</> : '🎯 Score my response'}
        </button>
      </div>

      {result && !result.error && (
        <div className="space-y-4">
          {/* Overall score */}
          <div className="bg-bg-1 border border-border-0 rounded-xl p-5 flex items-center gap-6">
            <div className="text-center">
              <div className={`text-5xl font-bold ${gradeColor[result.grade] || 'text-fg-0'}`}>{result.grade}</div>
              <div className="text-xs text-fg-2 mt-1">Grade</div>
            </div>
            <div className="flex-1">
              <div className="flex justify-between text-xs text-fg-2 mb-1">
                <span>Overall score</span>
                <span className="text-fg-0 font-medium">{result.overall}/100</span>
              </div>
              <div className="h-2 bg-bg-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${result.overall >= 80 ? 'bg-ok' : result.overall >= 60 ? 'bg-hero' : 'bg-crit'}`}
                  style={{ width: `${result.overall}%` }}
                />
              </div>
            </div>
          </div>

          {/* Category scores */}
          <div className="grid grid-cols-2 gap-3">
            {CRITERIA.map(c => {
              const score = result.scores?.[c.key] ?? 0;
              return (
                <div key={c.key} className="bg-bg-1 border border-border-0 rounded-xl p-4">
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-fg-1">{c.label}</span>
                    <span className="text-xs font-medium text-fg-0">{score}/100</span>
                  </div>
                  <div className="h-1.5 bg-bg-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${score >= 80 ? 'bg-ok' : score >= 60 ? 'bg-hero' : 'bg-crit'}`}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                  <p className="text-xs text-fg-2 mt-1">{c.desc}</p>
                </div>
              );
            })}
          </div>

          {/* Feedback */}
          {result.strengths?.length > 0 && (
            <div className="bg-ok/10 border border-ok/20 rounded-xl p-4">
              <p className="text-xs font-semibold text-ok mb-2">✓ Strengths</p>
              <ul className="space-y-1">
                {result.strengths.map((s, i) => <li key={i} className="text-xs text-fg-1">{s}</li>)}
              </ul>
            </div>
          )}
          {result.improvements?.length > 0 && (
            <div className="bg-warn/10 border border-warn/20 rounded-xl p-4">
              <p className="text-xs font-semibold text-warn mb-2">⬆ Improvements</p>
              <ul className="space-y-1">
                {result.improvements.map((s, i) => <li key={i} className="text-xs text-fg-1">{s}</li>)}
              </ul>
            </div>
          )}
          {result.revised && (
            <div className="bg-bg-1 border border-hero/20 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-hero">✦ Suggested revision</p>
                <button onClick={() => navigator.clipboard.writeText(result.revised)} className="text-xs text-fg-2 hover:text-hero">Copy</button>
              </div>
              <p className="text-xs text-fg-1 whitespace-pre-wrap leading-relaxed">{result.revised}</p>
            </div>
          )}
        </div>
      )}

      {result?.error && (
        <div className="bg-crit/10 border border-crit/30 rounded-xl p-4 text-sm text-crit">{result.error}</div>
      )}
    </div>
  );
}
