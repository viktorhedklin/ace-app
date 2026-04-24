import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Loader2, ImageIcon, X, CheckCircle2, Trash2, AlertTriangle } from 'lucide-react';
import { InvokeLLM, hasAnyApiKey } from '@/api/claude';
import { cn } from '@/lib/utils';
import { pushEntry as pushQAMemory } from '@/lib/qaMemory';

/* ═══════════════════════════════════════════════════════════════
   QA Review Input — paste a QA review (text or screenshot), Ace
   extracts score + 2-3 actionable issues, stores in Shift Tracker,
   and writes a feedback memory entry Ace will use in future chats.
   ═══════════════════════════════════════════════════════════════ */

const SYSTEM_PROMPT = `You analyze customer support QA reviews for a Bybit support agent.

Given a QA review (text or image), extract:
1. SCORE — the numeric score out of 100 (if percentage, convert; if /10, multiply by 10)
2. CHANNEL — 'chat' if about live chat / messaging, 'email' if about email / ticket reply
3. ISSUES — 2-4 specific, actionable issues the reviewer flagged (if any)
4. SUMMARY — 1-sentence takeaway

Return ONLY valid JSON, no markdown fences, in this exact shape:
{"score": 85, "channel": "chat", "issues": ["Missed empathy opening","Didn't include HC link"], "summary": "Solid close but softer opener would lift CSAT."}

If you can't determine score, return score: null.
If no specific issues were flagged, return issues: [].
If channel is unclear, default to 'chat'.`;

const MEMORY_WRITER_PROMPT = `You write durable memory entries for an AI support agent based on QA feedback. The agent uses these memories in future conversations to avoid repeating the same mistakes.

Given the QA issues below, write ONE memory entry per issue in this exact format:

---memory-entry---
name: {short 6-10 word rule title}
type: feedback
---
Rule: {concise one-liner the agent must follow}
Why: QA feedback on {date}, flagged because {issue}.
How to apply: {specific trigger — when/where this rule kicks in}
---memory-entry---

Be specific and concrete. Avoid generic platitudes. If issues are too vague to actionize, skip them.`;

export default function QAReviewInput({ data, onAdd, onRemove }) {
  const [text, setText] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imageDataUrl, setImageDataUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastResult, setLastResult] = useState(null);

  const reviews = data.qaReviews || [];

  async function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImageDataUrl(reader.result);
    reader.readAsDataURL(file);
  }

  function clearImage() {
    setImageFile(null);
    setImageDataUrl('');
  }

  async function analyze() {
    if (!text.trim() && !imageDataUrl) {
      setError('Paste the review text or drop a screenshot first.');
      return;
    }

    if (!hasAnyApiKey()) {
      setError('Add an API key in Settings to let Ace analyze QA reviews.');
      return;
    }

    setLoading(true);
    setError('');
    setLastResult(null);

    try {
      // For now: text-only path. Image support will wire through InvokeLLM vision later.
      const prompt = imageDataUrl && !text.trim()
        ? '[Image attached — no transcribed text yet. Use whatever is legible in the image to extract score/issues. If unreadable, return score null with issue "Image not legible — please paste text instead".]'
        : text.trim();

      const raw = await InvokeLLM({
        prompt,
        system_prompt: SYSTEM_PROMPT,
      });

      // Parse JSON out of the response (strip potential fences).
      const jsonText = raw.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
      let parsed;
      try {
        parsed = JSON.parse(jsonText);
      } catch {
        throw new Error('Ace response was not valid JSON. Try pasting the review again.');
      }

      if (typeof parsed.score !== 'number' || parsed.score < 0 || parsed.score > 100) {
        throw new Error('Could not extract a valid score (0–100) from the review.');
      }

      const entry = {
        ts: Date.now(),
        date: new Date().toISOString().split('T')[0],
        channel: parsed.channel === 'email' ? 'email' : 'chat',
        score: Math.round(parsed.score),
        issues: Array.isArray(parsed.issues) ? parsed.issues.slice(0, 4) : [],
        summary: parsed.summary || '',
        rawText: text.trim() || '[image]',
      };

      // Write durable feedback memories for each actionable issue.
      if (entry.issues.length > 0) {
        writeMemoriesFromIssues(entry).catch(err => console.warn('Memory write failed:', err));
      }

      onAdd(entry);
      setLastResult(entry);
      setText('');
      clearImage();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  async function writeMemoriesFromIssues(entry) {
    const issueBlock = entry.issues.map((i, n) => `${n + 1}. ${i}`).join('\n');
    const prompt = `Date: ${entry.date}\nChannel: ${entry.channel}\nScore: ${entry.score}/100\nIssues flagged:\n${issueBlock}\n\nSummary: ${entry.summary}`;

    const memoryBlob = await InvokeLLM({
      prompt,
      system_prompt: MEMORY_WRITER_PROMPT,
    });

    // Append to the cloud-mirrored QA memory queue. The adapter caps at 50,
    // mirrors to localStorage immediately, and upserts to Supabase async.
    await pushQAMemory({ ts: Date.now(), sourceEntry: entry, body: memoryBlob });
  }

  return (
    <div className="bg-bg-1 border border-border-0 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="type-h3 text-fg-0 flex items-center gap-2">
            <Sparkles size={14} className="text-hero" /> QA Reviews
          </h3>
          <p className="type-caption text-fg-2 mt-0.5">
            Paste a QA review or drop a screenshot. Ace extracts the score, flags issues, and remembers them.
          </p>
        </div>
      </div>

      {/* Input area */}
      <div className="space-y-2">
        <textarea
          value={text}
          onChange={e => { setText(e.target.value); setError(''); }}
          placeholder="Paste your QA review here — score, reviewer comments, anything they flagged..."
          rows={4}
          className="w-full bg-bg-2 border border-border-0 focus:border-hero/50 rounded-lg px-3 py-2 text-sm text-fg-0 placeholder-fg-3 outline-none transition-colors font-mono"
        />

        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-1.5 type-caption text-fg-2 hover:text-hero bg-bg-2 border border-border-0 hover:border-border-hero rounded-lg px-3 py-1.5 cursor-pointer transition-colors duration-220">
            <ImageIcon size={12} />
            <span>{imageFile ? imageFile.name.slice(0, 20) : 'Attach screenshot'}</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          </label>

          {imageDataUrl && (
            <button
              onClick={clearImage}
              className="type-caption text-fg-2 hover:text-crit transition-colors flex items-center gap-1"
              aria-label="Remove screenshot"
            >
              <X size={11} /> Remove
            </button>
          )}

          <button
            onClick={analyze}
            disabled={loading || (!text.trim() && !imageDataUrl)}
            className="ml-auto flex items-center gap-1.5 bg-hero/20 hover:bg-hero/30 disabled:opacity-40 disabled:cursor-not-allowed text-hero px-4 py-1.5 rounded-lg transition-colors duration-220 type-caption font-display font-semibold cursor-pointer"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {loading ? 'Ace analysing…' : 'Analyse with Ace'}
          </button>
        </div>

        {imageDataUrl && (
          <motion.img
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            src={imageDataUrl}
            alt="QA screenshot preview"
            className="rounded-lg border border-border-0 max-h-40 object-contain"
          />
        )}

        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="type-caption text-crit flex items-center gap-1.5"
            >
              <AlertTriangle size={11} /> {error}
            </motion.p>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {lastResult && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-ok/10 border border-ok/25 rounded-lg px-3 py-2 flex items-center gap-2"
            >
              <CheckCircle2 size={13} className="text-ok shrink-0" />
              <p className="type-caption text-fg-1">
                Logged {lastResult.channel} review — {lastResult.score}/100. {lastResult.issues.length > 0 && `${lastResult.issues.length} issue${lastResult.issues.length !== 1 ? 's' : ''} saved to Ace's memory.`}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Existing reviews list */}
      {reviews.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-border-0">
          <p className="type-kpi-label text-fg-2">Today's reviews · {reviews.length}</p>
          {reviews.map((r, i) => (
            <div key={i} className="bg-bg-2 border border-border-0 rounded-lg px-3 py-2.5 flex items-start gap-3">
              <span className={cn(
                'font-display font-bold tabular-nums text-xl shrink-0 w-14 text-center',
                r.score >= 90 ? 'text-ok' : r.score >= 75 ? 'text-hero' : r.score >= 60 ? 'text-warn' : 'text-crit'
              )}>
                {r.score}
              </span>
              <div className="flex-1 min-w-0">
                <p className="type-caption text-fg-1 flex items-center gap-2">
                  <span className="type-badge text-fg-2 bg-bg-3 px-1.5 py-0.5 rounded">{r.channel.toUpperCase()}</span>
                  <span className="truncate">{r.summary || '(no summary)'}</span>
                </p>
                {r.issues.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {r.issues.map((issue, n) => (
                      <li key={n} className="type-caption text-fg-2 flex items-start gap-1.5">
                        <span className="text-hero/60 shrink-0">→</span>
                        <span>{issue}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <button
                onClick={() => onRemove(i)}
                className="text-fg-3 hover:text-crit transition-colors shrink-0"
                aria-label="Remove review"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
