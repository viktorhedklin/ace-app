import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, Loader2, Sparkles, Lock, ChevronRight } from 'lucide-react';
import { InvokeLLM } from '@/api/claude';
import { cn } from '@/lib/utils';

const ESC_TYPES = [
  {
    key: 'lark',
    label: 'Lark Escalation (PIC)',
    desc: 'Post in Pool Escalation Log',
    icon: '📨',
  },
  {
    key: 'sf',
    label: 'Salesforce Internal Note',
    desc: 'Formal SF escalation note for the case',
    icon: '📋',
  },
];

function buildLarkEU({ uid, sf, directedTo, remarks, summary }) {
  const lines = ['@Pool Escalation Log EU'];
  lines.push(`📑 Inquiry directed to: EU: ${directedTo || '[Team]'}`);
  lines.push(`👤 UID(s): ${uid || '[UID]'}`);
  lines.push(`💼 SF(s): ${sf || '[SF number]'}`);
  if (remarks) lines.push(`🏷️ Remark(s): ${remarks}`);
  if (summary) { lines.push(''); lines.push(summary); }
  lines.push('');
  lines.push('Can you please assist in checking this?');
  lines.push('Thank you');
  return lines.join('\n');
}

function buildLarkGlobal({ uid, sf, directedTo, remarks, summary }) {
  const lines = ['@Pool Escalation Log'];
  lines.push(`📑 Inquiry directed to: ${directedTo || '[Team]'}`);
  lines.push(`👤 UID(s): ${uid || '[UID]'}`);
  lines.push(`💼 SF(s): ${sf || '[SF number]'}`);
  if (remarks) lines.push(`🏷️ Remark(s): ${remarks}`);
  if (summary) { lines.push(''); lines.push(summary); }
  lines.push('');
  lines.push('Can you please assist in checking this? Thank you');
  return lines.join('\n');
}

function buildSF({ uid, sf, summary }) {
  const lines = [`UID: ${uid || '[UID]'}`];
  if (sf) lines.push(`SF: ${sf}`);
  lines.push(`Summary: ${summary || '[Summary]'}`);
  lines.push('');
  lines.push('Hi team, could you assist with the above? Thank you');
  return lines.join('\n');
}

export default function EscalationBuilder({ open, onClose, platform: initPlatform, messages = [] }) {
  const [platform, setPlatform] = useState(initPlatform || null);
  const [escType, setEscType] = useState('lark');
  const [uid, setUid] = useState('');
  const [sf, setSf] = useState('');
  const [directedTo, setDirectedTo] = useState('');
  const [remarks, setRemarks] = useState('');
  const [summary, setSummary] = useState('');
  const [generating, setGenerating] = useState(false);
  const [template, setTemplate] = useState('');
  const [copied, setCopied] = useState(false);

  function handleClose() {
    setPlatform(initPlatform || null);
    setEscType('lark'); setUid(''); setSf('');
    setDirectedTo(''); setRemarks(''); setSummary('');
    setTemplate(''); setCopied(false);
    onClose();
  }

  function buildTemplate() {
    const data = { uid, sf, directedTo, remarks, summary };
    let result = '';
    if (escType === 'lark') {
      result = platform === 'eu' ? buildLarkEU(data) : buildLarkGlobal(data);
    } else {
      result = buildSF(data);
    }
    setTemplate(result);
  }

  async function autoFromChat() {
    if (!messages.length) return;
    setGenerating(true);
    try {
      const recent = messages.slice(-12).map(m =>
        `${m.role === 'user' ? 'Agent' : 'Ace'}: ${m.content.slice(0, 300)}`
      ).join('\n\n');
      const result = await InvokeLLM({
        prompt: `Based on this support chat, write a brief 1-2 sentence case summary for an internal escalation note. State: what the issue is, what was checked, what needs review. Plain text only — no markdown, no bold, no asterisks.\n\nChat:\n${recent}`,
        system_prompt: 'Write concise internal escalation summaries. Plain text only. No markdown. No asterisks. No bold formatting.',
      });
      setSummary(result.trim().replace(/\*\*/g, '').replace(/\*/g, '').replace(/^#+\s*/gm, ''));
    } catch {}
    setGenerating(false);
  }

  function copy() {
    navigator.clipboard.writeText(template);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  if (!open) return null;

  const platformLabel = platform === 'eu' ? 'EU' : platform === 'global' ? 'Global' : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Top accent line */}
        <div className={cn('h-0.5 w-full', platform === 'eu' ? 'bg-gradient-to-r from-yellow-400/60 via-yellow-400/20 to-transparent' : platform === 'global' ? 'bg-gradient-to-r from-green-400/60 via-green-400/20 to-transparent' : 'bg-gradient-to-r from-red-400/60 via-red-400/20 to-transparent')} />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="text-base">🔴</span>
            <span className="font-semibold text-slate-100">Escalation Builder</span>
            {platformLabel && (
              <span className={cn(
                'text-xs px-2 py-0.5 rounded font-bold border',
                platform === 'eu'
                  ? 'bg-yellow-400/15 border-yellow-400/30 text-yellow-400'
                  : 'bg-green-400/15 border-green-400/30 text-green-400'
              )}>{platformLabel}</span>
            )}
          </div>
          <button onClick={handleClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">

          {/* Platform selector (if unknown) */}
          {!platform && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Which platform?</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'eu', label: 'Bybit EU', flag: '🇪🇺', sub: 'MiCA Regulated', color: 'yellow' },
                  { key: 'global', label: 'Bybit Global', flag: '🌍', sub: '180+ Countries', color: 'green' },
                ].map(p => (
                  <motion.button
                    key={p.key}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={() => setPlatform(p.key)}
                    className={cn(
                      'rounded-xl p-4 text-left border transition-all',
                      p.color === 'yellow'
                        ? 'bg-yellow-400/8 border-yellow-400/20 hover:border-yellow-400/40'
                        : 'bg-green-400/8 border-green-400/20 hover:border-green-400/40'
                    )}
                  >
                    <p className="text-2xl mb-1.5">{p.flag}</p>
                    <p className={cn('font-semibold text-sm', p.color === 'yellow' ? 'text-yellow-400' : 'text-green-400')}>{p.label}</p>
                    <p className="text-xs text-slate-500">{p.sub}</p>
                  </motion.button>
                ))}
              </div>
            </div>
          )}

          {platform && (
            <>
              {/* Escalation type */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Escalation type</p>
                <div className="space-y-2">
                  {ESC_TYPES.map(t => (
                    <button
                      key={t.key}
                      onClick={() => { setEscType(t.key); setTemplate(''); }}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all duration-150',
                        escType === t.key
                          ? 'bg-slate-800 border-yellow-400/40'
                          : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                      )}
                    >
                      <span className="text-lg shrink-0">{t.icon}</span>
                      <div className="flex-1">
                        <p className={cn('text-sm font-medium', escType === t.key ? 'text-yellow-400' : 'text-slate-200')}>{t.label}</p>
                        <p className="text-xs text-slate-500">{t.desc}</p>
                      </div>
                      <div className={cn(
                        'w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-all',
                        escType === t.key ? 'border-yellow-400 bg-yellow-400' : 'border-slate-600'
                      )}>
                        {escType === t.key && <div className="w-1.5 h-1.5 rounded-full bg-slate-900" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Fields */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">👤 UID(s) <span className="text-slate-700">(if sharing)</span></label>
                    <input value={uid} onChange={e => { setUid(e.target.value); setTemplate(''); }}
                      placeholder="Leave blank = [UID]"
                      className="w-full bg-slate-800 border border-slate-700 focus:border-yellow-400/50 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 outline-none transition-colors" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">📋 SF Number</label>
                    <input value={sf} onChange={e => { setSf(e.target.value); setTemplate(''); }}
                      placeholder="Leave blank = [SF number]"
                      className="w-full bg-slate-800 border border-slate-700 focus:border-yellow-400/50 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 outline-none transition-colors" />
                  </div>
                </div>

                {escType === 'lark' && (
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">📑 Inquiry directed to</label>
                    <input value={directedTo} onChange={e => { setDirectedTo(e.target.value); setTemplate(''); }}
                      placeholder="e.g. Risk & Compliance Team, Card Ops"
                      className="w-full bg-slate-800 border border-slate-700 focus:border-yellow-400/50 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 outline-none transition-colors" />
                  </div>
                )}

                {escType === 'lark' && (
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">🏷️ Remarks <span className="text-slate-700">(optional)</span></label>
                    <input value={remarks} onChange={e => { setRemarks(e.target.value); setTemplate(''); }}
                      placeholder="e.g. User is VIP / case is urgent / already checked X"
                      className="w-full bg-slate-800 border border-slate-700 focus:border-yellow-400/50 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 outline-none transition-colors" />
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-slate-500">📝 Summary / Issue Description</label>
                    <button
                      onClick={autoFromChat}
                      disabled={generating || !messages.length}
                      className={cn(
                        'flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-all',
                        generating
                          ? 'bg-yellow-400/10 border-yellow-400/20 text-yellow-400/60'
                          : messages.length
                          ? 'bg-yellow-400/15 border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/25'
                          : 'bg-slate-800 border-slate-700 text-slate-600 cursor-not-allowed'
                      )}
                    >
                      {generating
                        ? <><Loader2 size={11} className="animate-spin" /> Generating...</>
                        : <><Sparkles size={11} /> Auto from chat</>
                      }
                    </button>
                  </div>
                  <textarea
                    value={summary}
                    onChange={e => { setSummary(e.target.value); setTemplate(''); }}
                    placeholder="Describe the issue briefly — what happened, what was checked, what needs review..."
                    rows={3}
                    className="w-full bg-slate-800 border border-slate-700 focus:border-yellow-400/50 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 outline-none resize-none transition-colors"
                  />
                </div>
              </div>

              {/* Build button */}
              <motion.button
                whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                onClick={buildTemplate}
                className="w-full bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                Build Template <ChevronRight size={16} />
              </motion.button>

              {/* Ready to paste */}
              <AnimatePresence>
                {template && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.18 }}
                    className="space-y-2"
                  >
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Ready to paste</p>
                    <div className="bg-slate-950 border border-slate-700 rounded-xl p-4">
                      <pre className="text-sm text-slate-200 font-mono whitespace-pre-wrap leading-relaxed">{template}</pre>
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={copy}
                      className={cn(
                        'w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all',
                        copied
                          ? 'bg-green-400/20 border border-green-400/30 text-green-400'
                          : 'bg-slate-800 border border-slate-700 hover:border-yellow-400/40 text-slate-200 hover:text-yellow-400'
                      )}
                    >
                      {copied ? <><Check size={15} /> Copied to clipboard</> : <><Copy size={15} /> Copy</>}
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}

          {/* Privacy footer */}
          <div className="flex items-center gap-1.5 text-xs text-slate-700 pt-1">
            <Lock size={10} />
            Ace never stores or requests UID/personal data — you control what goes in these fields
          </div>
        </div>
      </motion.div>
    </div>
  );
}
