import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  InvokeChatWithHistory, getKnowledge, saveKnowledge,
  parseAndExtractMemory, InvokeNBA, parsePlanBlock, PLAN_INSTRUCTION, DEEP_INSTRUCTION,
} from '@/api/claude';
import { useAce, scrubPII, recordCaseEvent } from '@/context/AceContext';
import { saveCase } from '@/lib/caseMemory';
import { Send, Trash2, Copy, Check, Brain, X, Zap, ChevronDown, ChevronUp, FlashlightOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import EscalationBuilder from './EscalationBuilder.jsx';

// ── Markdown renderer ──────────────────────────────────────────────────────────

function InlineText({ text }) {
  const parts = text.split(/(\*{1,3}[^*\n]+\*{1,3})/g);
  return (
    <>
      {parts.map((part, i) => {
        if (/^\*{3}[^*].+\*{3}$|^\*{3}.\*{3}$/.test(part))
          return <strong key={i} className="font-semibold text-white">{part.slice(3, -3)}</strong>;
        if (/^\*{2}[^*]/.test(part) && part.endsWith('**'))
          return <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
        if (/^\*{2}.\*{2}$/.test(part))
          return <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
        if (/^\*[^*]/.test(part) && part.endsWith('*') && !part.endsWith('**'))
          return <em key={i} className="italic text-slate-300">{part.slice(1, -1)}</em>;
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function MarkdownMessage({ content }) {
  const lines = content.split('\n');
  return (
    <div className="space-y-0.5 leading-relaxed text-sm">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1.5" />;
        if (line.startsWith('### ')) return <p key={i} className="font-semibold text-slate-200 mt-2 first:mt-0 text-sm"><InlineText text={line.slice(4)} /></p>;
        if (line.startsWith('## ')) return <p key={i} className="font-bold text-slate-100 mt-3 first:mt-0 text-sm border-b border-slate-700 pb-1"><InlineText text={line.slice(3)} /></p>;
        if (line.startsWith('# ')) return <p key={i} className="font-bold text-slate-100 mt-3 first:mt-0"><InlineText text={line.slice(2)} /></p>;
        const bullet = line.match(/^[-•*]\s+(.+)/);
        if (bullet) return (
          <div key={i} className="flex gap-2 items-start">
            <span className="text-yellow-400/50 mt-1 shrink-0" style={{ fontSize: 8 }}>▸</span>
            <span className="text-slate-300"><InlineText text={bullet[1]} /></span>
          </div>
        );
        const num = line.match(/^(\d+)\.\s+(.+)/);
        if (num) return (
          <div key={i} className="flex gap-2 items-start">
            <span className="text-yellow-400/60 shrink-0 text-xs font-mono w-4">{num[1]}.</span>
            <span className="text-slate-300"><InlineText text={num[2]} /></span>
          </div>
        );
        return <p key={i} className="text-slate-200"><InlineText text={line} /></p>;
      })}
    </div>
  );
}

// ── VIP Pulse styling ─────────────────────────────────────────────────────────

function getNBAButtonStyle(priority, vipLevel) {
  const isCritical = priority === 'critical' || vipLevel >= 3;
  if (!isCritical) {
    return {
      className: 'bg-slate-800 border-slate-600 text-slate-300 hover:text-slate-100 hover:border-slate-500',
      glowStyle: {},
      pulse: false,
    };
  }
  // VIP 3+ critical styling — yellow glow + pulse for VIP 4/5
  const glowIntensity = vipLevel >= 5 ? '0.8' : vipLevel >= 4 ? '0.6' : '0.5';
  const glowSize = vipLevel >= 5 ? '25px' : '20px';
  return {
    className: 'bg-yellow-400/10 border-yellow-400/60 text-yellow-300 hover:bg-yellow-400/20',
    glowStyle: { boxShadow: `0 0 ${glowSize} rgba(250, 204, 21, ${glowIntensity})` },
    pulse: vipLevel >= 4,
  };
}

// ── Plan block display ────────────────────────────────────────────────────────

function PlanPanel({ plan }) {
  const [open, setOpen] = useState(false);
  const lines = plan.split('\n').filter(l => l.trim());

  return (
    <div className="mt-1 mb-1">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-400 transition-colors duration-150 cursor-pointer"
        aria-expanded={open}
      >
        <span className="text-yellow-400/40">✦</span>
        Ace&apos;s reasoning
        {open ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="overflow-hidden"
          >
            <div className="mt-2 bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-1">
              {lines.map((line, i) => {
                const sep = line.indexOf(':');
                if (sep === -1) return <p key={i} className="text-xs text-slate-600">{line}</p>;
                const key = line.slice(0, sep).trim();
                const val = line.slice(sep + 1).trim();
                const hasWarning = val.includes('✗');
                return (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="text-slate-600 shrink-0 w-24 text-right">{key}</span>
                    <span className={cn('flex-1', hasWarning ? 'text-orange-400' : 'text-slate-400')}>{val}</span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── NBA action buttons ────────────────────────────────────────────────────────

function NBAButtons({ actions, vipLevel, onAction }) {
  if (!actions?.length) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="flex flex-wrap gap-2 mt-2"
    >
      <p className="w-full text-xs text-slate-600 flex items-center gap-1">
        <span className="text-yellow-400/50">⚡</span> Next best action
      </p>
      {actions.map((action, i) => {
        const { className, glowStyle, pulse } = getNBAButtonStyle(action.priority, vipLevel);
        const isCritical = action.priority === 'critical' || vipLevel >= 3;
        return (
          <motion.button
            key={i}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onAction(action)}
            style={glowStyle}
            className={cn(
              'flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border font-medium transition-colors duration-150 cursor-pointer',
              className,
              pulse && 'animate-pulse',
            )}
            title={action.reason}
          >
            <span>{action.icon}</span>
            {action.label}
            {isCritical && (
              <span className="text-xs bg-yellow-400/20 text-yellow-400 border border-yellow-400/30 px-1.5 py-0.5 rounded font-bold ml-1">
                CRITICAL
                {vipLevel >= 3 ? ` VIP ${vipLevel}` : ''}
              </span>
            )}
          </motion.button>
        );
      })}
    </motion.div>
  );
}

// ── VIP Selector ──────────────────────────────────────────────────────────────

function VIPSelector({ vipLevel, setVipLevel, vipColorClass, vipLabel }) {
  // Click cycles: 0→1→2→3→4→5→0
  function cycle() {
    setVipLevel((vipLevel + 1) % 6);
  }
  return (
    <button
      onClick={cycle}
      className={cn(
        'flex items-center gap-1 text-xs px-2 py-1 rounded-lg border font-medium transition-colors duration-150 cursor-pointer',
        vipColorClass
      )}
      title="Click to cycle VIP level (0–5)"
      aria-label={`Current VIP level: ${vipLabel}. Click to change.`}
    >
      {vipLevel >= 3 && <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse shrink-0" />}
      {vipLabel}
    </button>
  );
}

// ── Quick prompts ──────────────────────────────────────────────────────────────

const QUICK_PROMPTS = {
  'bybit-eu': ['Help me reply to this EU customer:', 'Is this covered under MiCA?', 'Draft a professional email for:', "What's the EU policy on"],
  'eu-live-chat': ['Quick reply for EU customer saying:', 'EU escalation path for:', 'MiCA compliance note on:', 'How do I handle EU'],
  'bybit-global': ['Help me reply to this customer:', 'Draft a global support email for:', "What's the policy on", 'How do I escalate'],
  'global-live-chat': ['Quick reply for customer saying:', 'Fastest resolution for:', 'What do I say when customer asks about', 'How do I handle'],
  personal: ['Help me think through this case:', "I'm stuck on something —", "Quick — what's the SOP for", 'Roast this response I wrote:'],
};

const QUICK_CHIPS = [
  { label: 'Hold 3–5 min', text: 'Thank you for your patience! Allow me to check this for you — this will take around 3–5 minutes.' },
  { label: 'Hold 5–7 min', text: "I appreciate your patience. I'm still reviewing this — just another 5–7 minutes." },
  { label: 'Back with news', text: "I'm back! I've had a chance to review your case. Here's what I found:" },
  { label: 'Quick update', text: "Just a quick update — I'm still working on your case. Thank you for your patience." },
  { label: 'Frustration', text: 'I completely understand your frustration, and I sincerely apologize for the inconvenience. Let me do everything I can to help resolve this for you.' },
  { label: 'Fund loss', text: 'I understand how concerning this must be for you. Please rest assured that I am taking this seriously and will do my best to assist.' },
  { label: 'Long wait', text: 'I sincerely apologize for the long wait. I know your time is valuable, and I appreciate your patience.' },
  { label: 'On your side', text: "I hear you, and I want to assure you that I'm on your side. We're going to work through this together." },
];

function getPlatform(channelId) {
  if (!channelId) return null;
  if (channelId.includes('eu')) return 'eu';
  if (channelId.includes('global')) return 'global';
  return null;
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function Chat({ channel }) {
  const navigate = useNavigate();
  const { vipLevel, setVipLevel, isVIPCritical, vipLabel, vipColorClass, parsedData, pasteSignal, clearPasteSignal } = useAce();
  const storageKey = `chat_history_${channel.id}`;

  const [messages, setMessages] = useState(() => {
    try { return JSON.parse(localStorage.getItem(storageKey)) || []; } catch { return []; }
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(null);
  const [savingMem, setSavingMem] = useState(null);
  const [memTitle, setMemTitle] = useState('');
  const [memSaved, setMemSaved] = useState(null);
  const [autoMemory, setAutoMemory] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`auto_memory_${channel.id}`)) ?? false; } catch { return false; }
  });
  const [autoSaved, setAutoSaved] = useState(null);
  const [showEscalation, setShowEscalation] = useState(false);
  const [deepMode, setDeepMode] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`deep_mode_${channel.id}`)) ?? false; } catch { return false; }
  });
  // Magic Paste banner — show for 6s after Bybit signals auto-detected
  const [pasteDetected, setPasteDetected] = useState(null);

  // NBA state — per-message actions stored on the message object
  const [nbaLoading, setNbaLoading] = useState(false);
  const [latestNBA, setLatestNBA] = useState([]);

  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(messages));
  }, [messages, storageKey]);

  // Magic Paste: react to Bybit signals detected from clipboard
  useEffect(() => {
    if (!pasteSignal) return;
    setPasteDetected(pasteSignal.parsed);
    clearPasteSignal();
    // Auto-run NBA with detected context — even if chat is empty
    const seed = messages.length
      ? messages
      : [{ role: 'user', content: pasteSignal.parsed.issue || 'Customer issue detected from paste' }];
    runNBA(seed);
    const t = setTimeout(() => setPasteDetected(null), 6000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pasteSignal]);

  function saveToMemory(idx) {
    if (!memTitle.trim()) return;
    const msg = messages[idx];
    const existing = getKnowledge();
    saveKnowledge([...existing, { id: Date.now(), title: memTitle.trim(), content: msg.content, active: true }]);
    setSavingMem(null);
    setMemTitle('');
    setMemSaved(idx);
    setTimeout(() => setMemSaved(null), 2500);
  }

  // Run NBA analysis after each AI response (non-blocking)
  async function runNBA(updatedMessages) {
    setNbaLoading(true);
    setLatestNBA([]);
    const actions = await InvokeNBA({
      messages: updatedMessages,
      vipLevel,
      parsedData,
    });
    setLatestNBA(actions);
    setNbaLoading(false);
  }

  // Handle NBA button click — navigate with context handoff
  function handleNBAAction(action) {
    navigate(action.toolPath, {
      state: {
        uid: parsedData.uid,
        orderId: parsedData.orderId,
        issue: parsedData.issue,
        coin: parsedData.coin,
        platform: parsedData.platform,
        vipLevel,
        fromNBA: true,
        nbaReason: action.reason,
      },
    });
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    // Quick remember: shortcut
    if (text.toLowerCase().startsWith('remember:')) {
      const body = text.slice('remember:'.length).trim();
      const sep = body.includes(' — ') ? ' — ' : body.includes(' - ') ? ' - ' : null;
      let title = 'Quick note';
      let content = body;
      if (sep) {
        const sepIdx = body.indexOf(sep);
        title = body.slice(0, sepIdx).trim() || 'Quick note';
        content = body.slice(sepIdx + sep.length).trim();
      }
      if (content) {
        saveKnowledge([...getKnowledge(), { id: Date.now(), title, content, active: true }]);
        setMessages(prev => [
          ...prev,
          { role: 'user', content: text, ts: Date.now() },
          { role: 'assistant', content: `✓ Saved to memory — "${title}"\n\n${content.slice(0, 150)}${content.length > 150 ? '…' : ''}`, ts: Date.now() },
        ]);
        setInput('');
        return;
      }
    }

    const newUserMsg = { role: 'user', content: text, ts: Date.now() };
    const updatedMessages = [...messages, newUserMsg];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);
    setLatestNBA([]);

    const vipContext = vipLevel > 0
      ? `\n\nAGENT CONTEXT — VIP OVERRIDE: Customer VIP Level is ${vipLevel}${isVIPCritical ? ' (HIGH-VALUE ACCOUNT — priority handling required)' : ''}.`
      : '';

    // Add streaming placeholder immediately
    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true, ts: Date.now() }]);

    let fullRaw = '';

    try {
      const historyForApi = updatedMessages.map(m => ({ role: m.role, content: scrubPII(m.content) }));
      const reasoningInstruction = deepMode ? DEEP_INSTRUCTION : PLAN_INSTRUCTION;

      await InvokeChatWithHistory({
        messages: historyForApi,
        system_prompt: channel.systemContext + vipContext + '\n\n' + reasoningInstruction,
        autoMemory,
        onToken: (token, accumulated) => {
          fullRaw = accumulated;
          // Hide [PLAN] block while streaming — show clean content only
          let display;
          if (accumulated.includes('[/PLAN]')) {
            display = accumulated.replace(/\[PLAN\][\s\S]*?\[\/PLAN\]\s*/i, '');
          } else if (/\[PLAN\]/i.test(accumulated)) {
            display = ''; // still inside plan block
          } else {
            display = accumulated;
          }
          setMessages(prev => {
            const arr = [...prev];
            if (arr[arr.length - 1]?.streaming) {
              arr[arr.length - 1] = { ...arr[arr.length - 1], content: display };
            }
            return arr;
          });
        },
      });

      // Finalize — parse plan + memory from complete raw text
      const { plan, clean: afterPlan } = parsePlanBlock(fullRaw);
      const { clean, saved } = parseAndExtractMemory(afterPlan);

      setMessages(prev => {
        const arr = [...prev];
        if (arr[arr.length - 1]?.streaming) {
          arr[arr.length - 1] = { role: 'assistant', content: clean, plan: plan || null, ts: Date.now(), streaming: false };
        }
        return arr;
      });

      if (saved.length) {
        setAutoSaved({ count: saved.length, ts: Date.now() });
        setTimeout(() => setAutoSaved(null), 3000);
      }

      recordCaseEvent({ vipLevel, channel: channel.id });
      saveCase({ uid: parsedData.uid || '', tool: `/${channel.id}`, channel: channel.id, vipLevel });

      const withResponse = [...updatedMessages, { role: 'assistant', content: clean }];
      runNBA(withResponse);

    } catch (e) {
      const errMsg = e.message === 'NO_API_KEY'
        ? '⚠️ No API key set. Go to Settings.'
        : `⚠️ ${e.message || 'Something went wrong. Try again.'}`;
      setMessages(prev => {
        const arr = [...prev];
        if (arr[arr.length - 1]?.streaming) {
          arr[arr.length - 1] = { role: 'assistant', content: errMsg, ts: Date.now(), streaming: false };
        } else {
          arr.push({ role: 'assistant', content: errMsg, ts: Date.now() });
        }
        return arr;
      });
    }
    setLoading(false);
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  function copyMsg(content, idx) {
    navigator.clipboard.writeText(content);
    setCopied(idx);
    setTimeout(() => setCopied(null), 2000);
  }

  function clearHistory() {
    if (confirm('Clear this conversation?')) {
      setMessages([]);
      setLatestNBA([]);
      localStorage.removeItem(storageKey);
    }
  }

  function injectChip(text) { setInput(text); textareaRef.current?.focus(); }
  function injectPrompt(p) { setInput(p); textareaRef.current?.focus(); }

  const prompts = QUICK_PROMPTS[channel.id] || QUICK_PROMPTS.personal;
  const platform = getPlatform(channel.id);

  const accent = channel.id.includes('eu')
    ? 'from-yellow-400/50 to-transparent'
    : channel.id.includes('global')
    ? 'from-green-400/50 to-transparent'
    : 'from-slate-500/30 to-transparent';

  const TOOLBAR = [
    { label: '⚡ Lookup', action: () => navigate('/quick-lookup') },
    { label: '📣 Campaign', action: () => navigate('/campaign') },
    { label: '🔴 Escalate', action: () => setShowEscalation(true), highlight: true },
    { label: '📋 Summary', action: () => injectPrompt('Give me a concise internal case summary for escalation — what the issue is, what was checked, and what needs review.') },
    { label: '⭐ CSAT', action: () => injectPrompt('Suggest 2–3 CSAT-optimised phrases to close this case positively.') },
    { label: '🎯 Quality', action: () => navigate('/quality-check') },
    { label: '💶 SEPA', action: () => navigate('/sepa-delay') },
  ];

  // VIP accent line when critical
  const vipGlowStyle = isVIPCritical
    ? { boxShadow: `0 0 ${vipLevel >= 5 ? '25' : '20'}px rgba(250, 204, 21, ${vipLevel >= 5 ? '0.4' : '0.25'}) inset` }
    : {};

  return (
    <div className="flex flex-col h-full min-h-0">

      <AnimatePresence>
        {showEscalation && (
          <EscalationBuilder
            open={showEscalation}
            onClose={() => setShowEscalation(false)}
            platform={platform}
            messages={messages}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="shrink-0 bg-slate-900 border-b border-slate-800" style={vipGlowStyle}>
        <div className={cn('h-px bg-gradient-to-r', accent)} />

        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="text-xl">{channel.flag}</span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-semibold text-slate-100 text-sm">{channel.name}</h1>
                <span className={cn(
                  'text-xs px-1.5 py-0.5 rounded font-medium',
                  channel.type === 'CHAT' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
                )}>{channel.type}</span>
              </div>
              <p className="text-xs text-slate-600">{channel.subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {autoSaved && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                className="text-xs text-yellow-400 flex items-center gap-1"
              >
                <Brain size={11} /> {autoSaved.count} saved
              </motion.span>
            )}

            {/* VIP Level selector */}
            <VIPSelector
              vipLevel={vipLevel}
              setVipLevel={setVipLevel}
              vipColorClass={vipColorClass}
              vipLabel={vipLabel}
            />

            {/* Deep reasoning toggle: ⚡ Flash vs 🧠 Deep */}
            <button
              onClick={() => {
                const next = !deepMode;
                setDeepMode(next);
                localStorage.setItem(`deep_mode_${channel.id}`, JSON.stringify(next));
              }}
              className={cn(
                'flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border transition-colors duration-150',
                deepMode
                  ? 'bg-purple-500/15 border-purple-500/30 text-purple-300'
                  : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'
              )}
              title={deepMode ? 'Deep mode: 3-pass policy audit' : 'Flash mode: instant response'}
              aria-label={deepMode ? 'Deep reasoning mode active' : 'Flash mode active'}
            >
              <span style={{ fontSize: 11 }}>{deepMode ? '🧠' : '⚡'}</span>
              {deepMode ? 'Deep' : 'Flash'}
            </button>

            <button
              onClick={() => {
                const next = !autoMemory;
                setAutoMemory(next);
                localStorage.setItem(`auto_memory_${channel.id}`, JSON.stringify(next));
              }}
              className={cn(
                'flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border transition-colors duration-150',
                autoMemory
                  ? 'bg-yellow-400/15 border-yellow-400/30 text-yellow-400'
                  : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'
              )}
            >
              <Zap size={10} className={autoMemory ? 'fill-yellow-400' : ''} />
              {autoMemory ? 'Auto' : 'Off'}
            </button>
            {messages.length > 0 && (
              <span className="text-xs text-slate-700">{messages.length}</span>
            )}
            <button
              onClick={clearHistory}
              className="text-slate-600 hover:text-red-400 transition-colors duration-150 flex items-center justify-center w-7 h-7 rounded-lg hover:bg-slate-800"
              aria-label="Clear conversation"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="px-4 pb-2.5 flex items-center gap-1.5 flex-wrap">
          {TOOLBAR.map(item => (
            <motion.button
              key={item.label}
              whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
              onClick={item.action}
              className={cn(
                'text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors duration-150',
                item.highlight
                  ? 'bg-red-500/15 border-red-500/30 text-red-400 hover:bg-red-500/25'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'
              )}
            >
              {item.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Magic Paste banner */}
      <AnimatePresence>
        {pasteDetected && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="shrink-0 mx-4 mt-2 bg-yellow-400/10 border border-yellow-400/30 rounded-xl px-4 py-2.5 flex items-center gap-3"
          >
            <span className="text-yellow-400 text-sm shrink-0">⚡</span>
            <div className="flex-1 flex items-center gap-2 flex-wrap min-w-0">
              <span className="text-xs font-medium text-yellow-400">Bybit signals detected</span>
              {pasteDetected.uid && <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">UID {pasteDetected.uid}</span>}
              {pasteDetected.orderId && <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">{pasteDetected.orderId}</span>}
              {pasteDetected.coin && <span className="text-xs bg-slate-800 text-yellow-400 px-2 py-0.5 rounded font-medium">{pasteDetected.coin}</span>}
              {pasteDetected.txHash && <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">{pasteDetected.txHash.slice(0, 12)}…</span>}
              {pasteDetected.errorCode && <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded font-mono">{pasteDetected.errorCode}</span>}
              <span className="text-xs text-slate-500">— routing NBA…</span>
            </div>
            <button onClick={() => setPasteDetected(null)} className="text-slate-600 hover:text-slate-400 shrink-0 transition-colors duration-150" aria-label="Dismiss">
              <X size={13} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center flex-1 text-center gap-4">
            <span className="text-5xl opacity-60">{channel.flag}</span>
            <div>
              <p className="text-slate-400 font-medium text-sm">{channel.name}</p>
              <p className="text-xs text-slate-600 mt-0.5">{channel.subtitle}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2 max-w-sm w-full">
              {prompts.map(p => (
                <motion.button
                  key={p}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={() => injectPrompt(p)}
                  className="text-xs bg-slate-800/80 hover:bg-slate-800 text-slate-500 hover:text-slate-200 px-3 py-2 rounded-lg text-left transition-colors duration-150 border border-slate-700/50 hover:border-slate-600"
                >
                  {p}
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* Spacer: pushes messages to the bottom when chat is short */}
        {messages.length > 0 && <div className="flex-1" />}

        <div className="space-y-4">
        {messages.map((m, i) => {
          const isLastAssistant = m.role === 'assistant' && i === messages.length - 1;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className={cn('flex gap-2.5', m.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              {m.role === 'assistant' && (
                <div className="w-6 h-6 rounded-full bg-yellow-400/20 border border-yellow-400/15 flex items-center justify-center text-xs shrink-0 mt-1 select-none font-bold text-yellow-400">A</div>
              )}
              <div className="max-w-[80%] flex flex-col gap-1">
                <div className={cn(
                  'rounded-2xl px-4 py-3 relative group',
                  m.role === 'user'
                    ? 'bg-slate-700/80 border border-slate-600/60 text-slate-100 rounded-tr-sm'
                    : 'bg-slate-800/50 border border-slate-700/40 text-slate-200 rounded-tl-sm backdrop-blur-sm'
                )}>
                  <MarkdownMessage content={m.content} />
                  {m.streaming && (
                    <span className="inline-block w-0.5 h-3.5 rounded-sm bg-yellow-400/70 ml-0.5 align-middle animate-pulse" />
                  )}

                  {/* Action buttons on hover */}
                  <div className="absolute -top-1.5 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg px-1.5 py-1">
                    {m.role === 'assistant' && (
                      <button
                        onClick={() => { setSavingMem(i); setMemTitle(''); }}
                        className={cn('transition-colors duration-150', memSaved === i ? 'text-yellow-400' : 'text-slate-500 hover:text-yellow-400')}
                        aria-label="Save to memory"
                      >
                        {memSaved === i ? <Check size={11} /> : <Brain size={11} />}
                      </button>
                    )}
                    <button onClick={() => copyMsg(m.content, i)} className="text-slate-500 hover:text-slate-300 transition-colors duration-150" aria-label="Copy message">
                      {copied === i ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
                    </button>
                  </div>
                </div>

                {/* PLAN reasoning panel — collapsible, below the message bubble */}
                {m.role === 'assistant' && m.plan && (
                  <PlanPanel plan={m.plan} />
                )}

                {/* Save to memory inline form */}
                {savingMem === i && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    className="bg-slate-900 border border-yellow-400/30 rounded-xl px-3 py-3 space-y-2"
                  >
                    <p className="text-xs text-yellow-400 font-medium">Save to Knowledge Base</p>
                    <input
                      autoFocus value={memTitle}
                      onChange={e => setMemTitle(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveToMemory(i); if (e.key === 'Escape') setSavingMem(null); }}
                      placeholder="Title for this memory…"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-yellow-400/50"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => saveToMemory(i)} disabled={!memTitle.trim()}
                        className="text-xs bg-yellow-400/20 disabled:bg-slate-800 disabled:text-slate-600 text-yellow-400 hover:bg-yellow-400/30 px-3 py-1.5 rounded-lg transition-colors duration-150 flex items-center gap-1">
                        <Brain size={11} /> Save
                      </button>
                      <button onClick={() => setSavingMem(null)} className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1.5 transition-colors duration-150 flex items-center gap-1">
                        <X size={11} /> Cancel
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* NBA buttons — only on the last assistant message */}
                {isLastAssistant && latestNBA.length > 0 && (
                  <NBAButtons
                    actions={latestNBA}
                    vipLevel={vipLevel}
                    onAction={handleNBAAction}
                  />
                )}
              </div>

              {m.role === 'user' && (
                <div className="w-6 h-6 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-xs text-slate-400 shrink-0 mt-1 select-none font-medium">V</div>
              )}
            </motion.div>
          );
        })}

        {/* Loading dots — only before first streaming token arrives */}
        {loading && !messages.some(m => m.streaming) && (
          <div className="flex gap-2.5 justify-start">
            <div className="w-6 h-6 rounded-full bg-yellow-400/20 border border-yellow-400/15 flex items-center justify-center text-xs shrink-0 mt-1 font-bold text-yellow-400">A</div>
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1 items-center">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 bg-yellow-400/60 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* NBA loading — subtle indicator after AI responds */}
        {nbaLoading && !loading && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex items-center gap-2 pl-9"
          >
            <div className="w-1.5 h-1.5 bg-yellow-400/40 rounded-full animate-pulse" />
            <span className="text-xs text-slate-700">Analyzing next action…</span>
          </motion.div>
        )}

        <div ref={bottomRef} />
        </div>{/* end messages wrapper */}
      </div>

      {/* Bottom — chips + input, unified glass panel */}
      <div className="shrink-0 border-t border-slate-800/60 bg-slate-900/80 backdrop-blur-sm">
        {/* Quick chips */}
        <div className="px-4 pt-2.5 flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {QUICK_CHIPS.map(chip => (
            <motion.button
              key={chip.label}
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => injectChip(chip.text)}
              className="text-xs whitespace-nowrap px-3 py-1 rounded-full bg-slate-800/70 hover:bg-slate-700/80 border border-slate-700/50 hover:border-slate-600/70 text-slate-500 hover:text-slate-200 transition-all duration-150 shrink-0"
            >
              {chip.label}
            </motion.button>
          ))}
        </div>

        {/* Input */}
        <div className="px-4 py-3">
          <div
            className="flex gap-3 items-end bg-slate-800/60 border border-slate-700/50 focus-within:border-yellow-400/40 focus-within:bg-slate-800/80 rounded-2xl px-4 py-3 transition-all duration-200"
            style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)' }}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask Ace anything… (Enter to send, Shift+Enter for new line)"
              rows={1}
              className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 resize-none outline-none min-h-[20px] max-h-[120px] leading-relaxed"
              onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
            />
            <motion.button
              onClick={send}
              disabled={!input.trim() || loading}
              whileHover={input.trim() && !loading ? { scale: 1.1 } : {}}
              whileTap={input.trim() && !loading ? { scale: 0.92 } : {}}
              className="w-7 h-7 rounded-lg flex items-center justify-center bg-yellow-400 disabled:bg-slate-700 text-slate-900 disabled:text-slate-500 transition-all duration-150 shrink-0 mb-0.5"
              aria-label="Send message"
            >
              <Send size={13} />
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}
