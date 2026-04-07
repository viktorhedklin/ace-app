import { useState } from 'react';
import { InvokeLLM } from '@/api/claude';
import { Loader2, Copy, Check, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

function StarDisplay({ score }) {
  const full = Math.floor(score);
  const half = score - full >= 0.4;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={cn(
          'text-2xl transition-all',
          i <= full ? 'text-yellow-400' : i === full + 1 && half ? 'text-yellow-400/50' : 'text-slate-700'
        )}>★</span>
      ))}
    </div>
  );
}

function ScoreGauge({ score }) {
  const pct = ((score - 1) / 4) * 100;
  const color = score >= 4.5 ? '#4ade80' : score >= 4.0 ? '#facc15' : score >= 3.0 ? '#fb923c' : '#f87171';
  return (
    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="h-full rounded-full"
        style={{ backgroundColor: color }}
      />
    </div>
  );
}

const SCORE_LABEL = score =>
  score >= 4.6 ? 'Excellent — customer will likely leave a 5★' :
  score >= 4.0 ? 'Good — strong response, minor room to improve' :
  score >= 3.0 ? 'Acceptable — but something is missing' :
  score >= 2.0 ? 'Weak — customer will likely be dissatisfied' :
  'Poor — this response will hurt your CSAT';

export default function CsatPredictor() {
  const [customerMsg, setCustomerMsg] = useState('');
  const [agentResponse, setAgentResponse] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function predict() {
    if (!agentResponse.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await InvokeLLM({
        prompt: `You are predicting the CSAT score a real customer would give this Bybit support response.
Think from the customer's perspective — not the quality assurance perspective.
${customerMsg.trim() ? `\nCUSTOMER MESSAGE:\n"${customerMsg.trim()}"\n` : ''}
AGENT RESPONSE:
"${agentResponse.trim()}"

Score 1.0–5.0 (one decimal). Be realistic — most responses land 3.0–4.5. Score 5.0 only if genuinely excellent in every dimension.

Return ONLY valid JSON, no extra text:
{
  "score": <1.0-5.0>,
  "verdict": "<one sentence — exactly what the customer would feel/think after reading this>",
  "factors": [
    {"label": "<short factor name>", "positive": <true/false>, "note": "<one line why>"}
  ],
  "improved": "<the improved version of the agent response — ready to send>"
}

Factors: 3–5 items. Mix positives and negatives where appropriate.`,
        system_prompt: 'You are a customer experience analyst. Predict CSAT from the customer\'s POV. Return only valid JSON.',
      });

      const jsonMatch = res.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : res);
      setResult(parsed);
    } catch {
      setResult({ error: 'Could not parse prediction. Try again.' });
    }
    setLoading(false);
  }

  function copyImproved() {
    navigator.clipboard.writeText(result.improved);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const scoreColor = result?.score >= 4.5 ? 'text-green-400' : result?.score >= 4.0 ? 'text-yellow-400' : result?.score >= 3.0 ? 'text-orange-400' : 'text-red-400';

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-100">⭐ CSAT Predictor</h1>
        <p className="text-sm text-slate-500">Predicts the score a real customer would give your response — before you send it</p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-slate-500 mb-1.5 block" htmlFor="csat-customer">
            Customer's message <span className="text-slate-700">(optional but improves accuracy)</span>
          </label>
          <textarea
            id="csat-customer"
            value={customerMsg}
            onChange={e => setCustomerMsg(e.target.value)}
            placeholder="Paste what the customer said…"
            rows={3}
            className="w-full bg-slate-900 border border-slate-700 focus:border-yellow-400/50 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none resize-none transition-colors"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1.5 block" htmlFor="csat-response">
            Your response draft <span className="text-red-400/70">*</span>
          </label>
          <textarea
            id="csat-response"
            value={agentResponse}
            onChange={e => setAgentResponse(e.target.value)}
            placeholder="Paste your response here…"
            rows={6}
            className="w-full bg-slate-900 border border-slate-700 focus:border-yellow-400/50 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none resize-none transition-colors"
          />
        </div>
        <button
          onClick={predict}
          disabled={!agentResponse.trim() || loading}
          className="w-full bg-yellow-400 hover:bg-yellow-300 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {loading ? <><Loader2 size={15} className="animate-spin" /> Predicting…</> : '⭐ Predict CSAT score'}
        </button>
      </div>

      <AnimatePresence>
        {result && !result.error && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="space-y-4"
          >
            {/* Score card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-end gap-2">
                    <span className={cn('text-5xl font-bold tabular-nums tracking-tight', scoreColor)}>
                      {result.score?.toFixed(1)}
                    </span>
                    <span className="text-slate-600 text-sm mb-1.5">/ 5.0</span>
                  </div>
                  <StarDisplay score={result.score} />
                </div>
                <div className="text-right max-w-[55%]">
                  <p className="text-xs font-semibold text-slate-400">{SCORE_LABEL(result.score)}</p>
                </div>
              </div>
              <ScoreGauge score={result.score} />
            </div>

            {/* Verdict */}
            {result.verdict && (
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-3">
                <p className="text-xs text-slate-500 mb-1">Customer's likely reaction</p>
                <p className="text-sm text-slate-200 italic">"{result.verdict}"</p>
              </div>
            )}

            {/* Factors */}
            {result.factors?.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Score factors</p>
                <div className="space-y-1.5">
                  {result.factors.map((f, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className={cn(
                        'flex items-start gap-3 px-4 py-2.5 rounded-xl border text-sm',
                        f.positive
                          ? 'bg-green-500/8 border-green-500/20 text-green-300'
                          : 'bg-red-500/8 border-red-500/20 text-red-300'
                      )}
                    >
                      <span className="text-base shrink-0 mt-0.5">{f.positive ? '✓' : '✗'}</span>
                      <div className="min-w-0">
                        <span className="font-medium">{f.label}</span>
                        {f.note && <span className="text-xs opacity-70 ml-2">— {f.note}</span>}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Improved version */}
            {result.improved && (
              <div className="bg-slate-900 border border-yellow-400/20 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-yellow-400">✦ Improved version</p>
                  <button
                    onClick={copyImproved}
                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-yellow-400 transition-colors"
                  >
                    {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{result.improved}</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {result?.error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-400">{result.error}</div>
      )}
    </div>
  );
}
