import { useState } from 'react';
import { InvokeLLM } from '@/api/claude';
import { scrubPII } from '@/lib/SecurityModule';
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
          i <= full ? 'text-hero' : i === full + 1 && half ? 'text-hero/50' : 'text-fg-3'
        )}>★</span>
      ))}
    </div>
  );
}

function ScoreGauge({ score }) {
  const pct = ((score - 1) / 4) * 100;
  const color = score >= 4.5 ? '#4ade80' : score >= 4.0 ? '#facc15' : score >= 3.0 ? '#fb923c' : '#f87171';
  return (
    <div className="w-full h-2 bg-bg-2 rounded-full overflow-hidden">
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
${customerMsg.trim() ? `\nCUSTOMER MESSAGE:\n"${scrubPII(customerMsg.trim())}"\n` : ''}
AGENT RESPONSE:
"${scrubPII(agentResponse.trim())}"

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

  const scoreColor = result?.score >= 4.5 ? 'text-ok' : result?.score >= 4.0 ? 'text-hero' : result?.score >= 3.0 ? 'text-warn' : 'text-crit';

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-fg-0">⭐ CSAT Predictor</h1>
        <p className="text-sm text-fg-2">Predicts the score a real customer would give your response — before you send it</p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-fg-2 mb-1.5 block" htmlFor="csat-customer">
            Customer's message <span className="text-fg-3">(optional but improves accuracy)</span>
          </label>
          <textarea
            id="csat-customer"
            value={customerMsg}
            onChange={e => setCustomerMsg(e.target.value)}
            placeholder="Paste what the customer said…"
            rows={3}
            className="w-full bg-bg-1 border border-border-0 focus:border-hero/50 rounded-xl px-4 py-3 text-sm text-fg-0 placeholder-fg-2 outline-none resize-none transition-colors"
          />
        </div>
        <div>
          <label className="text-xs text-fg-2 mb-1.5 block" htmlFor="csat-response">
            Your response draft <span className="text-crit/70">*</span>
          </label>
          <textarea
            id="csat-response"
            value={agentResponse}
            onChange={e => setAgentResponse(e.target.value)}
            placeholder="Paste your response here…"
            rows={6}
            className="w-full bg-bg-1 border border-border-0 focus:border-hero/50 rounded-xl px-4 py-3 text-sm text-fg-0 placeholder-fg-2 outline-none resize-none transition-colors"
          />
        </div>
        <button
          onClick={predict}
          disabled={!agentResponse.trim() || loading}
          className="w-full bg-hero hover:bg-hero disabled:bg-bg-3 disabled:text-fg-2 text-[#021418] font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
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
            <div className="bg-bg-1 border border-border-0 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-end gap-2">
                    <span className={cn('text-5xl font-bold tabular-nums tracking-tight', scoreColor)}>
                      {result.score?.toFixed(1)}
                    </span>
                    <span className="text-fg-2 text-sm mb-1.5">/ 5.0</span>
                  </div>
                  <StarDisplay score={result.score} />
                </div>
                <div className="text-right max-w-[55%]">
                  <p className="text-xs font-semibold text-fg-1">{SCORE_LABEL(result.score)}</p>
                </div>
              </div>
              <ScoreGauge score={result.score} />
            </div>

            {/* Verdict */}
            {result.verdict && (
              <div className="bg-bg-2/50 border border-border-0/50 rounded-xl px-4 py-3">
                <p className="text-xs text-fg-2 mb-1">Customer's likely reaction</p>
                <p className="text-sm text-fg-0 italic">"{result.verdict}"</p>
              </div>
            )}

            {/* Factors */}
            {result.factors?.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-fg-2 uppercase tracking-wider">Score factors</p>
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
                          ? 'bg-ok/8 border-ok/20 text-ok'
                          : 'bg-crit/8 border-crit/20 text-crit'
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
              <div className="bg-bg-1 border border-hero/20 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-hero">✦ Improved version</p>
                  <button
                    onClick={copyImproved}
                    className="flex items-center gap-1.5 text-xs text-fg-2 hover:text-hero transition-colors"
                  >
                    {copied ? <Check size={12} className="text-ok" /> : <Copy size={12} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="text-sm text-fg-1 whitespace-pre-wrap leading-relaxed">{result.improved}</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {result?.error && (
        <div className="bg-crit/10 border border-crit/30 rounded-xl p-4 text-sm text-crit">{result.error}</div>
      )}
    </div>
  );
}
