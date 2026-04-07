import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { BYBIT_KB } from '@/data/bybitKB';

const AceContext = createContext(null);

// ─── Privacy Shield — PII Scrubber ───────────────────────────────────────────
// Runs 100% client-side. Called before any text is sent to the LLM.
// Preserves message meaning; replaces only identifiable personal data.

export function scrubPII(text) {
  if (!text) return text;
  return text
    // Emails — RFC-ish, covers subdomain and plus-addressing
    .replace(/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/gi, '[EMAIL]')
    // Names preceded by common CRM labels
    .replace(
      /(?:(?:full[-_\s]?)?name|customer|client|from|to|sender|recipient)\s*[:\s]+([A-Z][a-z][\w'-]*(?:\s+[A-Z][a-z][\w'-]*)+)/g,
      (m, name) => m.replace(name, '[NAME]')
    )
    // Phone numbers: 10-15 digits, optional +/spaces/dashes/dots/parens
    .replace(/(?<!\d)(\+?[\d][\d\s().\\-]{8,14}[\d])(?!\d)/g, '[PHONE]')
    // UID-style digit blocks — 8-12 digits not embedded in a longer hex string
    .replace(/(?<![a-fA-F0-9])(\b\d{8,12}\b)(?![a-fA-F0-9])/g, '[USER_ID]');
}

// ─── Raw text parser ──────────────────────────────────────────────────────────
// Standalone mandate: parse what the agent pastes — no API, no loading states.

function parseRawContext(text) {
  if (!text?.trim()) return { uid: '', orderId: '', issue: '', platform: '', coin: '', txHash: '', errorCode: '', rawText: text || '' };

  // UID: 6-12 digit number, often preceded by "UID", "User ID", "Account"
  const uidMatch =
    text.match(/(?:uid|user[-_\s]?id|account[-_\s]?id|account#)\s*[:\s#]*(\d{6,12})/i) ||
    text.match(/\b(\d{8,12})\b/);

  // Order ID: alphanumeric block (P2P orders, trade IDs, case IDs)
  const orderMatch =
    text.match(/(?:order[-_\s]?(?:id|#)|p2p[-_\s]?order|case[-_\s]?id|ticket#?)\s*[:\s#]*([A-Z0-9]{6,20})/i) ||
    text.match(/\b([A-Z]{1,3}\d{7,18})\b/);

  // Platform: EU signals vs Global
  const platform =
    /\beu\b|bybit\.eu|mica|sepa|eea|gdpr/i.test(text) ? 'eu' :
    /global|180[\s+]countries|bybit\.com/i.test(text) ? 'global' : '';

  // Issue: first non-empty meaningful line
  const lines = text.split(/\n/).map(l => l.trim()).filter(l => l.length > 8);
  const issue = lines[0]?.slice(0, 150) || '';

  // Coin/token
  const coinMatch = text.match(/\b(BTC|ETH|USDT|XRP|SOL|BNB|USDC|TRX|XLM|AVAX)\b/i);
  const coin = coinMatch?.[1]?.toUpperCase() || '';

  // Tx hash: 0x + 40-64 hex chars (ETH/EVM) or bare 64-char hex (BTC/others)
  const txHashMatch = text.match(/\b(0x[a-fA-F0-9]{40,64}|[a-fA-F0-9]{64})\b/);

  // Bybit error codes: E01, ERR-001, error code: ABC123
  const errorCodeMatch = text.match(/\b(E\d{2,4}|ERR[-_]?\d{3,}|error[-_\s]?code[-_\s:]+[\w-]+)\b/i);

  return {
    uid: uidMatch?.[1] || '',
    orderId: orderMatch?.[1] || '',
    issue,
    platform,
    coin,
    txHash: txHashMatch?.[1] || '',
    errorCode: errorCodeMatch?.[1]?.trim() || '',
    rawText: text,
  };
}

function hasBybitSignals(parsed) {
  return !!(parsed.uid || parsed.orderId || parsed.coin || parsed.txHash || parsed.errorCode);
}

// ─── Case event recorder (for Efficiency Heatmap) ────────────────────────────
export function recordCaseEvent({ vipLevel = 0, channel = '' } = {}) {
  try {
    const raw = localStorage.getItem('ace_case_events') || '[]';
    const events = JSON.parse(raw);
    events.push({ ts: Date.now(), vipLevel, channel });
    // Keep only last 90 days
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    localStorage.setItem('ace_case_events', JSON.stringify(events.filter(e => e.ts > cutoff)));
  } catch { /* non-critical */ }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AceProvider({ children }) {
  const [vipLevel, setVipLevelRaw] = useState(() => {
    try { return Math.min(5, Math.max(0, parseInt(localStorage.getItem('ace_vip_level') || '0', 10))); }
    catch { return 0; }
  });

  const [parsedData, setParsedData] = useState({
    uid: '', orderId: '', issue: '', platform: '', coin: '', txHash: '', errorCode: '', rawText: '',
  });

  const [nbaActions, setNbaActions] = useState([]);

  // Magic Paste signal — fires when Bybit-relevant data is pasted anywhere in the app
  const [pasteSignal, setPasteSignal] = useState(null);

  function setVipLevel(level) {
    const n = Math.min(5, Math.max(0, Number(level)));
    setVipLevelRaw(n);
    localStorage.setItem('ace_vip_level', String(n));
  }

  function parseContext(text) {
    const parsed = parseRawContext(text);
    setParsedData(parsed);
    return parsed;
  }

  // ── Magic Paste global listener ──────────────────────────────────────────────
  // Intercepts all paste events app-wide. Doesn't prevent default — just piggybacks.
  // If Bybit signals are detected, updates parsedData and fires pasteSignal.
  useEffect(() => {
    function handlePaste(e) {
      const text = e.clipboardData?.getData('text') || '';
      if (!text.trim() || text.length < 10) return;
      const parsed = parseRawContext(text);
      if (hasBybitSignals(parsed)) {
        setParsedData(parsed);
        setPasteSignal({ parsed, ts: Date.now() });
      }
    }
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, []);

  const searchKB = useCallback((query) => {
    if (!query?.trim()) return [];
    const lower = query.toLowerCase();
    return BYBIT_KB.filter(a =>
      a.title.toLowerCase().includes(lower) ||
      a.subtitle?.toLowerCase().includes(lower) ||
      a.domain.toLowerCase().includes(lower) ||
      a.keyPoints?.some(kp => kp.toLowerCase().includes(lower))
    ).slice(0, 5);
  }, []);

  const isVIPCritical = vipLevel >= 3;

  const VIP_LABELS = ['Non-VIP', 'VIP 1', 'VIP 2', 'VIP 3', 'VIP 4', 'VIP 5'];
  const VIP_COLORS = [
    'text-slate-500 bg-slate-800 border-slate-700',
    'text-blue-400 bg-blue-500/10 border-blue-500/20',
    'text-blue-400 bg-blue-500/10 border-blue-500/20',
    'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
    'text-yellow-300 bg-yellow-400/15 border-yellow-400/50',
    'text-yellow-200 bg-yellow-400/20 border-yellow-400/70',
  ];

  return (
    <AceContext.Provider value={{
      vipLevel,
      setVipLevel,
      isVIPCritical,
      vipLabel: VIP_LABELS[vipLevel] || 'Non-VIP',
      vipColorClass: VIP_COLORS[vipLevel] || VIP_COLORS[0],
      parsedData,
      parseContext,
      nbaActions,
      setNbaActions,
      searchKB,
      kb: BYBIT_KB,
      pasteSignal,
      clearPasteSignal: () => setPasteSignal(null),
    }}>
      {children}
    </AceContext.Provider>
  );
}

export function useAce() {
  const ctx = useContext(AceContext);
  if (!ctx) throw new Error('useAce must be used within AceProvider');
  return ctx;
}
