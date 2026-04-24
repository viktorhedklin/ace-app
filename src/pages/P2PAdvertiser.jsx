import { useState, useMemo } from 'react';
import { Copy, Check, ChevronDown, ChevronUp, ArrowLeft, CheckCircle2, AlertTriangle, ExternalLink, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';
import { hasAnyApiKey } from '@/api/claude';
import WorkflowChat from '@/components/WorkflowChat';

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS & DATA
   ═══════════════════════════════════════════════════════════════ */

const SCENARIOS = [
  { id: 'payment',    name: 'Payment Method',    icon: '💳', desc: 'Adding, editing, troubleshooting payment methods' },
  { id: 'nickname',   name: 'Nickname',           icon: '✏️', desc: 'Set or change P2P nickname' },
  { id: 'reviews',    name: 'Reviews',            icon: '⭐', desc: 'Leave, edit, delete, or remove reviews' },
  { id: 'history',    name: 'Export Order History',icon: '📋', desc: 'Download P2P order records' },
  { id: 'chatdata',   name: 'Export Chat Data',   icon: '💬', desc: 'Access P2P order chat messages' },
  { id: 'receipt',    name: 'Order Receipt',      icon: '🧾', desc: 'Generate & download receipts' },
  { id: 'advertiser', name: 'Advertiser Status',  icon: '🏆', desc: 'General, Verified, or Block Advertiser' },
];

const GENERAL_REQ = [
  { label: 'Linked mobile number', key: 'mobile' },
  { label: 'Linked email address', key: 'email' },
  { label: 'Passed KYC Level 1 (Individual)', key: 'kyc' },
  { label: 'Registered ≥ 30 days', key: 'regDays', input: true, suffix: 'days', min: 30 },
  { label: 'Completed Orders ≥ 10', key: 'orders', input: true, suffix: 'orders', min: 10 },
  { label: '30-Day Completion Rate ≥ 90%', key: 'rate', input: true, suffix: '%', min: 90 },
];

const CASE_TYPES = {
  payment: 'E05-P2P > P2P Trading > Payment Method Issue',
  nickname: 'E05-P2P > P2P Trading > Profile Page',
  reviews: 'E05-P2P > P2P Trading > Profile Page',
  history: 'E05-P2P > P2P Trading > Export Order Info',
  chatdata: 'E05-P2P > P2P Trading > Export Order Info',
  receipt: 'E05-P2P > P2P Trading > Export Order Info',
  advertiser: 'E05-P2P > P2P Advertise > Advertiser Application',
};

const QT_FOLLOWUP = `Regarding your inquiry, it will need to be escalated for further checking. Please allow our team some time to check and we will update you again via email within 24 hours weekdays /48 hours weekends. Thank you for your understanding and sorry for any inconvenience caused.`;

const ESCALATION_NOTE = (uid, oid, summary, extra = '') =>
`UID: ${uid || '[INPUT UID]'}
${oid ? `OID: ${oid}\n` : ''}Summary: ${summary || '[Brief description]'}
${extra}
— Use Macro Pool 1 to Pool 2`;

/* ═══ EMAIL TEMPLATES ═══ */

const ET = {
  G2401: { code: 'G2401', title: 'Payment method guide (mismatch)', body: `Dear Trader,

Thank you for contacting Bybit Customer Support.

We understand that you have already added the payment method successfully, but you are still unable to select the payment method you have added when you try placing a sell order in P2P.

Please allow us to explain that this is because the payment method you have added does not match the advertisement you have selected. To resolve the issue, filter the advertisement according to the payment method you added. When creating sell orders in P2P, you can only trade with buyers who accepted the same payment method.

We hope that answers your inquiry. Please do not hesitate to contact us again should you require any assistance.

With warmest regards,
Bybit Support | Help Center` },

  G2402: { code: 'G2402', title: 'Payment method not supported', body: `Dear Trader,

Thank you for contacting Bybit Customer Support.

We understand that you are unable to find the specific payment method that you desire. Not all payment methods are available to all traders. The availability varies based on your IP, profile information, risk level, and the coin type you are trading with. We suggest choosing other alternative payment methods available on the list.

Your request has been recorded and we will escalate your feedback to the product team. Alternatively, you may input your feedback via the official link.

With warmest regards,
Bybit Support | Help Center` },

  G2403: { code: 'G2403', title: 'Third-party payment not allowed', body: `Dear Trader,

Thank you for contacting Bybit Customer Support.

We regret to inform you that adding a payment method in another person's name or using a third-party bank account is not allowed. According to P2P Terms of User Service, it is mandatory to use your own personal bank account for all P2P transactions. The name associated with any payment method must match your identity verification.

You may also try other deposit and withdrawal methods, such as One-Click Buy, Fiat Deposit/Withdrawal, and Crypto Deposits/Withdrawals.

With warmest regards,
Bybit | Customer Support | Help Center` },

  G2404: { code: 'G2404', title: 'KYC name language issue', body: `Dear Trader,

Thank you for contacting Bybit Customer Support.

We understand your KYC information is currently in a different language from the payment method you intend to add. The P2P trading system retrieves the KYC name directly from your verification documents.

To resolve this, we recommend updating your KYC information with your international passport to include an English version of your name. Once updated, proceed to your P2P User Center to add your payment method and select the backup name.

With warmest regards,
Bybit Support | Help Center` },

  G2101: { code: 'G2101', title: 'Change nickname — request info', body: `Dear Trader,

Thank you for using Bybit P2P Trading.

We have received your request to change your P2P nickname. Every P2P trader is only allowed to modify the nickname once. Before we proceed, please provide:
1. A valid reason for changing your P2P nickname.
2. At least 3 nickname options (max 15 characters each).

The review may take up to 3-5 business days.

With warmest regards,
Bybit | Customer Support | Help Center` },

  G2201: { code: 'G2201', title: 'Remove reviews — request info', body: `Dear Trader,

Thank you for using Bybit P2P Trading.

We have received your concern regarding a review on your profile. Please provide:
1. P2P Order ID
2. A screenshot of the review
3. The reason for the review removal
4. Screenshots or other evidence supporting your claim

The review process may take up to 3-5 business days.

With warmest regards,
Bybit | Customer Support | Help Center` },

  G2504: { code: 'G2504', title: 'Download order receipt guide', body: `Dear Trader,

Thank you for using Bybit P2P Trading.

You can generate and download the P2P order receipt:
1. Visit P2P Order history page
2. Click "All", filter to "Completed", locate the order
3. Click "Receipt" to generate
4. Click "Preview" to download PDF

Notes: Receipts only for Completed orders via website. Max 10 daily. Download link valid for 7 days.

With warmest regards,
Bybit | Customer Support | Help Center` },

  G3111: { code: 'G3111', title: 'General advertiser guide / upgrade', body: `Dear Trader,

Thank you for supporting Bybit P2P Trading.

Our P2P advertiser consists of 3 levels: Beginner, Regular, and Veteran. Each has different requirements and benefits. Upon meeting requirements, users are automatically upgraded. If requirements are no longer met, users are automatically downgraded.

If you confirm you meet the requirements but were not upgraded, please provide a screenshot:
WEB: P2P User Center → "More Data" → Screenshot
APP: P2P User Center → "More Data" → Screenshot

With warmest regards,
Bybit | Customer Support | Help Center` },

  G3211: { code: 'G3211', title: 'Verified advertiser guide', body: `Dear Trader,

Thank you for supporting Bybit P2P Trading.

You may refer to the P2P Advertiser Program page for Verified Advertiser requirements. Once you meet the basic requirements, submit your application for review. The result depends on the review by our relevant team.

With warmest regards,
Bybit | Customer Support | Help Center` },

  G3210: { code: 'G3210', title: 'Verified application under review', body: `Dear Trader,

Thank you for supporting Bybit P2P Trading.

Your Verified Advertiser application is still under review. The process may take up to 15 business days. Please wait patiently for the review result via your registered email.

With warmest regards,
Bybit | Customer Support | Help Center` },

  G3213: { code: 'G3213', title: 'VA application rejected', body: `Dear Trader,

Thank you for using Bybit P2P Trading.

Unfortunately, your Verified Advertiser application has been rejected based on the review of your documents and profile. Common reasons include: incomplete/inaccurate documentation, low completed orders/volume, insufficient or low-resolution documents.

You are welcome to resubmit your application. The review may take up to 15 business days.

With warmest regards,
Bybit Support | Help Center` },

  G3214: { code: 'G3214', title: 'VA status cancellation reasons', body: `Dear Trader,

Thank you for using Bybit P2P Trading.

Your Verified Advertiser status has been cancelled as you no longer fulfill the minimum requirements. For detailed information, consult your dedicated P2P Country Manager.

You may reapply 7 days after cancellation when you meet requirements again. Review takes up to 15 business days.

With warmest regards,
Bybit Support | Help Center` },
};

const HC_LINKS = [
  { label: 'How to Add a Payment Method', url: 'https://www.bybit.com/en/help-center/article/How-to-Add-a-Payment-Method' },
  { label: 'P2P Review Feature', url: 'https://www.bybit.com/en/help-center/article/P2P-Review' },
  { label: 'How to Post a Trade Ad', url: 'https://www.bybit.com/en/help-center/article/How-to-Post-P2P-Ad' },
  { label: 'P2P Advertiser Requirements', url: 'https://www.bybit.com/en/help-center/article/P2P-Advertiser-Requirements' },
  { label: 'Security Deposit in P2P', url: 'https://www.bybit.com/en/help-center/article/P2P-Security-Deposit' },
  { label: 'FAQ — P2P Advertisers', url: 'https://www.bybit.com/en/help-center/article/FAQ-P2P-Advertisers' },
];

/* ═══════════════════════════════════════════════════════════════
   SHARED COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

function CopyBtn({ text }) {
  const [ok, setOk] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 2000); }}
      className="text-fg-2 hover:text-hero transition-colors cursor-pointer" aria-label="Copy">
      {ok ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

function TemplateCard({ et }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-bg-2/50 rounded-lg overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-bg-2 transition-colors cursor-pointer">
        <span className="text-xs font-medium text-fg-1"><span className="text-hero/80 mr-1.5">{et.code}</span>{et.title}</span>
        <div className="flex items-center gap-2">
          <CopyBtn text={et.body} />
          {open ? <ChevronUp size={12} className="text-fg-2" /> : <ChevronDown size={12} className="text-fg-2" />}
        </div>
      </button>
      {open && <pre className="px-3 pb-3 text-xs text-fg-1 whitespace-pre-wrap leading-relaxed border-t border-border-0/50 pt-2">{et.body}</pre>}
    </div>
  );
}

function StepCard({ title, steps, caseType, escalation, template, children }) {
  return (
    <div className="bg-bg-2/40 border border-border-0/50 rounded-xl p-4 space-y-3">
      {title && <h4 className="text-sm font-semibold text-fg-0">{title}</h4>}
      {steps && (
        <ol className="space-y-1.5 text-xs text-fg-1 leading-relaxed">
          {steps.map((s, i) => <li key={i} className="flex gap-2"><span className="text-hero/70 shrink-0">{i + 1}.</span><span>{s}</span></li>)}
        </ol>
      )}
      {caseType && (
        <div className="flex items-center gap-2 text-xs">
          <ClipboardList size={12} className="text-info shrink-0" />
          <span className="text-fg-2">Case type:</span>
          <span className="text-info font-mono text-xs">{caseType}</span>
          <CopyBtn text={caseType} />
        </div>
      )}
      {escalation && (
        <div className="bg-crit/10 border border-crit/20 rounded-lg p-3 space-y-2">
          <p className="text-xs font-medium text-crit">Escalation Required</p>
          <pre className="text-xs text-fg-1 whitespace-pre-wrap">{escalation}</pre>
          <CopyBtn text={escalation} />
        </div>
      )}
      {template && <TemplateCard et={template} />}
      {children}
    </div>
  );
}

function BackBtn({ onClick }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 text-xs text-fg-2 hover:text-hero transition-colors mb-4 cursor-pointer">
      <ArrowLeft size={13} /> Back to scenarios
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SCENARIO FLOWS
   ═══════════════════════════════════════════════════════════════ */

function PaymentFlow({ onBack }) {
  const [sub, setSub] = useState(null);
  const subs = [
    { id: 'guide', label: 'General guide (add payment method)' },
    { id: 'mismatch', label: "Can't see payment method during trading" },
    { id: 'unsupported', label: 'Preferred payment method unavailable' },
    { id: 'name', label: "Can't edit name (KYC name)" },
    { id: 'third', label: 'Third-party payment method' },
    { id: 'language', label: 'KYC name language mismatch' },
  ];

  return (
    <div>
      <BackBtn onClick={onBack} />
      <h3 className="text-sm font-bold text-fg-0 mb-3">💳 Payment Method Issues</h3>

      {!sub && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {subs.map(s => (
            <button key={s.id} onClick={() => setSub(s.id)}
              className="text-left bg-bg-2/50 border border-border-0/50 hover:border-hero/30 rounded-lg px-3 py-2.5 text-xs text-fg-1 hover:text-fg-0 transition-all cursor-pointer">
              {s.label}
            </button>
          ))}
        </div>
      )}

      {sub === 'guide' && (
        <StepCard title="General Guide — Adding a Payment Method"
          steps={['Go to P2P User Center → Payment Method → "Add now"', 'Enter required information in the pop-up window', 'Payment name is auto-filled from KYC — cannot be edited', 'Only own personal bank accounts allowed (P2P Terms of Service)']}
          caseType={CASE_TYPES.payment} template={ET.G2401} />
      )}
      {sub === 'mismatch' && (
        <StepCard title="Payment Method Not Visible During Trading"
          steps={['Explain: payment method does not match the selected advertisement', 'Advise user to filter ads by their added payment method', 'When selling, only buyers with the same accepted payment method can trade', 'Payment method type must match word-by-word (e.g., "XYZ Bank" ≠ "Bank Transfer")']}
          caseType={CASE_TYPES.payment} template={ET.G2401} />
      )}
      {sub === 'unsupported' && (
        <StepCard title="Preferred Payment Method Unavailable"
          steps={['Not all payment methods are available to all traders', 'Availability depends on: IP, profile, risk level, coin type', 'Recommend selecting another supported payment method', 'User can submit feedback via official link for future addition']}
          caseType={CASE_TYPES.payment} template={ET.G2402} />
      )}
      {sub === 'name' && (
        <StepCard title="Cannot Edit Name on Payment Method"
          steps={['P2P system retrieves KYC name from verification documents', 'Name cannot be manually changed — it must match KYC', 'Mandatory to use own personal bank account (P2P Terms of Service)', 'If names don\'t match, user must update KYC or use matching account']}
          caseType={CASE_TYPES.payment} />
      )}
      {sub === 'third' && (
        <StepCard title="Third-Party Payment Method Not Allowed"
          steps={['Third-party bank accounts are strictly prohibited', 'Engaging in this may result in P2P service restrictions', 'Payment name must match KYC identity verification', 'Suggest alternative methods: One-Click Buy, Fiat Deposit/Withdrawal, Crypto']}
          caseType={CASE_TYPES.payment} template={ET.G2403} />
      )}
      {sub === 'language' && (
        <StepCard title="KYC Name Language Mismatch"
          steps={['System retrieves name in the language of the KYC document', 'Recommend updating KYC with international passport (English name)', 'After update: go to P2P User Center → add payment method → select backup name', 'Meanwhile, user can use One-Click Buy, Fiat, or Crypto methods']}
          caseType={CASE_TYPES.payment} template={ET.G2404} />
      )}

      {sub && <button onClick={() => setSub(null)} className="mt-3 text-xs text-fg-2 hover:text-fg-1 transition-colors cursor-pointer">← Back to payment issues</button>}
    </div>
  );
}

function NicknameFlow({ onBack }) {
  const [sub, setSub] = useState(null);
  return (
    <div>
      <BackBtn onClick={onBack} />
      <h3 className="text-sm font-bold text-fg-0 mb-3">✏️ Set / Change Nickname</h3>

      {!sub && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button onClick={() => setSub('set')} className="text-left bg-bg-2/50 border border-border-0/50 hover:border-hero/30 rounded-lg px-3 py-2.5 text-xs text-fg-1 hover:text-fg-0 transition-all cursor-pointer">Set nickname (first time)</button>
          <button onClick={() => setSub('change')} className="text-left bg-bg-2/50 border border-border-0/50 hover:border-hero/30 rounded-lg px-3 py-2.5 text-xs text-fg-1 hover:text-fg-0 transition-all cursor-pointer">Change existing nickname</button>
        </div>
      )}

      {sub === 'set' && (
        <StepCard title="Set Nickname (First Time)"
          steps={['Go to P2P User Center → Click "Edit" next to current nickname', 'Enter nickname (max 15 characters)', 'Nickname can only be set once and cannot be modified after']}
          caseType={CASE_TYPES.nickname} />
      )}
      {sub === 'change' && (
        <StepCard title="Change Existing Nickname — Requires Escalation"
          steps={['Inform user: nickname can only be changed once, for security reasons', 'No guarantee of approval — subject to P2P Operation Team review', 'Collect: valid reason + at least 3 nickname options (max 15 chars each)', 'Review takes 3-5 business days']}
          caseType={CASE_TYPES.nickname}
          escalation={ESCALATION_NOTE('', '', 'User requests P2P nickname change', 'Preferred nicknames: [1] ___ [2] ___ [3] ___')}
          template={ET.G2101}>
          <div className="bg-hero/10 border border-hero/20 rounded-lg p-3 mt-2">
            <p className="text-xs text-hero font-medium mb-1">Quicktext — Follow-up</p>
            <p className="text-xs text-fg-1">{QT_FOLLOWUP}</p>
            <div className="mt-1.5"><CopyBtn text={QT_FOLLOWUP} /></div>
          </div>
        </StepCard>
      )}

      {sub && <button onClick={() => setSub(null)} className="mt-3 text-xs text-fg-2 hover:text-fg-1 transition-colors cursor-pointer">← Back</button>}
    </div>
  );
}

function ReviewFlow({ onBack }) {
  const [sub, setSub] = useState(null);
  return (
    <div>
      <BackBtn onClick={onBack} />
      <h3 className="text-sm font-bold text-fg-0 mb-3">⭐ Review Management</h3>

      {!sub && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { id: 'leave', label: 'How to leave a review' },
            { id: 'edit', label: 'Edit / delete own review' },
            { id: 'remove', label: 'Request removal of negative review' },
          ].map(s => (
            <button key={s.id} onClick={() => setSub(s.id)}
              className="text-left bg-bg-2/50 border border-border-0/50 hover:border-hero/30 rounded-lg px-3 py-2.5 text-xs text-fg-1 hover:text-fg-0 transition-all cursor-pointer">
              {s.label}
            </button>
          ))}
        </div>
      )}

      {sub === 'leave' && (
        <StepCard title="Leaving a Review"
          steps={['Only 1 review per Completed order (no reviews for cancelled)', 'Go to P2P Order history → All → filter "Completed"', 'Locate order → click Order ID → "Leave a Review" section', 'If leaving negative review, must explain dissatisfaction']}
          caseType={CASE_TYPES.reviews} />
      )}
      {sub === 'edit' && (
        <StepCard title="Edit / Delete Own Review"
          steps={['Go to P2P Order history → All → filter "Completed"', 'Locate order → click Order ID → "My Ratings" section', 'Click edit button to modify or delete button to remove']}
          caseType={CASE_TYPES.reviews} />
      )}
      {sub === 'remove' && (
        <StepCard title="Request Negative Review Removal — Requires Escalation"
          steps={['Only false, insulting, or malicious reviews can be deleted', 'No guarantee — subject to P2P Operation Team approval', 'Collect: Order ID, screenshot of review, reason, supporting evidence', 'Review takes 3-5 business days']}
          caseType={CASE_TYPES.reviews}
          escalation={ESCALATION_NOTE('', '[ORDER ID]', 'User requests removal of negative P2P review', 'Screenshots/Supporting materials: [attach]')}
          template={ET.G2201}>
          <div className="bg-hero/10 border border-hero/20 rounded-lg p-3 mt-2">
            <p className="text-xs text-hero font-medium mb-1">Quicktext — Follow-up</p>
            <p className="text-xs text-fg-1">{QT_FOLLOWUP}</p>
            <div className="mt-1.5"><CopyBtn text={QT_FOLLOWUP} /></div>
          </div>
        </StepCard>
      )}

      {sub && <button onClick={() => setSub(null)} className="mt-3 text-xs text-fg-2 hover:text-fg-1 transition-colors cursor-pointer">← Back</button>}
    </div>
  );
}

function HistoryFlow({ onBack }) {
  const [sub, setSub] = useState(null);
  return (
    <div>
      <BackBtn onClick={onBack} />
      <h3 className="text-sm font-bold text-fg-0 mb-3">📋 Export Order History</h3>

      {!sub && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button onClick={() => setSub('guide')} className="text-left bg-bg-2/50 border border-border-0/50 hover:border-hero/30 rounded-lg px-3 py-2.5 text-xs text-fg-1 hover:text-fg-0 transition-all cursor-pointer">General guide (self-service)</button>
          <button onClick={() => setSub('banned')} className="text-left bg-bg-2/50 border border-border-0/50 hover:border-hero/30 rounded-lg px-3 py-2.5 text-xs text-fg-1 hover:text-fg-0 transition-all cursor-pointer">Login banned / restricted user</button>
        </div>
      )}

      {sub === 'guide' && (
        <StepCard title="Self-Service Export"
          steps={['Go to P2P Order history → All', 'Select desired time period (max 3 months per request)', 'Click "Export" — only available via Bybit website', 'Max 10 requests per day — 24h cooldown if limit reached']}
          caseType={CASE_TYPES.history} />
      )}
      {sub === 'banned' && (
        <StepCard title="Login Banned / Service Restricted User — Requires Escalation"
          steps={['User cannot self-export due to account restriction', 'Collect: exact timeframe of order history needed', 'Escalate to Pool 2 for manual export']}
          caseType={CASE_TYPES.history}
          escalation={ESCALATION_NOTE('', '', 'Login banned/restricted user requests P2P order history export', 'Timeframe: [requested period]')}>
          <div className="bg-hero/10 border border-hero/20 rounded-lg p-3 mt-2">
            <p className="text-xs text-hero font-medium mb-1">Quicktext — Follow-up</p>
            <p className="text-xs text-fg-1">{QT_FOLLOWUP}</p>
            <div className="mt-1.5"><CopyBtn text={QT_FOLLOWUP} /></div>
          </div>
        </StepCard>
      )}

      {sub && <button onClick={() => setSub(null)} className="mt-3 text-xs text-fg-2 hover:text-fg-1 transition-colors cursor-pointer">← Back</button>}
    </div>
  );
}

function ChatDataFlow({ onBack }) {
  const [sub, setSub] = useState(null);
  return (
    <div>
      <BackBtn onClick={onBack} />
      <h3 className="text-sm font-bold text-fg-0 mb-3">💬 Export Chat Data</h3>
      <p className="text-xs text-fg-2 mb-3">Users can access chats for orders created within the last 180 days via app or website.</p>

      {!sub && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button onClick={() => setSub('guide')} className="text-left bg-bg-2/50 border border-border-0/50 hover:border-hero/30 rounded-lg px-3 py-2.5 text-xs text-fg-1 hover:text-fg-0 transition-all cursor-pointer">Within 180 days (self-service)</button>
          <button onClick={() => setSub('old')} className="text-left bg-bg-2/50 border border-border-0/50 hover:border-hero/30 rounded-lg px-3 py-2.5 text-xs text-fg-1 hover:text-fg-0 transition-all cursor-pointer">Order older than 180 days</button>
        </div>
      )}

      {sub === 'guide' && (
        <StepCard title="Self-Service (Within 180 Days)"
          steps={['Go to P2P Order history → All', 'Locate the order → open the order chat box', 'Available on both Bybit app and website']}
          caseType={CASE_TYPES.chatdata} />
      )}
      {sub === 'old' && (
        <StepCard title="Order > 180 Days — Requires Escalation"
          steps={['Chat data no longer accessible by user', 'Collect: Order ID', 'Escalate to Pool 2 for retrieval']}
          caseType={CASE_TYPES.chatdata}
          escalation={ESCALATION_NOTE('', '[ORDER ID]', 'User requests P2P chat data for order older than 180 days')}>
          <div className="bg-hero/10 border border-hero/20 rounded-lg p-3 mt-2">
            <p className="text-xs text-hero font-medium mb-1">Quicktext — Follow-up</p>
            <p className="text-xs text-fg-1">{QT_FOLLOWUP}</p>
            <div className="mt-1.5"><CopyBtn text={QT_FOLLOWUP} /></div>
          </div>
        </StepCard>
      )}

      {sub && <button onClick={() => setSub(null)} className="mt-3 text-xs text-fg-2 hover:text-fg-1 transition-colors cursor-pointer">← Back</button>}
    </div>
  );
}

function ReceiptFlow({ onBack }) {
  return (
    <div>
      <BackBtn onClick={onBack} />
      <h3 className="text-sm font-bold text-fg-0 mb-3">🧾 Download Order Receipt</h3>
      <StepCard title="Self-Service Guide"
        steps={[
          'Go to P2P Order history → All → filter "Completed"',
          'Locate order → click "Receipt" to generate',
          'Click "Preview" to download PDF',
          'Check export history via "Export Task" — link valid 7 days',
          'Only Completed orders, only via website',
          'Max 10 receipts/day, max 10 downloads per receipt',
        ]}
        caseType={CASE_TYPES.receipt} template={ET.G2504} />
    </div>
  );
}

/* ═══ ADVERTISER STATUS FLOW ═══ */

function AdvertiserFlow({ onBack }) {
  const [type, setType] = useState(null);
  const [sub, setSub] = useState(null);
  const [reqData, setReqData] = useState({ mobile: false, email: false, kyc: false, regDays: '', orders: '', rate: '' });

  const reqResults = useMemo(() => {
    if (type !== 'general' || sub !== 'not_upgraded') return null;
    return GENERAL_REQ.map(r => {
      if (r.input) {
        const val = parseFloat(reqData[r.key]);
        return { ...r, met: !isNaN(val) && val >= r.min, value: reqData[r.key] };
      }
      return { ...r, met: reqData[r.key] };
    });
  }, [type, sub, reqData]);

  const types = [
    { id: 'general', label: 'General Advertiser', desc: 'Beginner · Regular · Veteran', deposit: 'None / 1,000 USDT (if high-risk flagged)' },
    { id: 'verified', label: 'Verified Advertiser', desc: '500 USDT deposit · 15 biz day review', deposit: '500 USDT' },
    { id: 'block', label: 'Block Advertiser', desc: '50K/100K USDT deposit · 7 biz day review', deposit: '50,000–100,000 USDT' },
  ];

  const generalSubs = [
    { id: 'cant_trade', label: "Can't trade — doesn't meet requirements" },
    { id: 'not_upgraded', label: 'Level not upgraded / downgraded' },
    { id: 'cant_post', label: "Can't post ads (high-risk flagged)" },
    { id: 'unfreeze', label: 'Unfreeze 1,000 USDT deposit' },
  ];

  const verifiedSubs = [
    { id: 'cant_apply', label: "Can't apply — requirements not met" },
    { id: 'cancelled_recent', label: 'Status cancelled < 7 days ago' },
    { id: 'chasing', label: 'Chasing application progress' },
    { id: 'rejected', label: 'Application rejected' },
    { id: 'lost_status', label: 'Lost Verified status' },
    { id: 'unfreeze_v', label: 'Unfreeze 500 USDT deposit' },
  ];

  const blockSubs = [
    { id: 'cant_apply_b', label: "Can't apply — requirements not met" },
    { id: 'chasing_b', label: 'Chasing application progress' },
    { id: 'rejected_b', label: 'Application rejected' },
    { id: 'unfreeze_b', label: 'Unfreeze deposit' },
  ];

  function renderGeneralSub() {
    if (sub === 'cant_trade') return (
      <StepCard title="Cannot Trade — Does Not Meet General Requirements"
        steps={['Direct user to P2P Advertiser Program page to check eligibility', 'Basic requirements: mobile + email linked, KYC L1, 30 days registered, 10+ orders, 90%+ completion rate', 'If user confirms they meet requirements → request screenshot of account data', 'WEB: P2P User Center → "More Data" → Screenshot', 'APP: P2P User Center → "More Data" → Screenshot']}
        caseType={CASE_TYPES.advertiser}
        escalation={ESCALATION_NOTE('', '', 'User claims to meet General Advertiser requirements but cannot trade', 'Screenshots: [attach account data]')}
        template={ET.G3111} />
    );
    if (sub === 'not_upgraded') return (
      <div className="space-y-4">
        <StepCard title="Level Not Upgraded / Downgraded"
          steps={['Level is based on cumulative counterparties + last 30-day trading volume', 'Upgrade is automatic when requirements are met', 'Downgrade is automatic when requirements are no longer met', 'If user confirms they meet requirements → collect screenshot for investigation']}
          caseType={CASE_TYPES.advertiser} template={ET.G3111} />

        <div className="bg-bg-2/40 border border-border-0/50 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-hero mb-3">Requirement Checker</h4>
          <p className="text-xs text-fg-2 mb-3">Input the user's data from their P2P User Center screenshot:</p>
          <div className="space-y-2">
            {GENERAL_REQ.map(r => (
              <div key={r.key} className="flex items-center gap-3">
                {r.input ? (
                  <>
                    <input type="number" placeholder={r.label} value={reqData[r.key]}
                      onChange={e => setReqData(p => ({ ...p, [r.key]: e.target.value }))}
                      className="flex-1 bg-bg-1 border border-border-0 focus:border-hero/50 rounded-lg px-3 py-1.5 text-xs text-fg-0 outline-none transition-colors" />
                    <span className="text-xs text-fg-2 w-12">{r.suffix}</span>
                  </>
                ) : (
                  <label className="flex items-center gap-2 flex-1 cursor-pointer">
                    <input type="checkbox" checked={reqData[r.key]}
                      onChange={e => setReqData(p => ({ ...p, [r.key]: e.target.checked }))}
                      className="rounded border-border-1 bg-bg-1 text-hero focus:ring-hero/50" />
                    <span className="text-xs text-fg-1">{r.label}</span>
                  </label>
                )}
              </div>
            ))}
          </div>

          {reqResults && reqResults.some(r => r.value !== '' || r.met) && (
            <div className="mt-4 space-y-1.5">
              <p className="text-xs font-medium text-fg-1 mb-2">Assessment:</p>
              {reqResults.map(r => (
                <div key={r.key} className="flex items-center gap-2 text-xs">
                  {r.met
                    ? <CheckCircle2 size={13} className="text-ok shrink-0" />
                    : <AlertTriangle size={13} className="text-crit shrink-0" />}
                  <span className={r.met ? 'text-ok' : 'text-crit'}>
                    {r.label} {r.input && r.value ? `— ${r.value}${r.suffix}` : ''}
                    {!r.met && r.input && r.value ? ` (need ≥ ${r.min})` : ''}
                  </span>
                </div>
              ))}
              {reqResults.every(r => r.met) && (
                <div className="bg-ok/10 border border-ok/20 rounded-lg p-2 mt-2">
                  <p className="text-xs text-ok">All requirements met — if user is still not upgraded, escalate to Pool 2 with screenshot.</p>
                </div>
              )}
              {reqResults.some(r => !r.met) && reqResults.some(r => r.value !== '' || r.met) && (
                <div className="bg-crit/10 border border-crit/20 rounded-lg p-2 mt-2">
                  <p className="text-xs text-crit">User does not meet all requirements. Inform them which criteria are not fulfilled.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
    if (sub === 'cant_post') return (
      <StepCard title="Cannot Post Ads — High-Risk Advertiser Flagged"
        steps={['User can trade (taker) but cannot post advertisements', 'Account flagged as High-Risk Advertiser', 'Verify in CS-go: Funding → Risk Order → Type: MarginFrozenHighRisk', 'User must submit supporting documents for Risk Review', 'User must deposit 1,000 USDT as security deposit', 'Refer to SOP E05 — P2P Restriction (Scenario 12: High Risk Advertiser)']}
        caseType={CASE_TYPES.advertiser} />
    );
    if (sub === 'unfreeze') return (
      <StepCard title="Unfreeze 1,000 USDT Security Deposit"
        steps={['Warn: unfreezing forfeits privilege to publish P2P advertisements', 'Submit unfreeze request from Security Deposit page', 'Common blockers: unsolved disputes, ongoing orders, high-risk flag', 'If issues: request screenshot/video of error → escalate to Pool 2']}
        caseType={CASE_TYPES.advertiser}
        escalation={ESCALATION_NOTE('', '', 'User unable to unfreeze P2P security deposit (1000 USDT)', 'Account Status:\nBan Remark (if any):\nScreenshot/video of error:')} />
    );
    return null;
  }

  function renderVerifiedSub() {
    if (sub === 'cant_apply') return (
      <StepCard title="Cannot Apply — Requirements Not Met"
        steps={['Must have General Advertiser status first', 'Need 500 USDT available in Funding Account', 'Check P2P Advertiser Program page for specific eligibility', 'If eligible: "Apply Now" button → submit documents for review', 'If not: "Currently Ineligible" button shown with unmet requirements']}
        caseType={CASE_TYPES.advertiser} template={ET.G3211} />
    );
    if (sub === 'cancelled_recent') return (
      <StepCard title="Status Cancelled < 7 Days Ago"
        steps={['User can reapply ≥ 7 days after cancellation', 'Must meet all requirements again at time of reapplication', 'New application will be re-evaluated from scratch', 'Review takes up to 15 business days', 'Result sent via account-registered email']}
        caseType={CASE_TYPES.advertiser} />
    );
    if (sub === 'chasing') return (
      <StepCard title="Chasing Verified Advertiser Application"
        steps={['Standard review: up to 15 business days (= 21 calendar days)', 'If applied within 21 days: inform still under review, wait for email', 'If applied > 21 days ago: escalate to Pool 2']}
        caseType={CASE_TYPES.advertiser} template={ET.G3210}>
        <div className="bg-warn/10 border border-warn/20 rounded-lg p-3 mt-2">
          <p className="text-xs text-warn font-medium">Check: When did the user apply?</p>
          <p className="text-xs text-fg-1 mt-1">Within 21 days → Send ET G3210 (under review)</p>
          <p className="text-xs text-fg-1">Over 21 days → Escalate to Pool 2</p>
        </div>
      </StepCard>
    );
    if (sub === 'rejected') return (
      <StepCard title="Verified Application Rejected"
        steps={['Decision based on documents + profile evaluation', 'Common reasons: incomplete docs, low orders/volume, low-res files', 'User may reapply with better documentation', 'New review takes up to 15 business days']}
        caseType={CASE_TYPES.advertiser} template={ET.G3213} />
    );
    if (sub === 'lost_status') return (
      <StepCard title="Lost Verified Advertiser Status"
        steps={['Cancellation = no longer fulfills minimum requirements', 'Direct user to their P2P Country Manager for details', 'Can reapply ≥ 7 days after cancellation', 'New review takes up to 15 business days']}
        caseType={CASE_TYPES.advertiser} template={ET.G3214} />
    );
    if (sub === 'unfreeze_v') return (
      <StepCard title="Unfreeze 500 USDT Verified Deposit"
        steps={['Warn: unfreezing loses Verified Advertiser status and benefits', '500 USDT auto-released if user applied for cancellation', 'If not released: may have ongoing dispute — resolve first', 'If still frozen after cancellation: escalate to Pool 2']}
        caseType={CASE_TYPES.advertiser}
        escalation={ESCALATION_NOTE('', '', 'Verified Advertiser deposit (500 USDT) not released after status cancellation')} />
    );
    return null;
  }

  function renderBlockSub() {
    if (sub === 'cant_apply_b') return (
      <StepCard title="Cannot Apply — Block Advertiser Requirements Not Met"
        steps={['Requires KYC Level 2 (Individual) or KYB (Business)', 'Deposit: 50,000 USDT (Individual) or 100,000 USDT (Business)', 'Check P2P Advertiser Program page for eligibility', 'If eligible: "Apply Now" → submit documents', 'If not: "Currently Ineligible" shown']}
        caseType={CASE_TYPES.advertiser} />
    );
    if (sub === 'chasing_b') return (
      <StepCard title="Chasing Block Advertiser Application"
        steps={['Standard review: up to 7 business days', 'If within timeframe: inform still under review', 'If over 7 business days: escalate to Pool 2']}
        caseType={CASE_TYPES.advertiser}
        escalation={ESCALATION_NOTE('', '', 'Block Advertiser application pending > 7 business days')} />
    );
    if (sub === 'rejected_b') return (
      <StepCard title="Block Advertiser Application Rejected"
        steps={['Decision based on documents and profile', 'Common reasons: incomplete docs, poor P2P performance, insufficient balance', 'User may reapply with updated documentation', 'New review takes up to 3 business days']}
        caseType={CASE_TYPES.advertiser} />
    );
    if (sub === 'unfreeze_b') return (
      <StepCard title="Unfreeze Block Advertiser Deposit"
        steps={['Warn: unfreezing loses Block Advertiser status and benefits', 'Submit unfreeze request on Block Advertiser page', 'If deposit not released: may have ongoing dispute', 'If issues: request screenshot/video → escalate to Pool 2']}
        caseType={CASE_TYPES.advertiser}
        escalation={ESCALATION_NOTE('', '', 'Block Advertiser unable to unfreeze security deposit', 'Screenshot/video of error:')} />
    );
    return null;
  }

  return (
    <div>
      <BackBtn onClick={onBack} />
      <h3 className="text-sm font-bold text-fg-0 mb-3">🏆 Advertiser Status</h3>

      {/* Level 1: Advertiser type */}
      {!type && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {types.map(t => (
            <button key={t.id} onClick={() => { setType(t.id); setSub(null); }}
              className="text-left bg-bg-2/50 border border-border-0/50 hover:border-hero/30 rounded-xl p-4 transition-all cursor-pointer">
              <h4 className="text-sm font-semibold text-fg-0">{t.label}</h4>
              <p className="text-xs text-fg-2 mt-1">{t.desc}</p>
              <p className="text-xs text-fg-2 mt-2">Deposit: {t.deposit}</p>
            </button>
          ))}
        </div>
      )}

      {/* Level 2: Sub-scenario */}
      {type && !sub && (
        <div>
          <button onClick={() => setType(null)} className="text-xs text-fg-2 hover:text-fg-1 transition-colors mb-3 cursor-pointer">
            ← Back to advertiser types
          </button>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(type === 'general' ? generalSubs : type === 'verified' ? verifiedSubs : blockSubs).map(s => (
              <button key={s.id} onClick={() => setSub(s.id)}
                className="text-left bg-bg-2/50 border border-border-0/50 hover:border-hero/30 rounded-lg px-3 py-2.5 text-xs text-fg-1 hover:text-fg-0 transition-all cursor-pointer">
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Level 3: Content */}
      {type && sub && (
        <div>
          <button onClick={() => setSub(null)} className="text-xs text-fg-2 hover:text-fg-1 transition-colors mb-3 cursor-pointer">
            ← Back to {type === 'general' ? 'General' : type === 'verified' ? 'Verified' : 'Block'} scenarios
          </button>
          {type === 'general' && renderGeneralSub()}
          {type === 'verified' && renderVerifiedSub()}
          {type === 'block' && renderBlockSub()}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export default function P2PAdvertiser() {
  const [scenario, setScenario] = useState(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showLinks, setShowLinks] = useState(false);

  const chatContext = () => {
    const sc = scenario ? SCENARIOS.find(s => s.id === scenario) : null;
    return `You are ACE, helping a Bybit support agent with a P2P Trading & Advertise inquiry.

CURRENT WORKFLOW: ${sc ? `${sc.name} — ${sc.desc}` : 'No scenario selected yet'}

SOP CONTEXT:
- P2P escalations go to the designated P2P Lark group only (not shift groups)
- Case expedition via Lark form in the P2P group
- Follow-up QT: "Regarding your inquiry, it will need to be escalated for further checking. Please allow our team some time to check and we will update you again via email within 24 hours weekdays /48 hours weekends."
- Pool 1 → Pool 2 escalation via Salesforce internal note
- P2P nickname can only be set once
- Third-party payment methods are prohibited
- General Advertiser: 3 levels (Beginner/Regular/Veteran), auto-upgrade/downgrade
- Verified Advertiser: 500 USDT deposit, 15 biz day review, reapply after 7 days if cancelled
- Block Advertiser: KYC L2/KYB, 50K-100K USDT deposit, 7 biz day review

INSTRUCTIONS: Answer concisely (2-4 sentences). If the agent asks for a draft reply, write a ready-to-send customer message. If they ask for an escalation note, format it as an internal note template. Be direct — the agent is mid-shift.`;
  };

  const suggestions = scenario === 'advertiser'
    ? ['Draft reply explaining requirements', 'Generate escalation note', 'What deposit amount for this advertiser type?', 'How long is the review process?']
    : ['Draft a reply to the customer', 'Generate escalation note for Pool 2', 'What case type should I use?', 'Explain this scenario to me'];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-fg-0">🤝 P2P Trading & Advertise</h1>
        <p className="text-sm text-fg-2 mt-0.5">SOP-driven workflow · 7 scenarios · Integrated ACE chat</p>
      </div>

      {/* Scenario selector */}
      {!scenario && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {SCENARIOS.map(s => (
            <button key={s.id} onClick={() => setScenario(s.id)}
              className="group text-left bg-bg-1 border border-border-0 hover:border-hero/30 rounded-xl p-3.5 transition-all cursor-pointer">
              <span className="text-xl">{s.icon}</span>
              <h3 className="text-sm font-semibold text-fg-0 mt-2 group-hover:text-hero transition-colors">{s.name}</h3>
              <p className="text-xs text-fg-2 mt-1 leading-relaxed">{s.desc}</p>
            </button>
          ))}
        </div>
      )}

      {/* Active scenario */}
      {scenario === 'payment' && <PaymentFlow onBack={() => setScenario(null)} />}
      {scenario === 'nickname' && <NicknameFlow onBack={() => setScenario(null)} />}
      {scenario === 'reviews' && <ReviewFlow onBack={() => setScenario(null)} />}
      {scenario === 'history' && <HistoryFlow onBack={() => setScenario(null)} />}
      {scenario === 'chatdata' && <ChatDataFlow onBack={() => setScenario(null)} />}
      {scenario === 'receipt' && <ReceiptFlow onBack={() => setScenario(null)} />}
      {scenario === 'advertiser' && <AdvertiserFlow onBack={() => setScenario(null)} />}

      {/* ACE Chat */}
      {scenario && (
        <WorkflowChat
          title="Ask ACE about this P2P case"
          systemContext={chatContext}
          suggestions={suggestions}
          kbDomains={['P2P']}
        />
      )}

      {/* Collapsible: All Email Templates */}
      <div className="bg-bg-1 border border-border-0 rounded-xl overflow-hidden">
        <button onClick={() => setShowTemplates(o => !o)}
          className="w-full flex items-center justify-between px-5 py-3 hover:bg-bg-2/50 transition-colors cursor-pointer">
          <span className="text-sm font-semibold text-fg-0">📨 Email Templates ({Object.keys(ET).length})</span>
          {showTemplates ? <ChevronUp size={14} className="text-fg-2" /> : <ChevronDown size={14} className="text-fg-2" />}
        </button>
        {showTemplates && (
          <div className="px-4 pb-4 space-y-2">
            {Object.values(ET).map(t => <TemplateCard key={t.code} et={t} />)}
          </div>
        )}
      </div>

      {/* Collapsible: Help Center Links */}
      <div className="bg-bg-1 border border-border-0 rounded-xl overflow-hidden">
        <button onClick={() => setShowLinks(o => !o)}
          className="w-full flex items-center justify-between px-5 py-3 hover:bg-bg-2/50 transition-colors cursor-pointer">
          <span className="text-sm font-semibold text-fg-0">🔗 Help Center Articles ({HC_LINKS.length})</span>
          {showLinks ? <ChevronUp size={14} className="text-fg-2" /> : <ChevronDown size={14} className="text-fg-2" />}
        </button>
        {showLinks && (
          <div className="px-5 pb-4 space-y-1.5">
            {HC_LINKS.map((l, i) => (
              <a key={i} href={l.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-info hover:text-info transition-colors py-1">
                <ExternalLink size={11} className="shrink-0" /> {l.label}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Escalation reminder */}
      <div className="bg-warn/10 border border-warn/20 rounded-xl p-4">
        <h4 className="text-xs font-semibold text-warn mb-1.5">Escalation Protocol</h4>
        <ul className="text-xs text-fg-1 space-y-1">
          <li>P2P escalations → designated P2P Lark group only</li>
          <li>Use Case Expedition Form in Lark group for urgent cases</li>
          <li>Do NOT tag in shift groups — P2P team won't respond there</li>
          <li>Salesforce: adjust case type → internal note → Pool 1 to Pool 2 macro</li>
        </ul>
      </div>
    </div>
  );
}
