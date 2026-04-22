import { useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronRight, RotateCcw, Copy, Check, Sparkles, Loader2, ArrowLeft, Clock, AlertTriangle, CheckCircle2, Calendar } from 'lucide-react';
import { scrubPII } from '@/lib/SecurityModule';
import { InvokeLLM, hasAnyApiKey } from '@/api/claude';
import { cn } from '@/lib/utils';

/* ─── Crypto data (unchanged) ─── */

const CHAINS = {
  BTC: { name: 'Bitcoin', confirmations: 1, minDeposit: '0.0001 BTC', memo: false, note: 'BTC network only. Ensure address starts with 1, 3 or bc1.' },
  ETH: { name: 'Ethereum (ERC-20)', confirmations: 6, minDeposit: '0.01 ETH', memo: false, note: 'Supports ETH and all ERC-20 tokens. Verify the token contract.' },
  TRX: { name: 'TRON (TRC-20)', confirmations: 20, minDeposit: '1 USDT', memo: false, note: 'Most common for USDT. Very fast network.' },
  BNB: { name: 'BNB Smart Chain (BEP-20)', confirmations: 15, minDeposit: '0.01 BNB', memo: false, note: 'BEP-20 tokens only — not BEP-2.' },
  XRP: { name: 'Ripple (XRP)', confirmations: 6, minDeposit: '10 XRP', memo: true, note: '⚠️ MEMO/Tag is mandatory. Missing memo = funds lost.' },
  XLM: { name: 'Stellar (XLM)', confirmations: 1, minDeposit: '1 XLM', memo: true, note: '⚠️ MEMO is mandatory for Stellar deposits.' },
  SOL: { name: 'Solana', confirmations: 1, minDeposit: '0.01 SOL', memo: false, note: 'Fast finality. Verify SPL token address.' },
  MATIC: { name: 'Polygon (MATIC)', confirmations: 200, minDeposit: '1 MATIC', memo: false, note: 'High confirmation count is normal for Polygon.' },
  AVAX: { name: 'Avalanche C-Chain', confirmations: 20, minDeposit: '0.1 AVAX', memo: false, note: 'C-Chain only. Not X-Chain or P-Chain.' },
  OP: { name: 'Optimism', confirmations: 15, minDeposit: '0.01 ETH', memo: false, note: 'Layer 2 — funds may take up to 7 days for bridge withdrawals.' },
  ARB: { name: 'Arbitrum One', confirmations: 15, minDeposit: '0.01 ETH', memo: false, note: 'Layer 2 on Ethereum. Fast but may have bridge delays.' },
};

const RESOLUTIONS = {
  not_confirmed: `The transaction hasn't reached the required number of confirmations yet. This is normal for network congestion. Ask the customer to wait and check again using a block explorer (etherscan.io, tronscan.org, etc.) for live confirmation count.`,
  wrong_network: `The funds were sent on the wrong network. Unfortunately Bybit cannot retrieve funds sent to the wrong network address. Advise the customer that this is an irreversible situation and the funds may be unrecoverable. Escalate to technical team with TxID and network details for a best-effort recovery attempt (fee applies).`,
  below_minimum: `The deposit is below the minimum deposit amount. Bybit will hold these funds. Customer needs to top up to meet the minimum or wait for a manual review. Raise a ticket: [INPUT UID], coin, amount, TxID.`,
  missing_memo: `Missing memo/tag deposits are the most common issue on XRP/XLM. Raise a manual recovery ticket immediately with: [INPUT UID], TxID, amount, coin. Recovery fee applies. Timeline: 3–7 business days.`,
  pending_credit: `Transaction confirmed but credit pending. This can happen during high network volume. Wait 30 minutes — if still not credited, raise an escalation ticket with TxID.`,
  not_started: `Transaction not yet broadcast to the blockchain. The sending exchange/wallet may still be processing. Ask customer to check the withdrawal status on the sending side.`,
  wrong_address: `The deposit address used does not match the customer's Bybit deposit address. Unfortunately, funds sent to the wrong address cannot be recovered by Bybit. Advise the customer to check the sending transaction on the block explorer and confirm the destination address matches exactly.`,
};

/* ─── SEPA data ─── */

const SEPA_CHECKLIST = [
  { key: 'ref', label: 'Reference number included & correct', tip: 'The unique reference from Bybit deposit page must be in the transfer description for auto-crediting' },
  { key: 'iban', label: 'Correct Bybit IBAN used', tip: 'Verify the IBAN matches the one displayed on the customer\'s Bybit deposit page' },
  { key: 'name', label: 'Sender name matches KYC name', tip: 'The name on the sending bank account must match the verified name on the Bybit account' },
  { key: 'bank_sent', label: 'Customer confirmed bank processed transfer', tip: 'Ask the customer to check with their bank that the transfer was actually sent and not held' },
  { key: 'amount', label: 'Amount within deposit limits', tip: 'SEPA deposits: min €10, verify no bank-side daily limit was hit' },
];

const DATE_QUICK = [
  { label: 'Today', offset: 0 },
  { label: 'Yesterday', offset: 1 },
  { label: '2 days ago', offset: 2 },
  { label: '3 days ago', offset: 3 },
  { label: '5 days ago', offset: 5 },
  { label: '1 week+', offset: 7 },
];

function getBusinessDays(from, to) {
  let count = 0;
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  if (d >= end) return 0;
  const cursor = new Date(d);
  cursor.setDate(cursor.getDate() + 1); // don't count the send day itself
  while (cursor <= end) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

function offsetToDate(offset) {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return d.toISOString().slice(0, 10);
}

function buildSepaProcessingReply(bizDays) {
  return `Thank you for reaching out regarding your SEPA deposit.

SEPA bank transfers typically take 1–3 business days to be processed and credited to your Bybit account. Since your transfer was initiated ${bizDays === 0 ? 'today' : bizDays === 1 ? '1 business day ago' : `${bizDays} business days ago`}, it is still within the standard processing window.

Please note:
• SEPA transfers are only processed on business days (Monday–Friday).
• Transfers initiated on weekends or bank holidays begin processing on the next business day.
• Ensure the unique reference number from your Bybit deposit page was included in the transfer — this allows automatic crediting.

If the deposit has not appeared after 3 full business days, please reach out again with:
• The exact transfer date and amount
• The reference number used
• Your sending bank name

We appreciate your patience and are here to help if you need further assistance.`;
}

function buildSepaDelayedReply(bizDays, checklist) {
  const issues = [];
  if (!checklist.ref) issues.push('reference number was not confirmed');
  if (!checklist.iban) issues.push('IBAN was not verified');
  if (!checklist.name) issues.push('sender name match was not confirmed');
  if (!checklist.bank_sent) issues.push('bank confirmation of the transfer is pending');

  return `Thank you for contacting us regarding your SEPA deposit that was initiated ${bizDays} business days ago.

We understand this is taking longer than expected and we want to help resolve this as quickly as possible.

${issues.length > 0 ? `To proceed with our investigation, we still need to verify the following:\n${issues.map(i => `• ${i[0].toUpperCase() + i.slice(1)}`).join('\n')}\n\n` : ''}To help us investigate, please provide or confirm the following:
• Exact transfer date and amount (in EUR)
• The unique reference number used in the transfer
• Your sending bank name and country
• A bank statement or transfer confirmation showing the completed transaction

Our team will prioritise this and work to locate your deposit. We will keep you updated on the progress.

We apologise for the inconvenience and appreciate your patience.`;
}

/* ─── Component ─── */

export default function MissingDeposit() {
  const { state } = useLocation();
  const handoff = state?.fromNBA ? state : null;

  // Top-level
  const [depositType, setDepositType] = useState(null); // 'crypto' | 'sepa'

  // Crypto wizard state
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [resolution, setResolution] = useState(null);
  const [copied, setCopied] = useState(false);

  // SEPA state
  const [sepaDate, setSepaDate] = useState('');
  const [sepaChecklist, setSepaChecklist] = useState({});
  const [sepaReply, setSepaReply] = useState('');
  const [sepaLoading, setSepaLoading] = useState(false);
  const [sepaCopied, setSepaCopied] = useState(false);
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

  /* Crypto helpers */
  function answer(key, val, next) {
    const newAnswers = { ...answers, [key]: val };
    setAnswers(newAnswers);
    if (next === 'resolve') resolve(newAnswers);
    else setStep(next);
  }

  function resolve(a) {
    if (a.txid === 'no') { setResolution('not_started'); return; }
    if (a.network === 'wrong') { setResolution('wrong_network'); return; }
    if (a.memo === 'no') { setResolution('missing_memo'); return; }
    if (a.address === 'no') { setResolution('wrong_address'); return; }
    if (a.minimum === 'no') { setResolution('below_minimum'); return; }
    if (a.confirmations === 'no') { setResolution('not_confirmed'); return; }
    setResolution('pending_credit');
  }

  /* SEPA helpers */
  function toggleCheck(key) {
    setSepaChecklist(p => ({ ...p, [key]: !p[key] }));
    setSepaReply('');
    setSepaCopied(false);
  }

  function generateSepaReply() {
    if (sepaStatus === 'processing') {
      setSepaReply(buildSepaProcessingReply(businessDays));
    } else {
      setSepaReply(buildSepaDelayedReply(businessDays, sepaChecklist));
    }
  }

  async function generateSepaWithAce() {
    if (!hasAnyApiKey()) {
      setSepaReply('No API key configured — add one in Settings. Using template instead.\n\n' + buildSepaDelayedReply(businessDays, sepaChecklist));
      return;
    }
    setSepaLoading(true);
    setSepaReply('');
    try {
      const checklistStatus = SEPA_CHECKLIST.map(c => `${sepaChecklist[c.key] ? '✓' : '✗'} ${c.label}`).join('\n');
      const result = await InvokeLLM({
        prompt: `SEPA deposit case:\n- Transfer date: ${sepaDate}\n- Business days elapsed: ${businessDays}\n- Status: ${sepaStatus}\n\nTroubleshooting checklist:\n${checklistStatus}\n\nAgent notes: ${sepaNotes || '(none)'}\n\nDraft a professional customer reply about this SEPA deposit. If within processing time, educate them about SEPA timelines. If delayed, ask for the specific missing information and reassure them.`,
        system_prompt: `You are ACE, writing customer-facing replies for Bybit EU SEPA deposit inquiries.

RULES:
- Professional, empathetic tone
- Plain text only — no markdown, no asterisks, no bold
- Never promise a specific timeline for resolution
- Never reveal internal processes
- If within processing time (< 3 business days): educate about SEPA processing times, reassure
- If delayed (3+ business days): ask for missing verification info, explain next steps
- Always mention: exact transfer date, amount, reference number, sending bank name as info needed
- Keep it concise — 3-4 paragraphs max
- Do NOT start with "Dear customer" or "Hello" — the agent will add their own greeting`,
      });
      setSepaReply(result.trim().replace(/\*\*/g, '').replace(/\*/g, '').replace(/^#+\s*/gm, ''));
    } catch {
      setSepaReply(buildSepaDelayedReply(businessDays, sepaChecklist));
    }
    setSepaLoading(false);
  }

  /* Global reset */
  function resetAll() {
    setDepositType(null);
    setStep(0); setAnswers({}); setResolution(null); setCopied(false);
    setSepaDate(''); setSepaChecklist({}); setSepaReply('');
    setSepaLoading(false); setSepaCopied(false); setSepaNotes('');
  }

  /* Crypto wizard data */
  const WIZARD = [
    {
      q: 'Does the customer have a transaction ID (TxID / hash)?',
      key: 'txid',
      opts: [
        { label: 'Yes, they have a TxID', val: 'yes', next: 1 },
        { label: 'No TxID available', val: 'no', next: 'resolve' },
      ],
    },
    {
      q: 'Which network / blockchain was used?',
      key: 'network',
      opts: [
        ...Object.entries(CHAINS).map(([k]) => ({ label: k, val: k, next: 2 })),
        { label: '⚠️ Wrong network used', val: 'wrong', next: 'resolve' },
      ],
    },
    {
      q: answers.network && CHAINS[answers.network]?.memo
        ? 'Was the MEMO/Tag included in the transaction?'
        : 'Does the deposit address match the Bybit deposit address exactly?',
      key: answers.network && CHAINS[answers.network]?.memo ? 'memo' : 'address',
      opts: answers.network && CHAINS[answers.network]?.memo
        ? [
            { label: 'Yes, memo was included', val: 'yes', next: 3 },
            { label: 'No, memo was missing', val: 'no', next: 'resolve' },
          ]
        : [
            { label: 'Yes, address matches', val: 'yes', next: 3 },
            { label: 'No or unsure', val: 'no', next: 'resolve' },
          ],
    },
    {
      q: `Was the amount above the minimum deposit? (${answers.network ? CHAINS[answers.network]?.minDeposit || '—' : '—'})`,
      key: 'minimum',
      opts: [
        { label: 'Yes, above minimum', val: 'yes', next: 4 },
        { label: 'No, below minimum', val: 'no', next: 'resolve' },
      ],
    },
    {
      q: `Has the transaction reached ${answers.network ? CHAINS[answers.network]?.confirmations || '—' : '—'} confirmations?`,
      key: 'confirmations',
      opts: [
        { label: 'Yes, fully confirmed', val: 'yes', next: 'resolve' },
        { label: 'No / still confirming', val: 'no', next: 'resolve' },
      ],
    },
  ];

  const current = WIZARD[step];
  const chainInfo = answers.network ? CHAINS[answers.network] : null;

  /* ─── RENDER ─── */

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* NBA contextual handoff banner */}
      {handoff && (
        <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-xl px-4 py-3 space-y-1">
          <p className="text-xs font-semibold text-yellow-400 flex items-center gap-1.5">
            <span>⚡</span> Routed from Live Chat
            {handoff.vipLevel >= 3 && (
              <span className="bg-yellow-400/20 border border-yellow-400/40 px-1.5 py-0.5 rounded text-yellow-300 font-bold ml-1">
                VIP {handoff.vipLevel}
              </span>
            )}
          </p>
          {handoff.uid && <p className="text-xs text-slate-400">UID: <span className="text-slate-200 font-mono">{scrubPII(handoff.uid)}</span></p>}
          {handoff.coin && <p className="text-xs text-slate-400">Coin: <span className="text-slate-200">{handoff.coin}</span></p>}
          {handoff.issue && <p className="text-xs text-slate-500 mt-0.5">{handoff.issue}</p>}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {depositType && (
            <button onClick={() => { resetAll(); }} className="text-slate-500 hover:text-yellow-400 transition-colors" aria-label="Back to deposit type selection">
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold text-slate-100">💸 Missing Deposit</h1>
            <p className="text-sm text-slate-500">
              {!depositType ? 'Choose deposit type to start troubleshooting' : depositType === 'crypto' ? 'Crypto deposit troubleshooting wizard' : 'SEPA bank transfer troubleshooting'}
            </p>
          </div>
        </div>
        {depositType && (
          <button onClick={resetAll} className="flex items-center gap-1 text-xs text-slate-500 hover:text-yellow-400 transition-colors cursor-pointer" aria-label="Restart wizard">
            <RotateCcw size={13} /> Restart
          </button>
        )}
      </div>

      {/* ━━━ DEPOSIT TYPE SELECTOR ━━━ */}
      {!depositType && (
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setDepositType('crypto')}
            className="rounded-xl p-5 text-left border bg-slate-900 border-slate-800 hover:border-yellow-400/40 transition-all group cursor-pointer"
          >
            <p className="text-2xl mb-2">🔗</p>
            <p className="font-semibold text-sm text-slate-100 group-hover:text-yellow-400 transition-colors">Crypto Deposit</p>
            <p className="text-xs text-slate-500 mt-1">On-chain transaction troubleshooting — TxID, network, confirmations</p>
          </button>
          <button
            onClick={() => setDepositType('sepa')}
            className="rounded-xl p-5 text-left border bg-slate-900 border-slate-800 hover:border-yellow-400/40 transition-all group cursor-pointer"
          >
            <p className="text-2xl mb-2">🏦</p>
            <p className="font-semibold text-sm text-slate-100 group-hover:text-yellow-400 transition-colors">SEPA Bank Transfer</p>
            <p className="text-xs text-slate-500 mt-1">EUR bank transfer — processing time, reference, IBAN checks</p>
          </button>
        </div>
      )}

      {/* ━━━ CRYPTO WIZARD (existing) ━━━ */}
      {depositType === 'crypto' && (
        <>
          {/* Chain info card */}
          {chainInfo && !resolution && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl px-4 py-3 text-sm">
              <p className="font-medium text-blue-300 mb-1">{chainInfo.name}</p>
              <p className="text-slate-400 text-xs">{chainInfo.note}</p>
              <div className="flex gap-4 mt-2 text-xs text-slate-400">
                <span>Min: <strong className="text-slate-200">{chainInfo.minDeposit}</strong></span>
                <span>Confirmations: <strong className="text-slate-200">{chainInfo.confirmations}</strong></span>
                <span>Memo required: <strong className={chainInfo.memo ? 'text-red-400' : 'text-green-400'}>{chainInfo.memo ? 'YES' : 'No'}</strong></span>
              </div>
            </div>
          )}

          {/* Progress */}
          {!resolution && (
            <div className="flex gap-1">
              {WIZARD.map((_, i) => (
                <div key={i} className={cn('h-1 flex-1 rounded-full', i <= step ? 'bg-yellow-400' : 'bg-slate-800')} />
              ))}
            </div>
          )}

          {/* Wizard question */}
          {!resolution && current && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <p className="font-medium text-slate-100">{current.q}</p>
              <div className="space-y-2">
                {current.opts.map(opt => (
                  <button
                    key={opt.val}
                    onClick={() => answer(current.key, opt.val, opt.next)}
                    className="w-full flex items-center justify-between text-left bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-yellow-400/40 rounded-lg px-4 py-3 text-sm text-slate-200 transition-all group cursor-pointer"
                  >
                    <span>{opt.label}</span>
                    <ChevronRight size={15} className="text-slate-600 group-hover:text-yellow-400 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Resolution */}
          {resolution && (
            <div className="bg-slate-900 border border-yellow-400/30 rounded-xl p-5 space-y-4">
              <h2 className="font-semibold text-yellow-400">Diagnosis & Action</h2>
              <p className="text-sm text-slate-300 leading-relaxed">{RESOLUTIONS[resolution]}</p>
              <button
                onClick={() => { navigator.clipboard.writeText(RESOLUTIONS[resolution]); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                className="flex items-center gap-2 text-xs text-slate-500 hover:text-yellow-400 transition-colors cursor-pointer"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? 'Copied' : 'Copy to clipboard'}
              </button>
              <button onClick={resetAll} className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors cursor-pointer">
                <RotateCcw size={13} /> Start new case
              </button>
            </div>
          )}
        </>
      )}

      {/* ━━━ SEPA WORKFLOW ━━━ */}
      {depositType === 'sepa' && (
        <>
          {/* SEPA info card */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl px-4 py-3 text-sm">
            <p className="font-medium text-blue-300 mb-1">SEPA Credit Transfer — EUR</p>
            <p className="text-slate-400 text-xs">SEPA transfers are processed on business days only (Mon–Fri). Standard processing is 1–3 business days.</p>
            <div className="flex gap-4 mt-2 text-xs text-slate-400">
              <span>Processing: <strong className="text-slate-200">1–3 business days</strong></span>
              <span>Min: <strong className="text-slate-200">€10</strong></span>
              <span>Hours: <strong className="text-slate-200">Banking days only</strong></span>
            </div>
          </div>

          {/* Date selector */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Calendar size={15} className="text-yellow-400" />
              <p className="font-medium text-slate-100">When was the SEPA transfer sent?</p>
            </div>

            {/* Quick date buttons */}
            <div className="flex flex-wrap gap-2">
              {DATE_QUICK.map(opt => (
                <button
                  key={opt.offset}
                  onClick={() => setSepaDate(offsetToDate(opt.offset))}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs border transition-all cursor-pointer',
                    sepaDate === offsetToDate(opt.offset)
                      ? 'bg-yellow-400/15 border-yellow-400/40 text-yellow-400'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Date input */}
            <div>
              <label htmlFor="sepa-date" className="text-xs text-slate-500 mb-1 block">Or pick exact date:</label>
              <input
                id="sepa-date"
                type="date"
                value={sepaDate}
                max={new Date().toISOString().slice(0, 10)}
                onChange={e => setSepaDate(e.target.value)}
                className="bg-slate-800 border border-slate-700 focus:border-yellow-400/50 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none transition-colors"
              />
            </div>
          </div>

          {/* ─── Status result after date ─── */}
          {sepaDate && sepaStatus === 'processing' && (
            <>
              {/* Within processing time */}
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-4 space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-green-400" />
                  <p className="font-semibold text-green-400 text-sm">Within normal processing time</p>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {businessDays === 0
                    ? 'Transfer was sent today — SEPA takes 1–3 business days. This is completely normal.'
                    : businessDays === 1
                    ? '1 business day elapsed. SEPA transfers typically take 1–3 business days. Still within the standard window.'
                    : `${businessDays} business days elapsed. Transfer may arrive today or tomorrow. Still within the 1–3 day processing window.`
                  }
                </p>
                <p className="text-xs text-slate-500 mt-1">Educate the customer about SEPA processing times and that weekends/holidays don't count as business days.</p>
              </div>

              {/* Draft reply */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                <p className="text-sm font-medium text-slate-200">Quick reply — SEPA processing time</p>
                <p className="text-xs text-slate-500">Pre-built reply explaining SEPA processing times. Ready to copy.</p>
                <div className="flex gap-2">
                  <button
                    onClick={generateSepaReply}
                    className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-semibold text-xs px-4 py-2 rounded-lg transition-colors cursor-pointer"
                    aria-label="Generate template reply"
                  >
                    <Sparkles size={13} /> Draft reply
                  </button>
                  {hasAnyApiKey() && (
                    <button
                      onClick={generateSepaWithAce}
                      disabled={sepaLoading}
                      className="flex items-center gap-2 bg-slate-800 border border-yellow-400/30 hover:border-yellow-400/50 text-yellow-400 text-xs px-4 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      aria-label="Generate reply with ACE AI"
                    >
                      {sepaLoading ? <><Loader2 size={13} className="animate-spin" /> Generating...</> : <><Sparkles size={13} /> Generate with ACE</>}
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          {sepaDate && (sepaStatus === 'delayed' || sepaStatus === 'overdue') && (
            <>
              {/* Warning banner */}
              <div className={cn(
                'rounded-xl px-4 py-4 space-y-2 border',
                sepaStatus === 'delayed'
                  ? 'bg-yellow-500/10 border-yellow-500/30'
                  : 'bg-red-500/10 border-red-500/30'
              )}>
                <div className="flex items-center gap-2">
                  {sepaStatus === 'delayed'
                    ? <Clock size={16} className="text-yellow-400" />
                    : <AlertTriangle size={16} className="text-red-400" />
                  }
                  <p className={cn('font-semibold text-sm', sepaStatus === 'delayed' ? 'text-yellow-400' : 'text-red-400')}>
                    {sepaStatus === 'delayed'
                      ? `${businessDays} business days — exceeds standard processing time`
                      : `${businessDays} business days — significantly overdue`
                    }
                  </p>
                </div>
                <p className="text-xs text-slate-400">
                  {sepaStatus === 'delayed'
                    ? 'Standard SEPA is 1–3 business days. Run through the checklist below before responding or escalating.'
                    : 'This deposit is well past the normal window. Complete the checklist and prepare an escalation or detailed reply.'
                  }
                </p>
              </div>

              {/* Troubleshooting checklist */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                <p className="text-sm font-medium text-slate-200">Pre-escalation checklist</p>
                <div className="space-y-2">
                  {SEPA_CHECKLIST.map(item => (
                    <button
                      key={item.key}
                      onClick={() => toggleCheck(item.key)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all cursor-pointer',
                        sepaChecklist[item.key]
                          ? 'bg-green-400/8 border-green-400/25'
                          : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                      )}
                    >
                      <div className={cn(
                        'w-5 h-5 rounded flex items-center justify-center shrink-0 border-2 transition-all',
                        sepaChecklist[item.key] ? 'bg-green-400 border-green-400' : 'border-slate-600'
                      )}>
                        {sepaChecklist[item.key] && <Check size={12} className="text-slate-900" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm', sepaChecklist[item.key] ? 'text-green-400' : 'text-slate-200')}>{item.label}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{item.tip}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Agent notes + generate */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <label htmlFor="sepa-notes" className="text-sm font-medium text-slate-200">Your notes (optional)</label>
                  <span className="text-xs text-slate-600">{sepaNotes.length > 0 ? `${sepaNotes.length} chars` : 'Add context'}</span>
                </div>
                <textarea
                  id="sepa-notes"
                  value={sepaNotes}
                  onChange={e => { setSepaNotes(e.target.value); setSepaReply(''); setSepaCopied(false); }}
                  placeholder="Any extra context — e.g. customer says bank confirmed it was sent 4 days ago, reference XYZ123..."
                  rows={3}
                  className="w-full bg-slate-800 border border-slate-700 focus:border-yellow-400/50 rounded-lg px-4 py-3 text-sm text-slate-100 placeholder-slate-600 outline-none resize-y transition-colors"
                />
                <div className="flex gap-2">
                  <button
                    onClick={generateSepaReply}
                    className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-semibold text-xs px-4 py-2 rounded-lg transition-colors cursor-pointer"
                    aria-label="Draft template reply"
                  >
                    <Sparkles size={13} /> Draft reply
                  </button>
                  {hasAnyApiKey() && (
                    <button
                      onClick={generateSepaWithAce}
                      disabled={sepaLoading}
                      className="flex items-center gap-2 bg-slate-800 border border-yellow-400/30 hover:border-yellow-400/50 text-yellow-400 text-xs px-4 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      aria-label="Generate reply with ACE AI"
                    >
                      {sepaLoading ? <><Loader2 size={13} className="animate-spin" /> Generating...</> : <><Sparkles size={13} /> Generate with ACE</>}
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ─── SEPA Reply preview ─── */}
          {sepaReply && (
            <div className="bg-slate-900 border border-yellow-400/20 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                  <h2 className="text-sm font-semibold text-yellow-400">Draft reply</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={generateSepaReply}
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-yellow-400 transition-colors cursor-pointer"
                    aria-label="Regenerate reply"
                  >
                    <RotateCcw size={11} /> Redo
                  </button>
                  <button
                    onClick={() => { navigator.clipboard.writeText(sepaReply); setSepaCopied(true); setTimeout(() => setSepaCopied(false), 2000); }}
                    className="flex items-center gap-1.5 text-xs bg-yellow-400/20 hover:bg-yellow-400/30 text-yellow-400 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                    aria-label="Copy reply to clipboard"
                  >
                    {sepaCopied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy reply</>}
                  </button>
                </div>
              </div>
              <pre className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed font-mono p-5 max-h-96 overflow-y-auto">{sepaReply}</pre>
            </div>
          )}

          {/* Loading state */}
          {sepaLoading && !sepaReply && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 flex items-center justify-center gap-3">
              <Loader2 size={18} className="animate-spin text-yellow-400" />
              <p className="text-sm text-slate-400">ACE is drafting your reply...</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
