import { useState } from 'react';
import { Copy, Check, ChevronDown, ChevronUp, RotateCcw, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ═══ CONSTANTS ═══ */

const INQUIRY_TYPES = [
  { value: 'unable',  label: 'Unable to Place Order',     icon: '🚫', desc: 'Fiat service restricted, banned, or general guidance' },
  { value: 'order',   label: 'Deposit Order Handling',     icon: '📋', desc: 'Order exists in CS:GO — route by status' },
  { value: 'other',   label: 'Other Fiat Issues',          icon: '📎', desc: 'KYC name mismatch, fiat info removal' },
];

const UNABLE_SCENARIOS = [
  { value: 'guide',      label: 'General fiat deposit guidance', action: 'Live Chat: fd01-en-fiat-guide | Email: ET 4800' },
  { value: 'restricted', label: 'Fiat service restricted (country)', action: 'Check CS:GO > KYC > Issue Country against restricted list' },
  { value: 'banned',     label: 'Service banned by Fiat Risk', action: 'Check CS:GO > Funding > Risk Order for triggered orders' },
];

const ORDER_STATUSES = [
  { value: 'no_record',                label: 'No Record Found',              group: 'none',       color: 'red' },
  { value: 'PENDING',                  label: 'PENDING',                      group: 'processing', color: 'yellow' },
  { value: 'PAYING',                   label: 'PAYING',                       group: 'processing', color: 'yellow' },
  { value: 'PENDING_PAY',              label: 'PENDING PAY',                  group: 'processing', color: 'yellow' },
  { value: 'REFUND_PROCESSING',        label: 'REFUND PROCESSING',            group: 'processing', color: 'blue' },
  { value: 'PAY_ORDER_CREATE_FAILED',  label: 'PAY ORDER CREATE FAILED',      group: 'completed',  color: 'red' },
  { value: 'TIMEOUT_CANCEL',           label: 'TIMEOUT CANCEL',               group: 'completed',  color: 'slate' },
  { value: 'REFUNDED',                 label: 'REFUNDED',                     group: 'completed',  color: 'green' },
  { value: 'FAILED',                   label: 'FAILED',                       group: 'completed',  color: 'red' },
  { value: 'SUCCESS',                  label: 'SUCCESS',                      group: 'completed',  color: 'green' },
];

const RISK_REVIEW = {
  triggered: { label: 'Order Triggered — Pending Submission', qt: 'fd02 Response 1', et: 'ET 4855 Option 1', action: 'Advise user to submit documents via Support Hub. Review takes up to 2 business days.' },
  expired:   { label: 'Order Triggered — Expired', qt: 'fd02 Response 5', et: 'ET 4855 Option 5', action: 'Submission expired. Advise user to retry a NEW fiat deposit — may trigger risk review again.' },
  reviewing: { label: 'Documents Submitted — Under Review', qt: 'fd02 Response 2', et: 'ET 4855 Option 2', action: 'Documents submitted. Review takes up to 2 business days. If exceeded → escalate P2.' },
  rejected:  { label: 'Documents Rejected', qt: 'fd02 Response 3', et: 'ET 4855 Option 3', action: 'Guide user to Support Hub > Details to see which docs were rejected. Resubmit required.' },
  approved:  { label: 'Review Approved', qt: 'fd02 Response 6', et: 'ET 4855 Option 6', action: 'Review successful. User can proceed with new order. Advise security measures.' },
  refused:   { label: 'Review Refused', qt: 'fd02 Response 7', et: 'ET 4855 Option 7', action: 'Review completed with refusal. User may retry but no guarantee. Do not speculate on reasons.' },
};

const ORDER_HANDLING = {
  no_record: {
    title: 'Scenario 3: No Order Created, Funds Deducted',
    steps: ['Collect: Full Name, Fiat Currency, Amount, Channel, Date, Payment Proof', 'Live Chat: fd05-en-clarification-on-fiat-deposit → offer follow-up (a06)', 'Email: ET 4880b → internal note → Macro P1>P2'],
    case_type: 'E03 Fiat Transactions > Fiat Deposit > Fiat Payment Refund',
  },
  PENDING: {
    title: 'Scenario 4.1.1: PENDING — Risk Review or Discrepancy',
    steps: ['Search Order ID in Lark groups', 'Type 1: Risk Alert Group → handle per Risk Review flow', 'Type 2: Discrepancy Platform → wait 5 BD or escalate', 'Type 3: No Record in Lark → escalate P2 immediately'],
    case_type: 'E03 Fiat Transactions > Fiat Deposit > Fiat Deposit Risk Trigger',
  },
  PAYING: {
    title: 'Scenario 4.1.2: PAYING — Payment Not Received',
    steps: ['Check if WITHIN or EXCEEDED 96 hours', 'Within: advise to complete payment on details page (fd03 Response 2 / ET 4880 Option 2)', 'Exceeded: escalate P2 with internal note'],
    case_type: 'E03 Fiat Transactions > Fiat Deposit > Fiat Deposit Guidance',
  },
  PENDING_PAY: {
    title: 'Scenario 4.1.3: PENDING PAY — BLIK Method',
    steps: ['Check if WITHIN or EXCEEDED 48 hours', 'Within: advise order will cancel after 48h if no payment (fd03 Response 2)', 'Exceeded: escalate P2 with internal note'],
    case_type: 'E03 Fiat Transactions > Fiat Deposit > Fiat Deposit Guidance',
  },
  REFUND_PROCESSING: {
    title: 'Scenario 4.1.4: REFUND PROCESSING',
    steps: ['Check if WITHIN or EXCEEDED 14 business days', 'Within: inform refund takes 7-14 BD (fd03 Response 5 / ET 4880 Option 5)', 'Exceeded: escalate P2 for investigation'],
    case_type: 'E03 Fiat Transactions > Fiat Deposit > Fiat Payment Refund',
  },
  PAY_ORDER_CREATE_FAILED: {
    title: 'Scenario 4.2.1: PAY ORDER CREATE FAILED',
    steps: ['Order rejected by risk control — funds NOT charged', 'Advise: retry later or use P2P/One-Click Buy', 'Live Chat: fd03 Response 1 | Email: ET 4880 Option 1'],
    case_type: 'E03 Fiat Transactions > Fiat Deposit > Fiat Payment Failed',
  },
  TIMEOUT_CANCEL: {
    title: 'Scenario 4.2.2: TIMEOUT CANCEL',
    steps: ['Order timed out — payment not received', 'Advise: try again. If funds deducted → collect proof and escalate', 'Live Chat: fd03 Response 3 | Email: ET 4880 Option 3'],
    case_type: 'E03 Fiat Transactions > Fiat Deposit > Fiat Payment Failed',
  },
  REFUNDED: {
    title: 'Scenario 4.2.3: REFUNDED',
    steps: ['Refund completed by Bybit', 'Funds reflect within 14 BD depending on bank', 'If not received → customer contacts bank first → then provide proof for escalation', 'Live Chat: fd03 Response 6 | Email: ET 4880 Option 6'],
    case_type: 'E03 Fiat Transactions > Fiat Deposit > Fiat Payment Refund',
  },
  FAILED: {
    title: 'Scenario 4.2.4: FAILED',
    steps: ['Check Failed Code in CS:GO > Funding > Fiat Deposit > Order > Failed Code', 'Cross-ref with FAQ Troubleshooting sheet', 'If error known: reply per FAQ. If unknown or 3+ failures → escalate P2', 'If funds deducted: collect proof (currency, amount, channel, receipt) → escalate P2'],
    case_type: 'E03 Fiat Transactions > Fiat Deposit > Fiat Payment Refund',
  },
  SUCCESS: {
    title: 'Scenario 4.2.5: SUCCESS',
    steps: ['Deposit credited to Funding Account', 'Confirm with customer — check order history page', 'Live Chat: fd03 Response 4 | Email: ET 4880 Option 4'],
    case_type: 'E03 Fiat Transactions > Fiat Deposit > Fiat Deposit Guidance',
  },
};

const RESTRICTED_HANDLING = [
  { condition: 'Russia / Belarus',  action: 'Only RUB supported. QT: fs01-en-native-fiat | ET: 4719 Option 1' },
  { condition: 'Nigeria',           action: 'Only NGN supported. QT: fs01-en-native-fiat | ET: 4719 Option 2' },
  { condition: 'Restricted country', action: 'Fiat unavailable. QT: fs02-en-restricted-countries | ET: 4721. Suggest P2P as alternative.' },
  { condition: 'Not from restricted country but error', action: 'Request video of error → offer follow-up → internal note with video → Macro P1>P2' },
];

const ESCALATION_TEMPLATES = {
  no_record: `Dear team, the user reports that funds have been deducted from their bank account, but NO ORDER was created in the system. Kindly investigate and assist accordingly.
UID:
Full Name:
Order ID: N/A
Date of payment:
Fiat Currency:
Amount:
Deposited Channel:
Payment Proof: *attached*`,
  risk_exceeded: `Dear team, user's fiat risk review has exceeded 2 business days and there is yet to be any update for the result. Kindly assist in expediting the risk result.
UID:
Appeal ID:`,
  discrepancy: `Dear team, the user's fiat deposit order triggered discrepancies and the order exceeded 5 business days. Kindly assist with the further investigation.
UID:
Order ID:`,
  pending_no_lark: `Dear team, the user's Fiat deposit order is PENDING but there is no record in risk order or Lark.
UID:
Order ID:`,
  paying_stuck: `Dear team, the fiat deposit order had been stuck in status [PAYING] for more than 96 hours. Kindly assist to check on the issue.
UID:
Order ID:`,
  pending_pay_stuck: `Dear team, the fiat deposit order had been stuck in status [PENDING PAY] for more than 48 hours. Kindly assist to check on the issue.
UID:
Order ID:`,
  refund_stuck: `Dear team, the user's Fiat deposit order is stuck in this status for more than 14 business days.
UID:
Status: REFUND_PROCESSING
Order ID:`,
  failed_deducted: `Dear team, the user reports that funds have been deducted from their payment method, but the order status shows as FAILED. Kindly investigate and assist accordingly.
UID:
Order ID:
Fiat Currency:
Amount:
Deposited Channel:
Payment Proof: *attached*`,
  failed_repeated: `Dear team, the user's Fiat Deposit order status is FAILED more than 3 times in a row. Kindly assist on investigating the possible issues.
UID:
Order ID:
Status: FAILED`,
  name_mismatch: `Dear team, the user's name provided during the Fiat deposit appears to be incorrect.
Kindly assist in correcting it after the user provides with the correct information and screenshot.
UID:`,
  fiat_removal: `UID:
Remark: The user is unable to use the Fiat Information Removal Self-Service. Kindly assist in removing the Fiat Information Removal manually.
Attachment: *attached*`,
  video_restricted: `Dear team, kindly assist with the following.
UID:
Video Recording: *attached*
Summary: The user is not from fiat service restricted country but is unable to proceed with fiat service. The user is inquiring about the reason.`,
};

/* ═══ HELPERS ═══ */

function useCopy(ms = 2000) {
  const [done, setDone] = useState(false);
  function copy(text) { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), ms); }
  return [done, copy];
}

function CopyBtn({ text, label = 'Copy' }) {
  const [done, copy] = useCopy();
  return (
    <button onClick={() => copy(text)} className={cn('flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border transition-all cursor-pointer', done ? 'bg-ok/15 border-ok/30 text-ok' : 'bg-bg-2 border-border-0 text-fg-1 hover:text-hero hover:border-hero/40')} aria-label={label}>
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

function OptionBtn({ selected, onClick, children, color = 'yellow' }) {
  const colors = {
    yellow: selected ? 'bg-hero/15 border-hero/40 text-hero' : '',
    red:    selected ? 'bg-crit/15 border-crit/40 text-crit' : '',
    green:  selected ? 'bg-ok/15 border-ok/40 text-ok' : '',
    blue:   selected ? 'bg-info/15 border-info/40 text-info' : '',
    slate:  selected ? 'bg-bg-3 border-border-1 text-fg-1' : '',
  };
  return (
    <button onClick={onClick} className={cn('px-3 py-2 rounded-lg text-xs border transition-all cursor-pointer text-left', selected ? colors[color] : 'bg-bg-2 border-border-0 text-fg-1 hover:border-border-1')}>
      {children}
    </button>
  );
}

/* ═══ MAIN COMPONENT ═══ */

export default function FiatDeposit() {
  const [inquiryType, setInquiryType] = useState(null);
  const [unableScenario, setUnableScenario] = useState(null);
  const [orderStatus, setOrderStatus] = useState(null);
  const [riskStatus, setRiskStatus] = useState(null);
  const [otherType, setOtherType] = useState(null); // 'name_mismatch' | 'fiat_removal'
  const [fiatRemovalSelf, setFiatRemovalSelf] = useState(null); // 'yes' | 'no'

  const handling = orderStatus ? ORDER_HANDLING[orderStatus] : null;
  const riskInfo = riskStatus ? RISK_REVIEW[riskStatus] : null;

  function reset() {
    setInquiryType(null); setUnableScenario(null); setOrderStatus(null);
    setRiskStatus(null); setOtherType(null); setFiatRemovalSelf(null);
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-fg-0">💶 Fiat Deposit</h1>
          <p className="text-sm text-fg-2">Global Fiat Deposit SOP — guided workflow</p>
        </div>
        {inquiryType && (
          <button onClick={reset} className="flex items-center gap-1 text-xs text-fg-2 hover:text-hero transition-colors cursor-pointer" aria-label="Restart">
            <RotateCcw size={13} /> Restart
          </button>
        )}
      </div>

      {/* Info collection reminder */}
      <Section title="Step 1 — Collect Information" open={!inquiryType}>
        <div className="px-4 pb-4 space-y-3">
          <p className="text-xs text-fg-1">Gather from customer before proceeding:</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {['UID', 'Fiat currency', 'Deposit channel', 'Deposit amount', 'Order ID (if any)', 'Error message / screenshots', 'Payment proof (if charged)'].map(item => (
              <span key={item} className="bg-bg-2 border border-border-0 px-2.5 py-1.5 rounded-lg text-fg-1">{item}</span>
            ))}
          </div>
          <p className="text-xs text-fg-2">Check in CS:GO: Account Status, KYC Level, Country/Region, Risk Orders, Order Status</p>
        </div>
      </Section>

      {/* Step 2: Inquiry type */}
      <div className="bg-bg-1 border border-border-0 rounded-xl p-5 space-y-4">
        <p className="text-sm font-medium text-fg-0">Step 2 — What is the customer's issue?</p>
        <div className="grid grid-cols-1 gap-2">
          {INQUIRY_TYPES.map(t => (
            <button key={t.value} onClick={() => { setInquiryType(t.value); setUnableScenario(null); setOrderStatus(null); setRiskStatus(null); setOtherType(null); setFiatRemovalSelf(null); }}
              className={cn('flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all cursor-pointer',
                inquiryType === t.value ? 'bg-hero/10 border-hero/30' : 'bg-bg-2 border-border-0 hover:border-border-1')}>
              <span className="text-xl">{t.icon}</span>
              <div>
                <p className={cn('text-sm font-semibold', inquiryType === t.value ? 'text-hero' : 'text-fg-0')}>{t.label}</p>
                <p className="text-xs text-fg-2">{t.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ═══ (A) UNABLE TO PLACE ORDER ═══ */}
      {inquiryType === 'unable' && (
        <>
          <div className="bg-bg-1 border border-border-0 rounded-xl p-5 space-y-3">
            <p className="text-sm font-medium text-fg-0">What's preventing the order?</p>
            <div className="space-y-2">
              {UNABLE_SCENARIOS.map(s => (
                <OptionBtn key={s.value} selected={unableScenario === s.value} onClick={() => setUnableScenario(s.value)}>
                  <p className="font-semibold">{s.label}</p>
                  <p className="text-fg-2 mt-0.5">{s.action}</p>
                </OptionBtn>
              ))}
            </div>
          </div>

          {/* Restricted country handling */}
          {unableScenario === 'restricted' && (
            <Section title="Scenario 1: Fiat Service Restricted">
              <div className="px-4 pb-4 space-y-3">
                <p className="text-xs text-fg-1">Check CS:GO &gt; KYC &gt; Issue Country against <a href="https://www.bybit.com/en/help-center/article?id=000002099" target="_blank" rel="noopener noreferrer" className="text-info hover:text-info">restricted country list</a></p>
                {RESTRICTED_HANDLING.map((r, i) => (
                  <div key={i} className="bg-bg-2/60 border border-border-0 rounded-lg px-3 py-2.5">
                    <p className="text-xs font-semibold text-fg-0">{r.condition}</p>
                    <p className="text-xs text-fg-1 mt-0.5">{r.action}</p>
                  </div>
                ))}
                <div className="pt-2">
                  <CopyBtn text={ESCALATION_TEMPLATES.video_restricted} label="Copy video escalation template" />
                </div>
              </div>
            </Section>
          )}

          {/* Risk ban handling */}
          {unableScenario === 'banned' && (
            <Section title="Scenario 2: Service Banned by Fiat Risk">
              <div className="px-4 pb-4 space-y-3">
                <p className="text-xs text-fg-1">Check CS:GO &gt; Funding &gt; Risk Order. User must submit docs via <a href="https://www.bybit.com/en/help-center/case-list" target="_blank" rel="noopener noreferrer" className="text-info hover:text-info">Support Hub</a></p>
                <p className="text-xs text-fg-2">Search Order ID in Lark groups to determine stage:</p>
                <div className="space-y-2">
                  {Object.entries(RISK_REVIEW).map(([key, r]) => (
                    <OptionBtn key={key} selected={riskStatus === key} onClick={() => setRiskStatus(key)} color={key === 'approved' ? 'green' : key === 'refused' ? 'red' : 'yellow'}>
                      <p className="font-semibold">{r.label}</p>
                    </OptionBtn>
                  ))}
                </div>
                {riskInfo && (
                  <div className="bg-hero/8 border border-hero/20 rounded-lg px-3 py-3 space-y-1">
                    <p className="text-xs font-semibold text-hero">{riskInfo.label}</p>
                    <p className="text-xs text-fg-1">{riskInfo.action}</p>
                    <p className="text-xs text-fg-2 mt-1">QT: {riskInfo.qt} | {riskInfo.et}</p>
                  </div>
                )}
                {riskStatus === 'reviewing' && (
                  <div className="pt-1">
                    <p className="text-xs text-fg-2 mb-1">If review exceeded 2 business days:</p>
                    <CopyBtn text={ESCALATION_TEMPLATES.risk_exceeded} label="Copy escalation template" />
                  </div>
                )}
              </div>
            </Section>
          )}
        </>
      )}

      {/* ═══ (B) ORDER HANDLING ═══ */}
      {inquiryType === 'order' && (
        <>
          <div className="bg-bg-1 border border-border-0 rounded-xl p-5 space-y-4">
            <p className="text-sm font-medium text-fg-0">Order status in CS:GO</p>
            <p className="text-xs text-fg-2">CS:GO &gt; User Profile &gt; Funding &gt; Fiat Deposit &gt; Order Status</p>

            {/* Processing statuses */}
            <div>
              <p className="text-xs text-fg-2 mb-2">Processing Orders</p>
              <div className="flex flex-wrap gap-2">
                {ORDER_STATUSES.filter(s => s.group === 'processing' || s.group === 'none').map(s => (
                  <OptionBtn key={s.value} selected={orderStatus === s.value} onClick={() => { setOrderStatus(s.value); setRiskStatus(null); }} color={s.color}>
                    {s.label}
                  </OptionBtn>
                ))}
              </div>
            </div>

            {/* Completed statuses */}
            <div>
              <p className="text-xs text-fg-2 mb-2">Completed Orders</p>
              <div className="flex flex-wrap gap-2">
                {ORDER_STATUSES.filter(s => s.group === 'completed').map(s => (
                  <OptionBtn key={s.value} selected={orderStatus === s.value} onClick={() => { setOrderStatus(s.value); setRiskStatus(null); }} color={s.color}>
                    {s.label}
                  </OptionBtn>
                ))}
              </div>
            </div>
          </div>

          {/* Order handling detail */}
          {handling && (
            <div className="bg-bg-1 border border-hero/20 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-hero">{handling.title}</h3>
              <div className="space-y-1.5">
                {handling.steps.map((step, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="text-hero font-bold mt-0.5 shrink-0">{i + 1}.</span>
                    <span className="text-fg-1">{step}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-fg-2 mt-2">Case Type: {handling.case_type}</p>
            </div>
          )}

          {/* PENDING: Lark group check */}
          {orderStatus === 'PENDING' && (
            <Section title="PENDING — Lark Group Check">
              <div className="px-4 pb-4 space-y-3">
                <p className="text-xs text-fg-1">Search Order ID in Lark groups to determine trigger type:</p>
                <div className="space-y-2">
                  <div className="bg-hero/8 border border-hero/20 rounded-lg px-3 py-2.5">
                    <p className="text-xs font-semibold text-hero">Type 1: Risk Alert Group found</p>
                    <p className="text-xs text-fg-1 mt-0.5">Handle per Risk Review flow (same as Scenario 2). No fiat ban — user can still use fiat services.</p>
                    <div className="mt-2 space-y-1.5">
                      {Object.entries(RISK_REVIEW).map(([key, r]) => (
                        <OptionBtn key={key} selected={riskStatus === key} onClick={() => setRiskStatus(key)} color="yellow">
                          <span className="font-semibold">{r.label}</span>
                        </OptionBtn>
                      ))}
                    </div>
                    {riskInfo && (
                      <div className="mt-2 bg-bg-2/60 rounded-lg px-3 py-2">
                        <p className="text-xs text-fg-1">{riskInfo.action}</p>
                        <p className="text-xs text-fg-2">QT: {riskInfo.qt} | {riskInfo.et}</p>
                      </div>
                    )}
                  </div>
                  <div className="bg-info/8 border border-info/20 rounded-lg px-3 py-2.5">
                    <p className="text-xs font-semibold text-info">Type 2: Discrepancy Platform found</p>
                    <p className="text-xs text-fg-1 mt-0.5">Review takes up to 5 business days. Within 5 BD → advise wait (fd03 Response 8 / ET 4880 Option 8). Exceeded → escalate P2.</p>
                    <div className="mt-2"><CopyBtn text={ESCALATION_TEMPLATES.discrepancy} label="Copy discrepancy template" /></div>
                  </div>
                  <div className="bg-crit/8 border border-crit/20 rounded-lg px-3 py-2.5">
                    <p className="text-xs font-semibold text-crit">Type 3: No Record in Lark</p>
                    <p className="text-xs text-fg-1 mt-0.5">No record in risk order or Lark → escalate P2 immediately.</p>
                    <div className="mt-2"><CopyBtn text={ESCALATION_TEMPLATES.pending_no_lark} label="Copy escalation template" /></div>
                  </div>
                </div>
              </div>
            </Section>
          )}

          {/* Escalation templates for specific statuses */}
          {orderStatus === 'no_record' && (
            <Section title="Escalation — No Order Created">
              <div className="px-4 pb-4 space-y-2">
                <p className="text-xs text-fg-1">Collect: Full Name, Currency, Amount, Channel, Date, Payment Proof. Then escalate:</p>
                <CopyBtn text={ESCALATION_TEMPLATES.no_record} label="Copy template" />
                <pre className="text-xs text-fg-2 font-mono whitespace-pre-wrap bg-bg-2/50 rounded-lg p-3 mt-2">{ESCALATION_TEMPLATES.no_record}</pre>
              </div>
            </Section>
          )}

          {orderStatus === 'PAYING' && (
            <Section title="Escalation — PAYING Stuck" open={false}>
              <div className="px-4 pb-4 space-y-2">
                <p className="text-xs text-fg-1">If exceeded 96 hours:</p>
                <CopyBtn text={ESCALATION_TEMPLATES.paying_stuck} label="Copy template" />
                <pre className="text-xs text-fg-2 font-mono whitespace-pre-wrap bg-bg-2/50 rounded-lg p-3 mt-2">{ESCALATION_TEMPLATES.paying_stuck}</pre>
              </div>
            </Section>
          )}

          {orderStatus === 'PENDING_PAY' && (
            <Section title="Escalation — PENDING PAY Stuck" open={false}>
              <div className="px-4 pb-4 space-y-2">
                <p className="text-xs text-fg-1">If exceeded 48 hours:</p>
                <CopyBtn text={ESCALATION_TEMPLATES.pending_pay_stuck} label="Copy template" />
                <pre className="text-xs text-fg-2 font-mono whitespace-pre-wrap bg-bg-2/50 rounded-lg p-3 mt-2">{ESCALATION_TEMPLATES.pending_pay_stuck}</pre>
              </div>
            </Section>
          )}

          {orderStatus === 'REFUND_PROCESSING' && (
            <Section title="Escalation — Refund Stuck" open={false}>
              <div className="px-4 pb-4 space-y-2">
                <p className="text-xs text-fg-1">If exceeded 14 business days:</p>
                <CopyBtn text={ESCALATION_TEMPLATES.refund_stuck} label="Copy template" />
                <pre className="text-xs text-fg-2 font-mono whitespace-pre-wrap bg-bg-2/50 rounded-lg p-3 mt-2">{ESCALATION_TEMPLATES.refund_stuck}</pre>
              </div>
            </Section>
          )}

          {orderStatus === 'FAILED' && (
            <Section title="FAILED — Additional Actions">
              <div className="px-4 pb-4 space-y-3">
                <div className="bg-bg-2/60 border border-border-0 rounded-lg px-3 py-2.5">
                  <p className="text-xs font-semibold text-fg-0">If error code known:</p>
                  <p className="text-xs text-fg-1">Check FAQ Troubleshooting sheet. Reply per the matching solution.</p>
                </div>
                <div className="bg-bg-2/60 border border-border-0 rounded-lg px-3 py-2.5">
                  <p className="text-xs font-semibold text-fg-0">If failed 3+ times in a row:</p>
                  <CopyBtn text={ESCALATION_TEMPLATES.failed_repeated} label="Copy template" />
                </div>
                <div className="bg-crit/8 border border-crit/20 rounded-lg px-3 py-2.5">
                  <p className="text-xs font-semibold text-crit">If funds deducted but status FAILED:</p>
                  <p className="text-xs text-fg-1 mt-0.5">Collect: Currency, Amount, Channel, Payment Proof → escalate</p>
                  <div className="mt-2"><CopyBtn text={ESCALATION_TEMPLATES.failed_deducted} label="Copy template" /></div>
                </div>
              </div>
            </Section>
          )}
        </>
      )}

      {/* ═══ (C) OTHER FIAT ISSUES ═══ */}
      {inquiryType === 'other' && (
        <>
          <div className="bg-bg-1 border border-border-0 rounded-xl p-5 space-y-3">
            <p className="text-sm font-medium text-fg-0">What type of issue?</p>
            <div className="space-y-2">
              <OptionBtn selected={otherType === 'name_mismatch'} onClick={() => { setOtherType('name_mismatch'); setFiatRemovalSelf(null); }}>
                <p className="font-semibold">KYC Name Mismatch on Fiat Deposit Account</p>
                <p className="text-fg-2 mt-0.5">Beneficiary name doesn't match KYC name</p>
              </OptionBtn>
              <OptionBtn selected={otherType === 'fiat_removal'} onClick={() => { setOtherType('fiat_removal'); setFiatRemovalSelf(null); }}>
                <p className="font-semibold">Fiat Info Removal</p>
                <p className="text-fg-2 mt-0.5">KYC transfer or delete account process</p>
              </OptionBtn>
            </div>
          </div>

          {otherType === 'name_mismatch' && (
            <Section title="Scenario 5: KYC Name Mismatch">
              <div className="px-4 pb-4 space-y-3">
                <p className="text-xs text-fg-1">Collect from user:</p>
                <div className="text-xs text-fg-1 space-y-1">
                  <p>1. Screenshot of beneficiary name page</p>
                  <p>2. Incorrect name used</p>
                  <p>3. Correct name as per KYC</p>
                  <p>4. Proof of identity (ID card or passport)</p>
                </div>
                <p className="text-xs text-fg-2">Live Chat: offer follow-up (a06) → Email: ET 4842 → Internal note → Macro P1&gt;P2</p>
                <CopyBtn text={ESCALATION_TEMPLATES.name_mismatch} label="Copy internal note" />
                <p className="text-xs text-fg-2 mt-1">Case Type: E03 Fiat Transactions &gt; Fiat Deposit &gt; Fiat Deposit Guidance</p>
              </div>
            </Section>
          )}

          {otherType === 'fiat_removal' && (
            <Section title="Scenario 6: Fiat Info Removal">
              <div className="px-4 pb-4 space-y-3">
                <p className="text-xs text-fg-1">Ask: Can the user use the Fiat Info Removal Self-Service?</p>
                <div className="flex gap-2">
                  <OptionBtn selected={fiatRemovalSelf === 'yes'} onClick={() => setFiatRemovalSelf('yes')} color="green">Yes — can use self-service</OptionBtn>
                  <OptionBtn selected={fiatRemovalSelf === 'no'} onClick={() => setFiatRemovalSelf('no')} color="red">No — cannot use self-service</OptionBtn>
                </div>

                {fiatRemovalSelf === 'yes' && (
                  <div className="bg-ok/8 border border-ok/20 rounded-lg px-3 py-2.5 space-y-1">
                    <p className="text-xs font-semibold text-ok">Self-Service Available</p>
                    <p className="text-xs text-fg-1">QT: fd06-en-fiat-removal-guide | Email: ET 4864</p>
                    <p className="text-xs text-fg-2 mt-1">Remind: unlink all payment methods (Credit Card, Tax ID, P2P, Bank Card, Digital Wallet) before proceeding.</p>
                    <p className="text-xs text-fg-2">Link: <a href="https://www.bybit.com/en/fiat/trade/express/expressUserCenter" target="_blank" rel="noopener noreferrer" className="text-info">expressUserCenter</a></p>
                  </div>
                )}

                {fiatRemovalSelf === 'no' && (
                  <div className="bg-crit/8 border border-crit/20 rounded-lg px-3 py-2.5 space-y-2">
                    <p className="text-xs font-semibold text-crit">Cannot Use Self-Service</p>
                    <p className="text-xs text-fg-1">Request screenshot of error → offer follow-up → internal note → Macro P1&gt;P2</p>
                    <CopyBtn text={ESCALATION_TEMPLATES.fiat_removal} label="Copy escalation template" />
                  </div>
                )}
              </div>
            </Section>
          )}
        </>
      )}

      {/* Quick Reference */}
      <Section title="Quick Reference — QT & ET Codes" open={false}>
        <div className="px-4 pb-4 space-y-2 text-xs">
          {[
            ['fd01-en-fiat-guide', 'How to deposit fiat'],
            ['fd02-en-risk-control-status', 'Risk control status (7 options)'],
            ['fd03-en-order-status', 'Order status reply (8 options)'],
            ['fd05-en-clarification-on-fiat-deposit', 'Info collection (no order)'],
            ['fd06-en-fiat-removal-guide', 'Fiat info removal self-service'],
            ['fs01-en-native-fiat', 'RU/BY = RUB only, NG = NGN only'],
            ['fs02-en-restricted-countries', 'Fiat restricted countries'],
            ['ET 4800', 'Fiat Deposit General Guide'],
            ['ET 4719', 'RU/BY/NG Fiat Restriction'],
            ['ET 4721', 'Prohibited Country'],
            ['ET 4842', 'KYC Name Mismatch'],
            ['ET 4855', 'Fiat High-Risk Triggered (7 options)'],
            ['ET 4864', 'Fiat Info Removal Guide'],
            ['ET 4880', 'Fiat Deposit Order Status (8 options)'],
            ['ET 4880b', 'Info Collection (no order)'],
            ['ET 4891', 'Fiat Removal Self-Service'],
          ].map(([code, desc]) => (
            <div key={code} className="flex items-center justify-between">
              <span className="text-fg-1 font-mono">{code}</span>
              <span className="text-fg-2">{desc}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Never do */}
      <div className="bg-crit/5 border border-crit/20 rounded-xl px-5 py-3">
        <p className="text-xs font-semibold text-crit uppercase tracking-widest mb-2">Never</p>
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          {['Promise an ETA', 'Manually credit fiat', 'Mention internal review logic', 'Share ban reasons', 'Ask for passwords or 2FA codes'].map(d => (
            <span key={d} className="text-xs text-fg-2 flex items-center gap-1.5">
              <span className="text-crit text-xs">✕</span> {d}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
