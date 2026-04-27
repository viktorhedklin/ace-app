import { useState, useMemo, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { RotateCcw, Copy, Check, Sparkles, Loader2, ArrowLeft, Clock, AlertTriangle, CheckCircle2, Calendar, Search, Send, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { scrubPII } from '@/lib/SecurityModule';
import { InvokeLLM, InvokeChatWithHistory, hasAnyApiKey } from '@/api/claude';
import { cn } from '@/lib/utils';

/* ═══ CHAIN DATA ═══ */

const CHAINS = {
  BTC:   { name: 'Bitcoin',              confirmations: 1,   minDeposit: '0.0001 BTC', memo: false, bc: 'bitcoin',       explorer: 'https://mempool.space/tx/',              explorerName: 'Mempool' },
  ETH:   { name: 'Ethereum (ERC-20)',    confirmations: 6,   minDeposit: '0.01 ETH',   memo: false, bc: 'ethereum',      explorer: 'https://etherscan.io/tx/',               explorerName: 'Etherscan' },
  TRX:   { name: 'TRON (TRC-20)',        confirmations: 20,  minDeposit: '1 USDT',     memo: false, bc: 'tron',          explorer: 'https://tronscan.org/#/transaction/',     explorerName: 'Tronscan' },
  BNB:   { name: 'BNB Smart Chain',      confirmations: 15,  minDeposit: '0.01 BNB',   memo: false, bc: 'bnb',           explorer: 'https://bscscan.com/tx/',                explorerName: 'BscScan' },
  XRP:   { name: 'Ripple (XRP)',         confirmations: 6,   minDeposit: '10 XRP',     memo: true,  bc: 'ripple',        explorer: 'https://xrpscan.com/tx/',                explorerName: 'XRPScan' },
  XLM:   { name: 'Stellar (XLM)',        confirmations: 1,   minDeposit: '1 XLM',      memo: true,  bc: 'stellar',       explorer: 'https://stellarchain.io/tx/',             explorerName: 'StellarChain' },
  SOL:   { name: 'Solana',               confirmations: 1,   minDeposit: '0.01 SOL',   memo: false, bc: 'solana',        explorer: 'https://solscan.io/tx/',                 explorerName: 'Solscan' },
  MATIC: { name: 'Polygon',              confirmations: 200, minDeposit: '1 MATIC',    memo: false, bc: 'polygon',       explorer: 'https://polygonscan.com/tx/',            explorerName: 'PolygonScan' },
  AVAX:  { name: 'Avalanche C-Chain',    confirmations: 20,  minDeposit: '0.1 AVAX',   memo: false, bc: 'avalanche',     explorer: 'https://snowtrace.io/tx/',               explorerName: 'Snowtrace' },
  OP:    { name: 'Optimism',             confirmations: 15,  minDeposit: '0.01 ETH',   memo: false, bc: 'optimism',      explorer: 'https://optimistic.etherscan.io/tx/',     explorerName: 'OP Etherscan' },
  ARB:   { name: 'Arbitrum One',         confirmations: 15,  minDeposit: '0.01 ETH',   memo: false, bc: 'arbitrum-one',  explorer: 'https://arbiscan.io/tx/',                explorerName: 'Arbiscan' },
};

/* ═══ BLOCKCHAIN FETCH ═══
 * Queries blockchair.com (public chain aggregator). The TX hash is public
 * on-chain data — this is equivalent to opening Etherscan in a browser.
 * No customer PII is sent. Hash is a blockchain primitive, not user info. */

async function fetchTx(chainKey, txid) {
  const chain = CHAINS[chainKey];
  if (!chain?.bc) throw new Error('Unsupported chain');
  const url = `https://api.blockchair.com/${chain.bc}/dashboards/transaction/${txid}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Explorer returned ${res.status}`);
  const json = await res.json();
  const txKey = Object.keys(json.data || {})[0];
  if (!txKey || !json.data[txKey]) throw new Error('Transaction not found');
  const raw = json.data[txKey];
  const tx = raw.transaction || {};
  const latestBlock = json.context?.state || 0;
  const confs = tx.block_id > 0 && latestBlock > 0 ? latestBlock - tx.block_id + 1 : 0;
  const required = chain.confirmations;
  let status = 'pending';
  if (tx.block_id === -1 || tx.block_id === 0) status = 'pending';
  else if (tx.failed === true) status = 'failed';
  else if (confs >= required) status = 'confirmed';
  else status = 'confirming';

  return {
    hash: tx.hash || txid,
    chain: chainKey,
    chainName: chain.name,
    blockId: tx.block_id,
    time: tx.time,
    confirmations: confs,
    requiredConfirmations: required,
    status,
    from: tx.sender || (raw.inputs?.[0]?.recipient) || '—',
    to: tx.recipient || (raw.outputs?.[0]?.recipient) || '—',
    value: tx.value != null ? tx.value : tx.input_total,
    valueUsd: tx.value_usd ?? tx.input_total_usd ?? null,
    fee: tx.fee,
    feeUsd: tx.fee_usd,
    memo: tx.memo || tx.destination_tag || null,
    failed: tx.failed || false,
    explorerUrl: chain.explorer + txid,
    explorerName: chain.explorerName,
    raw,
  };
}

/* ═══ SEPA DATA ═══ */

const SEPA_CHECKLIST = [
  { key: 'ref',      label: 'Reference number included & correct',       tip: 'Unique reference from Bybit deposit page must be in the transfer description' },
  { key: 'iban',     label: 'Correct Bybit IBAN used',                   tip: 'Verify IBAN matches the one on customer\'s Bybit deposit page' },
  { key: 'name',     label: 'Sender name matches KYC name',              tip: 'Name on sending bank account must match verified Bybit name' },
  { key: 'bank',     label: 'Bank confirms transfer completed',          tip: 'Customer should check with bank that transfer was sent and not held' },
  { key: 'amount',   label: 'Amount within deposit limits (min €10)',     tip: 'SEPA deposits min €10 — check bank-side daily limit too' },
  { key: 'country',  label: 'Country eligible for fiat services',        tip: 'Check CS:GO KYC > Issue Country against restricted country list' },
];

const SEPA_ORDER_STATUSES = [
  { value: 'no_order',              label: 'No order found in CS:GO',         color: 'red',    action: 'Funds deducted but no order created → collect info and escalate to P2' },
  { value: 'PENDING',               label: 'PENDING',                         color: 'yellow', action: 'Risk review or discrepancy check triggered. Search Order ID in Lark groups (Risk Control / Discrepancy Platform)' },
  { value: 'PAYING',                label: 'PAYING',                          color: 'yellow', action: 'Payment not yet received. Will auto-cancel after 96 hours. If within 96h → advise to complete payment. If exceeded → escalate P2' },
  { value: 'PENDING_PAY',           label: 'PENDING PAY',                     color: 'yellow', action: 'BLIK method — must complete within 48h or auto-cancels. If exceeded → escalate P2' },
  { value: 'REFUND_PROCESSING',     label: 'REFUND PROCESSING',               color: 'blue',   action: 'Refund initiated. Takes 7–14 business days. If exceeded 14 BD → escalate P2' },
  { value: 'PAY_ORDER_CREATE_FAILED', label: 'PAY ORDER CREATE FAILED',       color: 'red',    action: 'Rejected by risk control. Funds were NOT charged. Advise to retry or use P2P/One-Click Buy' },
  { value: 'TIMEOUT_CANCEL',        label: 'TIMEOUT CANCEL',                  color: 'slate',  action: 'Order timed out — payment not received. If customer says funds were deducted → collect proof and escalate' },
  { value: 'REFUNDED',              label: 'REFUNDED',                        color: 'green',  action: 'Refund completed by Bybit. Funds should appear within 14 BD. If not → customer contacts bank first, then escalate with proof' },
  { value: 'FAILED',                label: 'FAILED',                          color: 'red',    action: 'Order failed. Check Failed Code in CS:GO. If funds deducted → collect proof and escalate' },
  { value: 'SUCCESS',               label: 'SUCCESS',                         color: 'green',  action: 'Deposit credited successfully. Check Funding Account balance with customer' },
];

const SEPA_ESCALATION_TEMPLATES = {
  no_order: `Dear team, the user reports that funds have been deducted from their bank account, but NO ORDER was created in the system. Kindly investigate and assist accordingly. Thank you.
UID:
Full Name:
Order ID: N/A
Date of payment:
Fiat Currency:
Amount:
Deposited Channel:
Payment Proof: *attached*`,
  pending_risk: `Dear team, user's fiat risk review has exceeded 2 business days and there is yet to be any update for the result. Kindly assist in expediting the risk result.
UID:
Appeal ID:`,
  pending_discrepancy: `Dear team, the user's fiat deposit order triggered discrepancies and the order exceeded 5 business days. Kindly assist with the further investigation.
UID:
Order ID:`,
  pending_no_record: `Dear team, the user's Fiat deposit order is PENDING but there is no record in risk order or Lark.
UID:
Order ID:`,
  paying_stuck: `Dear team, the fiat deposit order had been stuck in status [PAYING] for more than 96 hours. Kindly assist to check on the issue.
UID:
Order ID:`,
  refund_stuck: `Dear team, the user's Fiat deposit order is stuck in REFUND_PROCESSING for more than 14 business days.
UID:
Status: REFUND_PROCESSING
Order ID:`,
  failed_deducted: `Dear team, the user reports that funds have been deducted from their payment method, but the order status shows as FAILED. Kindly investigate and assist accordingly. Thank you.
UID:
Order ID:
Fiat Currency:
Amount:
Deposited Channel:
Payment Proof: *attached*`,
  name_mismatch: `Dear team, the user's name provided during the Fiat deposit appears to be incorrect.
Kindly assist in correcting it after the user provides with the correct information and screenshot.
UID:`,
};

/* ═══ HELPERS ═══ */

function getBusinessDays(from, to) {
  let count = 0;
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  if (cursor >= end) return 0;
  cursor.setDate(cursor.getDate() + 1);
  while (cursor <= end) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

const DATE_QUICK = [
  { label: 'Today', offset: 0 }, { label: 'Yesterday', offset: 1 },
  { label: '2 days ago', offset: 2 }, { label: '3 days ago', offset: 3 },
  { label: '5 days ago', offset: 5 }, { label: '1 week+', offset: 7 },
];

function offsetToDate(o) { const d = new Date(); d.setDate(d.getDate() - o); return d.toISOString().slice(0, 10); }

function useCopy(ms = 2000) {
  const [done, setDone] = useState(false);
  function copy(text) { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), ms); }
  return [done, copy];
}

/* ═══ SUB-COMPONENTS ═══ */

function CopyBtn({ text, label = 'Copy', className = '' }) {
  const [done, copy] = useCopy();
  return (
    <button onClick={() => copy(text)} className={cn('flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border transition-all cursor-pointer', done ? 'bg-ok/15 border-ok/30 text-ok' : 'bg-bg-2 border-border-0 text-fg-1 hover:text-hero hover:border-hero/40', className)} aria-label={label}>
      {done ? <><Check size={11} /> Copied</> : <><Copy size={11} /> {label}</>}
    </button>
  );
}

function Section({ title, children, open: defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-bg-1 border border-border-0 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3 text-left cursor-pointer">
        <span className="text-xs font-semibold text-fg-1 uppercase tracking-widest">{title}</span>
        {open ? <ChevronUp size={13} className="text-fg-2" /> : <ChevronDown size={13} className="text-fg-2" />}
      </button>
      {open && children}
    </div>
  );
}

/* ── Tx Result Card ── */

function TxResultCard({ tx }) {
  if (!tx) return null;
  const STATUS_COLORS = { confirmed: 'text-ok bg-ok/15 border-ok/30', confirming: 'text-hero bg-hero/15 border-hero/30', pending: 'text-warn bg-orange-400/15 border-orange-400/30', failed: 'text-crit bg-crit/15 border-crit/30' };
  const confPct = tx.requiredConfirmations > 0 ? Math.min(100, (tx.confirmations / tx.requiredConfirmations) * 100) : 0;

  // Format value — handle wei/satoshi
  let displayValue = '—';
  if (tx.value != null) {
    const v = Number(tx.value);
    if (tx.chain === 'ETH' || tx.chain === 'OP' || tx.chain === 'ARB' || tx.chain === 'AVAX' || tx.chain === 'MATIC' || tx.chain === 'BNB') {
      displayValue = (v / 1e18).toFixed(6);
    } else if (tx.chain === 'BTC') {
      displayValue = (v / 1e8).toFixed(8);
    } else if (tx.chain === 'XRP') {
      displayValue = (v / 1e6).toFixed(6);
    } else if (tx.chain === 'TRX' || tx.chain === 'SOL') {
      displayValue = (v / 1e6).toFixed(6);
    } else {
      displayValue = v.toLocaleString();
    }
  }

  return (
    <div className="bg-bg-1 border border-border-0 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-fg-0">Transaction Details</h3>
        <div className="flex items-center gap-2">
          <span className={cn('text-xs px-2 py-0.5 rounded border font-semibold', STATUS_COLORS[tx.status] || STATUS_COLORS.pending)}>
            {tx.status.toUpperCase()}
          </span>
          <a href={tx.explorerUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-info hover:text-info transition-colors">
            {tx.explorerName} <ExternalLink size={11} />
          </a>
        </div>
      </div>

      {/* Confirmations bar */}
      <div>
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-fg-2">Confirmations</span>
          <span className={tx.confirmations >= tx.requiredConfirmations ? 'text-ok' : 'text-hero'}>
            {tx.confirmations.toLocaleString()} / {tx.requiredConfirmations} required
          </span>
        </div>
        <div className="h-1.5 bg-bg-2 rounded-full overflow-hidden">
          <div className={cn('h-full rounded-full transition-all duration-500', tx.confirmations >= tx.requiredConfirmations ? 'bg-ok' : 'bg-hero')} style={{ width: `${confPct}%` }} />
        </div>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div><span className="text-fg-2 block">Time</span><span className="text-fg-0 font-mono">{tx.time || '—'}</span></div>
        <div><span className="text-fg-2 block">Block</span><span className="text-fg-0 font-mono">{tx.blockId > 0 ? tx.blockId.toLocaleString() : 'Unconfirmed'}</span></div>
        <div><span className="text-fg-2 block">From</span><span className="text-fg-0 font-mono text-[11px] break-all">{tx.from}</span></div>
        <div><span className="text-fg-2 block">To</span><span className="text-fg-0 font-mono text-[11px] break-all">{tx.to}</span></div>
        <div><span className="text-fg-2 block">Value</span><span className="text-fg-0">{displayValue}{tx.valueUsd != null ? <span className="text-fg-2 ml-1">(${Number(tx.valueUsd).toFixed(2)})</span> : ''}</span></div>
        <div><span className="text-fg-2 block">Fee</span><span className="text-fg-0">{tx.feeUsd != null ? `$${Number(tx.feeUsd).toFixed(4)}` : '—'}</span></div>
        {tx.memo && <div className="col-span-2"><span className="text-fg-2 block">Memo / Tag</span><span className="text-fg-0 font-mono">{tx.memo}</span></div>}
      </div>

      {/* Quick diagnosis */}
      {tx.status === 'confirmed' && (
        <div className="bg-ok/8 border border-ok/20 rounded-lg px-3 py-2 text-xs text-ok">
          <CheckCircle2 size={13} className="inline mr-1" /> Transaction fully confirmed. If not credited, check: correct deposit address, minimum amount ({CHAINS[tx.chain]?.minDeposit}), {CHAINS[tx.chain]?.memo ? 'memo/tag was included, ' : ''}correct network.
        </div>
      )}
      {tx.status === 'confirming' && (
        <div className="bg-hero/8 border border-hero/20 rounded-lg px-3 py-2 text-xs text-hero">
          <Clock size={13} className="inline mr-1" /> Still confirming — {tx.requiredConfirmations - tx.confirmations} more needed. Customer should wait.
        </div>
      )}
      {tx.status === 'pending' && (
        <div className="bg-orange-400/8 border border-orange-400/20 rounded-lg px-3 py-2 text-xs text-warn">
          <AlertTriangle size={13} className="inline mr-1" /> Transaction not yet in a block. May still be in the mempool or the sending side hasn't broadcast yet.
        </div>
      )}
      {tx.status === 'failed' && (
        <div className="bg-crit/8 border border-crit/20 rounded-lg px-3 py-2 text-xs text-crit">
          <AlertTriangle size={13} className="inline mr-1" /> Transaction failed on-chain. Funds should revert to sender. Customer needs to retry.
        </div>
      )}
    </div>
  );
}

/* ── Mini Chat ── */

function TxChat({ txData }) {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  const SUGGESTIONS = ['Is this transaction confirmed enough for Bybit?', 'Was the correct network used?', 'What should I tell the customer?', 'Should I escalate this?'];

  async function send(text) {
    const q = (text || input).trim();
    if (!q || loading) return;
    setInput('');
    const newMsgs = [...msgs, { role: 'user', content: q }];
    setMsgs(newMsgs);
    setLoading(true);
    try {
      const sys = `You are ACE, helping a Bybit support agent investigate a crypto deposit. Here is the transaction data:\n\n${JSON.stringify(txData, null, 2)}\n\nChain: ${txData.chainName} (${txData.chain})\nBybit requires ${txData.requiredConfirmations} confirmations. Min deposit: ${CHAINS[txData.chain]?.minDeposit}. Memo required: ${CHAINS[txData.chain]?.memo ? 'YES' : 'No'}.\n\nAnswer concisely (2-4 sentences). Be direct. Focus on what the agent should do.`;
      const result = await InvokeChatWithHistory({ messages: newMsgs, system_prompt: sys });
      setMsgs(prev => [...prev, { role: 'assistant', content: result }]);
    } catch (err) {
      setMsgs(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    }
    setLoading(false);
  }

  return (
    <div className="bg-bg-1 border border-hero/20 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border-0 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-hero animate-pulse" />
        <span className="text-xs font-semibold text-hero">Ask ACE about this transaction</span>
      </div>

      {/* Messages */}
      <div className="max-h-60 overflow-y-auto p-3 space-y-2">
        {msgs.length === 0 && (
          <div className="space-y-2">
            <p className="text-xs text-fg-2">Quick questions:</p>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => send(s)} className="text-xs bg-bg-2 border border-border-0 hover:border-hero/40 text-fg-1 hover:text-hero px-2.5 py-1 rounded-lg transition-all cursor-pointer">{s}</button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={cn('text-xs rounded-lg px-3 py-2 max-w-[85%]', m.role === 'user' ? 'bg-hero/10 text-fg-0 ml-auto' : 'bg-bg-2 text-fg-1')}>
            {m.content}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-fg-2">
            <Loader2 size={12} className="animate-spin" /> Thinking...
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border-0 px-3 py-2 flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Ask about this transaction..."
          className="flex-1 bg-bg-2 border border-border-0 focus:border-hero/50 rounded-lg px-3 py-1.5 text-xs text-fg-0 placeholder-fg-3 outline-none transition-colors"
        />
        <button onClick={() => send()} disabled={loading || !input.trim()} className="bg-hero hover:bg-hero disabled:opacity-40 text-[#021418] rounded-lg px-3 py-1.5 transition-colors cursor-pointer" aria-label="Send message">
          <Send size={13} />
        </button>
      </div>
    </div>
  );
}

/* ═══ MAIN COMPONENT ═══ */

export default function MissingDeposit() {
  const { state } = useLocation();
  const handoff = state?.fromNBA ? state : null;

  const [depositType, setDepositType] = useState(null); // 'crypto' | 'sepa'

  /* ── Crypto state ── */
  const [selectedChain, setSelectedChain] = useState(null);
  const [txid, setTxid] = useState('');
  const [txLoading, setTxLoading] = useState(false);
  const [txData, setTxData] = useState(null);
  const [txError, setTxError] = useState('');

  /* ── SEPA state ── */
  const [sepaDate, setSepaDate] = useState('');
  const [sepaChecklist, setSepaChecklist] = useState({});
  const [sepaOrderStatus, setSepaOrderStatus] = useState(null);
  const [sepaHasOrder, setSepaHasOrder] = useState(null); // null | 'yes' | 'no'
  const [sepaReply, setSepaReply] = useState('');
  const [sepaLoading, setSepaLoading] = useState(false);
  const [sepaNotes, setSepaNotes] = useState('');

  const businessDays = useMemo(() => {
    if (!sepaDate) return null;
    return getBusinessDays(new Date(sepaDate), new Date());
  }, [sepaDate]);

  const sepaStatus = useMemo(() => {
    if (businessDays === null) return null;
    if (businessDays < 3) return 'processing';
    if (businessDays <= 5) return 'delayed';
    return 'overdue';
  }, [businessDays]);

  /* ── Actions ── */

  async function lookupTx() {
    if (!selectedChain || !txid.trim()) return;
    setTxLoading(true); setTxError(''); setTxData(null);
    try {
      const data = await fetchTx(selectedChain, txid.trim());
      setTxData(data);
    } catch (err) {
      setTxError(err.message || 'Failed to fetch transaction');
    }
    setTxLoading(false);
  }

  function resetAll() {
    setDepositType(null); setSelectedChain(null); setTxid(''); setTxLoading(false); setTxData(null); setTxError('');
    setSepaDate(''); setSepaChecklist({}); setSepaOrderStatus(null); setSepaHasOrder(null);
    setSepaReply(''); setSepaLoading(false); setSepaNotes('');
  }

  function toggleCheck(key) { setSepaChecklist(p => ({ ...p, [key]: !p[key] })); }

  async function generateSepaReply() {
    if (!hasAnyApiKey()) {
      setSepaReply('No API key configured — add one in Settings.');
      return;
    }
    setSepaLoading(true); setSepaReply('');
    try {
      const checkStatus = SEPA_CHECKLIST.map(c => `${sepaChecklist[c.key] ? '✓' : '✗'} ${c.label}`).join('\n');
      const orderInfo = sepaHasOrder === 'yes' && sepaOrderStatus ? `Order status: ${sepaOrderStatus}` : sepaHasOrder === 'no' ? 'No order found — funds deducted but no order created' : 'Order status unknown';
      const result = await InvokeLLM({
        prompt: `SEPA/Fiat deposit case:\n- Transfer date: ${sepaDate}\n- Business days elapsed: ${businessDays}\n- Status: ${sepaStatus}\n- ${orderInfo}\n\nChecklist:\n${checkStatus}\n\nAgent notes: ${sepaNotes || '(none)'}\n\nDraft a professional customer reply about this deposit issue.`,
        system_prompt: `You are ACE, writing customer-facing replies for Bybit fiat deposit inquiries.\nRULES:\n- Professional, empathetic, plain text only\n- Never promise specific timelines\n- Never reveal internal processes\n- Structure: Answer → Educate → Next step\n- Keep it 3-4 paragraphs max\n- Do NOT start with "Dear customer" — agent adds their own greeting`,
      });
      setSepaReply(result.trim().replace(/\*\*/g, '').replace(/\*/g, ''));
    } catch { setSepaReply('Failed to generate — try again.'); }
    setSepaLoading(false);
  }

  const selectedOrderInfo = sepaOrderStatus ? SEPA_ORDER_STATUSES.find(s => s.value === sepaOrderStatus) : null;
  const escalationKey = sepaOrderStatus === 'no_order' ? 'no_order' : sepaOrderStatus === 'PENDING' ? 'pending_no_record' : sepaOrderStatus === 'PAYING' ? 'paying_stuck' : sepaOrderStatus === 'REFUND_PROCESSING' ? 'refund_stuck' : sepaOrderStatus === 'FAILED' ? 'failed_deducted' : null;

  /* ═══ RENDER ═══ */

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Handoff banner */}
      {handoff && (
        <div className="bg-hero/10 border border-hero/30 rounded-xl px-4 py-3 space-y-1">
          <p className="text-xs font-semibold text-hero flex items-center gap-1.5">
            <span>⚡</span> Routed from Live Chat
            {handoff.vipLevel >= 3 && <span className="bg-hero/20 border border-hero/40 px-1.5 py-0.5 rounded text-hero font-bold ml-1">VIP {handoff.vipLevel}</span>}
          </p>
          {handoff.uid && <p className="text-xs text-fg-1">UID: <span className="text-fg-0 font-mono">{scrubPII(handoff.uid)}</span></p>}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {depositType && <button onClick={resetAll} className="text-fg-2 hover:text-hero transition-colors cursor-pointer" aria-label="Back"><ArrowLeft size={18} /></button>}
          <div>
            <h1 className="text-xl font-bold text-fg-0">💸 Missing Deposit</h1>
            <p className="text-sm text-fg-2">{!depositType ? 'Choose deposit type' : depositType === 'crypto' ? 'Blockchain transaction lookup & diagnostics' : 'SEPA / Fiat deposit troubleshooting'}</p>
          </div>
        </div>
        {depositType && <button onClick={resetAll} className="flex items-center gap-1 text-xs text-fg-2 hover:text-hero transition-colors cursor-pointer" aria-label="Restart"><RotateCcw size={13} /> Restart</button>}
      </div>

      {/* ━━━ TYPE SELECTOR ━━━ */}
      {!depositType && (
        <div className="grid grid-cols-2 gap-4">
          <button onClick={() => setDepositType('crypto')} className="rounded-xl p-5 text-left border bg-bg-1 border-border-0 hover:border-hero/40 transition-all group cursor-pointer">
            <p className="text-2xl mb-2">🔗</p>
            <p className="font-semibold text-sm text-fg-0 group-hover:text-hero transition-colors">Crypto Deposit</p>
            <p className="text-xs text-fg-2 mt-1">Blockchain lookup — enter TxID, ACE checks the chain for you</p>
          </button>
          <button onClick={() => setDepositType('sepa')} className="rounded-xl p-5 text-left border bg-bg-1 border-border-0 hover:border-hero/40 transition-all group cursor-pointer">
            <p className="text-2xl mb-2">🏦</p>
            <p className="font-semibold text-sm text-fg-0 group-hover:text-hero transition-colors">SEPA / Fiat Deposit</p>
            <p className="text-xs text-fg-2 mt-1">Bank transfer — order status, risk review, escalation templates</p>
          </button>
        </div>
      )}

      {/* ━━━ CRYPTO ━━━ */}
      {depositType === 'crypto' && (
        <>
          {/* Chain selector */}
          {!txData && (
            <div className="bg-bg-1 border border-border-0 rounded-xl p-5 space-y-4">
              <p className="font-medium text-fg-0 text-sm">Select chain</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(CHAINS).map(([key, c]) => (
                  <button key={key} onClick={() => { setSelectedChain(key); setTxData(null); setTxError(''); }}
                    className={cn('px-3 py-1.5 rounded-lg text-xs border transition-all cursor-pointer', selectedChain === key ? 'bg-hero/15 border-hero/40 text-hero font-semibold' : 'bg-bg-2 border-border-0 text-fg-1 hover:border-border-1')}>
                    {key}
                  </button>
                ))}
              </div>

              {/* Chain info */}
              {selectedChain && (
                <div className="bg-info/10 border border-info/30 rounded-lg px-3 py-2 text-xs">
                  <p className="font-medium text-info">{CHAINS[selectedChain].name}</p>
                  <p className="text-fg-1 mt-0.5">{CHAINS[selectedChain].note}</p>
                  <div className="flex gap-4 mt-1.5 text-fg-1">
                    <span>Min: <strong className="text-fg-0">{CHAINS[selectedChain].minDeposit}</strong></span>
                    <span>Confirmations: <strong className="text-fg-0">{CHAINS[selectedChain].confirmations}</strong></span>
                    <span>Memo: <strong className={CHAINS[selectedChain].memo ? 'text-crit' : 'text-ok'}>{CHAINS[selectedChain].memo ? 'REQUIRED' : 'No'}</strong></span>
                  </div>
                </div>
              )}

              {/* TxID input */}
              {selectedChain && (
                <div className="space-y-2">
                  <label htmlFor="txid-input" className="text-xs text-fg-2">Transaction ID (TxID / Hash)</label>
                  <div className="flex gap-2">
                    <input id="txid-input" value={txid} onChange={e => setTxid(e.target.value)} onKeyDown={e => e.key === 'Enter' && lookupTx()}
                      placeholder="Paste transaction hash here..."
                      className="flex-1 bg-bg-2 border border-border-0 focus:border-hero/50 rounded-lg px-3 py-2 text-sm text-fg-0 placeholder-fg-3 outline-none font-mono transition-colors" />
                    <button onClick={lookupTx} disabled={txLoading || !txid.trim()}
                      className="flex items-center gap-2 bg-hero hover:bg-hero disabled:opacity-40 text-[#021418] font-semibold text-xs px-4 py-2 rounded-lg transition-colors cursor-pointer" aria-label="Look up transaction">
                      {txLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                      {txLoading ? 'Looking up...' : 'Look Up'}
                    </button>
                  </div>
                  {/* Explorer link */}
                  {txid.trim() && (
                    <a href={CHAINS[selectedChain].explorer + txid.trim()} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-info hover:text-info transition-colors">
                      Open in {CHAINS[selectedChain].explorerName} <ExternalLink size={11} />
                    </a>
                  )}
                </div>
              )}

              {/* Error */}
              {txError && (
                <div className="bg-crit/10 border border-crit/30 rounded-lg px-3 py-2 text-xs text-crit space-y-1">
                  <p><AlertTriangle size={12} className="inline mr-1" />{txError}</p>
                  <p className="text-fg-2">Try opening the explorer link above to check manually. The API may be rate-limited or the TxID may be invalid.</p>
                </div>
              )}
            </div>
          )}

          {/* Tx Results */}
          {txData && (
            <>
              <div className="flex items-center gap-2">
                <button onClick={() => { setTxData(null); setTxError(''); }} className="text-xs text-fg-2 hover:text-hero transition-colors cursor-pointer flex items-center gap-1">
                  <ArrowLeft size={12} /> New lookup
                </button>
                <span className="text-xs text-fg-2">|</span>
                <span className="text-xs text-fg-2 font-mono">{txData.hash.slice(0, 12)}...{txData.hash.slice(-8)}</span>
              </div>
              <TxResultCard tx={txData} />
              {hasAnyApiKey() && <TxChat txData={txData} />}
              {!hasAnyApiKey() && (
                <div className="bg-bg-1 border border-border-0 rounded-xl px-4 py-3 text-xs text-fg-2">
                  Add an API key in Settings to ask ACE questions about this transaction.
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ━━━ SEPA / FIAT ━━━ */}
      {depositType === 'sepa' && (
        <>
          {/* Info card */}
          <div className="bg-info/10 border border-info/30 rounded-xl px-4 py-3 text-sm">
            <p className="font-medium text-info mb-1">SEPA / Fiat Deposit</p>
            <p className="text-fg-1 text-xs">Standard SEPA processing: 1–3 business days (Mon–Fri). Collect UID, currency, method, amount, order ID, screenshots, and payment proof.</p>
          </div>

          {/* Date selector */}
          <div className="bg-bg-1 border border-border-0 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Calendar size={15} className="text-hero" />
              <p className="font-medium text-fg-0 text-sm">When was the transfer sent?</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {DATE_QUICK.map(opt => (
                <button key={opt.offset} onClick={() => setSepaDate(offsetToDate(opt.offset))}
                  className={cn('px-3 py-1.5 rounded-lg text-xs border transition-all cursor-pointer', sepaDate === offsetToDate(opt.offset) ? 'bg-hero/15 border-hero/40 text-hero' : 'bg-bg-2 border-border-0 text-fg-1 hover:border-border-1')}>
                  {opt.label}
                </button>
              ))}
            </div>
            <div>
              <label htmlFor="sepa-date" className="text-xs text-fg-2 mb-1 block">Or pick exact date:</label>
              <input id="sepa-date" type="date" value={sepaDate} max={new Date().toISOString().slice(0, 10)} onChange={e => setSepaDate(e.target.value)}
                className="bg-bg-2 border border-border-0 focus:border-hero/50 rounded-lg px-3 py-2 text-sm text-fg-0 outline-none transition-colors" />
            </div>
          </div>

          {/* Status banner */}
          {sepaDate && (
            <div className={cn('rounded-xl px-4 py-3 border', sepaStatus === 'processing' ? 'bg-ok/10 border-ok/30' : sepaStatus === 'delayed' ? 'bg-hero-soft/10 border-hero/30' : 'bg-crit/10 border-crit/30')}>
              <div className="flex items-center gap-2">
                {sepaStatus === 'processing' ? <CheckCircle2 size={15} className="text-ok" /> : sepaStatus === 'delayed' ? <Clock size={15} className="text-hero" /> : <AlertTriangle size={15} className="text-crit" />}
                <p className={cn('font-semibold text-sm', sepaStatus === 'processing' ? 'text-ok' : sepaStatus === 'delayed' ? 'text-hero' : 'text-crit')}>
                  {businessDays} business day{businessDays !== 1 ? 's' : ''} — {sepaStatus === 'processing' ? 'within normal processing time' : sepaStatus === 'delayed' ? 'exceeds standard window' : 'significantly overdue'}
                </p>
              </div>
              <p className="text-xs text-fg-1 mt-1">
                {sepaStatus === 'processing' ? 'SEPA takes 1–3 business days. Educate the customer.' : 'Check if there is an order in CS:GO and run through the checklist below.'}
              </p>
            </div>
          )}

          {/* Order check */}
          {sepaDate && (
            <div className="bg-bg-1 border border-border-0 rounded-xl p-5 space-y-4">
              <p className="font-medium text-fg-0 text-sm">Does the customer have an Order ID in CS:GO?</p>
              <p className="text-xs text-fg-2">Check: CS:GO &gt; User Profile &gt; Funding &gt; Fiat Deposit</p>
              <div className="flex gap-2">
                <button onClick={() => { setSepaHasOrder('yes'); setSepaOrderStatus(null); }}
                  className={cn('px-4 py-2 rounded-lg text-xs border transition-all cursor-pointer', sepaHasOrder === 'yes' ? 'bg-hero/15 border-hero/40 text-hero' : 'bg-bg-2 border-border-0 text-fg-1 hover:border-border-1')}>
                  Yes — order found
                </button>
                <button onClick={() => { setSepaHasOrder('no'); setSepaOrderStatus('no_order'); }}
                  className={cn('px-4 py-2 rounded-lg text-xs border transition-all cursor-pointer', sepaHasOrder === 'no' ? 'bg-crit/15 border-crit/40 text-crit' : 'bg-bg-2 border-border-0 text-fg-1 hover:border-border-1')}>
                  No — no record
                </button>
              </div>

              {/* Order status selector */}
              {sepaHasOrder === 'yes' && (
                <div className="space-y-2">
                  <p className="text-xs text-fg-2">Select order status:</p>
                  <div className="flex flex-wrap gap-2">
                    {SEPA_ORDER_STATUSES.filter(s => s.value !== 'no_order').map(s => (
                      <button key={s.value} onClick={() => setSepaOrderStatus(s.value)}
                        className={cn('px-3 py-1.5 rounded-lg text-xs border transition-all cursor-pointer',
                          sepaOrderStatus === s.value ? `bg-${s.color}-400/15 border-${s.color}-400/40 text-${s.color}-400 font-semibold` : 'bg-bg-2 border-border-0 text-fg-1 hover:border-border-1',
                          sepaOrderStatus === s.value && s.color === 'yellow' && 'bg-hero/15 border-hero/40 text-hero',
                          sepaOrderStatus === s.value && s.color === 'red' && 'bg-crit/15 border-crit/40 text-crit',
                          sepaOrderStatus === s.value && s.color === 'green' && 'bg-ok/15 border-ok/40 text-ok',
                          sepaOrderStatus === s.value && s.color === 'blue' && 'bg-info/15 border-info/40 text-info',
                        )}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Order status action card */}
          {selectedOrderInfo && (
            <div className={cn('rounded-xl border px-4 py-4 space-y-2',
              selectedOrderInfo.color === 'red' ? 'bg-crit/8 border-crit/25' :
              selectedOrderInfo.color === 'yellow' ? 'bg-hero/8 border-hero/25' :
              selectedOrderInfo.color === 'green' ? 'bg-ok/8 border-ok/25' :
              selectedOrderInfo.color === 'blue' ? 'bg-info/8 border-info/25' :
              'bg-bg-2 border-border-0'
            )}>
              <p className="text-sm font-semibold text-fg-0">{selectedOrderInfo.label}</p>
              <p className="text-xs text-fg-1 leading-relaxed">{selectedOrderInfo.action}</p>
            </div>
          )}

          {/* Escalation template */}
          {escalationKey && SEPA_ESCALATION_TEMPLATES[escalationKey] && (
            <Section title="Escalation Template (P2)" open={true}>
              <div className="px-4 pb-4">
                <div className="flex justify-end mb-2">
                  <CopyBtn text={SEPA_ESCALATION_TEMPLATES[escalationKey]} label="Copy template" />
                </div>
                <pre className="text-xs text-fg-1 font-mono whitespace-pre-wrap leading-relaxed bg-bg-2/50 rounded-lg p-3">{SEPA_ESCALATION_TEMPLATES[escalationKey]}</pre>
              </div>
            </Section>
          )}

          {/* Checklist */}
          {sepaDate && sepaStatus !== 'processing' && (
            <Section title="Pre-escalation Checklist">
              <div className="px-4 pb-4 space-y-1.5">
                {SEPA_CHECKLIST.map(item => (
                  <button key={item.key} onClick={() => toggleCheck(item.key)}
                    className={cn('w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all cursor-pointer',
                      sepaChecklist[item.key] ? 'bg-ok/8 border-ok/25' : 'bg-bg-2 border-border-0 hover:border-border-1')}>
                    <div className={cn('w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all',
                      sepaChecklist[item.key] ? 'bg-ok border-ok' : 'border-border-1')}>
                      {sepaChecklist[item.key] && <Check size={10} className="text-[#021418]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm', sepaChecklist[item.key] ? 'text-ok' : 'text-fg-0')}>{item.label}</p>
                      <p className="text-xs text-fg-2 mt-0.5">{item.tip}</p>
                    </div>
                  </button>
                ))}
              </div>
            </Section>
          )}

          {/* Notes + AI generation */}
          {sepaDate && (
            <div className="bg-bg-1 border border-border-0 rounded-xl p-5 space-y-3">
              <label htmlFor="sepa-notes" className="text-sm font-medium text-fg-0">Agent notes</label>
              <textarea id="sepa-notes" value={sepaNotes} onChange={e => { setSepaNotes(e.target.value); setSepaReply(''); }}
                placeholder="Extra context — customer says bank confirmed 4 days ago, reference XYZ123..."
                rows={3} className="w-full bg-bg-2 border border-border-0 focus:border-hero/50 rounded-lg px-4 py-3 text-sm text-fg-0 placeholder-fg-3 outline-none resize-y transition-colors" />
              {hasAnyApiKey() && (
                <button onClick={generateSepaReply} disabled={sepaLoading}
                  className="flex items-center gap-2 bg-hero hover:bg-hero disabled:opacity-50 text-[#021418] font-semibold text-xs px-4 py-2 rounded-lg transition-colors cursor-pointer" aria-label="Generate reply with ACE">
                  {sepaLoading ? <><Loader2 size={13} className="animate-spin" /> Generating...</> : <><Sparkles size={13} /> Generate reply with ACE</>}
                </button>
              )}
            </div>
          )}

          {/* Generated reply */}
          {sepaReply && (
            <div className="bg-bg-1 border border-hero/20 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-border-0">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-hero animate-pulse" />
                  <h2 className="text-sm font-semibold text-hero">Draft reply</h2>
                </div>
                <CopyBtn text={sepaReply} label="Copy reply" />
              </div>
              <pre className="text-xs text-fg-1 whitespace-pre-wrap leading-relaxed font-mono p-5 max-h-96 overflow-y-auto">{sepaReply}</pre>
            </div>
          )}

          {/* Quicktext reference */}
          <Section title="Quick Reference — Templates" open={false}>
            <div className="px-4 pb-4 space-y-3">
              {[
                { label: 'QT: fd01 — Fiat Deposit Guide', ref: 'fd01-en-fiat-guide' },
                { label: 'QT: fd02 — Risk Control Status', ref: 'fd02-en-risk-control-status' },
                { label: 'QT: fd03 — Order Status Reply', ref: 'fd03-en-order-status' },
                { label: 'QT: fd05 — Info Collection (No Order)', ref: 'fd05-en-clarification-on-fiat-deposit' },
                { label: 'QT: fd06 — Fiat Removal Guide', ref: 'fd06-en-fiat-removal-guide' },
                { label: 'QT: fs01 — Native Fiat (RU/BY/NG)', ref: 'fs01-en-native-fiat' },
                { label: 'QT: fs02 — Restricted Countries', ref: 'fs02-en-restricted-countries' },
                { label: 'ET: 4800 — Fiat Deposit General', ref: 'ET 4800' },
                { label: 'ET: 4855 — Fiat High-Risk Triggered', ref: 'ET 4855' },
                { label: 'ET: 4880 — Order Status Email', ref: 'ET 4880' },
              ].map(t => (
                <div key={t.ref} className="flex items-center justify-between text-xs">
                  <span className="text-fg-1">{t.label}</span>
                  <span className="text-fg-2 font-mono">{t.ref}</span>
                </div>
              ))}
            </div>
          </Section>
        </>
      )}
    </div>
  );
}
