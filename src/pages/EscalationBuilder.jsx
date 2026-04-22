import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, Loader2, Sparkles, Lock, ChevronRight, ChevronDown, AlertTriangle } from 'lucide-react';
import { InvokeLLM, hasAnyApiKey } from '@/api/claude';
import { scrubPII } from '@/lib/SecurityModule';
import { cn } from '@/lib/utils';

/* ─── Constants ─── */

const ESC_TYPES = [
  { key: 'lark', label: 'Lark Escalation (PIC)', desc: 'Post in Pool Escalation Log', icon: '📨' },
  { key: 'sf', label: 'Salesforce Internal Note', desc: 'Formal SF escalation note for the case', icon: '📋' },
];

const TROUBLESHOOTING_STEPS = [
  { key: 'vpn', label: 'Confirmed no active VPN', tip: 'Ask if the user has any VPN or proxy enabled' },
  { key: 'cache', label: 'Cleared cache & cookies', tip: 'QT: a17-en-troubleshooting-Bybit-APP' },
  { key: 'app_ver', label: 'App/browser version is latest', tip: 'Confirm they are on the latest Bybit app or browser version' },
  { key: 'other_device', label: 'Tested on another device', tip: 'Check if the issue persists on a different device' },
  { key: 'restart', label: 'Restarted device & retried', tip: 'Ask to restart and try the process again' },
  { key: 'recording', label: 'Screen recording requested', tip: 'Ask customer to send a screen recording of the issue' },
];

/* ─── Template builders ─── */

function buildLarkEU({ uid, sf, directedTo, remarks, summary, deviceOS, appVersion, troubleshooting }) {
  const lines = ['@Pool Escalation Log EU'];
  lines.push(`📑 Inquiry directed to: EU: ${directedTo || '[Team]'}`);
  lines.push(`👤 UID(s): ${uid || '[UID]'}`);
  lines.push(`💼 SF(s): ${sf || '[SF number]'}`);
  if (deviceOS || appVersion) {
    lines.push(`📱 Device & OS: ${deviceOS || '[Device & OS]'}`);
    lines.push(`📦 App / Browser Version: ${appVersion || '[Version]'}`);
  }
  if (remarks) lines.push(`🏷️ Remark(s): ${remarks}`);
  if (troubleshooting) { lines.push(''); lines.push(troubleshooting); }
  if (summary) { lines.push(''); lines.push(summary); }
  lines.push('');
  lines.push('Can you please assist in checking this?');
  lines.push('Thank you');
  return lines.join('\n');
}

function buildLarkGlobal({ uid, sf, directedTo, remarks, summary, deviceOS, appVersion, troubleshooting }) {
  const lines = ['@Pool Escalation Log'];
  lines.push(`📑 Inquiry directed to: ${directedTo || '[Team]'}`);
  lines.push(`👤 UID(s): ${uid || '[UID]'}`);
  lines.push(`💼 SF(s): ${sf || '[SF number]'}`);
  if (deviceOS || appVersion) {
    lines.push(`📱 Device & OS: ${deviceOS || '[Device & OS]'}`);
    lines.push(`📦 App / Browser Version: ${appVersion || '[Version]'}`);
  }
  if (remarks) lines.push(`🏷️ Remark(s): ${remarks}`);
  if (troubleshooting) { lines.push(''); lines.push(troubleshooting); }
  if (summary) { lines.push(''); lines.push(summary); }
  lines.push('');
  lines.push('Can you please assist in checking this? Thank you');
  return lines.join('\n');
}

function buildSF({ uid, sf, summary, deviceOS, appVersion, troubleshooting }) {
  const lines = [`UID: ${uid || '[UID]'}`];
  if (sf) lines.push(`SF: ${sf}`);
  if (deviceOS) lines.push(`Device & OS: ${deviceOS}`);
  if (appVersion) lines.push(`Bybit App / Browser Version: ${appVersion}`);
  lines.push(`User Inquiry: ${summary || '[Summary]'}`);
  if (troubleshooting) {
    lines.push(`Agent Summary: ${troubleshooting}`);
  }
  lines.push('');
  lines.push('Hi team, could you assist with the above? Thank you');
  return lines.join('\n');
}

/* ─── Component ─── */

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

  // New fields
  const [deviceOS, setDeviceOS] = useState('');
  const [appVersion, setAppVersion] = useState('');
  const [checklist, setChecklist] = useState({});
  const [showChecklist, setShowChecklist] = useState(false);
  const [notes, setNotes] = useState('');

  function handleClose() {
    setPlatform(initPlatform || null);
    setEscType('lark'); setUid(''); setSf('');
    setDirectedTo(''); setRemarks(''); setSummary('');
    setTemplate(''); setCopied(false);
    setDeviceOS(''); setAppVersion('');
    setChecklist({}); setShowChecklist(false); setNotes('');
    onClose();
  }

  function toggleCheck(key) {
    setChecklist(p => ({ ...p, [key]: !p[key] }));
    setTemplate('');
  }

  function formatTroubleshooting() {
    const done = TROUBLESHOOTING_STEPS.filter(s => checklist[s.key]);
    if (!done.length) return '';
    return 'Troubleshooting completed:\n' + done.map(s => `- ${s.label}`).join('\n');
  }

  function buildTemplate() {
    const troubleshooting = formatTroubleshooting();
    const data = { uid, sf, directedTo, remarks, summary, deviceOS, appVersion, troubleshooting };
    let result = '';
    if (escType === 'lark') {
      result = platform === 'eu' ? buildLarkEU(data) : buildLarkGlobal(data);
    } else {
      result = buildSF(data);
    }
    setTemplate(result);
  }

  async function generateWithAce() {
    setGenerating(true);
    try {
      // Build context from chat messages and/or agent notes
      let context = '';
      if (messages.length) {
        const recent = messages.slice(-15).map(m =>
          `${m.role === 'user' ? 'Agent' : 'Ace'}: ${scrubPII(m.content.slice(0, 400))}`
        ).join('\n\n');
        context += `Chat history:\n${recent}\n\n`;
      }
      if (notes.trim()) {
        context += `Agent notes:\n${notes.trim()}\n\n`;
      }

      const checklistStatus = TROUBLESHOOTING_STEPS.map(s =>
        `${checklist[s.key] ? '✓' : '✗'} ${s.label}`
      ).join('\n');

      if (!context.trim() && !checklistStatus) {
        setSummary('Add some notes or chat context so ACE can generate a summary.');
        setGenerating(false);
        return;
      }

      if (!hasAnyApiKey()) {
        // Fallback: build a basic summary from notes
        setSummary(notes.trim() || 'No API key configured — add one in Settings to use ACE generation.');
        setGenerating(false);
        return;
      }

      const result = await InvokeLLM({
        prompt: `Generate a concise escalation summary from this context.\n\n${context}Troubleshooting checklist:\n${checklistStatus}\n\nUID: ${uid || 'not provided'}\nSF: ${sf || 'not provided'}`,
        system_prompt: `You write concise internal escalation summaries for Bybit support cases. Your output will be pasted into an escalation template.

FORMAT:
User Inquiry: [1-2 sentences describing what the customer's issue is]
Agent Summary: [2-3 sentences describing what was checked, what was found, and why escalation is needed]

RULES:
- Plain text only — no markdown, no asterisks, no bold, no bullet points
- Be specific: mention what was checked and what the findings were
- If troubleshooting was done, mention it briefly
- Never include PII (names, emails, phone numbers) — use UID only
- Never guess — only state what is evidenced in the context
- Keep it under 100 words total
- Write in third person ("The user reported..." not "I checked...")`,
      });

      setSummary(result.trim().replace(/\*\*/g, '').replace(/\*/g, '').replace(/^#+\s*/gm, ''));
    } catch {
      setSummary(notes.trim() || 'Generation failed — write your summary manually.');
    }
    setGenerating(false);
  }

  function copy() {
    navigator.clipboard.writeText(template);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  if (!open) return null;

  const platformLabel = platform === 'eu' ? 'EU' : platform === 'global' ? 'Global' : null;
  const checklistCount = TROUBLESHOOTING_STEPS.filter(s => checklist[s.key]).length;

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
          <button onClick={handleClose} className="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer" aria-label="Close escalation builder">
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
                      'rounded-xl p-4 text-left border transition-all cursor-pointer',
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
                        'w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all duration-150 cursor-pointer',
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

              {/* ─── Pre-escalation troubleshooting checklist ─── */}
              <div className="space-y-2">
                <button
                  onClick={() => setShowChecklist(p => !p)}
                  className="w-full flex items-center justify-between text-left cursor-pointer group"
                  aria-label="Toggle troubleshooting checklist"
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={13} className="text-yellow-400" />
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Pre-escalation checklist</p>
                    {checklistCount > 0 && (
                      <span className="text-xs bg-green-400/15 border border-green-400/30 text-green-400 px-1.5 py-0.5 rounded font-bold">
                        {checklistCount}/{TROUBLESHOOTING_STEPS.length}
                      </span>
                    )}
                  </div>
                  <ChevronDown size={14} className={cn('text-slate-500 transition-transform', showChecklist && 'rotate-180')} />
                </button>

                <AnimatePresence>
                  {showChecklist && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-1.5 pt-1">
                        {TROUBLESHOOTING_STEPS.map(s => (
                          <button
                            key={s.key}
                            onClick={() => toggleCheck(s.key)}
                            className={cn(
                              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all cursor-pointer',
                              checklist[s.key]
                                ? 'bg-green-400/8 border-green-400/25'
                                : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600'
                            )}
                          >
                            <div className={cn(
                              'w-4 h-4 rounded flex items-center justify-center shrink-0 border-2 transition-all',
                              checklist[s.key] ? 'bg-green-400 border-green-400' : 'border-slate-600'
                            )}>
                              {checklist[s.key] && <Check size={10} className="text-slate-900" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn('text-xs font-medium', checklist[s.key] ? 'text-green-400' : 'text-slate-300')}>{s.label}</p>
                              <p className="text-[10px] text-slate-500">{s.tip}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ─── Fields ─── */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="esc-uid" className="text-xs text-slate-500 mb-1 block">👤 UID(s)</label>
                    <input id="esc-uid" value={uid} onChange={e => { setUid(e.target.value); setTemplate(''); }}
                      placeholder="[UID]"
                      className="w-full bg-slate-800 border border-slate-700 focus:border-yellow-400/50 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 outline-none transition-colors" />
                  </div>
                  <div>
                    <label htmlFor="esc-sf" className="text-xs text-slate-500 mb-1 block">📋 SF Number</label>
                    <input id="esc-sf" value={sf} onChange={e => { setSf(e.target.value); setTemplate(''); }}
                      placeholder="[SF number]"
                      className="w-full bg-slate-800 border border-slate-700 focus:border-yellow-400/50 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 outline-none transition-colors" />
                  </div>
                </div>

                {/* Device info fields */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="esc-device" className="text-xs text-slate-500 mb-1 block">📱 Device & OS</label>
                    <input id="esc-device" value={deviceOS} onChange={e => { setDeviceOS(e.target.value); setTemplate(''); }}
                      placeholder="e.g. iPhone 15 / iOS 18.2"
                      className="w-full bg-slate-800 border border-slate-700 focus:border-yellow-400/50 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 outline-none transition-colors" />
                  </div>
                  <div>
                    <label htmlFor="esc-appver" className="text-xs text-slate-500 mb-1 block">📦 App / Browser Version</label>
                    <input id="esc-appver" value={appVersion} onChange={e => { setAppVersion(e.target.value); setTemplate(''); }}
                      placeholder="e.g. Bybit 4.52.0 / Chrome 126"
                      className="w-full bg-slate-800 border border-slate-700 focus:border-yellow-400/50 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 outline-none transition-colors" />
                  </div>
                </div>

                {escType === 'lark' && (
                  <div>
                    <label htmlFor="esc-directed" className="text-xs text-slate-500 mb-1 block">📑 Inquiry directed to</label>
                    <input id="esc-directed" value={directedTo} onChange={e => { setDirectedTo(e.target.value); setTemplate(''); }}
                      placeholder="e.g. Risk & Compliance Team, Card Ops"
                      className="w-full bg-slate-800 border border-slate-700 focus:border-yellow-400/50 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 outline-none transition-colors" />
                  </div>
                )}

                {escType === 'lark' && (
                  <div>
                    <label htmlFor="esc-remarks" className="text-xs text-slate-500 mb-1 block">🏷️ Remarks <span className="text-slate-700">(optional)</span></label>
                    <input id="esc-remarks" value={remarks} onChange={e => { setRemarks(e.target.value); setTemplate(''); }}
                      placeholder="e.g. User is VIP / case is urgent / already checked X"
                      className="w-full bg-slate-800 border border-slate-700 focus:border-yellow-400/50 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 outline-none transition-colors" />
                  </div>
                )}

                {/* ─── Notes + Generate with ACE ─── */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="esc-notes" className="text-xs text-slate-500">📝 Your notes / paste chat</label>
                    <span className="text-xs text-slate-600">{notes.length > 0 ? `${notes.length} chars` : 'Raw context'}</span>
                  </div>
                  <textarea
                    id="esc-notes"
                    value={notes}
                    onChange={e => { setNotes(e.target.value); setTemplate(''); }}
                    placeholder="Paste the chat or write rough notes — ACE will structure it into a proper escalation summary..."
                    rows={3}
                    className="w-full bg-slate-800 border border-slate-700 focus:border-yellow-400/50 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 outline-none resize-y transition-colors"
                  />
                </div>

                {/* Summary (generated or manual) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="esc-summary" className="text-xs text-slate-500">📄 Escalation Summary</label>
                    <button
                      onClick={generateWithAce}
                      disabled={generating || (!messages.length && !notes.trim())}
                      className={cn(
                        'flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-all cursor-pointer',
                        generating
                          ? 'bg-yellow-400/10 border-yellow-400/20 text-yellow-400/60'
                          : (messages.length || notes.trim())
                          ? 'bg-yellow-400/15 border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/25'
                          : 'bg-slate-800 border-slate-700 text-slate-600 cursor-not-allowed'
                      )}
                    >
                      {generating
                        ? <><Loader2 size={11} className="animate-spin" /> Generating...</>
                        : <><Sparkles size={11} /> Generate with ACE</>
                      }
                    </button>
                  </div>
                  <textarea
                    id="esc-summary"
                    value={summary}
                    onChange={e => { setSummary(e.target.value); setTemplate(''); }}
                    placeholder="ACE will generate this from your notes — or write it manually..."
                    rows={3}
                    className="w-full bg-slate-800 border border-slate-700 focus:border-yellow-400/50 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 outline-none resize-none transition-colors"
                  />
                </div>
              </div>

              {/* Build button */}
              <motion.button
                whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                onClick={buildTemplate}
                className="w-full bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
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
                        'w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer',
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
