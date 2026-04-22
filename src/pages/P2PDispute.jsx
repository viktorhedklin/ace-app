import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { scrubPII } from '@/lib/SecurityModule';
import { Copy, Check } from 'lucide-react';

const DISPUTE_TYPES = [
  { id: 'payment_sent', label: 'Buyer claims payment sent, seller won\'t release', icon: '💸' },
  { id: 'payment_not_received', label: 'Seller claims no payment received', icon: '🚫' },
  { id: 'wrong_amount', label: 'Wrong payment amount sent', icon: '💱' },
  { id: 'fake_proof', label: 'Suspected fake payment proof', icon: '🎭' },
  { id: 'cancelled_after_payment', label: 'Order cancelled after payment was made', icon: '❌' },
  { id: 'overpaid', label: 'Buyer overpaid / underpaid', icon: '⚖️' },
];

const ACTIONS = {
  payment_sent: {
    title: 'Buyer claims payment sent — Seller won\'t release',
    steps: [
      'Request payment proof from buyer (bank screenshot, receipt — must show: amount, sender name, recipient name, date/time, transaction ID)',
      'Verify sender name matches buyer\'s KYC name',
      'Ask seller to check payment account (may be pending/delayed)',
      'If seller refuses to check: escalate to P2P dispute team immediately',
      'Dispute must be raised within 30 minutes of payment deadline',
      'Crypto is held in escrow — buyer\'s funds are safe during dispute review',
    ],
    escalate: true,
    timeline: '2–24 hours for standard dispute review',
    template: `Thank you for raising this dispute. I've reviewed the case and I'm escalating this to our P2P dispute team for urgent review.

Escrow status: The cryptocurrency is safely held in escrow and will not be released until the dispute is resolved.

What you need to provide:
• Clear screenshot of payment confirmation (showing amount, sender name, recipient name, date/time)
• Bank statement or transaction reference number

Our team will review within 24 hours. Case ID: [CASE_ID]`,
  },
  payment_not_received: {
    title: 'Seller claims no payment received',
    steps: [
      'Ask buyer to provide payment proof (screenshot of successful transfer)',
      'Verify: payment must be to the seller\'s listed payment account',
      'Check if payment account name matches seller\'s KYC',
      'Common issue: payment sent to wrong account — buyer\'s responsibility',
      'If payment confirmed on bank end but not received: contact bank for trace',
      'If fraudulent activity suspected: escalate with evidence',
    ],
    escalate: false,
    timeline: 'Resolve within 30-minute order window or raise dispute',
    template: `I understand your concern. To help resolve this quickly, I'll need the buyer to provide:

1. A clear screenshot of the payment transfer
2. The exact amount, time, and account number used

Please note: If payment was sent to an account not listed by the seller, it cannot be verified on our end and the order may be cancelled.

If you have confirmed payment proof, please share it and I'll escalate to our P2P team immediately.`,
  },
  fake_proof: {
    title: 'Suspected fake payment proof',
    steps: [
      '⚠️ ESCALATE IMMEDIATELY — this is potential fraud',
      'Do NOT instruct seller to release crypto',
      'Note buyer UID, seller UID, order ID from system — attach screenshot of suspected fake proof',
      'Compare payment details with actual bank records (if accessible)',
      'Submit fraud report: include all evidence, mark as URGENT',
      'Inform seller: DO NOT release funds until investigation complete',
      'Lock both accounts pending investigation if evidence is strong',
    ],
    escalate: true,
    urgent: true,
    timeline: 'URGENT — same-day review required',
    template: `⚠️ Important notice regarding your P2P order.

We have received your report and have placed this order under immediate review by our security team.

Action required: Do NOT release the cryptocurrency until you receive a confirmation from Bybit support.

Your case has been flagged as urgent. Our team will review and respond within 2–4 hours. Case ID: [CASE_ID]

We take fraud very seriously and will take appropriate action.`,
  },
  wrong_amount: {
    title: 'Wrong payment amount sent',
    steps: [
      'Verify the original order amount vs. amount paid',
      'If underpaid: seller can choose to release partial or cancel order',
      'If overpaid: buyer can request refund of excess from seller (outside Bybit platform)',
      'Bybit cannot force refund of overpayment — both parties must agree',
      'Advise buyer to communicate directly with seller via chat',
      'If no agreement: raise formal dispute and Bybit arbiter will decide',
    ],
    escalate: false,
    timeline: 'Mutual agreement preferred; arbiter within 24h if disputed',
    template: `Thank you for contacting us about this order.

For orders where the payment amount doesn't match:
• Underpayment: The seller has the right to cancel the order. If you'd like to proceed, please communicate with the seller in the order chat.
• Overpayment: Bybit recommends resolving this directly with the seller. Any excess payment refund is between buyer and seller.

If you cannot reach an agreement, please raise a formal dispute and our arbiter team will review within 24 hours.`,
  },
  cancelled_after_payment: {
    title: 'Order cancelled after payment made',
    steps: [
      'Confirm if buyer clicked "I\'ve Paid" before order was cancelled',
      'If payment was made: raise dispute immediately — do NOT let order lapse',
      'Note order ID from system — collect payment proof and timestamp from customer',
      'If seller cancelled maliciously: account review + potential ban',
      'USDT/crypto should still be in escrow — check with P2P team',
      'Priority escalation if funds were released or escrow is missing',
    ],
    escalate: true,
    timeline: 'Urgent — raise within 1 hour of cancellation',
    template: `I understand this is a stressful situation. Please do not worry — if payment was made before the order was cancelled, your funds are protected by our escrow system.

Immediate action needed:
1. Do NOT place a new order for the same amount yet
2. Provide: Order ID, payment proof with timestamp, amount

I'm escalating this to our P2P dispute team now. Case ID: [CASE_ID]

Resolution timeline: 2–8 hours.`,
  },
  overpaid: {
    title: 'Overpaid / Underpaid',
    steps: [
      'Request the original order amount and actual amount paid',
      'For underpayment: seller may release partial crypto or cancel (their choice)',
      'For overpayment: Bybit cannot force refund — buyer and seller must agree',
      'Recommend resolving via order chat before escalating',
      'If seller is unresponsive for 30+ min: raise dispute',
    ],
    escalate: false,
    timeline: 'Aim to resolve within order payment window',
    template: `Thank you for reaching out. Regarding the payment discrepancy:

If you paid less than the order amount: The seller may choose to proceed with a partial release or cancel the order. Please communicate with them directly in the order chat.

If you paid more than the order amount: Please discuss with the seller for a refund of the excess amount. This is done outside of Bybit, as we're unable to reverse payments made to third-party accounts.

If no resolution is reached within the payment window, please raise a formal dispute.`,
  },
};

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="text-slate-500 hover:text-yellow-400 transition-colors">
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

export default function P2PDispute() {
  const { state } = useLocation();
  const handoff = state?.fromNBA ? state : null;
  const [selected, setSelected] = useState(null);
  const action = selected ? ACTIONS[selected] : null;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
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
          {handoff.orderId && <p className="text-xs text-slate-400">Order ID: <span className="text-slate-200 font-mono">{scrubPII(handoff.orderId)}</span></p>}
          {handoff.issue && <p className="text-xs text-slate-500 mt-0.5">{handoff.issue}</p>}
        </div>
      )}
      <div>
        <h1 className="text-xl font-bold text-slate-100">⚖️ P2P Dispute</h1>
        <p className="text-sm text-slate-500">Dispute resolution SOP and appeals workflow</p>
      </div>

      {/* Dispute type selector */}
      <div>
        <p className="text-xs text-slate-500 mb-3">Select the dispute type</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {DISPUTE_TYPES.map(d => (
            <button
              key={d.id}
              onClick={() => setSelected(d.id)}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm transition-all border',
                selected === d.id
                  ? 'bg-yellow-400/15 border-yellow-400/40 text-yellow-400'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-600'
              )}
            >
              <span className="text-xl">{d.icon}</span>
              <span>{d.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Action guide */}
      {action && (
        <div className="space-y-4">
          <div className={cn(
            'rounded-xl p-5 border space-y-4',
            action.urgent ? 'bg-red-500/10 border-red-500/30' : 'bg-slate-900 border-slate-800'
          )}>
            <div className="flex items-start justify-between">
              <h2 className="font-semibold text-slate-100">{action.title}</h2>
              <div className="flex gap-2 shrink-0">
                {action.urgent && <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded font-medium">URGENT</span>}
                {action.escalate && <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded font-medium">ESCALATE</span>}
              </div>
            </div>
            <div className="bg-slate-800/50 rounded-lg px-3 py-2 text-xs text-slate-400">
              ⏱ {action.timeline}
            </div>
            <div className="space-y-2">
              {action.steps.map((step, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-yellow-400 shrink-0 font-medium w-5">{i + 1}.</span>
                  <span className={cn('text-slate-300', step.startsWith('⚠️') && 'text-red-400 font-medium')}>{step}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500">📋 Customer message template</span>
              <CopyBtn text={action.template} />
            </div>
            <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">{action.template}</p>
          </div>
        </div>
      )}

      {/* Key rules */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 className="font-semibold text-slate-100 mb-3">📌 Key P2P Dispute Rules</h2>
        <div className="space-y-2">
          {[
            'Disputes must be raised within 30 minutes of the payment deadline',
            'Crypto stays in escrow during active disputes — buyer\'s funds are protected',
            'Both parties must provide evidence — decision is final',
            'Bybit cannot reverse payments sent to third-party bank accounts',
            'Repeated fraudulent behavior = permanent P2P ban',
            'Appeals can be submitted within 7 days of dispute closure',
          ].map((rule, i) => (
            <p key={i} className="text-xs text-slate-400 flex items-start gap-2">
              <span className="text-yellow-400 shrink-0">•</span> {rule}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
