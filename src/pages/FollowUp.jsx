import { useState, useMemo } from 'react';
import { Copy, Check, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const TEMPLATE_TYPES = [
  { key: 'lost_chat', label: 'Lost Chat Follow-up', icon: '📧', desc: 'Chat disconnected mid-conversation' },
  { key: 'empty_chat', label: 'No Issue / Inactivity', icon: '💤', desc: 'Customer closed without stating concern' },
];

const EXTRA_OPTIONS = [
  { key: 'crypto', label: 'Crypto transaction details', desc: 'TXID · Coin · Chain/Network · Amount', icon: '🔗' },
  { key: 'fiat', label: 'Fiat transaction details', desc: 'Currency · Transaction reference · Amount', icon: '💶' },
  { key: 'screenshot', label: 'Screenshot of the issue', desc: 'Ask customer to attach a screenshot', icon: '🖼️' },
];

function buildLostChat(form, extras) {
  const reason = form.reason.trim() || '[state reason for losing the chat]';
  const issue = form.issue.trim() || '[issue/concern of client]';

  let body = '';
  if (form.solution.trim()) body += form.solution.trim();
  if (form.question.trim()) {
    if (body) body += '\n\n';
    body += form.question.trim();
  }
  if (extras.crypto) {
    if (body) body += '\n\n';
    body += `To assist you further, please share the following transaction details:\n• TXID / Transaction Hash:\n• Coin:\n• Chain / Network:\n• Amount:`;
  }
  if (extras.fiat) {
    if (body) body += '\n\n';
    body += `Please also provide the relevant details for the fiat transaction:\n• Currency:\n• Transaction reference:\n• Amount:`;
  }
  if (extras.screenshot) {
    if (body) body += '\n\n';
    body += `Kindly also provide a screenshot of the issue so we can review it more accurately.`;
  }
  if (!body) body = '[your response / solution here]';

  return `{{{Case.Anti_Phishing_Text__c}}}\n{{{Case.Anti_Phishing_Code__c}}}\n\nDear valued Bybit trader,\n\nThank you for contacting Bybit Customer Support.\n\nWe would like to express our sincere apologies for the chat due to ${reason}. Allow me to assist you further on your ${issue}.\n\n${body}\n\nHope that answers your inquiry. Please do not hesitate to contact us again should you require any assistance. Thank you.`;
}

function buildEmptyChat(extras) {
  let text = `Thank you for contacting Bybit Customer Support.\n\nWe would like to express our sincere apologies that the chat had to be closed due to inactivity. Allow me to assist you further with your inquiry.\n\nWe noticed that the chat was disconnected before you were able to share your concern with us. Kindly reply to this message with more details regarding the issue so we can assist you accordingly.`;

  if (extras.crypto) {
    text += `\n\nIf your concern is related to a crypto transaction, please share the following details:\n• TXID / Transaction Hash:\n• Coin:\n• Chain / Network:\n• Amount:`;
  }
  if (extras.fiat) {
    text += `\n\nIf your concern is related to a fiat transaction, please provide the relevant currency and transaction details.`;
  }
  if (extras.screenshot) {
    text += `\n\nIn addition, kindly provide us with a screenshot of the issue, if applicable, so we can review it further.`;
  }

  text += `\n\nYou may also visit our Help Center for answers and step-by-step guides to common inquiries.\n\nThank you and we hope to hear from you soon.`;
  return text;
}

export default function FollowUp() {
  const [templateType, setTemplateType] = useState('lost_chat');
  const [form, setForm] = useState({ reason: '', issue: '', solution: '', question: '' });
  const [extras, setExtras] = useState({ crypto: false, fiat: false, screenshot: false });
  const [copied, setCopied] = useState(false);

  function update(field, val) { setForm(p => ({ ...p, [field]: val })); }
  function toggleExtra(key) { setExtras(p => ({ ...p, [key]: !p[key] })); }
  function reset() {
    setForm({ reason: '', issue: '', solution: '', question: '' });
    setExtras({ crypto: false, fiat: false, screenshot: false });
    setCopied(false);
  }

  const template = useMemo(() =>
    templateType === 'lost_chat' ? buildLostChat(form, extras) : buildEmptyChat(extras),
    [templateType, form, extras]
  );

  function copy() {
    navigator.clipboard.writeText(template);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
        className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">📬 Follow-up Tool</h1>
          <p className="text-sm text-slate-500">Last-hour workflow — generate follow-up emails for your cases</p>
        </div>
        <button onClick={reset} className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-400 transition-colors">
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
            className={cn(
              'rounded-xl p-4 text-left border transition-all duration-200',
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

      {/* Lost chat fields */}
      <AnimatePresence mode="wait">
        {templateType === 'lost_chat' && (
          <motion.div key="lost"
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 overflow-hidden">
            <h2 className="text-sm font-semibold text-slate-300">Case details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Reason chat was lost</label>
                <input value={form.reason} onChange={e => update('reason', e.target.value)}
                  placeholder="e.g. technical disconnection, inactivity..."
                  className="w-full bg-slate-800 border border-slate-700 focus:border-yellow-400/50 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 outline-none transition-colors" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Customer issue / concern</label>
                <input value={form.issue} onChange={e => update('issue', e.target.value)}
                  placeholder="e.g. missing USDT deposit, KYC issue..."
                  className="w-full bg-slate-800 border border-slate-700 focus:border-yellow-400/50 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 outline-none transition-colors" />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Solution / information to provide</label>
              <textarea value={form.solution} onChange={e => update('solution', e.target.value)}
                placeholder="The resolution or information you are providing to the customer..."
                rows={3}
                className="w-full bg-slate-800 border border-slate-700 focus:border-yellow-400/50 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 outline-none resize-none transition-colors" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Question to ask <span className="text-slate-700">(optional)</span></label>
              <input value={form.question} onChange={e => update('question', e.target.value)}
                placeholder="e.g. Could you please confirm the TxID of the transaction?"
                className="w-full bg-slate-800 border border-slate-700 focus:border-yellow-400/50 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 outline-none transition-colors" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Additional info toggles */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-300">Request additional info from customer</h2>
        <div className="space-y-2">
          {EXTRA_OPTIONS.map(item => (
            <motion.button key={item.key} whileTap={{ scale: 0.98 }}
              onClick={() => toggleExtra(item.key)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all duration-150',
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

      {/* Live preview */}
      <motion.div layout className="bg-slate-900 border border-yellow-400/20 rounded-xl overflow-hidden shadow-lg shadow-yellow-400/5">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
            <h2 className="text-sm font-semibold text-yellow-400">Email preview</h2>
          </div>
          <motion.button whileTap={{ scale: 0.95 }} onClick={copy}
            className="flex items-center gap-1.5 text-xs bg-yellow-400/20 hover:bg-yellow-400/30 active:bg-yellow-400/40 text-yellow-400 px-3 py-1.5 rounded-lg transition-colors">
            <AnimatePresence mode="wait" initial={false}>
              {copied
                ? <motion.span key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-1"><Check size={12} /> Copied!</motion.span>
                : <motion.span key="copy" initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-1"><Copy size={12} /> Copy email</motion.span>
              }
            </AnimatePresence>
          </motion.button>
        </div>
        <pre className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed font-mono p-5 max-h-80 overflow-y-auto">{template}</pre>
      </motion.div>
    </div>
  );
}
