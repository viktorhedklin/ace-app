import { useState, useRef } from 'react';
import { Copy, Check, RotateCcw, Sparkles, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { InvokeLLM, hasAnyApiKey } from '@/api/claude';

const TEMPLATE_TYPES = [
  { key: 'lost_chat', label: 'Lost Chat Follow-up', icon: '📧', desc: 'Chat disconnected mid-conversation' },
  { key: 'empty_chat', label: 'No Issue / Inactivity', icon: '💤', desc: 'Customer closed without stating concern' },
];

const EXTRA_OPTIONS = [
  { key: 'crypto', label: 'Crypto transaction details', desc: 'TXID · Coin · Chain/Network · Amount', icon: '🔗' },
  { key: 'fiat', label: 'Fiat transaction details', desc: 'Currency · Transaction reference · Amount', icon: '💶' },
  { key: 'screenshot', label: 'Screenshot of the issue', desc: 'Ask customer to attach a screenshot', icon: '🖼️' },
];

function buildSystemPrompt(templateType, extras) {
  const extraRequests = [];
  if (extras.crypto) extraRequests.push('- Ask for crypto transaction details: TXID / Transaction Hash, Coin, Chain / Network, Amount');
  if (extras.fiat) extraRequests.push('- Ask for fiat transaction details: Currency, Transaction reference, Amount');
  if (extras.screenshot) extraRequests.push('- Ask customer to provide a screenshot of the issue');

  const extraBlock = extraRequests.length
    ? `\n\nThe agent also wants to request the following from the customer — weave these naturally into the email:\n${extraRequests.join('\n')}`
    : '';

  if (templateType === 'lost_chat') {
    return `You are ACE, an AI assistant for Bybit Customer Support agents. Your job is to take an agent's raw, unstructured case notes and transform them into a professional follow-up email.

You MUST follow this EXACT template structure — do not deviate:

---
Thank you for contacting Bybit Customer Support.

We would like to express our sincere apologies for the chat due to [reason for losing the chat]. Allow me to assist you further on your [issue/concern of client].

[BODY — the solution, information, and any questions from the agent's notes go here]
${extraBlock ? '\n' + extraRequests.map(r => r.replace('- ', '')).join('\n') + '\n' : ''}
Hope that answers your inquiry. Please do not hesitate to contact us again should you require any assistance. Thank you.
---

RULES:
- Output ONLY the email body text — no subject line, no markdown formatting, no code blocks, no "---" delimiters
- Replace [reason for losing the chat] with the reason from the agent's notes (e.g. "technical disconnection", "inactivity")
- Replace [issue/concern of client] with the customer's issue from the notes
- The BODY section should contain the agent's solution/info rephrased into clear, professional customer-facing language
- If the agent mentioned questions to ask the customer, include them naturally in the body
- Do NOT include any PII or internal Bybit references (CS:GO, P2, macros, escalation labels)
- Do NOT add information the agent didn't mention — only structure what they wrote
- If notes are minimal, use [brackets] as placeholders for missing info
- Keep paragraphs short and professional`;
  }

  return `You are ACE, an AI assistant for Bybit Customer Support agents. Your job is to take an agent's raw, unstructured case notes and produce a No Issue / Inactivity follow-up email.

You MUST follow this EXACT template structure — do not deviate:

---
Thank you for contacting Bybit Customer Support.

We would like to express our sincere apologies that the chat had to be closed due to inactivity. Allow me to assist you further with your inquiry.

We noticed that the chat was disconnected before you were able to share your concern with us. Kindly reply to this message with more details regarding the issue so we can assist you accordingly.
${extras.crypto ? '\nIf your concern is related to a crypto transaction, please share the following details:\n* TXID/Transaction Hash\n* Coin\n* Chain/Network\n* Amount' : ''}
${extras.fiat ? '\nIf your concern is related to a fiat transaction, please provide the relevant currency and transaction details.' : ''}
${extras.screenshot ? '\nIn addition, kindly provide us with a screenshot of the issue, if applicable, so we can review it further.' : ''}

You may also visit our Help Center for answers and step-by-step guides to common inquiries.

Thank you and we hope to hear from you soon.
---

RULES:
- Output ONLY the email body text — no markdown, no code blocks, no "---" delimiters
- If the agent provided any context in their notes, weave it in naturally (e.g. "We noticed you may have had a question about...")
- Keep the structure above intact — only add context from notes, do not remove template sections
- Do NOT include any PII or internal Bybit references`;
}

export default function FollowUp() {
  const [templateType, setTemplateType] = useState('lost_chat');
  const [notes, setNotes] = useState('');
  const [extras, setExtras] = useState({ crypto: false, fiat: false, screenshot: false });
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef(null);

  function toggleExtra(key) { setExtras(p => ({ ...p, [key]: !p[key] })); }

  function reset() {
    setNotes('');
    setExtras({ crypto: false, fiat: false, screenshot: false });
    setEmail('');
    setError('');
    setCopied(false);
  }

  function buildEmptyChatDirect() {
    let text = `Thank you for contacting Bybit Customer Support.\n\nWe would like to express our sincere apologies that the chat had to be closed due to inactivity. Allow me to assist you further with your inquiry.\n\nWe noticed that the chat was disconnected before you were able to share your concern with us. Kindly reply to this message with more details regarding the issue so we can assist you accordingly.`;
    if (extras.crypto) text += `\n\nIf your concern is related to a crypto transaction, please share the following details:\n* TXID/Transaction Hash\n* Coin\n* Chain/Network\n* Amount`;
    if (extras.fiat) text += `\n\nIf your concern is related to a fiat transaction, please provide the relevant currency and transaction details.`;
    if (extras.screenshot) text += `\n\nIn addition, kindly provide us with a screenshot of the issue, if applicable, so we can review it further.`;
    text += `\n\nYou may also visit our Help Center for answers and step-by-step guides to common inquiries.\n\nThank you and we hope to hear from you soon.`;
    return text;
  }

  async function structureWithAce() {
    // Empty chat with no notes → generate fixed template directly (no API needed)
    if (templateType === 'empty_chat' && !notes.trim()) {
      setEmail(buildEmptyChatDirect());
      return;
    }
    if (!notes.trim()) {
      setError('Write some notes first — even rough ones work.');
      return;
    }
    if (!hasAnyApiKey()) {
      setError('No API key configured — add one in Settings.');
      return;
    }
    setLoading(true);
    setError('');
    setEmail('');
    try {
      const result = await InvokeLLM({
        prompt: `Here are my case notes. Structure this into a follow-up email:\n\n${notes.trim()}`,
        system_prompt: buildSystemPrompt(templateType, extras),
      });
      setEmail(result);
    } catch (err) {
      setError(err.message === 'NO_API_KEY' ? 'No API key — add one in Settings.' : `Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  function copy() {
    navigator.clipboard.writeText(email);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
        className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">📬 Follow-up Tool</h1>
          <p className="text-sm text-slate-500">Write freely — ACE structures it into a follow-up email</p>
        </div>
        <button onClick={reset} className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
          aria-label="Reset follow-up form">
          <RotateCcw size={13} /> Reset
        </button>
      </motion.div>

      {/* Template type selector */}
      <div className="grid grid-cols-2 gap-3">
        {TEMPLATE_TYPES.map((t, i) => (
          <motion.button key={t.key}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.98 }}
            onClick={() => setTemplateType(t.key)}
            aria-label={`Select ${t.label}`}
            className={cn(
              'rounded-xl p-4 text-left border transition-all duration-200 cursor-pointer',
              templateType === t.key
                ? 'bg-yellow-400/10 border-yellow-400/40 shadow-lg shadow-yellow-400/5'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            )}>
            <p className="text-lg mb-1">{t.icon}</p>
            <p className={cn('font-medium text-sm', templateType === t.key ? 'text-yellow-400' : 'text-slate-200')}>{t.label}</p>
            <p className="text-xs text-slate-500 mt-0.5">{t.desc}</p>
          </motion.button>
        ))}
      </div>

      {/* Free-form notes */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-300">Your case notes</h2>
          <span className="text-xs text-slate-600">{notes.length > 0 ? `${notes.length} chars` : 'Write anything'}</span>
        </div>
        <textarea
          ref={textareaRef}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder={templateType === 'lost_chat'
            ? "Dump your notes here — e.g.:\n\nchat dropped due to inactivity, user cant apply for bybit card, they already have active virtual card which blocks new application. need to check if they mean physical card. ask for screenshot..."
            : "Any context about the chat — e.g.:\n\nuser joined but didnt say anything, chat timed out after 3 mins. no idea what they needed..."}
          rows={6}
          className="w-full bg-slate-800 border border-slate-700 focus:border-yellow-400/50 rounded-lg px-4 py-3 text-sm text-slate-100 placeholder-slate-600 outline-none resize-y transition-colors leading-relaxed"
        />
        <div className="flex items-center gap-3">
          <button
            onClick={structureWithAce}
            disabled={loading || !notes.trim()}
            className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 font-semibold text-sm px-5 py-2.5 rounded-lg transition-colors duration-150 cursor-pointer"
            aria-label="Structure notes into email with ACE"
          >
            {loading
              ? <><Loader2 size={15} className="animate-spin" /> Structuring...</>
              : <><Sparkles size={15} /> ACE, structure this</>}
          </button>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      </div>

      {/* Additional info toggles */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-300">Request additional info from customer</h2>
        <div className="space-y-2">
          {EXTRA_OPTIONS.map(item => (
            <motion.button key={item.key} whileTap={{ scale: 0.98 }}
              onClick={() => toggleExtra(item.key)}
              aria-label={`Toggle ${item.label}`}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all duration-150 cursor-pointer',
                extras[item.key]
                  ? 'bg-yellow-400/10 border-yellow-400/30 shadow-md shadow-yellow-400/5'
                  : 'bg-slate-800 border-slate-700 hover:border-slate-600'
              )}>
              <span className="text-lg">{item.icon}</span>
              <div className="flex-1">
                <p className={cn('text-sm font-medium', extras[item.key] ? 'text-yellow-400' : 'text-slate-200')}>{item.label}</p>
                <p className="text-xs text-slate-500">{item.desc}</p>
              </div>
              <motion.div animate={{ scale: extras[item.key] ? 1 : 0.8, backgroundColor: extras[item.key] ? 'rgb(250 204 21)' : 'transparent' }}
                transition={{ duration: 0.15 }}
                className="w-5 h-5 rounded-full border-2 border-slate-600 flex items-center justify-center shrink-0">
                {extras[item.key] && <Check size={10} className="text-slate-900" />}
              </motion.div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Email preview */}
      <AnimatePresence>
        {email && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            layout
            className="bg-slate-900 border border-yellow-400/20 rounded-xl overflow-hidden shadow-lg shadow-yellow-400/5"
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                <h2 className="text-sm font-semibold text-yellow-400">Email preview</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={structureWithAce}
                  disabled={loading}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-yellow-400 transition-colors cursor-pointer"
                  aria-label="Regenerate email"
                >
                  <RotateCcw size={11} /> Redo
                </button>
                <motion.button whileTap={{ scale: 0.95 }} onClick={copy}
                  className="flex items-center gap-1.5 text-xs bg-yellow-400/20 hover:bg-yellow-400/30 active:bg-yellow-400/40 text-yellow-400 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                  aria-label="Copy email to clipboard"
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {copied
                      ? <motion.span key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-1"><Check size={12} /> Copied!</motion.span>
                      : <motion.span key="copy" initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-1"><Copy size={12} /> Copy email</motion.span>
                    }
                  </AnimatePresence>
                </motion.button>
              </div>
            </div>
            <pre className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed font-mono p-5 max-h-96 overflow-y-auto">{email}</pre>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading state */}
      {loading && !email && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 flex items-center justify-center gap-3">
          <Loader2 size={18} className="animate-spin text-yellow-400" />
          <p className="text-sm text-slate-400">ACE is structuring your email...</p>
        </div>
      )}
    </div>
  );
}
