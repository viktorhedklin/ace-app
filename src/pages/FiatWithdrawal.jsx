import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Copy, Check, ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, Circle, Clock, ArrowRight, RotateCcw } from 'lucide-react';

/* ─── CONSTANTS ─────────────────────────────────────────────────────────────── */

const WITHDRAWAL_REQUIREMENTS = [
  { key: 'email', label: 'Email bound & enabled' },
  { key: 'ga', label: 'Google 2FA enabled' },
  { key: 'kyc', label: 'KYC Level 1/2 verified' },
  { key: 'status', label: 'Account status: Active (not banned)' },
  { key: 'country', label: 'KYC country: Not restricted' },
  { key: 'deposit', label: 'At least one Fiat Deposit completed' },
];

const ORDER_STATUSES = [
  { key: 'withdrawing', label: 'WITHDRAWING / PENDING_WITHDRAW / PENDING', scenario: 'processing' },
  { key: 'failed', label: 'FAILED', scenario: 'failed' },
  { key: 'success', label: 'SUCCESS (but not received)', scenario: 'success_not_received' },
  { key: 'refund', label: 'REFUND', scenario: 'refund' },
];

const RISK_ORDER_STATUSES = [
  { key: 'pending_submission', label: 'Pending Submission', action: 'Submit documents via Support Hub', qt: 'fd02 Option 1', et: '4855 Option 1' },
  { key: 'under_review', label: 'Under Review', action: 'Check if within or exceeded 2 business days', qt: 'fd02 Option 2', et: '4855 Option 2' },
  { key: 'pending_resubmission', label: 'Pending Resubmission', action: 'Resubmit documents via Support Hub', qt: 'fd02 Option 3', et: '4855 Option 3' },
  { key: 'approved', label: 'Approved', action: 'Inform user verification approved', qt: 'fd02 Option 6', et: '4855 Option 6' },
  { key: 'rejected', label: 'Rejected', action: 'Inform user rejected; new submission on next withdrawal attempt', qt: 'fd02 Option 7', et: '4855 Option 7' },
];

/* ─── TEMPLATES ─────────────────────────────────────────────────────────────── */

const TEMPLATES = {
  escalation_processing: (uid, orderId, orderTime) =>
    `Dear team, kindly assist with the following.\nUID: ${uid || '[UID]'}\nOrder ID: ${orderId || '[ORDER_ID]'}\nOrder Time: ${orderTime || '[ORDER_TIME]'}\nIssue Type: Withdrawing / Pending Withdraw / Pending\nSummary: The user's fiat withdrawal order is pending after processing time. Kindly assist in checking.\n**Attach screenshot of the CS:GO Fiat Withdrawal record**`,

  escalation_failed_multiple: (uid, orderId, errorCode) =>
    `Dear team, kindly assist with the following.\nUID: ${uid || '[UID]'}\nOrder ID: ${orderId || '[ORDER_ID]'}\nError Code and Message: ${errorCode || '[ERROR_CODE]'}\nSummary: The user's fiat withdrawal FAILED multiple times for the same reason.\n**Attach screenshot of the CS:GO Fiat Withdrawal record**`,

  escalation_failed_unknown: (uid, orderId, errorCode) =>
    `Dear team, kindly assist with the following.\nUID: ${uid || '[UID]'}\nOrder ID: ${orderId || '[ORDER_ID]'}\nError Code and Message: ${errorCode || '[ERROR_CODE]'}\nSummary: The user's fiat withdrawal status is FAILED and inquiring about the reason.\n**Attach screenshot of the CS:GO Fiat Withdrawal record**`,

  escalation_suspicious: (uid) =>
    `Dear team, kindly assist with the following.\nUID: ${uid || '[UID]'}\nRemarks: The UID is shown in the suspicious activity group when performing fiat withdrawal.`,

  escalation_success_not_received: (uid, orderId, amount, currency, fullName) =>
    `Dear team, kindly assist with the following case.\nUID: ${uid || '[UID]'}\nOrder ID: ${orderId || '[ORDER_ID]'}\nOrder Status: Success\nWithdrawal Amount & Currency: ${amount || '[AMOUNT]'} ${currency || '[CURRENCY]'}\nFull Name: ${fullName || '[FULL_NAME]'}\nBank Statement: Please upload as an attachment\nRelevant payment information:\n- Bank Account Number / IBAN Number (SEPA, FPS)\n- Bank Account Number (Bank Transfer)\n- PIX Key (PIX)\n- Advcash Account Email Address (Advcash)\n- ZEN Mobile Number (ZEN)\nSummary: The user's fiat withdrawal status is SUCCESS, but the funds have not been received on the receiving platform.\n**Attach the bank statement and any related supporting documents**`,

  escalation_refund: (uid, orderId) =>
    `Dear team, kindly assist with the following.\nUID: ${uid || '[UID]'}\nOrder ID: ${orderId || '[ORDER_ID]'}\nOrder Status: Refund\nSummary: The user's fiat withdrawal status is marked as "Refund," but the amount has not been reflected in the Bybit account. Kindly assist in investigating and ensure the refund is processed to the user.\n**Attach the Fiat Withdrawal Order record from CS:GO**`,

  escalation_risk_review_exceeded: (uid, appealId) =>
    `Dear team, user's fiat risk review has exceeded 2 business days and there is yet to be any update for the result. Kindly assist in expediting the risk result.\n\nUID: ${uid || '[UID]'}\nAppeal ID: ${appealId || '[APPEAL_ID]'}`,

  escalation_risk_expired: (uid, appealId) =>
    `Dear team, user's risk order status has [EXPIRED], not able to complete fiat withdrawal after 2nd risk control submission. Kindly investigate and assist accordingly. Thank you.\n\nUID: ${uid || '[UID]'}\nAppeal ID: ${appealId || '[APPEAL_ID]'}`,

  escalation_risk_submission: (uid, appealId) =>
    `Dear team, kindly assist with the following.\nUID: ${uid || '[UID]'}\nAppeal ID: ${appealId || '[APPEAL_ID]'}\nSummary: The user has submitted the documents for Fiat withdrawal submission, and more than 2 business days have passed without a reply. Kindly assist in checking.\n**Attach screenshot of the Lark submission record**`,

  escalation_24h_ban: (uid, orderId, errorCode) =>
    `Dear team, kindly assist with the following.\nUID: ${uid || '[UID]'}\nOrder ID: ${orderId || '[ORDER_ID]'}\nError Code and Message: ${errorCode || '300370101'}\nSummary: The user's fiat withdrawal FAILED under the same error code [300370101] after the 24-hour restrictions being lifted.`,

  escalation_3x_code: (uid, orderId, errorCode) =>
    `Dear team, kindly assist with investigating.\nUID: ${uid || '[UID]'}\nOrder ID: ${orderId || '[ORDER_ID]'}\nError Code and Message: ${errorCode || '[3XXXXXXX]'}\nSummary: The user's fiat withdrawal FAILED under the error code [${errorCode || '3XXXXXXX'}].`,

  qt_follow_up: `Is your email contactable at XXX@XXX.com?\n\nPlease allow our team some time to check on this and we will come back to you via email within 5-7 working days. Thank you for your understanding and sorry for any inconvenience caused.`,

  qt_order_within_time: `Upon reviewing your Fiat Withdrawal order: [Order ID].\n\nYour fiat withdrawal is still being processed within the estimated time for the selected payment method. You may visit the Fiat Withdrawal page and select your desired fiat currency to view the estimated processing time.\n\nIf the transaction has exceeded the indicated processing time and you have not received your withdrawal, please reach out to us again for further assistance.\n\nFiat Withdrawal Page: https://www.bybit.com/en/fiat/trade/withdraw/home`,

  qt_refund_processed: `Upon reviewing your Fiat Withdrawal order: [Order ID].\n\nYour fiat withdrawal refund has been processed successfully. The funds have been returned to your Bybit Funding Account. You may check your Funding Account balance for confirmation.\n\nFunding Page: https://www.bybit.com/user/assets/home/fiat`,
};

/* ─── COMPONENTS ────────────────────────────────────────────────────────────── */

function CopyBtn({ text, copyKey, copied, onCopy }) {
  return (
    <button onClick={() => onCopy(text, copyKey)} className="flex items-center gap-1 text-xs text-fg-2 hover:text-hero transition-colors duration-150 cursor-pointer shrink-0" aria-label={`Copy ${copyKey}`}>
      {copied === copyKey ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
    </button>
  );
}

function TemplateBlock({ title, text, copyKey, copied, onCopy, hint }) {
  return (
    <div className="bg-bg-2/50 border border-border-0 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-fg-1">{title}</p>
        <CopyBtn text={text} copyKey={copyKey} copied={copied} onCopy={onCopy} />
      </div>
      <p className="text-xs text-fg-1 whitespace-pre-wrap leading-relaxed font-mono">{text}</p>
      {hint && <p className="text-[10px] text-fg-2 italic">{hint}</p>}
    </div>
  );
}

function OptionBtn({ selected, onClick, children, className }) {
  return (
    <button onClick={onClick} aria-label={typeof children === 'string' ? children : undefined}
      className={cn(
        'flex items-center gap-2 px-4 py-3 rounded-xl border text-left transition-all duration-150 cursor-pointer text-sm',
        selected ? 'bg-hero/10 border-hero/30 text-hero' : 'bg-bg-2 border-border-0 text-fg-1 hover:text-fg-0 hover:border-border-1',
        className
      )}>
      {children}
    </button>
  );
}

function Alert({ color, icon: Icon, title, children }) {
  const colors = {
    red: 'bg-crit/5 border-crit/20 text-crit',
    orange: 'bg-warn/5 border-warn/20 text-warn',
    blue: 'bg-info/5 border-info/20 text-info',
    green: 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400',
    yellow: 'bg-hero/5 border-hero/20 text-hero',
  };
  return (
    <div className={cn('border rounded-xl px-4 py-3', colors[color])}>
      <div className="flex items-center gap-2 mb-1">
        {Icon && <Icon size={14} className="shrink-0" />}
        <p className="text-xs font-semibold">{title}</p>
      </div>
      <div className="text-xs text-fg-1 space-y-1">{children}</div>
    </div>
  );
}

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-bg-1 border border-border-0 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full px-5 py-4 flex items-center justify-between cursor-pointer" aria-label={`Toggle ${title}`}>
        <h2 className="font-semibold text-fg-0 text-sm">{title}</h2>
        {open ? <ChevronDown size={14} className="text-fg-2" /> : <ChevronRight size={14} className="text-fg-2" />}
      </button>
      {open && <div className="px-5 pb-5 space-y-4">{children}</div>}
    </div>
  );
}

/* ─── MAIN ──────────────────────────────────────────────────────────────────── */

export default function FiatWithdrawal() {
  const [form, setForm] = useState({
    uid: '', currency: '', method: '', amount: '', orderId: '', errorCode: '', errorMsg: '', fullName: '', appealId: '',
  });
  const [inquiryType, setInquiryType] = useState('');
  const [orderStatus, setOrderStatus] = useState('');
  const [reqChecks, setReqChecks] = useState({});
  const [scenario, setScenario] = useState('');
  const [riskStatus, setRiskStatus] = useState('');
  const [timeStatus, setTimeStatus] = useState('');
  const [errorType, setErrorType] = useState('');
  const [restrictionStatus, setRestrictionStatus] = useState('');
  const [refundCredited, setRefundCredited] = useState('');
  const [copied, setCopied] = useState(null);

  function updateForm(field, val) { setForm(p => ({ ...p, [field]: val })); }
  function copy(text, key) { navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 2000); }
  function resetAll() {
    if (!confirm('Reset this workflow?')) return;
    setForm({ uid: '', currency: '', method: '', amount: '', orderId: '', errorCode: '', errorMsg: '', fullName: '', appealId: '' });
    setInquiryType(''); setOrderStatus(''); setReqChecks({}); setScenario(''); setRiskStatus(''); setTimeStatus(''); setErrorType(''); setRestrictionStatus(''); setRefundCredited('');
  }

  const allReqsPassed = WITHDRAWAL_REQUIREMENTS.every(r => reqChecks[r.key]);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-fg-0">💶 Fiat Withdrawal</h1>
          <p className="text-sm text-fg-2">Guided SOP for fiat withdrawal inquiries</p>
        </div>
        <button onClick={resetAll} className="flex items-center gap-1 text-xs text-fg-2 hover:text-crit transition-colors duration-150 cursor-pointer" aria-label="Reset fiat withdrawal form">
          <RotateCcw size={13} /> Reset
        </button>
      </div>

      {/* Important notes */}
      <Alert color="orange" icon={AlertTriangle} title="Important Notes">
        <ul className="space-y-0.5 ml-3 list-disc">
          <li>Once a fiat withdrawal order is placed, it <strong className="text-warn">CANNOT be cancelled</strong></li>
          <li>RU/BY users: only RUB withdrawals. NG users: only NGN withdrawals</li>
          <li>Remark field is <strong className="text-warn">mandatory</strong> for Level 4</li>
        </ul>
      </Alert>

      {/* Case info */}
      <Section title="Case Information">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="fw-uid" className="text-xs text-fg-2 mb-1 block">UID</label>
            <input id="fw-uid" value={form.uid} onChange={e => updateForm('uid', e.target.value)} placeholder="Customer UID"
              className="w-full bg-bg-2 border border-border-0 focus:border-hero/50 rounded-lg px-3 py-2 text-sm text-fg-0 placeholder-fg-3 outline-none" />
          </div>
          <div>
            <label htmlFor="fw-currency" className="text-xs text-fg-2 mb-1 block">Fiat Currency</label>
            <input id="fw-currency" value={form.currency} onChange={e => updateForm('currency', e.target.value)} placeholder="e.g. EUR, USD, GBP"
              className="w-full bg-bg-2 border border-border-0 focus:border-hero/50 rounded-lg px-3 py-2 text-sm text-fg-0 placeholder-fg-3 outline-none" />
          </div>
          <div>
            <label htmlFor="fw-method" className="text-xs text-fg-2 mb-1 block">Payment Method</label>
            <input id="fw-method" value={form.method} onChange={e => updateForm('method', e.target.value)} placeholder="e.g. SEPA, Bank Transfer"
              className="w-full bg-bg-2 border border-border-0 focus:border-hero/50 rounded-lg px-3 py-2 text-sm text-fg-0 placeholder-fg-3 outline-none" />
          </div>
          <div>
            <label htmlFor="fw-amount" className="text-xs text-fg-2 mb-1 block">Amount</label>
            <input id="fw-amount" value={form.amount} onChange={e => updateForm('amount', e.target.value)} placeholder="Withdrawal amount"
              className="w-full bg-bg-2 border border-border-0 focus:border-hero/50 rounded-lg px-3 py-2 text-sm text-fg-0 placeholder-fg-3 outline-none" />
          </div>
          <div>
            <label htmlFor="fw-orderid" className="text-xs text-fg-2 mb-1 block">Order ID</label>
            <input id="fw-orderid" value={form.orderId} onChange={e => updateForm('orderId', e.target.value)} placeholder="If order created"
              className="w-full bg-bg-2 border border-border-0 focus:border-hero/50 rounded-lg px-3 py-2 text-sm text-fg-0 placeholder-fg-3 outline-none" />
          </div>
          <div>
            <label htmlFor="fw-error" className="text-xs text-fg-2 mb-1 block">Error Code / Message</label>
            <input id="fw-error" value={form.errorCode} onChange={e => updateForm('errorCode', e.target.value)} placeholder="If any"
              className="w-full bg-bg-2 border border-border-0 focus:border-hero/50 rounded-lg px-3 py-2 text-sm text-fg-0 placeholder-fg-3 outline-none" />
          </div>
        </div>
      </Section>

      {/* Inquiry type */}
      <Section title="Inquiry Type">
        <div className="grid grid-cols-1 gap-2">
          <OptionBtn selected={inquiryType === 'unable'} onClick={() => { setInquiryType('unable'); setOrderStatus(''); setScenario(''); setRiskStatus(''); setTimeStatus(''); setErrorType(''); }}>
            <span className="font-semibold">A</span> Unable to Place Withdrawal Order
          </OptionBtn>
          <OptionBtn selected={inquiryType === 'not_received'} onClick={() => { setInquiryType('not_received'); setScenario(''); setRiskStatus(''); setTimeStatus(''); setErrorType(''); }}>
            <span className="font-semibold">B</span> Fiat Withdrawal Order Not Received
          </OptionBtn>
          <OptionBtn selected={inquiryType === 'other'} onClick={() => { setInquiryType('other'); setOrderStatus(''); setScenario(''); }}>
            <span className="font-semibold">C</span> Other Fiat Withdrawal Issues (Refund)
          </OptionBtn>
        </div>
      </Section>

      {/* ═══ (A) Unable to Place Order ════════════════════════════════════ */}
      {inquiryType === 'unable' && (
        <>
          <Section title="A — Check Withdrawal Requirements">
            <div className="space-y-3">
              <p className="text-xs text-fg-1">Check CS:GO for each requirement. All must pass before proceeding.</p>
              <div className="space-y-2">
                {WITHDRAWAL_REQUIREMENTS.map(r => (
                  <button key={r.key} onClick={() => setReqChecks(p => ({ ...p, [r.key]: !p[r.key] }))} className="flex items-center gap-3 w-full text-left cursor-pointer group" aria-label={`Toggle: ${r.label}`}>
                    {reqChecks[r.key]
                      ? <CheckCircle2 size={16} className="text-ok shrink-0" />
                      : <Circle size={16} className="text-fg-2 group-hover:text-fg-1 shrink-0" />}
                    <span className={cn('text-sm', reqChecks[r.key] ? 'text-fg-2 line-through' : 'text-fg-1')}>{r.label}</span>
                  </button>
                ))}
              </div>
              {!allReqsPassed && (
                <p className="text-xs text-warn">If any requirement fails, advise user to complete it before proceeding.</p>
              )}
              {allReqsPassed && (
                <Alert color="green" icon={CheckCircle2} title="All requirements passed">
                  <p>If user needs general guidance, use QT fw01-en-fiat-withdrawal-guide or ET 4806.</p>
                  <p className="mt-1">For error messages, select the appropriate scenario below.</p>
                </Alert>
              )}
            </div>
          </Section>

          {allReqsPassed && (
            <Section title="A — Error Scenario">
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-2">
                  <OptionBtn selected={scenario === '1.1'} onClick={() => { setScenario('1.1'); setRiskStatus(''); setTimeStatus(''); }}>
                    <div>
                      <p className="font-medium">Scenario 1.1: Withdrawal Account Pending Verification</p>
                      <p className="text-xs text-fg-2">Risk order type = WithdrawBindCard / "Please wait while your account information is being verified"</p>
                    </div>
                  </OptionBtn>
                  <OptionBtn selected={scenario === '1.2'} onClick={() => { setScenario('1.2'); }}>
                    <div>
                      <p className="font-medium">Scenario 1.2: Suspicious Activity Alert</p>
                      <p className="text-xs text-fg-2">"Risk reject, contact CS" or "Risk reject, try again after 2 hours"</p>
                    </div>
                  </OptionBtn>
                </div>

                {/* Scenario 1.1 */}
                {scenario === '1.1' && (
                  <div className="bg-bg-2/50 rounded-xl p-4 space-y-3">
                    <p className="text-xs text-fg-1">Check CS:GO &gt; User Profile &gt; Funding &gt; Risk Order &gt; Type = WithdrawBindCard</p>
                    <p className="text-xs text-fg-2">Case Type: E03 Fiat Transactions &gt; Fiat Withdrawal &gt; Fiat Withdrawal Verification</p>
                    <div className="grid grid-cols-1 gap-2">
                      {RISK_ORDER_STATUSES.map(s => (
                        <OptionBtn key={s.key} selected={riskStatus === s.key} onClick={() => setRiskStatus(s.key)}>
                          <div className="flex-1">
                            <p className="font-medium">{s.label}</p>
                            <p className="text-xs text-fg-2">{s.action} — QT {s.qt} / ET {s.et}</p>
                          </div>
                        </OptionBtn>
                      ))}
                    </div>

                    {riskStatus === 'under_review' && (
                      <div className="space-y-2">
                        <p className="text-xs text-fg-1">Is the review within or exceeded 2 business days?</p>
                        <div className="grid grid-cols-2 gap-2">
                          <OptionBtn selected={timeStatus === 'within'} onClick={() => setTimeStatus('within')}>Within 2 BD</OptionBtn>
                          <OptionBtn selected={timeStatus === 'exceeded'} onClick={() => setTimeStatus('exceeded')}>Exceeded 2 BD</OptionBtn>
                        </div>
                        {timeStatus === 'within' && (
                          <Alert color="blue" icon={Clock} title="Within Processing Time">
                            <p>Inform user review is in progress (up to 2 business days). Use QT fd02 Option 2 / ET 4855 Option 2.</p>
                          </Alert>
                        )}
                        {timeStatus === 'exceeded' && (
                          <>
                            <Alert color="red" icon={AlertTriangle} title="Exceeded — Escalate to P2">
                              <p>Use QT a06-en-email-follow-up, then run Macro Pool 1 &gt; Pool 2</p>
                            </Alert>
                            <TemplateBlock title="Escalation Note" text={TEMPLATES.escalation_risk_submission(form.uid, form.appealId)} copyKey="esc-risk-sub" copied={copied} onCopy={copy} />
                          </>
                        )}
                      </div>
                    )}

                    {riskStatus && riskStatus !== 'under_review' && (
                      <Alert color="blue" icon={CheckCircle2} title={`Action: ${RISK_ORDER_STATUSES.find(s => s.key === riskStatus)?.action}`}>
                        <p>No risk order record? Escalate to P2 for further investigation.</p>
                      </Alert>
                    )}
                  </div>
                )}

                {/* Scenario 1.2 */}
                {scenario === '1.2' && (
                  <div className="bg-bg-2/50 rounded-xl p-4 space-y-3">
                    <p className="text-xs text-fg-1">Check if UID is found in the Lark Suspicious Activity group.</p>
                    <p className="text-xs text-fg-2">Case Type: E01 Account Matters &gt; Security Issue &gt; Suspicious Alert</p>
                    <div className="grid grid-cols-2 gap-2">
                      <OptionBtn selected={scenario === '1.2' && timeStatus === 'found'} onClick={() => setTimeStatus('found')}>UID Found in Group</OptionBtn>
                      <OptionBtn selected={scenario === '1.2' && timeStatus === 'not_found'} onClick={() => setTimeStatus('not_found')}>UID Not Found</OptionBtn>
                    </div>
                    {timeStatus === 'found' && (
                      <>
                        <Alert color="red" icon={AlertTriangle} title="UID Found — Escalate to P2">
                          <p>Run QT a06-en-email-follow-up, then Macro Pool 1 &gt; Pool 2</p>
                        </Alert>
                        <TemplateBlock title="Escalation Note" text={TEMPLATES.escalation_suspicious(form.uid)} copyKey="esc-suspicious" copied={copied} onCopy={copy} />
                      </>
                    )}
                    {timeStatus === 'not_found' && (
                      <Alert color="blue" icon={ArrowRight} title="UID Not Found — Refer to Scenario 3 (Failed Withdrawal)">
                        <p>Treat as a failed withdrawal. Check the Failed order path below.</p>
                      </Alert>
                    )}
                  </div>
                )}
              </div>
            </Section>
          )}
        </>
      )}

      {/* ═══ (B) Order Not Received ═══════════════════════════════════════ */}
      {inquiryType === 'not_received' && (
        <>
          <Section title="B — Check Order Status in CS:GO">
            <div className="space-y-3">
              <p className="text-xs text-fg-1">CS:GO &gt; User Profile &gt; Funding &gt; Fiat Withdrawal &gt; Order ID</p>
              <div className="grid grid-cols-1 gap-2">
                {ORDER_STATUSES.map(s => (
                  <OptionBtn key={s.key} selected={orderStatus === s.key} onClick={() => { setOrderStatus(s.key); setScenario(s.scenario); setErrorType(''); setTimeStatus(''); setRestrictionStatus(''); setRefundCredited(''); }}>
                    <span className="font-medium">{s.label}</span>
                  </OptionBtn>
                ))}
              </div>
            </div>
          </Section>

          {/* Scenario 2: Processing */}
          {scenario === 'processing' && (
            <Section title="Scenario 2 — Order Processing">
              <div className="space-y-3">
                <p className="text-xs text-fg-1">Verify withdrawal method via CS:GO &gt; User Profile &gt; Funding &gt; Fiat Withdrawal &gt; UpdateTime</p>
                <p className="text-xs text-fg-2">Case Type: E03 Fiat Transactions &gt; Fiat Withdrawal &gt; Fiat Withdrawal Guidance (or Pending)</p>
                <div className="grid grid-cols-2 gap-2">
                  <OptionBtn selected={timeStatus === 'within'} onClick={() => setTimeStatus('within')}>Within Processing Time</OptionBtn>
                  <OptionBtn selected={timeStatus === 'exceeded'} onClick={() => setTimeStatus('exceeded')}>Exceeded Processing Time</OptionBtn>
                </div>
                {timeStatus === 'within' && (
                  <>
                    <Alert color="green" icon={Clock} title="Within Processing Time">
                      <p>Inform user withdrawal is still being processed. Advise to wait and monitor.</p>
                    </Alert>
                    <TemplateBlock title="QT fw02 Option 1 — Within Processing Time" text={TEMPLATES.qt_order_within_time} copyKey="qt-within" copied={copied} onCopy={copy} hint="Live Chat: QT fw02-en-order-status (Option 1) / Email: ET 4805" />
                  </>
                )}
                {timeStatus === 'exceeded' && (
                  <>
                    <Alert color="red" icon={AlertTriangle} title="Exceeded — Escalate to P2">
                      <p>Use QT a06-en-email-follow-up, then run Macro Pool 1 &gt; Pool 2</p>
                    </Alert>
                    <TemplateBlock title="Escalation Note" text={TEMPLATES.escalation_processing(form.uid, form.orderId, '')} copyKey="esc-processing" copied={copied} onCopy={copy} />
                  </>
                )}
              </div>
            </Section>
          )}

          {/* Scenario 3: Failed */}
          {scenario === 'failed' && (
            <Section title="Scenario 3 — Failed Withdrawal">
              <div className="space-y-3">
                <p className="text-xs text-fg-1">CS:GO &gt; User Profile &gt; Status — Check for any account restrictions</p>
                <p className="text-xs text-fg-2">Case Type: E03 Fiat Transactions &gt; Fiat Withdrawal &gt; Fiat Withdrawal Failed</p>

                <div className="grid grid-cols-2 gap-2">
                  <OptionBtn selected={restrictionStatus === 'none'} onClick={() => { setRestrictionStatus('none'); setErrorType(''); }}>No Restriction</OptionBtn>
                  <OptionBtn selected={restrictionStatus === 'found'} onClick={() => { setRestrictionStatus('found'); setErrorType(''); }}>Restriction Found</OptionBtn>
                </div>

                {restrictionStatus === 'found' && (
                  <Alert color="orange" icon={AlertTriangle} title="Account Restriction Found">
                    <p>Based on Reason/Remarks, proceed to the respective SOP (Suspicious Alert, AML/Compliance, Wrong Transfer, P2P restriction, or Hacked Account).</p>
                  </Alert>
                )}

                {restrictionStatus === 'none' && (
                  <div className="space-y-3">
                    <p className="text-xs text-fg-1">Check the error code from CS:GO (hover over "!" icon on failed status).</p>
                    <div className="grid grid-cols-1 gap-2">
                      <OptionBtn selected={errorType === 'non_3'} onClick={() => setErrorType('non_3')}>
                        <div>
                          <p className="font-medium">Error code NOT starting with 3</p>
                          <p className="text-xs text-fg-2">Check FAQ for known error codes</p>
                        </div>
                      </OptionBtn>
                      <OptionBtn selected={errorType === '300300001'} onClick={() => setErrorType('300300001')}>
                        <div>
                          <p className="font-medium">Error 300300001 — Fiat Risk Control</p>
                          <p className="text-xs text-fg-2">User triggered fiat risk control, documents required</p>
                        </div>
                      </OptionBtn>
                      <OptionBtn selected={errorType === '300370101'} onClick={() => setErrorType('300370101')}>
                        <div>
                          <p className="font-medium">Error 300370101 — 24h Security Restriction</p>
                          <p className="text-xs text-fg-2">24-hour restriction due to security settings change</p>
                        </div>
                      </OptionBtn>
                      <OptionBtn selected={errorType === 'other_3'} onClick={() => setErrorType('other_3')}>
                        <div>
                          <p className="font-medium">Other 3XXXXXXX Error Codes</p>
                          <p className="text-xs text-fg-2">Escalate to P2 directly</p>
                        </div>
                      </OptionBtn>
                    </div>

                    {errorType === 'non_3' && (
                      <div className="space-y-2">
                        <Alert color="blue" icon={CheckCircle2} title="Check FAQ for Known Error Codes">
                          <p>Look up the error code in FAQ. If found, advise accordingly.</p>
                          <p>If error shows MORE than 3 times in CS:GO, escalate to P2.</p>
                          <p>If NOT found in FAQ, escalate to P2.</p>
                        </Alert>
                        <TemplateBlock title="Escalation Note (Multiple Failures)" text={TEMPLATES.escalation_failed_multiple(form.uid, form.orderId, form.errorCode)} copyKey="esc-multi-fail" copied={copied} onCopy={copy} />
                        <TemplateBlock title="Escalation Note (Unknown Error)" text={TEMPLATES.escalation_failed_unknown(form.uid, form.orderId, form.errorCode)} copyKey="esc-unknown-fail" copied={copied} onCopy={copy} />
                      </div>
                    )}

                    {errorType === '300300001' && (
                      <div className="space-y-3">
                        <Alert color="yellow" icon={AlertTriangle} title="Fiat Risk Control Triggered">
                          <p>Case Type: E03 &gt; Fiat Withdrawal &gt; Fiat Withdrawal Risk Trigger</p>
                          <p className="mt-1">Check these Lark groups in order:</p>
                          <ol className="list-decimal ml-4 space-y-0.5 mt-1">
                            <li>Fiat High Risk - Triggered</li>
                            <li>Fiat High Risk - Reviewing (documents submitted)</li>
                            <li>Fiat High Risk - Result (review complete)</li>
                          </ol>
                        </Alert>

                        <div>
                          <label htmlFor="fw-appeal" className="text-xs text-fg-2 mb-1 block">Appeal ID (from Lark group)</label>
                          <input id="fw-appeal" value={form.appealId} onChange={e => updateForm('appealId', e.target.value)} placeholder="Appeal ID"
                            className="w-full bg-bg-2 border border-border-0 focus:border-hero/50 rounded-lg px-3 py-2 text-sm text-fg-0 placeholder-fg-3 outline-none" />
                        </div>

                        <p className="text-xs text-fg-1">Select the risk status from CS:GO Risk Order:</p>
                        <div className="grid grid-cols-1 gap-2">
                          {RISK_ORDER_STATUSES.map(s => (
                            <OptionBtn key={s.key} selected={riskStatus === s.key} onClick={() => { setRiskStatus(s.key); setTimeStatus(''); }}>
                              <div className="flex-1">
                                <p className="font-medium">{s.label}</p>
                                <p className="text-xs text-fg-2">{s.action}</p>
                              </div>
                            </OptionBtn>
                          ))}
                          <OptionBtn selected={riskStatus === 'expired'} onClick={() => { setRiskStatus('expired'); setTimeStatus(''); }}>
                            <div className="flex-1">
                              <p className="font-medium">Expired</p>
                              <p className="text-xs text-fg-2">Advise user to retry fiat withdrawal (may trigger new risk control)</p>
                            </div>
                          </OptionBtn>
                        </div>

                        {riskStatus === 'pending_submission' && (
                          <Alert color="blue" icon={ArrowRight} title="Pending Submission">
                            <p>Advise user to submit documents via Support Hub. QT fd02 Option 1 / ET 4855 Option 1</p>
                          </Alert>
                        )}
                        {riskStatus === 'under_review' && (
                          <div className="space-y-2">
                            <p className="text-xs text-fg-1">Check trigger time — within or exceeded 2 business days?</p>
                            <div className="grid grid-cols-2 gap-2">
                              <OptionBtn selected={timeStatus === 'within'} onClick={() => setTimeStatus('within')}>Within 2 BD</OptionBtn>
                              <OptionBtn selected={timeStatus === 'exceeded'} onClick={() => setTimeStatus('exceeded')}>Exceeded 2 BD</OptionBtn>
                            </div>
                            {timeStatus === 'within' && (
                              <Alert color="blue" icon={Clock} title="Within Review Time">
                                <p>Advise user to wait patiently. QT fd02 Option 2 / ET 4855 Option 2</p>
                              </Alert>
                            )}
                            {timeStatus === 'exceeded' && (
                              <>
                                <Alert color="red" icon={AlertTriangle} title="Exceeded — Escalate to P2" />
                                <TemplateBlock title="Escalation Note" text={TEMPLATES.escalation_risk_review_exceeded(form.uid, form.appealId)} copyKey="esc-risk-exceeded" copied={copied} onCopy={copy} />
                              </>
                            )}
                          </div>
                        )}
                        {riskStatus === 'pending_resubmission' && (
                          <Alert color="orange" icon={ArrowRight} title="Pending Resubmission">
                            <p>Guide user to Support Hub to resubmit. QT fd02 Option 3 / ET 4855 Option 3</p>
                          </Alert>
                        )}
                        {riskStatus === 'approved' && (
                          <Alert color="green" icon={CheckCircle2} title="Approved">
                            <p>Inform user verification successful, proceed with new order. QT fd02 Option 6 / ET 4855 Option 6</p>
                          </Alert>
                        )}
                        {riskStatus === 'rejected' && (
                          <Alert color="blue" icon={ArrowRight} title="Rejected (Refuse)">
                            <p>User may retry, but no guarantee. QT fd02 Option 7 / ET 4855 Option 7</p>
                          </Alert>
                        )}
                        {riskStatus === 'expired' && (
                          <>
                            <Alert color="orange" icon={Clock} title="Expired — Retry Withdrawal">
                              <p>Advise user to retry fiat withdrawal. May trigger new risk control. QT fd02 Option 5 / ET 4855 Option 5</p>
                              <p>If user fails again after 2nd submission, escalate to P2.</p>
                            </Alert>
                            <TemplateBlock title="Escalation Note (if still failing)" text={TEMPLATES.escalation_risk_expired(form.uid, form.appealId)} copyKey="esc-risk-expired" copied={copied} onCopy={copy} />
                          </>
                        )}
                      </div>
                    )}

                    {errorType === '300370101' && (
                      <div className="space-y-2">
                        <Alert color="orange" icon={Clock} title="24-Hour Security Restriction">
                          <p>Check CS:GO &gt; User Profile &gt; Status for BAN IMPOSED vs NORMAL</p>
                        </Alert>
                        <div className="grid grid-cols-2 gap-2">
                          <OptionBtn selected={timeStatus === 'ban_imposed'} onClick={() => setTimeStatus('ban_imposed')}>BAN IMPOSED (with expiry)</OptionBtn>
                          <OptionBtn selected={timeStatus === 'normal'} onClick={() => setTimeStatus('normal')}>NORMAL — Escalate P2</OptionBtn>
                        </div>
                        {timeStatus === 'ban_imposed' && (
                          <Alert color="blue" icon={Clock} title="24h Ban — Advise Retry After Expiry">
                            <p>The ban is related to security settings change. Check ExpiryTime in CS:GO. Advise user to retry after expiry. ET 4852</p>
                          </Alert>
                        )}
                        {timeStatus === 'normal' && (
                          <>
                            <Alert color="red" icon={AlertTriangle} title="Account Normal but Error Persists — Escalate P2" />
                            <TemplateBlock title="Escalation Note" text={TEMPLATES.escalation_24h_ban(form.uid, form.orderId, '300370101')} copyKey="esc-24h" copied={copied} onCopy={copy} />
                          </>
                        )}
                      </div>
                    )}

                    {errorType === 'other_3' && (
                      <>
                        <Alert color="red" icon={AlertTriangle} title="Other 3XXXXXXX Code — Escalate to P2">
                          <p>Run QT a06-en-email-follow-up, then Macro Pool 1 &gt; Pool 2</p>
                        </Alert>
                        <TemplateBlock title="Escalation Note" text={TEMPLATES.escalation_3x_code(form.uid, form.orderId, form.errorCode)} copyKey="esc-3x" copied={copied} onCopy={copy} />
                      </>
                    )}
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Scenario 4: Success but not received */}
          {scenario === 'success_not_received' && (
            <Section title="Scenario 4 — Success but Funds Not Received">
              <div className="space-y-3">
                <p className="text-xs text-fg-2">Case Type: E03 Fiat Transactions &gt; Fiat Withdrawal &gt; Unreceived Fiat Withdrawal</p>
                <Alert color="red" icon={AlertTriangle} title="Escalate to P2 — Collect Information First">
                  <p>Obtain fiat withdrawal details and escalate. Use QT a06-en-email-follow-up, then Macro Pool 1 &gt; Pool 2. Apply ET 4803.</p>
                </Alert>
                <div>
                  <label htmlFor="fw-fullname" className="text-xs text-fg-2 mb-1 block">Full Name (as per KYC)</label>
                  <input id="fw-fullname" value={form.fullName} onChange={e => updateForm('fullName', e.target.value)} placeholder="Customer full name"
                    className="w-full bg-bg-2 border border-border-0 focus:border-hero/50 rounded-lg px-3 py-2 text-sm text-fg-0 placeholder-fg-3 outline-none" />
                </div>
                <TemplateBlock title="Escalation Note" text={TEMPLATES.escalation_success_not_received(form.uid, form.orderId, form.amount, form.currency, form.fullName)} copyKey="esc-success" copied={copied} onCopy={copy} />
              </div>
            </Section>
          )}

          {/* Scenario 5: Refund from order status */}
          {scenario === 'refund' && (
            <Section title="Scenario 5 — Refund Not Reflected">
              <div className="space-y-3">
                <p className="text-xs text-fg-2">Case Type: E03 Fiat Transactions &gt; Fiat Withdrawal &gt; Fiat Withdrawal Reversal</p>
                <p className="text-xs text-fg-1">Verify if refund has been credited to user's Bybit Funding Account.</p>
                <div className="grid grid-cols-2 gap-2">
                  <OptionBtn selected={refundCredited === 'yes'} onClick={() => setRefundCredited('yes')}>Refund Credited</OptionBtn>
                  <OptionBtn selected={refundCredited === 'no'} onClick={() => setRefundCredited('no')}>Refund NOT Credited</OptionBtn>
                </div>
                {refundCredited === 'yes' && (
                  <>
                    <Alert color="green" icon={CheckCircle2} title="Refund Processed">
                      <p>Inform user funds are in their Funding Account.</p>
                    </Alert>
                    <TemplateBlock title="QT fw02 Option 2 — Refund Processed" text={TEMPLATES.qt_refund_processed} copyKey="qt-refund" copied={copied} onCopy={copy} />
                  </>
                )}
                {refundCredited === 'no' && (
                  <>
                    <Alert color="red" icon={AlertTriangle} title="Refund Missing — Escalate to P2">
                      <p>Run Macro Pool 1 &gt; Pool 2</p>
                    </Alert>
                    <TemplateBlock title="Escalation Note" text={TEMPLATES.escalation_refund(form.uid, form.orderId)} copyKey="esc-refund" copied={copied} onCopy={copy} />
                  </>
                )}
              </div>
            </Section>
          )}
        </>
      )}

      {/* ═══ (C) Other — Refund ═══════════════════════════════════════════ */}
      {inquiryType === 'other' && (
        <Section title="C — Refund Not Reflected in Account">
          <div className="space-y-3">
            <p className="text-xs text-fg-2">Case Type: E03 Fiat Transactions &gt; Fiat Withdrawal &gt; Fiat Withdrawal Reversal</p>
            <p className="text-xs text-fg-1">Check if refund has been credited to Bybit Funding Account.</p>
            <div className="grid grid-cols-2 gap-2">
              <OptionBtn selected={refundCredited === 'yes'} onClick={() => setRefundCredited('yes')}>Refund Credited</OptionBtn>
              <OptionBtn selected={refundCredited === 'no'} onClick={() => setRefundCredited('no')}>Refund NOT Credited</OptionBtn>
            </div>
            {refundCredited === 'yes' && (
              <>
                <Alert color="green" icon={CheckCircle2} title="Refund Processed">
                  <p>Inform user funds are in Funding Account.</p>
                </Alert>
                <TemplateBlock title="QT fw02 Option 2" text={TEMPLATES.qt_refund_processed} copyKey="qt-refund-c" copied={copied} onCopy={copy} />
              </>
            )}
            {refundCredited === 'no' && (
              <>
                <Alert color="red" icon={AlertTriangle} title="Refund Missing — Escalate to P2" />
                <TemplateBlock title="Escalation Note" text={TEMPLATES.escalation_refund(form.uid, form.orderId)} copyKey="esc-refund-c" copied={copied} onCopy={copy} />
              </>
            )}
          </div>
        </Section>
      )}

      {/* ─── Level 4 Fields Reminder ─────────────────────────────────────── */}
      {inquiryType && (
        <div className="bg-bg-2/50 border border-border-0 rounded-xl px-4 py-3 space-y-2">
          <p className="text-xs font-semibold text-fg-1">Level 4 Fields (Mandatory)</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <span className="text-fg-2">Fiat Currency:</span><span className="text-fg-1">{form.currency || '[from CS:GO]'}</span>
            <span className="text-fg-2">Amount:</span><span className="text-fg-1">{form.amount || '[from CS:GO]'}</span>
            <span className="text-fg-2">Payment Method:</span><span className="text-fg-1">{form.method || '[from CS:GO]'}</span>
            <span className="text-fg-2">Withdrawal Status:</span><span className="text-fg-1">{orderStatus ? ORDER_STATUSES.find(s => s.key === orderStatus)?.label.split(' ')[0] : '[from CS:GO]'}</span>
            <span className="text-fg-2">Withdrawal Date:</span><span className="text-fg-1">[Initiated Date and Time]</span>
            <span className="text-fg-2">Order ID:</span><span className="text-fg-1">{form.orderId || '[from CS:GO]'}</span>
            <span className="text-fg-2">Fiat Channel:</span><span className="text-fg-1">[from CS:GO]</span>
          </div>
        </div>
      )}

      {/* ─── QuickText Reference ─────────────────────────────────────────── */}
      {inquiryType && (
        <Section title="Quick Reference — Templates" defaultOpen={false}>
          <div className="space-y-3">
            <TemplateBlock title="QT a06 — Follow-up" text={TEMPLATES.qt_follow_up} copyKey="qt-followup" copied={copied} onCopy={copy} />
            <TemplateBlock title="QT fw02 Option 1 — Within Processing Time" text={TEMPLATES.qt_order_within_time} copyKey="qt-within-ref" copied={copied} onCopy={copy} />
            <TemplateBlock title="QT fw02 Option 2 — Refund Processed" text={TEMPLATES.qt_refund_processed} copyKey="qt-refund-ref" copied={copied} onCopy={copy} />
          </div>
        </Section>
      )}
    </div>
  );
}
