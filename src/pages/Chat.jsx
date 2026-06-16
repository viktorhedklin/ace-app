import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  InvokeChatWithHistory, InvokeLLM, getKnowledge, saveKnowledge,
  parseAndExtractMemory, InvokeNBA, parsePlanBlock, PLAN_INSTRUCTION, DEEP_INSTRUCTION,
} from '@/api/claude';
import { useAce, scrubPII, recordCaseEvent } from '@/context/AceContext';
import { scrubMessagesForStorage, scrubForStorage } from '@/lib/SecurityModule';
import { saveCase } from '@/lib/caseMemory';
import { get as storageGet, set as storageSet, remove as storageRemove, NAMESPACES } from '@/lib/storage';
import { Send, Trash2, Copy, Check, Brain, X, Zap, ChevronDown, ChevronUp, XCircle, ArrowDownToLine, ImagePlus, Languages, Gauge } from 'lucide-react';
import { cn } from '@/lib/utils';
import EscalationBuilder from './EscalationBuilder.jsx';
import QuickReplies from '@/components/QuickReplies';
import LinkHealthBadge from '@/components/LinkHealthBadge';
import DraftRating from '@/components/DraftRating';
import AceAvatar from '@/components/AceAvatar';

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
          return <em key={i} className="italic text-fg-1">{part.slice(1, -1)}</em>;
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
        if (line.startsWith('### ')) return <p key={i} className="font-semibold text-fg-0 mt-2 first:mt-0 text-sm"><InlineText text={line.slice(4)} /></p>;
        if (line.startsWith('## ')) return <p key={i} className="font-bold text-fg-0 mt-3 first:mt-0 text-sm border-b border-border-0 pb-1"><InlineText text={line.slice(3)} /></p>;
        if (line.startsWith('# ')) return <p key={i} className="font-bold text-fg-0 mt-3 first:mt-0"><InlineText text={line.slice(2)} /></p>;
        const bullet = line.match(/^[-•*]\s+(.+)/);
        if (bullet) return (
          <div key={i} className="flex gap-2 items-start">
            <span className="text-hero/50 mt-1 shrink-0" style={{ fontSize: 8 }}>▸</span>
            <span className="text-fg-1"><InlineText text={bullet[1]} /></span>
          </div>
        );
        const num = line.match(/^(\d+)\.\s+(.+)/);
        if (num) return (
          <div key={i} className="flex gap-2 items-start">
            <span className="text-hero/60 shrink-0 text-xs font-mono w-4">{num[1]}.</span>
            <span className="text-fg-1"><InlineText text={num[2]} /></span>
          </div>
        );
        return <p key={i} className="text-fg-0"><InlineText text={line} /></p>;
      })}
    </div>
  );
}

// ── VIP Pulse styling ─────────────────────────────────────────────────────────

function getNBAButtonStyle(priority, vipLevel) {
  const isCritical = priority === 'critical' || vipLevel >= 3;
  if (!isCritical) {
    return {
      className: 'bg-bg-2 border-border-1 text-fg-1 hover:text-fg-0 hover:border-border-1',
      glowStyle: {},
      pulse: false,
    };
  }
  // VIP 3+ critical styling — yellow glow + pulse for VIP 4/5
  const glowIntensity = vipLevel >= 5 ? '0.8' : vipLevel >= 4 ? '0.6' : '0.5';
  const glowSize = vipLevel >= 5 ? '25px' : '20px';
  return {
    className: 'bg-hero/10 border-hero/60 text-hero hover:bg-hero/20',
    glowStyle: { boxShadow: `0 0 ${glowSize} rgba(250, 204, 21, ${glowIntensity})` },
    pulse: vipLevel >= 4,
  };
}

// ── Plan block display ────────────────────────────────────────────────────────

function PlanPanel({ plan }) {
  const [open, setOpen] = useState(false);
  const lines = plan.split('\n').filter(l => l.trim());

  // Detect passes and policy citations for badge count
  const passCount = lines.filter(l => /^PASS\s+\d/i.test(l.trim())).length;
  const hasWarnings = lines.some(l => l.includes('✗'));
  const hasCite = lines.some(l => l.includes('CITE:'));

  return (
    <div className="mt-1.5 mb-1">
      <button
        onClick={() => setOpen(o => !o)}
        className="group flex items-center gap-2 text-xs cursor-pointer transition-colors duration-150"
        aria-expanded={open}
        aria-label="Toggle Ace Logic reasoning panel"
      >
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-colors duration-200"
          style={{
            background: open ? 'rgba(250,204,21,0.08)' : 'rgba(250,204,21,0.03)',
            borderColor: open ? 'rgba(250,204,21,0.30)' : 'rgba(250,204,21,0.12)',
          }}
        >
          <span style={{ color: '#facc15', fontSize: 10 }}>&#9670;</span>
          <span className="text-hero/80 font-medium tracking-wide" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Ace Logic
          </span>
          {passCount > 0 && (
            <span className="text-hero/50 font-normal" style={{ fontSize: 9 }}>
              {passCount}-pass
            </span>
          )}
          {hasCite && (
            <span className="text-cyan-400/60 font-normal" style={{ fontSize: 9 }}>cited</span>
          )}
          {hasWarnings && (
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
          )}
        </span>
        {open ? <ChevronUp size={10} className="text-hero/40" /> : <ChevronDown size={10} className="text-fg-2 group-hover:text-hero/40" />}
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
            <div
              className="mt-2 rounded-lg p-3 space-y-1"
              style={{
                background: 'rgba(15,10,5,0.50)',
                border: '1px solid rgba(250,204,21,0.18)',
                boxShadow: '0 0 12px rgba(250,204,21,0.04)',
              }}
            >
              {lines.map((line, i) => {
                const sep = line.indexOf(':');
                if (sep === -1) return <p key={i} className="text-xs text-fg-2">{line}</p>;
                const key = line.slice(0, sep).trim();
                const val = line.slice(sep + 1).trim();
                const hasCheck = val.includes('✓');
                const hasX = val.includes('✗');
                const isPass = /^PASS\s+\d/i.test(key);
                const isCite = val.startsWith('CITE:') || key.includes('CITATION');
                return (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className={cn('shrink-0 w-28 text-right font-medium', isCite ? 'text-cyan-400/70' : isPass ? 'text-hero/60' : 'text-fg-2')}>{key}</span>
                    <span className={cn(
                      'flex-1',
                      isCite ? 'text-cyan-300/90 font-medium' : hasX ? 'text-warn' : hasCheck ? 'text-emerald-400/80' : 'text-fg-1'
                    )}>{val}</span>
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

// Priority ordering — critical buttons render first and enter first, so the
// urgent action always reads as "do this one first" at a glance.
const NBA_PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

function NBAButtons({ actions, vipLevel, onAction }) {
  if (!actions?.length) return null;

  // Stable sort by priority — critical first, then high, then medium/low.
  // When VIP >= 3 we also lift actions up a slot since the whole case is hot.
  const sorted = [...actions].sort((a, b) => {
    const pa = NBA_PRIORITY_ORDER[a.priority] ?? 4;
    const pb = NBA_PRIORITY_ORDER[b.priority] ?? 4;
    return pa - pb;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="flex flex-wrap gap-2 mt-2"
    >
      <motion.p
        className="w-full text-xs text-fg-2 flex items-center gap-1"
        initial={{ opacity: 0, x: -4 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
      >
        <span className="text-hero/50">⚡</span> Next best action
      </motion.p>
      {sorted.map((action, i) => {
        const { className, glowStyle, pulse } = getNBAButtonStyle(action.priority, vipLevel);
        const isCritical = action.priority === 'critical' || vipLevel >= 3;
        // Cascade: critical buttons enter first with a longer entrance,
        // subsequent actions stagger in 80ms behind each other.
        const delay = 0.08 + i * 0.08;
        return (
          <motion.button
            key={i}
            initial={{ opacity: 0, y: 10, scale: 0.92 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              // One-shot entrance glow for critical buttons — reinforces urgency
              boxShadow: isCritical ? [
                glowStyle.boxShadow || '0 0 0px rgba(250,204,21,0)',
                '0 0 32px rgba(250,204,21,0.75)',
                glowStyle.boxShadow || '0 0 0px rgba(250,204,21,0)',
              ] : undefined,
            }}
            transition={{
              delay,
              type: 'spring',
              stiffness: 380,
              damping: 22,
              boxShadow: isCritical
                ? { delay, duration: 1.1, times: [0, 0.5, 1] }
                : undefined,
            }}
            whileHover={{
              scale: 1.04,
              y: -1,
              // Deepen shadow on hover so the button feels "raised"
              boxShadow: isCritical
                ? '0 4px 20px rgba(250,204,21,0.45), 0 0 24px rgba(250,204,21,0.55)'
                : '0 4px 14px rgba(0,0,0,0.35)',
            }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onAction(action)}
            style={glowStyle}
            className={cn(
              'flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border font-medium cursor-pointer',
              'transition-colors duration-150',
              className,
              pulse && 'animate-pulse',
            )}
            title={action.reason}
          >
            <span>{action.icon}</span>
            {action.label}
            {isCritical && (
              <span className="text-xs bg-hero/20 text-hero border border-hero/30 px-1.5 py-0.5 rounded font-bold ml-1">
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
      {vipLevel >= 3 && <span className="w-1.5 h-1.5 rounded-full bg-hero animate-pulse shrink-0" />}
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

// ── Tone Alchemist (Email channels only) ─────────────────────────────────────

const TONES = [
  {
    id: 'defensive',
    label: 'Defensive',
    color: 'slate',
    instruction: 'TONE: Defensive — factual, policy-first. Lead with the rule or policy, cite specific clauses where possible. Be firm but professional. Avoid over-apologising. The goal is to protect both the company and the customer by being precise and transparent about what can and cannot be done.',
    classes: {
      active: 'bg-fg-3/15 border-border-1/30 text-fg-1',
      dot: 'bg-fg-3',
    },
  },
  {
    id: 'empathetic',
    label: 'Empathetic',
    color: 'cyan',
    instruction: 'TONE: Empathetic — warm, understanding, human. Acknowledge the customer\'s frustration or concern first. Use phrases like "I understand how concerning this must be" and "I hear you". Show that you genuinely care about their situation before moving to the resolution. Be kind but still clear about next steps.',
    classes: {
      active: 'bg-cyan-400/15 border-cyan-400/30 text-cyan-300',
      dot: 'bg-cyan-400',
    },
  },
  {
    id: 'concierge',
    label: 'Concierge',
    color: 'yellow',
    instruction: 'TONE: Concierge — premium, white-glove service. Treat this customer as a VIP. Be exceptionally polished, proactive, and thorough. Offer to go above and beyond. Use language like "I\'d be happy to personally ensure", "Allow me to take care of this for you", "I\'ve taken the liberty of checking". Make them feel like the most important person in the room.',
    classes: {
      active: 'bg-hero/15 border-hero/30 text-hero',
      dot: 'bg-hero',
    },
  },
];

function ToneSlider({ tone, setTone }) {
  return (
    <div className="flex items-center gap-1">
      {TONES.map(t => (
        <button
          key={t.id}
          onClick={() => setTone(t.id)}
          className={cn(
            'flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border font-medium transition-all duration-200 cursor-pointer',
            tone === t.id
              ? t.classes.active
              : 'bg-bg-2/60 border-border-0/50 text-fg-2 hover:text-fg-1 hover:border-border-1'
          )}
          title={`${t.label} tone`}
          aria-label={`Set tone to ${t.label}`}
        >
          <span className={cn('w-1.5 h-1.5 rounded-full shrink-0 transition-all duration-200', tone === t.id ? t.classes.dot : 'bg-fg-2')} />
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ── Friction Detector — client-side sentiment analysis ──────────────────────

const NEGATIVE_WORDS = /\b(frustrated|angry|upset|furious|scam|stolen|lost|hack|hacked|waiting|days|weeks|ridiculous|terrible|unacceptable|complaint|lawyer|legal|regulator|sue|fraud|lie|lying|worst|horrible|disgusted|fed up|sick of|rip.?off|incompetent|useless)\b/gi;
const POSITIVE_WORDS = /\b(thank|thanks|appreciate|resolved|great|helpful|understand|perfect|excellent|wonderful|amazing|happy|pleased|satisfied|good job|well done|sorted)\b/gi;

function analyzeSentiment(text) {
  if (!text) return 0;
  const negMatches = text.match(NEGATIVE_WORDS)?.length || 0;
  const posMatches = text.match(POSITIVE_WORDS)?.length || 0;
  return posMatches - negMatches; // positive = good, negative = bad
}

function SentimentMeter({ score }) {
  // score: 0-100 where 50 is neutral, <25 is danger
  const clamped = Math.max(0, Math.min(100, score));
  const color = clamped >= 60 ? 'bg-emerald-400' : clamped >= 35 ? 'bg-hero' : 'bg-crit';
  const label = clamped >= 60 ? 'Positive' : clamped >= 35 ? 'Neutral' : 'Friction';
  const textColor = clamped >= 60 ? 'text-emerald-400/70' : clamped >= 35 ? 'text-hero/70' : 'text-crit/70';
  return (
    <div className="flex items-center gap-2" title={`Customer sentiment: ${label} (${clamped})`}>
      <div className="w-16 h-1.5 bg-bg-2 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className={cn('text-[10px] font-medium', textColor)}>{label}</span>
    </div>
  );
}

// ── Visual Sentinel — screenshot audit instruction ───────────────────────────

const VISUAL_AUDIT_INSTRUCTION = `VISUAL AUDIT — An image has been attached. Before your main response, you MUST extract ALL identifiable data from this screenshot and present it in this exact format:

[VISUAL_AUDIT]
UIDs found: <list or "None">
TxHashes found: <list or "None">
Wallet addresses: <list or "None">
Order IDs: <list or "None">
Error codes: <list or "None">
Amounts/balances: <list or "None">
Timestamps: <list or "None">
Bybit UI section: <identified page/section or "Unknown">
[/VISUAL_AUDIT]

After the audit block, proceed with your normal response addressing the user's question about the image.`;

// ── Main component ─────────────────────────────────────────────────────────────

export default function Chat({ channel }) {
  const navigate = useNavigate();
  const { vipLevel, setVipLevel, isVIPCritical, vipLabel, vipColorClass, parsedData, pasteSignal, clearPasteSignal, triggerHeartbeat } = useAce();
  const historyKey = `history_${channel.id}`;
  const legacyHistoryKey = `chat_history_${channel.id}`;

  const [messages, setMessages] = useState(() => {
    const fromCloud = storageGet(NAMESPACES.CHAT, historyKey);
    if (Array.isArray(fromCloud)) return fromCloud;
    try { return JSON.parse(localStorage.getItem(legacyHistoryKey)) || []; } catch { return []; }
  });
  // Draft recovery: persist input to sessionStorage per channel so a misclick
  // doesn't destroy a half-written 2-min reply. Cleared on send.
  const draftKey = `ace_draft_${channel.id}`;
  const [input, setInput] = useState(() => {
    try { return sessionStorage.getItem(draftKey) || ''; }
    catch (e) { console.warn('[Chat] draft read failed', e); return ''; }
  });
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(null);
  const [savingMem, setSavingMem] = useState(null);
  const [memTitle, setMemTitle] = useState('');
  const [memSaved, setMemSaved] = useState(null);

  // Per-message FX: { [index]: 'celebrated' | 'flagged' } — transient trigger
  // for AceAvatar state, auto-clears after 900ms. Fires when agent uses the
  // DraftRating thumbs buttons so the avatar visibly reacts to feedback.
  const [messageFx, setMessageFx] = useState({});
  function triggerAvatarFx(index, kind) {
    setMessageFx(prev => ({ ...prev, [index]: kind }));
    setTimeout(() => {
      setMessageFx(prev => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    }, 900);
  }
  const [autoMemory, setAutoMemory] = useState(() => {
    const fromCloud = storageGet(NAMESPACES.CHAT, `auto_${channel.id}`);
    if (typeof fromCloud === 'boolean') return fromCloud;
    try { return JSON.parse(localStorage.getItem(`auto_memory_${channel.id}`)) ?? false; } catch { return false; }
  });
  const [autoSaved, setAutoSaved] = useState(null);
  const [showEscalation, setShowEscalation] = useState(false);
  const isEmail = channel.type === 'EMAIL';
  const [tone, setTone] = useState(() => {
    const fromCloud = storageGet(NAMESPACES.CHAT, `tone_${channel.id}`);
    if (typeof fromCloud === 'string') return fromCloud;
    try { return localStorage.getItem(`tone_${channel.id}`) || 'empathetic'; } catch { return 'empathetic'; }
  });
  const [deepMode, setDeepMode] = useState(() => {
    const fromCloud = storageGet(NAMESPACES.CHAT, `deep_${channel.id}`);
    if (typeof fromCloud === 'boolean') return fromCloud;
    try { return JSON.parse(localStorage.getItem(`deep_mode_${channel.id}`)) ?? false; } catch { return false; }
  });
  // Close case
  const [closingCase, setClosingCase] = useState(false);
  const [closeSummary, setCloseSummary] = useState('');
  const [closeSaving, setCloseSaving] = useState(false);

  // Magic Paste banner — show for 6s after Bybit signals auto-detected
  const [pasteDetected, setPasteDetected] = useState(null);

  // NBA state — per-message actions stored on the message object
  const [nbaLoading, setNbaLoading] = useState(false);
  const [latestNBA, setLatestNBA] = useState([]);

  // Visual Sentinel — image attachment
  const [imageAttachment, setImageAttachment] = useState(null); // { base64, mediaType, preview }
  const fileInputRef = useRef(null);

  // Friction Detector — running sentiment score (0-100, 50 = neutral)
  const [sentimentScore, setSentimentScore] = useState(50);
  const prevSentimentRef = useRef(50);

  // Quick Replies panel
  const [showQuickReplies, setShowQuickReplies] = useState(false);

  // Auto-CSAT prediction
  const [csatScores, setCsatScores] = useState({}); // { msgIndex: { grade, score } }
  const [autoCsat, setAutoCsat] = useState(() => {
    const fromCloud = storageGet(NAMESPACES.SETTINGS, 'auto_csat');
    if (typeof fromCloud === 'boolean') return fromCloud;
    try { return JSON.parse(localStorage.getItem('ace_auto_csat')) ?? false; } catch { return false; }
  });

  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const historySaveTimerRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // STORAGE SHIELD: scrub ALL messages (user + assistant) before persisting.
  // Debounced so streaming doesn't fire an upsert per token.
  // CAP: keep only the most recent MAX_HISTORY messages to prevent
  // localStorage quota overruns over months of use.
  useEffect(() => {
    clearTimeout(historySaveTimerRef.current);
    historySaveTimerRef.current = setTimeout(() => {
      const MAX_HISTORY = 1000;
      const trimmed = messages.length > MAX_HISTORY ? messages.slice(-MAX_HISTORY) : messages;
      storageSet(NAMESPACES.CHAT, historyKey, scrubMessagesForStorage(trimmed));
      localStorage.removeItem(legacyHistoryKey);
    }, 700);
    return () => clearTimeout(historySaveTimerRef.current);
  }, [messages, historyKey, legacyHistoryKey]);

  // Persist draft input to sessionStorage on every keystroke.
  useEffect(() => {
    try {
      if (input) sessionStorage.setItem(draftKey, input);
      else sessionStorage.removeItem(draftKey);
    } catch (e) { console.warn('[Chat] draft write failed', e); }
  }, [input, draftKey]);

  // Hotkeys: Ctrl+Shift+E = escalate, Ctrl+Shift+M = save last assistant msg
  // to memory, Ctrl+Shift+C = copy last assistant message. Live-chat workflow
  // demands keyboard flow — every action that requires a click loses seconds.
  useEffect(() => {
    function onKey(e) {
      if (!(e.ctrlKey || e.metaKey) || !e.shiftKey) return;
      const key = e.key.toLowerCase();
      if (key === 'e') {
        e.preventDefault();
        setShowEscalation(true);
      } else if (key === 'm') {
        e.preventDefault();
        const lastAssistantIdx = [...messages].map((m, i) => ({ m, i }))
          .reverse()
          .find(({ m }) => m.role === 'assistant' && !m.streaming)?.i;
        if (lastAssistantIdx !== undefined) {
          setSavingMem(lastAssistantIdx);
          setMemTitle('');
        }
      } else if (key === 'c') {
        const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant' && !m.streaming);
        const lastIdx = messages.length - 1 - [...messages].reverse().findIndex(m => m === lastAssistant);
        if (lastAssistant) {
          e.preventDefault();
          copyMsg(lastAssistant.content, lastIdx);
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [messages]);

  useEffect(() => {
    storageSet(NAMESPACES.CHAT, `tone_${channel.id}`, tone);
    localStorage.removeItem(`tone_${channel.id}`);
  }, [tone, channel.id]);

  // Auto-suggest Deep mode for high-stakes cases. Fires once per channel
  // session when a high-VIP or security signal appears. Does not toggle
  // silently — shows a soft banner the agent can accept or dismiss.
  const [deepSuggestion, setDeepSuggestion] = useState(null);
  const deepSuggestedRef = useRef(false);
  useEffect(() => {
    if (deepMode || deepSuggestedRef.current) return;
    const issue = (parsedData?.issue || '').toLowerCase();
    const securityHit = /hack|unauthori[sz]ed|compromise|scam|phish|stolen|drain|2fa lost|account.{0,10}access/i.test(issue);
    const highVip = vipLevel >= 4;
    if (highVip || securityHit) {
      deepSuggestedRef.current = true;
      setDeepSuggestion(highVip ? `VIP ${vipLevel} detected — Deep mode recommended` : 'Security signal detected — Deep mode recommended');
    }
  }, [vipLevel, parsedData, deepMode]);

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

  // Auto-CSAT: score the last assistant response (utility tier, no KB)
  async function runAutoCsat(msgIndex, content) {
    if (!autoCsat || csatScores[msgIndex] || content.length < 30) return;
    try {
      const res = await InvokeLLM({
        prompt: `Rate this customer support response on a scale of 1-100 and assign a letter grade (A/B/C/D/F). Consider tone, clarity, completeness, and professionalism. Return ONLY JSON: {"score": <number>, "grade": "<letter>"}\n\nResponse: "${content.slice(0, 500)}"`,
        system_prompt: 'You are a QA scorer. Return only valid JSON with score and grade fields.',
      });
      const match = res.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        setCsatScores(prev => ({ ...prev, [msgIndex]: { score: parsed.score, grade: parsed.grade } }));
      }
    } catch (e) { console.warn('[Chat] CSAT parse failed', e); }
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

  function handleImageAttach(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 10 * 1024 * 1024) return; // 10MB max
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      setImageAttachment({
        base64,
        mediaType: file.type,
        preview: reader.result,
        name: file.name,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // reset so same file can be re-selected
  }

  async function send() {
    const text = input.trim();
    if ((!text && !imageAttachment) || loading) return;

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

    // Friction Detector: analyze sentiment of incoming user text
    const sentimentDelta = analyzeSentiment(text) * 8; // each word shifts score by 8 points
    const newSentiment = Math.max(0, Math.min(100, sentimentScore + sentimentDelta));
    setSentimentScore(newSentiment);
    // Trigger Nebula Heartbeat if sentiment drops below 25 (friction zone)
    if (newSentiment < 25 && prevSentimentRef.current >= 25) {
      triggerHeartbeat();
    }
    prevSentimentRef.current = newSentiment;

    // GDPR: store ONLY scrubbed text in state — raw is destroyed here
    const safeContent = scrubPII(text);
    const hasImage = !!imageAttachment;

    // Build display message (what user sees in chat)
    const displayMsg = { role: 'user', content: safeContent, ts: Date.now(), hasImage: hasImage };
    const updatedMessages = [...messages, displayMsg];
    setMessages(updatedMessages);
    setInput('');
    const currentImage = imageAttachment;
    setImageAttachment(null);
    setLoading(true);
    setLatestNBA([]);

    const vipContext = vipLevel > 0
      ? `\n\nAGENT CONTEXT — VIP OVERRIDE: Customer VIP Level is ${vipLevel}${isVIPCritical ? ' (HIGH-VALUE ACCOUNT — priority handling required)' : ''}.`
      : '';

    const toneContext = isEmail
      ? `\n\n${TONES.find(t => t.id === tone)?.instruction || ''}`
      : '';

    // Add streaming placeholder immediately
    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true, ts: Date.now() }]);

    let fullRaw = '';

    try {
      // Messages already scrubbed in state; API layer scrubs again (defense in depth)
      const historyForApi = updatedMessages.map(m => ({ role: m.role, content: m.content }));

      // Visual Sentinel: if image attached, build content array for the last user message
      if (hasImage && currentImage) {
        const lastIdx = historyForApi.length - 1;
        historyForApi[lastIdx] = {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: currentImage.mediaType, data: currentImage.base64 } },
            { type: 'text', text: VISUAL_AUDIT_INSTRUCTION + '\n\n' + safeContent },
          ],
        };
      }

      const reasoningInstruction = deepMode ? DEEP_INSTRUCTION : PLAN_INSTRUCTION;

      await InvokeChatWithHistory({
        messages: historyForApi,
        system_prompt: channel.systemContext + vipContext + toneContext + '\n\n' + reasoningInstruction,
        autoMemory,
        // Scrubbed UID — enables Ace to pull prior case history for this customer
        kbUid: parsedData?.uid ? scrubPII(parsedData.uid) : undefined,
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
      saveCase({ uid: scrubPII(parsedData.uid || ''), tool: `/${channel.id}`, channel: channel.id, vipLevel });

      const withResponse = [...updatedMessages, { role: 'assistant', content: clean }];
      runNBA(withResponse);
      runAutoCsat(updatedMessages.length, clean);

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
      clearTimeout(historySaveTimerRef.current);
      setMessages([]);
      setLatestNBA([]);
      storageRemove(NAMESPACES.CHAT, historyKey);
      localStorage.removeItem(legacyHistoryKey);
    }
  }

  async function closeCase() {
    setCloseSaving(true);
    const summary = closeSummary.trim();
    if (summary) {
      const today = new Date().toLocaleDateString('en-GB');
      const title = `Case: ${channel.name} — ${today}`;
      const existing = getKnowledge();
      saveKnowledge([...existing, { id: Date.now(), title, content: scrubForStorage(summary), active: true }]);
    }
    clearTimeout(historySaveTimerRef.current);
    setMessages([]);
    setLatestNBA([]);
    storageRemove(NAMESPACES.CHAT, historyKey);
    localStorage.removeItem(legacyHistoryKey);
    setClosingCase(false);
    setCloseSummary('');
    setCloseSaving(false);
  }

  // Ghost-Writing Sync: pull latest chat reasoning into email composer
  const CHAT_PAIR = { 'bybit-eu': 'eu-live-chat', 'bybit-global': 'global-live-chat' };
  const pairedChatChannel = CHAT_PAIR[channel.id] || null;

  function syncFromChat() {
    if (!pairedChatChannel) return;
    try {
      const chatHistory =
        storageGet(NAMESPACES.CHAT, `history_${pairedChatChannel}`)
        ?? JSON.parse(localStorage.getItem(`chat_history_${pairedChatChannel}`) || '[]');
      const lastAssistant = [...chatHistory].reverse().find(m => m.role === 'assistant');
      if (!lastAssistant?.content) return;
      const activeTone = TONES.find(t => t.id === tone);
      const prompt = `Rewrite the following chat reasoning into a professional ${activeTone?.label || 'Empathetic'} email draft for the customer. Keep the facts and resolution, adapt the tone and format for email.\n\n--- CHAT REASONING ---\n${lastAssistant.content}`;
      setInput(prompt);
      textareaRef.current?.focus();
    } catch { /* no chat history available */ }
  }

  function injectChip(text) { setInput(text); textareaRef.current?.focus(); }
  function injectPrompt(p) { setInput(p); textareaRef.current?.focus(); }

  const prompts = QUICK_PROMPTS[channel.id] || QUICK_PROMPTS.personal;
  const platform = getPlatform(channel.id);

  const accent = channel.id.includes('eu')
    ? 'from-hero/50 to-transparent'
    : channel.id.includes('global')
    ? 'from-green-400/50 to-transparent'
    : 'from-fg-3/30 to-transparent';

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
      <div className="shrink-0 bg-bg-1 border-b border-border-0" style={vipGlowStyle}>
        <div className={cn('h-px bg-gradient-to-r', accent)} />

        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="text-xl">{channel.flag}</span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-semibold text-fg-0 text-sm">{channel.name}</h1>
                <span className={cn(
                  'text-xs px-1.5 py-0.5 rounded font-medium',
                  channel.type === 'CHAT' ? 'bg-ok/20 text-ok' : 'bg-info/20 text-info'
                )}>{channel.type}</span>
              </div>
              <p className="text-xs text-fg-2">{channel.subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {autoSaved && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                className="text-xs text-hero flex items-center gap-1"
              >
                <Brain size={11} /> {autoSaved.count} saved
              </motion.span>
            )}

            {/* Friction Detector — sentiment meter */}
            {messages.length > 0 && <SentimentMeter score={sentimentScore} />}

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
                storageSet(NAMESPACES.CHAT, `deep_${channel.id}`, next);
                localStorage.removeItem(`deep_mode_${channel.id}`);
                if (deepSuggestion) setDeepSuggestion(null);
              }}
              className={cn(
                'flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border transition-colors duration-150 relative',
                deepMode
                  ? 'bg-purple-500/15 border-purple-500/30 text-purple-300'
                  : deepSuggestion
                    ? 'bg-purple-500/10 border-purple-500/40 text-purple-200 animate-pulse'
                    : 'bg-bg-2 border-border-0 text-fg-2 hover:text-fg-1'
              )}
              title={deepSuggestion || (deepMode ? 'Deep mode: 3-pass policy audit' : 'Flash mode: instant response')}
              aria-label={deepMode ? 'Deep reasoning mode active' : 'Flash mode active'}
            >
              <span style={{ fontSize: 11 }}>{deepMode ? '🧠' : '⚡'}</span>
              {deepMode ? 'Deep' : 'Flash'}
              {deepSuggestion && !deepMode && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-purple-400 rounded-full" />
              )}
            </button>

            <button
              onClick={() => {
                const next = !autoMemory;
                setAutoMemory(next);
                storageSet(NAMESPACES.CHAT, `auto_${channel.id}`, next);
                localStorage.removeItem(`auto_memory_${channel.id}`);
              }}
              className={cn(
                'flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border transition-colors duration-150',
                autoMemory
                  ? 'bg-hero/15 border-hero/30 text-hero'
                  : 'bg-bg-2 border-border-0 text-fg-2 hover:text-fg-1'
              )}
            >
              <Zap size={10} className={autoMemory ? 'fill-hero' : ''} />
              {autoMemory ? 'Auto' : 'Off'}
            </button>
            {messages.length > 0 && (
              <>
                <span className="text-xs text-fg-3">{messages.length}</span>
                <button
                  onClick={() => { setClosingCase(true); }}
                  className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border bg-bg-2 border-border-0 text-fg-2 hover:text-crit hover:border-crit/30 transition-all duration-150 cursor-pointer"
                  title="Close case"
                  aria-label="Close case"
                >
                  <XCircle size={12} />
                  <span className="hidden sm:inline">Close</span>
                </button>
              </>
            )}
            <button
              onClick={clearHistory}
              className="text-fg-2 hover:text-crit transition-colors duration-150 flex items-center justify-center w-7 h-7 rounded-lg hover:bg-bg-2"
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
                  ? 'bg-crit/15 border-crit/30 text-crit hover:bg-crit/25'
                  : 'bg-bg-2 border-border-0 text-fg-1 hover:text-fg-0 hover:border-border-1'
              )}
            >
              {item.label}
            </motion.button>
          ))}
          {/* Tone Alchemist — email channels only */}
          {isEmail && (
            <>
              <div className="w-px h-4 bg-bg-3/50 mx-1" />
              <ToneSlider tone={tone} setTone={setTone} />
              {pairedChatChannel && (
                <motion.button
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                  onClick={syncFromChat}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors duration-150 bg-cyan-500/10 border-cyan-500/25 text-cyan-400 hover:bg-cyan-500/20 cursor-pointer"
                  title="Sync latest chat reasoning into email composer"
                  aria-label="Sync from live chat"
                >
                  <ArrowDownToLine size={11} />
                  Live Sync
                </motion.button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Magic Paste banner — each detected field stagger-reveals with a gold
          bloom; a light sweep passes across the banner on mount for "scanning"
          feel. Makes ACE's paste intelligence visible, not invisible. */}
      <AnimatePresence>
        {pasteDetected && (() => {
          const fields = [
            pasteDetected.uid && { key: 'uid', label: `UID ${pasteDetected.uid}`, cls: 'bg-bg-2 text-fg-1 font-mono' },
            pasteDetected.orderId && { key: 'order', label: pasteDetected.orderId, cls: 'bg-bg-2 text-fg-1 font-mono' },
            pasteDetected.coin && { key: 'coin', label: pasteDetected.coin, cls: 'bg-bg-2 text-hero font-medium' },
            pasteDetected.txHash && { key: 'tx', label: `${pasteDetected.txHash.slice(0, 12)}…`, cls: 'bg-bg-2 text-fg-1 font-mono' },
            pasteDetected.errorCode && { key: 'err', label: pasteDetected.errorCode, cls: 'bg-crit/20 text-crit font-mono' },
          ].filter(Boolean);

          return (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="relative shrink-0 mx-4 mt-2 bg-hero/10 border border-hero/30 rounded-xl px-4 py-2.5 flex items-center gap-3 overflow-hidden"
            >
              {/* Scan sweep — single horizontal beam left→right on mount */}
              <motion.span
                className="absolute inset-y-0 w-20 pointer-events-none"
                style={{
                  background: 'linear-gradient(90deg, transparent 0%, rgba(250,204,21,0.35) 50%, transparent 100%)',
                  filter: 'blur(6px)',
                }}
                initial={{ x: '-100%' }}
                animate={{ x: '700%' }}
                transition={{ duration: 0.9, ease: 'easeOut' }}
              />

              <motion.span
                className="text-hero text-sm shrink-0 relative"
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 18 }}
              >⚡</motion.span>

              <div className="flex-1 flex items-center gap-2 flex-wrap min-w-0 relative">
                <motion.span
                  className="text-xs font-medium text-hero"
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05, duration: 0.25 }}
                >Bybit signals detected</motion.span>

                {fields.map((f, idx) => (
                  <motion.span
                    key={f.key}
                    className={`text-xs px-2 py-0.5 rounded relative ${f.cls}`}
                    initial={{ opacity: 0, scale: 0.6, y: 4 }}
                    animate={{
                      opacity: 1,
                      scale: 1,
                      y: 0,
                      boxShadow: [
                        '0 0 0px rgba(250,204,21,0)',
                        '0 0 14px rgba(250,204,21,0.55)',
                        '0 0 0px rgba(250,204,21,0)',
                      ],
                    }}
                    transition={{
                      delay: 0.15 + idx * 0.08,
                      scale: { type: 'spring', stiffness: 500, damping: 20 },
                      opacity: { duration: 0.2 },
                      boxShadow: { duration: 0.9, times: [0, 0.4, 1] },
                    }}
                  >{f.label}</motion.span>
                ))}

                <motion.span
                  className="text-xs text-fg-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 + fields.length * 0.08, duration: 0.3 }}
                >— routing NBA…</motion.span>
              </div>

              <button
                onClick={() => setPasteDetected(null)}
                className="text-fg-2 hover:text-fg-1 shrink-0 transition-colors duration-150 relative"
                aria-label="Dismiss"
              >
                <X size={13} />
              </button>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center flex-1 text-center gap-4">
            <span className="text-5xl opacity-60">{channel.flag}</span>
            <div>
              <p className="text-fg-1 font-medium text-sm">{channel.name}</p>
              <p className="text-xs text-fg-2 mt-0.5">{channel.subtitle}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2 max-w-sm w-full">
              {prompts.map(p => (
                <motion.button
                  key={p}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={() => injectPrompt(p)}
                  className="text-xs bg-bg-2/80 hover:bg-bg-2 text-fg-2 hover:text-fg-0 px-3 py-2 rounded-lg text-left transition-colors duration-150 border border-border-0/50 hover:border-border-1"
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
                <AceAvatar
                  size={28}
                  state={
                    messageFx[i] === 'celebrated' ? 'celebrated' :
                    messageFx[i] === 'flagged'    ? 'flagged' :
                    m.streaming && !m.content     ? 'thinking' :
                    m.streaming                   ? 'streaming' :
                    'idle'
                  }
                  className="mt-1"
                />
              )}
              <div className="max-w-[80%] flex flex-col gap-1">
                <div
                  className={cn(
                    'rounded-2xl px-4 py-3 relative group transition-all duration-200',
                    m.role === 'user'
                      ? 'bg-info/8 backdrop-blur-md border border-info/15 text-fg-0 rounded-tr-sm'
                      : 'bg-white/[0.04] backdrop-blur-lg border border-white/[0.08] text-fg-0 rounded-tl-sm'
                  )}
                  style={m.role === 'user'
                    ? { boxShadow: '0 2px 16px rgba(59,130,246,0.06), inset 0 1px 0 rgba(255,255,255,0.03)' }
                    : { boxShadow: '0 2px 20px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.04)' }
                  }
                >
                  {m.hasImage && (
                    <div className="flex items-center gap-1.5 mb-1.5 text-xs text-hero/60">
                      <ImagePlus size={11} />
                      <span>Screenshot attached — Visual Audit</span>
                    </div>
                  )}
                  <MarkdownMessage content={m.content} />
                  {/* Pre-stream indicator is now on the avatar (thinking state) —
                      nothing needed inside the bubble until content arrives. */}
                  {m.streaming && !m.content && (
                    <div className="h-4 flex items-center">
                      <span className="text-xs text-fg-2/60 italic">thinking…</span>
                    </div>
                  )}
                  {/* Streaming cursor — glowing dot trailing the last token */}
                  {m.streaming && m.content && (
                    <motion.span
                      className="inline-block rounded-full ml-1 align-middle"
                      style={{
                        width: 7, height: 7,
                        background: 'rgba(250,204,21,0.95)',
                        boxShadow: '0 0 10px rgba(250,204,21,0.65)',
                      }}
                      animate={{ opacity: [0.35, 1, 0.35], scale: [0.9, 1.15, 0.9] }}
                      transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  )}

                  {/* Action buttons on hover */}
                  <div className="absolute -top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1.5 bg-bg-1/90 backdrop-blur-md border border-white/10 rounded-xl px-2 py-1.5 shadow-lg">
                    {m.role === 'assistant' && (
                      <button
                        onClick={() => { setSavingMem(i); setMemTitle(''); }}
                        className={cn('transition-colors duration-150', memSaved === i ? 'text-hero' : 'text-fg-2 hover:text-hero')}
                        aria-label="Save to memory"
                      >
                        {memSaved === i ? <Check size={11} /> : <Brain size={11} />}
                      </button>
                    )}
                    <button onClick={() => copyMsg(m.content, i)} className="text-fg-2 hover:text-fg-1 transition-colors duration-150" aria-label="Copy message">
                      {copied === i ? <Check size={11} className="text-ok" /> : <Copy size={11} />}
                    </button>
                  </div>
                </div>

                {/* Dead-link warning — runs async, silent when links are healthy */}
                {m.role === 'assistant' && !m.streaming && m.content && (
                  <LinkHealthBadge content={m.content} streaming={m.streaming} />
                )}

                {/* Thumbs up/down — feeds back into QA memory + trajectory */}
                {m.role === 'assistant' && !m.streaming && m.content && (
                  <DraftRating
                    messageContent={m.content}
                    messageIndex={i}
                    onRate={kind => triggerAvatarFx(i, kind === 'up' ? 'celebrated' : 'flagged')}
                  />
                )}

                {/* Auto-CSAT badge */}
                {m.role === 'assistant' && csatScores[i] && (
                  <div className="flex items-center gap-1.5 px-1">
                    <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded',
                      csatScores[i].grade === 'A' ? 'bg-ok/20 text-ok' :
                      csatScores[i].grade === 'B' ? 'bg-info/20 text-info' :
                      csatScores[i].grade === 'C' ? 'bg-hero-soft/20 text-hero' :
                      'bg-crit/20 text-crit'
                    )}>{csatScores[i].grade}</span>
                    <span className="text-[10px] text-fg-2">{csatScores[i].score}/100</span>
                  </div>
                )}

                {/* PLAN reasoning panel — collapsible, below the message bubble */}
                {m.role === 'assistant' && m.plan && (
                  <PlanPanel plan={m.plan} />
                )}

                {/* Save to memory inline form */}
                {savingMem === i && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    className="bg-bg-1 border border-hero/30 rounded-xl px-3 py-3 space-y-2"
                  >
                    <p className="text-xs text-hero font-medium">Save to Knowledge Base</p>
                    <input
                      autoFocus value={memTitle}
                      onChange={e => setMemTitle(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveToMemory(i); if (e.key === 'Escape') setSavingMem(null); }}
                      placeholder="Title for this memory…"
                      className="w-full bg-bg-2 border border-border-0 rounded-lg px-3 py-2 text-xs text-fg-0 placeholder-fg-2 outline-none focus:border-hero/50"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => saveToMemory(i)} disabled={!memTitle.trim()}
                        className="text-xs bg-hero/20 disabled:bg-bg-2 disabled:text-fg-2 text-hero hover:bg-hero/30 px-3 py-1.5 rounded-lg transition-colors duration-150 flex items-center gap-1">
                        <Brain size={11} /> Save
                      </button>
                      <button onClick={() => setSavingMem(null)} className="text-xs text-fg-2 hover:text-fg-1 px-2 py-1.5 transition-colors duration-150 flex items-center gap-1">
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
                <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/10 border border-info/15 backdrop-blur-sm flex items-center justify-center text-xs text-info shrink-0 mt-1 select-none font-medium">V</div>
              )}
            </motion.div>
          );
        })}

        {/* Pre-stream thinking — avatar sheds particles, no separate dot bubble */}
        {loading && !messages.some(m => m.streaming) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="flex gap-2.5 justify-start items-start h-12"
          >
            <AceAvatar size={28} state="thinking" className="mt-1" />
          </motion.div>
        )}

        {/* NBA loading — subtle indicator after AI responds */}
        {nbaLoading && !loading && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex items-center gap-2 pl-9"
          >
            <div className="w-1.5 h-1.5 bg-hero/40 rounded-full animate-pulse" />
            <span className="text-xs text-fg-3">Analyzing next action…</span>
          </motion.div>
        )}

        <div ref={bottomRef} />
        </div>{/* end messages wrapper */}
      </div>

      {/* Close Case Panel */}
      <AnimatePresence initial={false}>
        {closingCase && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="shrink-0 bg-bg-1 border-t-2 border-crit/30 px-5 py-4 space-y-3"
          >
            <div>
              <p className="text-sm font-semibold text-fg-0">Close this case</p>
              <p className="text-xs text-fg-2 mt-0.5">Save a case summary to Knowledge Base before clearing.</p>
            </div>
            <textarea
              autoFocus
              value={closeSummary}
              onChange={e => setCloseSummary(e.target.value)}
              placeholder="Case summary (optional) — what happened, resolution, follow-up needed..."
              rows={3}
              className="w-full bg-bg-2 border border-border-0 rounded-xl px-4 py-3 text-sm text-fg-0 placeholder-fg-2 outline-none focus:border-crit/40 resize-none transition-colors duration-200"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={closeCase}
                disabled={closeSaving}
                className="flex items-center gap-1.5 text-xs bg-hero hover:bg-hero text-[#021418] font-semibold px-4 py-2 rounded-lg transition-colors duration-150 disabled:opacity-60 cursor-pointer"
              >
                {closeSaving ? 'Saving...' : 'Save & Close'}
              </button>
              <button
                onClick={() => {
                  clearTimeout(historySaveTimerRef.current);
                  setMessages([]);
                  setLatestNBA([]);
                  storageRemove(NAMESPACES.CHAT, historyKey);
                  localStorage.removeItem(legacyHistoryKey);
                  setClosingCase(false);
                  setCloseSummary('');
                }}
                className="text-xs text-fg-1 hover:text-fg-0 px-4 py-2 rounded-lg border border-border-0 hover:border-border-1 transition-colors duration-150 cursor-pointer"
              >
                Just Clear
              </button>
              <button
                onClick={() => { setClosingCase(false); setCloseSummary(''); }}
                className="text-xs text-fg-2 hover:text-fg-1 px-3 py-2 transition-colors duration-150 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom — chips + input, unified glass panel */}
      <div className="shrink-0 border-t border-white/[0.06] bg-bg-1/60 backdrop-blur-xl relative">
        {/* Quick Replies panel */}
        <QuickReplies
          open={showQuickReplies}
          onClose={() => setShowQuickReplies(false)}
          onInsert={text => { setInput(text); setShowQuickReplies(false); textareaRef.current?.focus(); }}
        />

        {/* Quick Actions Bar — visible when conversation is active */}
        {messages.length > 0 && (
          <div className="px-4 pt-2 flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            <button
              onClick={() => {
                const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
                if (lastAssistant) { navigator.clipboard.writeText(lastAssistant.content); }
              }}
              className="text-xs whitespace-nowrap px-2.5 py-1.5 rounded-lg bg-bg-2 border border-border-0 text-fg-1 hover:text-fg-0 hover:border-border-1 transition-colors duration-150 shrink-0 flex items-center gap-1 cursor-pointer"
              aria-label="Copy last AI response"
            >
              <Copy size={10} /> Copy Last
            </button>
            <button
              onClick={() => setShowEscalation(true)}
              className="text-xs whitespace-nowrap px-2.5 py-1.5 rounded-lg bg-crit/10 border border-crit/25 text-crit hover:bg-crit/20 transition-colors duration-150 shrink-0 flex items-center gap-1 cursor-pointer"
              aria-label="Open escalation builder"
            >
              📤 Escalate
            </button>
            <button
              onClick={() => {
                const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
                if (lastAssistant) {
                  const idx = messages.lastIndexOf(lastAssistant);
                  setSavingMem(idx);
                  setMemTitle('');
                }
              }}
              className="text-xs whitespace-nowrap px-2.5 py-1.5 rounded-lg bg-bg-2 border border-border-0 text-fg-1 hover:text-hero hover:border-hero/30 transition-colors duration-150 shrink-0 flex items-center gap-1 cursor-pointer"
              aria-label="Save to memory"
            >
              <Brain size={10} /> Save Memory
            </button>
            <button
              onClick={() => setShowQuickReplies(!showQuickReplies)}
              className={cn(
                'text-xs whitespace-nowrap px-2.5 py-1.5 rounded-lg border transition-colors duration-150 shrink-0 flex items-center gap-1 cursor-pointer',
                showQuickReplies
                  ? 'bg-hero/15 border-hero/30 text-hero'
                  : 'bg-bg-2 border-border-0 text-fg-1 hover:text-fg-0 hover:border-border-1'
              )}
              aria-label="Toggle quick replies"
            >
              <Languages size={10} /> SE/EN
            </button>
            <button
              onClick={() => {
                const next = !autoCsat;
                setAutoCsat(next);
                storageSet(NAMESPACES.SETTINGS, 'auto_csat', next);
                localStorage.removeItem('ace_auto_csat');
              }}
              className={cn(
                'text-xs whitespace-nowrap px-2.5 py-1.5 rounded-lg border transition-colors duration-150 shrink-0 flex items-center gap-1 cursor-pointer',
                autoCsat
                  ? 'bg-ok/15 border-ok/30 text-ok'
                  : 'bg-bg-2 border-border-0 text-fg-1 hover:text-fg-0 hover:border-border-1'
              )}
              aria-label="Toggle auto quality scoring"
            >
              <Gauge size={10} /> {autoCsat ? 'CSAT On' : 'CSAT Off'}
            </button>
          </div>
        )}

        {/* Quick chips */}
        <div className="px-4 pt-2 flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {QUICK_CHIPS.map(chip => (
            <motion.button
              key={chip.label}
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => injectChip(chip.text)}
              className="text-xs whitespace-nowrap px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] backdrop-blur-sm border border-white/[0.06] hover:border-white/[0.12] text-fg-2 hover:text-fg-0 transition-all duration-200 shrink-0"
            >
              {chip.label}
            </motion.button>
          ))}
        </div>

        {/* Image preview */}
        <AnimatePresence>
          {imageAttachment && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-4 pt-2 overflow-hidden"
            >
              <div className="inline-flex items-center gap-2 bg-bg-2/80 border border-border-0 rounded-xl px-3 py-2">
                <img src={imageAttachment.preview} alt="Attachment preview" className="w-10 h-10 rounded-lg object-cover" />
                <div className="min-w-0">
                  <p className="text-xs text-fg-1 truncate max-w-[160px]">{imageAttachment.name}</p>
                  <p className="text-[10px] text-hero/70">Visual Audit will run</p>
                </div>
                <button
                  onClick={() => setImageAttachment(null)}
                  className="text-fg-2 hover:text-crit transition-colors duration-150 shrink-0 cursor-pointer"
                  aria-label="Remove image"
                >
                  <X size={13} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input */}
        <div className="px-4 py-3">
          <div
            className="flex gap-3 items-end bg-white/[0.03] backdrop-blur-lg border border-white/[0.08] focus-within:border-hero/30 rounded-2xl px-4 py-3 transition-all duration-200"
            style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.04)' }}
          >
            {/* Image attach button */}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageAttach} className="hidden" aria-label="Attach image" />
            <button
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 shrink-0 mb-0.5 cursor-pointer',
                imageAttachment
                  ? 'bg-hero/15 text-hero border border-hero/30'
                  : 'bg-bg-2/60 text-fg-2 hover:text-fg-1 border border-border-0/50 hover:border-border-1'
              )}
              title="Attach screenshot for Visual Audit"
              aria-label="Attach image for Visual Audit"
            >
              <ImagePlus size={14} />
            </button>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={imageAttachment ? "Describe what you need from this screenshot…" : "Ask Ace anything… (Enter to send, Shift+Enter for new line)"}
              rows={1}
              className="flex-1 bg-transparent text-sm text-fg-0 placeholder-fg-2 resize-none outline-none min-h-[20px] max-h-[120px] leading-relaxed"
              onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
            />
            <motion.button
              onClick={send}
              disabled={(!input.trim() && !imageAttachment) || loading}
              whileHover={(input.trim() || imageAttachment) && !loading ? { scale: 1.1 } : {}}
              whileTap={(input.trim() || imageAttachment) && !loading ? { scale: 0.92 } : {}}
              className="w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br from-hero to-hero disabled:from-bg-3 disabled:to-bg-3 text-[#021418] disabled:text-fg-2 transition-all duration-200 shrink-0 mb-0.5"
              style={(input.trim() || imageAttachment) && !loading ? { boxShadow: '0 0 16px rgba(250,204,21,0.25)' } : {}}
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
