import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronRight, RotateCcw, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

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

export default function MissingDeposit() {
  const { state } = useLocation();
  const handoff = state?.fromNBA ? state : null;
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [resolution, setResolution] = useState(null);
  const [copied, setCopied] = useState(false);

  function answer(key, val, next) {
    const newAnswers = { ...answers, [key]: val };
    setAnswers(newAnswers);
    if (next === 'resolve') {
      resolve(newAnswers);
    } else {
      setStep(next);
    }
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

  function reset() {
    setStep(0);
    setAnswers({});
    setResolution(null);
    setCopied(false);
  }

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
        ? `Was the MEMO/Tag included in the transaction?`
        : `Does the deposit address match the Bybit deposit address exactly?`,
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
          {handoff.uid && <p className="text-xs text-slate-400">UID: <span className="text-slate-200 font-mono">{handoff.uid}</span></p>}
          {handoff.coin && <p className="text-xs text-slate-400">Coin: <span className="text-slate-200">{handoff.coin}</span></p>}
          {handoff.issue && <p className="text-xs text-slate-500 mt-0.5">{handoff.issue}</p>}
        </div>
      )}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">💸 Missing Deposit</h1>
          <p className="text-sm text-slate-500">Step-by-step deposit troubleshooting wizard</p>
        </div>
        <button onClick={reset} className="flex items-center gap-1 text-xs text-slate-500 hover:text-yellow-400 transition-colors">
          <RotateCcw size={13} /> Restart
        </button>
      </div>

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
                className="w-full flex items-center justify-between text-left bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-yellow-400/40 rounded-lg px-4 py-3 text-sm text-slate-200 transition-all group"
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
            className="flex items-center gap-2 text-xs text-slate-500 hover:text-yellow-400 transition-colors"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copied' : 'Copy to clipboard'}
          </button>
          <button onClick={reset} className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors">
            <RotateCcw size={13} /> Start new case
          </button>
        </div>
      )}
    </div>
  );
}
