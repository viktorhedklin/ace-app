import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { BYBIT_KB, parseErrorCodes } from '@/data/bybitKB';
import { scrubPII } from '@/lib/SecurityModule';
import { toast } from '@/components/ui/use-toast';
import { syncKnowledgeFromRemote, getKBSyncUrl, setKBSyncUrl } from '@/api/claude';  // kept for optional manual sync
import { get as storageGet, set as storageSet, remove as storageRemove, registerAutoFlush, NAMESPACES } from '@/lib/storage';

// Re-export from SecurityModule — single source of truth for all PII scrubbing.
// Every file that imports scrubPII from AceContext gets the SecurityModule version.
export { scrubPII } from '@/lib/SecurityModule';

const AceContext = createContext(null);

// ─── Raw text parser ──────────────────────────────────────────────────────────
// Standalone mandate: parse what the agent pastes — no API, no loading states.

function parseRawContext(text) {
  if (!text?.trim()) return { uid: '', orderId: '', issue: '', platform: '', coin: '', txHash: '', errorCode: '' };

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
  };
}

function hasBybitSignals(parsed) {
  return !!(parsed.uid || parsed.orderId || parsed.coin || parsed.txHash || parsed.errorCode);
}

// ─── Case event recorder (for Efficiency Heatmap) ────────────────────────────
export function recordCaseEvent({ vipLevel = 0, channel = '' } = {}) {
  try {
    const existing = storageGet(NAMESPACES.SETTINGS, 'case_events');
    const legacy = !Array.isArray(existing)
      ? JSON.parse(localStorage.getItem('ace_case_events') || '[]')
      : null;
    const events = Array.isArray(existing) ? existing : (legacy || []);
    events.push({ ts: Date.now(), vipLevel, channel });
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const trimmed = events.filter(e => e.ts > cutoff);
    storageSet(NAMESPACES.SETTINGS, 'case_events', trimmed);
    localStorage.removeItem('ace_case_events');
  } catch (e) {
    console.warn('[AceContext] recordCaseEvent failed', e);
  }
}

// ─── Secure Snippets — local-only snippet storage ────────────────────────────

function loadSnippets() {
  const fromCloud = storageGet(NAMESPACES.SETTINGS, 'snippets');
  if (Array.isArray(fromCloud)) return fromCloud;
  try { return JSON.parse(localStorage.getItem('ace_snippets') || '[]'); }
  catch { return []; }
}

function persistSnippets(snippets) {
  storageSet(NAMESPACES.SETTINGS, 'snippets', snippets);
  localStorage.removeItem('ace_snippets');
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AceProvider({ children }) {
  const [vipLevel, setVipLevelRaw] = useState(() => {
    try { return Math.min(5, Math.max(0, parseInt(localStorage.getItem('ace_vip_level') || '0', 10))); }
    catch { return 0; }
  });

  const [parsedData, setParsedData] = useState({
    uid: '', orderId: '', issue: '', platform: '', coin: '', txHash: '', errorCode: '',
  });

  const [nbaActions, setNbaActions] = useState([]);

  // Ghost Mode — suppresses all VIP visual flair (animations, gold accents)
  const [ghostMode, setGhostMode] = useState(false);

  // Nebula Heartbeat — triggered by Friction Detector on sentiment drop
  const [nebulaHeartbeat, setNebulaHeartbeat] = useState(0); // increment to trigger

  // ── Secure Snippets ──────────────────────────────────────────────────────────
  const [snippets, setSnippetsRaw] = useState(loadSnippets);
  const [snippetSearchOpen, setSnippetSearchOpen] = useState(false);

  const addSnippet = useCallback((title, content) => {
    const next = [...snippets, { id: Date.now() + Math.random(), title, content, createdAt: Date.now() }];
    setSnippetsRaw(next);
    persistSnippets(next);
  }, [snippets]);

  const removeSnippet = useCallback((id) => {
    const next = snippets.filter(s => s.id !== id);
    setSnippetsRaw(next);
    persistSnippets(next);
  }, [snippets]);

  const updateSnippet = useCallback((id, title, content) => {
    const next = snippets.map(s => s.id === id ? { ...s, title, content } : s);
    setSnippetsRaw(next);
    persistSnippets(next);
  }, [snippets]);

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

  // ── Hotkey: ⌘+S Snippet Search (⌘+H Ghost Mode is in Layout.jsx) ────────────
  useEffect(() => {
    function handleKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        setSnippetSearchOpen(o => !o);
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  // ── Register storage auto-flush — retries queued cloud writes on reconnect
  // and every 60s as a safety net. Idempotent, safe to call on every mount.
  useEffect(() => {
    registerAutoFlush();
  }, []);

  // ── Magic Paste global listener ──────────────────────────────────────────────
  // Intercepts all paste events app-wide. Doesn't prevent default — just piggybacks.
  // If Bybit signals are detected, updates parsedData and fires pasteSignal.
  // If error codes are detected, fires Tactical Suggestion toasts with SOP.
  useEffect(() => {
    function handlePaste(e) {
      const text = e.clipboardData?.getData('text') || '';
      if (!text.trim() || text.length < 10) return;
      const parsed = parseRawContext(text);
      if (hasBybitSignals(parsed)) {
        setParsedData(parsed);
        setPasteSignal({ parsed, ts: Date.now() });
      }

      // ── Tactical Auto-Parser: detect Bybit error codes in pasted text ──
      const errorHits = parseErrorCodes(text);
      if (errorHits.length > 0) {
        // Show one toast per detected error code (max 3 to avoid spam)
        errorHits.slice(0, 3).forEach((hit, idx) => {
          setTimeout(() => {
            const severityColor = hit.severity === 'critical' ? 'destructive' : 'default';
            const severityTag = hit.severity === 'critical' ? 'CRITICAL'
              : hit.severity === 'high' ? 'HIGH' : hit.severity === 'medium' ? 'MED' : 'LOW';
            toast({
              title: `Tactical: ${hit.code} [${severityTag}]`,
              description: `${hit.label} — ${hit.agentAction.slice(0, 120)}${hit.agentAction.length > 120 ? '...' : ''}`,
              variant: severityColor,
              duration: 8000,
            });
          }, idx * 400); // stagger toasts so they don't stack instantly
        });
      }
    }
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, []);

  // ── Startup cleanup — purge dead Base44 sync URLs ──────────────────────────
  const cleanupRan = useRef(false);
  useEffect(() => {
    if (cleanupRan.current) return;
    cleanupRan.current = true;
    // Kill any Base44 remnants — Base44 was permanently excluded in Phase 1
    const url = getKBSyncUrl();
    if (url && /base44|b44\./i.test(url)) {
      setKBSyncUrl('');
      storageRemove(NAMESPACES.KB, 'sync_url');
      localStorage.removeItem('ace_kb_sync_url');
    }
    // Also clean up any leftover GitHub token from previous version
    localStorage.removeItem('ace_gh_token');
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
      ghostMode,
      setGhostMode,
      nebulaHeartbeat,
      triggerHeartbeat: () => setNebulaHeartbeat(n => n + 1),
      snippets,
      addSnippet,
      removeSnippet,
      updateSnippet,
      snippetSearchOpen,
      setSnippetSearchOpen,
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
