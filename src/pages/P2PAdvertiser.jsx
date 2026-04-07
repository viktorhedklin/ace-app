import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';

const SECTIONS = [
  {
    id: 'requirements',
    title: 'Advertiser Requirements',
    icon: '📋',
    content: [
      { label: 'KYC Level', value: 'Level 2 (Advanced) required', highlight: true },
      { label: 'Account Age', value: 'Min. 30 days since registration' },
      { label: 'Trading Volume', value: 'Min. 500 USDT equivalent in spot/derivatives' },
      { label: 'Completion Rate', value: 'Min. 60% order completion rate' },
      { label: 'Positive Feedback', value: 'Good standing — no recent violations' },
      { label: 'Registration Fee', value: '100 USDT (refundable) frozen as collateral' },
    ],
  },
  {
    id: 'frozen_ad',
    title: 'Frozen / Suspended Ad',
    icon: '🧊',
    scenarios: [
      {
        issue: 'Ad frozen due to insufficient balance',
        action: 'Ask advertiser to top up their P2P wallet balance. The ad will auto-unfreeze once balance is sufficient.',
      },
      {
        issue: 'Ad suspended — account violation',
        action: 'Review the violation notice in P2P > My Ads. If unresolved after 7 days, account may be permanently banned. Escalate to P2P team with [INPUT UID] and violation ID.',
      },
      {
        issue: 'Ad not visible to buyers',
        action: 'Check if ad is set to "Online" status, advertiser is online in the app, and payment method is verified and active.',
      },
      {
        issue: 'Ad automatically paused',
        action: 'Occurs when the advertiser has 5+ open orders simultaneously or has been offline for 30+ mins. Guide them to re-enable.',
      },
    ],
  },
  {
    id: 'payment_issues',
    title: 'Payment Method Issues',
    icon: '💳',
    scenarios: [
      {
        issue: 'Payment method rejected',
        action: 'Payment method must be in the advertiser\'s own name. Third-party payments are not allowed. Advise to add a compliant payment method.',
      },
      {
        issue: 'Bank account flagged',
        action: 'If payment account is flagged, the advertiser must use an alternative verified payment method. Cannot use flagged accounts.',
      },
      {
        issue: 'Cannot add new payment method',
        action: 'Verify KYC name matches bank account name. Check if account is under a security hold. Max 5 payment methods allowed.',
      },
    ],
  },
  {
    id: 'limits',
    title: 'Trading Limits & Restrictions',
    icon: '⚖️',
    content: [
      { label: 'Min order amount', value: '1 USDT (set by advertiser)' },
      { label: 'Max single order', value: '50,000 USDT equivalent' },
      { label: 'Daily trading limit', value: 'Depends on KYC level and account history' },
      { label: 'Concurrent orders', value: 'Max 5 simultaneous open orders' },
      { label: 'Release timeout', value: 'Advertiser must release within 15 mins of payment confirmation' },
      { label: 'Price range', value: 'Must be within ±20% of market price' },
    ],
  },
  {
    id: 'escalation',
    title: 'Escalation Triggers',
    icon: '🚨',
    list: [
      'Advertiser reports buyer refusing to pay after placing order',
      'Funds released but buyer hasn\'t received crypto (crypto stuck)',
      'Advertiser account permanently suspended — needs appeal',
      'KYC identity mismatch on payment method',
      'Collateral refund request (after deregistering as advertiser)',
      'Any fraud suspicion involving large amounts',
    ],
  },
];

const TEMPLATES = [
  {
    label: 'Frozen ad — balance issue',
    text: `Thank you for reaching out. Your P2P advertisement has been temporarily paused because your P2P wallet balance is insufficient to cover the ad amount.

To resume your ad:
1. Go to Assets → P2P Account
2. Transfer funds to your P2P wallet
3. Your ad will automatically reactivate once the balance is restored

If you have any further questions, please don't hesitate to reach out.`,
  },
  {
    label: 'Payment method rejected',
    text: `Thank you for contacting Bybit P2P support.

Your payment method could not be verified because the account name does not match your registered KYC name. Bybit's P2P policy requires all payment methods to be in your own name to protect both buyers and sellers.

Please add a payment account that matches your verified identity (${'{'}KYC_NAME{'}'}). Third-party accounts are not permitted on our platform.

If you believe this is an error, please provide a copy of your bank statement showing your name and account number.`,
  },
];

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button onClick={copy} className="text-slate-500 hover:text-yellow-400 transition-colors">
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

function Section({ section }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-800/50 transition-colors"
      >
        <h2 className="font-semibold text-slate-100 flex items-center gap-2">
          <span>{section.icon}</span> {section.title}
        </h2>
        {open ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
      </button>
      {open && (
        <div className="px-5 pb-5">
          {section.content && (
            <div className="space-y-2">
              {section.content.map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                  <span className="text-sm text-slate-400">{item.label}</span>
                  <span className={cn('text-sm font-medium', item.highlight ? 'text-yellow-400' : 'text-slate-200')}>{item.value}</span>
                </div>
              ))}
            </div>
          )}
          {section.scenarios && (
            <div className="space-y-3">
              {section.scenarios.map((s, i) => (
                <div key={i} className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-sm font-medium text-red-400 mb-1">❌ {s.issue}</p>
                  <p className="text-xs text-slate-300 leading-relaxed">→ {s.action}</p>
                </div>
              ))}
            </div>
          )}
          {section.list && (
            <ul className="space-y-2">
              {section.list.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                  <span className="text-red-400 shrink-0">•</span> {item}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default function P2PAdvertiser() {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-100">🤝 P2P Advertiser</h1>
        <p className="text-sm text-slate-500">P2P advertiser SOP, requirements and common issues</p>
      </div>

      {SECTIONS.map(s => <Section key={s.id} section={s} />)}

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-slate-100">📨 Message Templates</h2>
        {TEMPLATES.map((t, i) => (
          <div key={i} className="bg-slate-800/50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400">{t.label}</span>
              <CopyButton text={t.text} />
            </div>
            <p className="text-xs text-slate-400 whitespace-pre-wrap leading-relaxed">{t.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
