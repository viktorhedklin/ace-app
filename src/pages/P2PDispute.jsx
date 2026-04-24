import { useState, useMemo, useEffect } from 'react';
import { Copy, Check, ChevronDown, ChevronUp, ArrowLeft, CheckCircle2, AlertTriangle, ExternalLink, ClipboardList, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { hasAnyApiKey } from '@/api/claude';
import WorkflowChat from '@/components/WorkflowChat';
import { useLocation } from 'react-router-dom';
import { scrubPII } from '@/lib/SecurityModule';

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS & DATA
   ═══════════════════════════════════════════════════════════════ */

const SCENARIOS = [
  { id: 'yellow', name: 'Yellow Alert', icon: '🚨', desc: 'Urgent: scam >$100, impersonation, threats, spam' },
  { id: 'reset', name: 'Reset Appeal Limit', icon: '🔄', desc: 'Appeal chances exhausted (2/2)' },
  { id: 'pending_before', name: 'Before Appeal', icon: '⏳', desc: 'Pending Coin Release — no appeal yet' },
  { id: 'pending_after', name: 'After Appeal', icon: '📋', desc: 'Appeal submitted — check status in SF' },
  { id: 'closed_loss', name: 'Closed + Asset Loss', icon: '💰', desc: 'Completed/Cancelled with asset loss' },
  { id: 'closed_no_loss', name: 'Closed — No Loss', icon: '📝', desc: 'No asset loss but other issues' },
  { id: 'scam', name: 'Scam Reporting', icon: '🕵️', desc: 'Report scams & suspicious behavior' },
  { id: 'risk', name: 'Risk Warning', icon: '⚠️', desc: 'Fraud_P2P_InTransitOrderAnomalies ban' },
];

const CASE_TYPES = {
  buyer: 'E05-P2P > P2P Dispute > With Buyer',
  seller: 'E05-P2P > P2P Dispute > With Seller',
  both: 'E05-P2P > P2P Dispute > With Buyer/With Seller',
  guide: 'E05-P2P > P2P Dispute > User Guide',
  completion: 'E05-P2P > P2P Dispute > Completion Rate',
  trading_guide: 'E05-P2P > P2P Trading > User Guide',
  risk_ban: 'E05-P2P > Risk Control > P2P Ban',
};

/* ═══ APPEAL RULES ═══ */

const APPEAL_RULES = [
  'In Progress or Cancelled/Completed within 5 calendar days → can submit appeal online',
  'Cancelled/Completed > 5 calendar days → must use webform',
  '2 appeal chances max per order',
  'Fast-Track (VA/VIP): within 1 day, 15-min system judgment',
];

/* ═══ APPEAL STATUSES ═══ */

const APPEAL_STATUSES = [
  { status: 'Under Negotiation', sfEquiv: 'Open', desc: 'User just submitted. Negotiation stage lasts 1 hour or until respondent clicks "Negotiation Failed".' },
  { status: 'Pending Verification', sfEquiv: 'Open', desc: 'Appeal submitted. P2P agent has not stepped in yet. If > 20 min, expedite.' },
  { status: 'Verifying', sfEquiv: 'Pending CS Reply', desc: 'User responded in Order Chat Box. Pending P2P agent review.' },
  { status: 'Pending Reply from Traders', sfEquiv: 'Pending Trader Reply', desc: 'P2P agent waiting for trader to reply/provide proof. Auto-cancel if no response.' },
  { status: 'Postponed', sfEquiv: 'Pending Trader Reply', desc: 'Waiting for trader to provide updates/proofs.' },
  { status: 'Onhold for Internal', sfEquiv: 'Onhold', desc: 'P2P agent checking with other departments (risk, operations).' },
  { status: 'Escalate to Type 2', sfEquiv: 'Escalate to Pool 2', desc: 'Complex case, requires more follow-up time.' },
  { status: 'Verification Completed', sfEquiv: 'Solved', desc: 'Appeal has been closed.' },
];

/* ═══ QUICKTEXTS ═══ */

const QT = {
  followup: { code: 'p2pG1-en-email-followup', title: 'Standard escalation follow-up', text: `Regarding your inquiry, it will need to be escalated for further checking. Please allow our team some time to check and we will update you again via email within 24 hours weekdays /48 hours weekends. Thank you for your understanding and sorry for any inconvenience caused.` },

  a06_followup: { code: 'a06-en-email-follow-up', title: 'Email follow-up (appeal limit issues)', text: `Regarding your inquiry, it will need to be escalated for further checking. Please allow our team some time to check and we will update you again via email within 24 hours weekdays /48 hours weekends. Thank you for your understanding and sorry for any inconvenience caused.` },

  buyer_a: { code: 'p2pD1-en-Buyer-a', title: 'Buyer requests faster coin release', text: `Could you please confirm that your fiat transfer has been completed? Some payment methods may not process transfers instantly, so the seller might need time to receive the funds. Please be patient while the payment is being processed.\nIf you've verified that the transfer was successful, do not cancel the order. Instead, communicate with the seller or submit an appeal to our P2P specialists. You can find a detailed guide on how to do so here: How to Submit an Appeal for Your P2P Order.` },

  buyer_b: { code: 'p2pD1-en-Buyer-b', title: 'Buyer overpaid seller', text: `Thank you for bringing this situation to our attention. A quick solution is to place a new order with the same counterparty for the overpaid amount, allowing us to secure an equivalent amount of the coin in the seller's account.\nIf placing a new order isn't feasible, you may submit an appeal following our guide: How to Submit an Appeal for Your P2P Order. Please be aware that recovering the overpaid amount is not guaranteed and depends on the seller's willingness to cooperate.` },

  buyer_c: { code: 'p2pD1-en-Buyer-c', title: 'Seller breaks rules (extra fees, 3rd party)', text: `I'm truly sorry to hear about your negative experience. I understand how frustrating this must be for you. Our suggestion is to request a refund from the seller and consider avoiding future trades with this counterparty. Please DO NOT cancel the order until the refund is secured.\nYou can share refund details with the seller through the P2P Order Chat Box. Make sure to use the same payment details as your initial payment. If the seller remains uncooperative, we urge you to submit an appeal to involve a P2P specialist. You may submit an appeal following our guide: How to Submit an Appeal for Your P2P Order.` },

  seller_a: { code: 'p2pD1-en-Seller-a', title: 'Buyer did not make payment', text: `Before you release any coins, ask the buyer to show you proof they've sent the payment to the correct account. Some payments take longer to go through, so you may not see it in your account right away. Once the buyer gives you proof, you may validate it with your payment service provider to make sure the money has arrived. Please do not release the coin until you're sure the money has been credited to your account.` },

  seller_b: { code: 'p2pD1-en-Seller-b', title: 'Buyer paying less than required', text: `Thank you for bringing this to our attention. Please do not release any coins until you've received the full payment. You have two options:\n1) Discuss with the buyer to complete the remaining payment.\n2) Refund the partial payment you've received and ask the buyer to cancel the order.\nIf the buyer isn't cooperating, you can submit an appeal to involve a P2P appeal specialist. Here's a guide on how to do that: How to Submit an Appeal for Your P2P Order.` },

  seller_c: { code: 'p2pD1-en-Seller-c', title: 'Buyer violated rules (3rd party account)', text: `I'm truly sorry to hear about your negative experience. We understand how frustrating this must be for you. Our recommendation is to refund the buyer and stop trading with the counterparty.\nPlease use the P2P Order Chat Box to request for the refund details and order cancellation from the buyer. If the buyer isn't cooperative or refuses to cancel the order, consider submitting an appeal to involve a P2P appeal specialist. Here's a guide on how to do that: How to Submit an Appeal for Your P2P Order.` },

  seller_d: { code: 'p2pD1-en-Seller-d', title: "Seller's bank frozen after receiving payment", text: `We're genuinely sorry to hear you've encountered this issue and understand it's a frustrating experience. Unfortunately, this situation isn't uncommon in P2P trading. We recommend contacting your bank right away to discuss how to unfreeze the account.\nIf you need any further cooperation from the buyer, reach out to the counterparty through the P2P Order Chat Box. Should your bank be able to reverse the payment, kindly request them to do so.\nIf the buyer isn't cooperative or refuses to cancel the order, consider submitting an appeal to involve a P2P appeal specialist. Here's a guide on how to do that: How to Submit an Appeal for Your P2P Order.` },

  be_patient: { code: 'p2pD2-en-be-patient', title: 'Appeal under review — be patient', text: `Thank you for bringing this to our attention. We understand how urgent this issue is for you. However, our P2P appeal specialists are committed to a thorough review of each case, examining evidence from both parties involved.\nWhile this process does require some time, it's crucial for arriving at a fair resolution. We respectfully ask for your patience as they finalize their assessment, and rest assured, they will be in touch as soon as possible. Thank you for your understanding.` },

  asap: { code: 'p2pD2-en-asap', title: 'Escalated for immediate review', text: `Thank you for bringing this to our attention. We genuinely regret the adverse trading experience you've encountered. We're escalating your case to the relevant team for immediate review. Rest assured, they'll reach out to you as swiftly as possible. Thank you for your understanding.` },

  handle_care: { code: 'p2pD2-en-handle-with-care', title: 'Handle with care (VIP/sensitive)', text: `Thank you for checking in on the status of your case. We understand how important this is for you and appreciate your patience. Our team is actively working to resolve your issue, and we'll update you as soon as we have more information. Your understanding is highly valued as we diligently work towards a solution.` },

  closed_appeal: { code: 'p2pD3-en-P2P-Closed-Order-Appeal', title: 'Closed order — eligible for online appeal', text: `Thank you for bringing this to our attention. According to what we have checked here, this order is eligible to submit an appeal online and request the P2P appeal specialist to get involved. Simply follow this user guide here to proceed further: How to Appeal for Canceled/Completed P2P Orders.` },

  webform: { code: 'p2pD3-en-P2P-Webform', title: 'Closed order — submit via webform', text: `Thank you for bringing this to our attention. We understand how difficult and challenging this must be for you.\nHowever, due to the complexity of your case, we would suggest you submit the case directly to the P2P appeal specialists as they can offer tailored solutions based on your situation. To expedite the process, please gather all supporting documents and submit your case using this form: https://www.bybit.com/en-US/help-center/s/webform?state=187` },

  bank_frozen: { code: 'p2pD4-en-bank-frozen', title: "Seller's bank account frozen", text: `We're truly sorry to hear about the difficulties you're facing with your bank account being frozen. This is a known risk associated with P2P transactions. Unfortunately, as Bybit doesn't have a direct relationship with payment providers, our ability to intervene is limited.\nWe strongly recommend reaching out to your bank as quickly as possible to understand the steps to unfreeze your account. If the bank requires the buyer's supporting documents, you can contact them through the P2P Order Chat Box to request their cooperation. Thank you for your understanding.` },

  third_party: { code: 'p2pD4-en-third-party-payment', title: 'Third-party payment reported', text: `Thank you for bringing this to our attention. It's important to note that third-party payment is not allowed on Bybit, as outlined in our P2P Terms of User Service. Once an order is completed and the coins are released, we can't reverse the transaction.\nFor future transactions, if you find yourself in a similar situation, we strongly advise against completing the order. Instead, you may consider refunding the payment and request an order cancellation from the buyer. If the buyer is uncooperative, you can submit an appeal to engage our P2P appeal specialists for assistance.` },

  verbal_attack: { code: 'p2pD4-en-verbal-attack', title: 'Communication issues / offensive language', text: `We understand that you've had less-than-ideal trading experience and we appreciate your understanding. According to our P2P Terms of User Service, users are expected to interact respectfully and avoid using offensive or abusive language.\nIf you've encountered a trader who doesn't adhere to these guidelines, you have the right to leave a negative review or block them. This helps us maintain a fair and respectful trading environment for everyone. For future trades, consider checking the P2P profile reviews to make a more informed choice of trading partners.` },

  report_user: { code: 'p2pD4-en-report-user', title: 'Report unethical / non-compliant behavior', text: `Thank you for bringing this to our attention. We understand that you've had less-than-ideal trading experience and we appreciate your understanding. Please be assured that Bybit is committed to maintaining a fair trading environment, and we do not condone malicious activities.\nIf you'd like to avoid interacting with this trader in the future, you have the right to leave a negative review or block them. Your feedback will be visible on the user's P2P profile, potentially assisting others on our platform.\nHere's a guide on how to leave a review: P2P Review Feature Guide.` },

  completion_select: { code: 'p2pD4-en-completion-rate-select-reason', title: 'Completion rate — select correct reason', text: `We understand that you would like to appeal for your completion rate as the order needs to be canceled due to the seller's fault. Please be informed that your completion rate will not be affected if you select the correct reason under "seller issue" when canceling the order. You may follow the guide: How to Cancel Your P2P Orders and Manage Your Completion Rate.` },

  completion_reappeal: { code: 'p2pD4-en-completion-rate-reappeal', title: 'Completion rate — re-appeal with evidence', text: `We genuinely regret the adverse trading experience you've encountered. Kindly allow me to escalate your case to the relevant team and review your order cancellation issue again. Please submit the relevant supporting evidence to support your claim. Please ensure that the proof is clear, accurate, and directly related to the appeal reason. The relevant team will get back to you via email within 2 days.` },

  completion_alt: { code: 'p2pD4-en-completion-rate-alternatives', title: 'Completion rate — alternatives to improve', text: `Thank you for bringing this to our attention. Unfortunately, we are unable to assist as you have declared that the order is canceled due to Buyer's reason. Please be reminded to select the correct reason next time so that your completion rate will not be affected.\nHowever, here are alternate ways to improve your completion rate:\n- The completion rate is calculated from the last 30 days. The impact will diminish over time.\n- Complete more successful P2P trades. Review the counterparty's profile carefully before placing orders.` },

  risk_buyer_a: { code: 'p2pD5-en-Buyer-risk-a', title: 'Risk Warning — Buyer paid, wait for auto-cancel', text: `Thank you for bringing this to our attention. If you have already made the payment, please be patient. At this stage, the order will be automatically cancelled within 15–30 minutes, and you won't be able to submit an appeal yet. Once the appeal button becomes available, please prepare and submit an appeal with video proof of payment that clearly shows:\n- Login process to your bank/app (enter password before recording; Face ID/SMS/2FA are fine).\n- Your account details (account name & number).\n- The transaction details (amount, payee name & account, date & time) that match the order.` },

  risk_buyer_b: { code: 'p2pD5-en-Buyer-risk-b', title: 'Risk Warning — Buyer paid, appeal immediately', text: `Thank you for bringing this to our attention. If you've already made the payment, the quickest solution is to submit an appeal immediately and please do not cancel the order. Once the appeal is submitted, the seller's coins will be frozen until the matter is resolved. When submitting your appeal, please prepare a video proof of payment that shows:\n- Login process to your bank/app (enter password before recording; Face ID/SMS/2FA are fine).\n- Your account details (account name & number).\n- The transaction details (amount, payee name & account, date & time) that match the order.` },

  risk_buyer_c: { code: 'p2pD5-en-Buyer-risk-c', title: 'Risk Warning — Buyer no payment, cancel order', text: `Thank you for bringing this to our attention. Since no actual payment was made for this order, you may go ahead and cancel the order directly. You may follow the guide: How to Cancel Your P2P Orders and Manage Your Completion Rate. This will help avoid any delays or unnecessary steps in the process.` },

  risk_seller_d: { code: 'p2pD5-en-Seller-risk-d', title: 'Risk Warning — Seller not received payment', text: `Thank you for bringing this to our attention. If you have not received the payment from the buyer, please submit an appeal immediately with a video proof showing:\n- Your account details page (account number and account name clearly visible).\n- The transaction history page with the page refreshed.\n- All transaction records from the date the order was placed up to today.` },

  risk_patient: { code: 'p2pD5-en-be-patient-risk', title: 'Risk Warning — Appeal submitted, be patient', text: `Thank you for bringing this to our attention. We understand how urgent this issue is for you. However, our P2P appeal specialists are committed to a thorough review of each case, examining evidence from both parties involved. Therefore, please do not cancel the appeal and fully cooperate by providing all necessary proof. Only follow instructions from the official support agent, and do not blindly follow any instructions from the counterparty.\nWhile this process does require some time, it's crucial for arriving at a fair resolution. We respectfully ask for your patience as they finalize their assessment, and rest assured, they will be in touch as soon as possible. Thank you for your understanding.` },

  risk_investigation: { code: 'p2pD5-en-investigation-risk', title: 'Risk Warning — Under investigation (suspected scammer)', text: `Regarding your inquiry, you are currently unable to conduct P2P trading. If you believe there is no scammer behavior on your side, please fully cooperate with our P2P specialist during the investigation of the related P2P order.` },
};

/* ═══ EMAIL TEMPLATES ═══ */

const ET = {
  '1111b': { code: 'ET 1111b', title: 'Request Order ID', body: `Dear Trader,\n\nThank you for contacting Bybit Customer Support.\n\nTo assist you further with your P2P inquiry, please provide us with the following information:\n1. P2P Order ID\n2. Screenshots related to your issue\n\nOnce we receive this information, we will be able to investigate and assist you promptly.\n\nWith warmest regards,\nBybit Support | Help Center` },

  '1111p_opt1': { code: 'ET 1111p (Option 1)', title: 'Ongoing appeal — TPC passed, expedited', body: `Dear Trader,\n\nThank you for contacting Bybit Customer Support.\n\nThank you for bringing your P2P ongoing appeal to our attention. We genuinely regret the adverse trading experience you've encountered. We have escalated your case to the relevant team for immediate review. Rest assured, they'll reach out to you as swiftly as possible. Thank you for your understanding.\n\nWith warmest regards,\nBybit Support | Help Center` },

  '1111p_opt2': { code: 'ET 1111p (Option 2)', title: 'Ongoing appeal — TPC not passed, be patient', body: `Dear Trader,\n\nThank you for contacting Bybit Customer Support.\n\nThank you for bringing your P2P ongoing appeal to our attention. We understand how urgent this issue is for you. However, our P2P appeal specialists are committed to a thorough review of each case, examining evidence from both parties involved.\nWhile this process does require some time, it's crucial for arriving at a fair resolution. We respectfully ask for your patience as they finalize their assessment, and rest assured, they will be in touch as soon as possible. Thank you for your understanding.\n\nWith warmest regards,\nBybit Support | Help Center` },
};

/* ═══ HELP CENTER LINKS ═══ */

const HC_LINKS = [
  { label: 'How to Submit an Appeal for Your P2P Order', url: 'https://www.bybit.com/en/help-center/article/P2P-Appeal' },
  { label: 'P2P Appeal Solutions for Canceled/Completed Orders', url: 'https://www.bybit.com/en/help-center/article/P2P-Closed-Order-Appeal' },
  { label: 'How to Cancel P2P Orders & Manage Completion Rate', url: 'https://www.bybit.com/en/help-center/article/P2P-Cancel-Order' },
  { label: 'How to Avoid Crypto P2P Scams', url: 'https://www.bybit.com/en/help-center/article/P2P-Avoid-Scams' },
  { label: 'P2P Review Feature Guide', url: 'https://www.bybit.com/en/help-center/article/P2P-Review' },
  { label: 'P2P Webform (for orders > 5 days)', url: 'https://www.bybit.com/en-US/help-center/s/webform?state=187' },
];

/* ═══ ESCALATION NOTE HELPER ═══ */

const ESCALATION_NOTE = (uid, oid, summary, extra = '') =>
`UID: ${uid || '[INPUT UID]'}
Order ID: ${oid || '[INPUT ORDER ID]'}
Summary: ${summary || '[Brief description]'}
Screenshot/Recording: ${extra || '[Attach evidence]'}
— Use Macro Pool 1 to Pool 2`;

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

function QTCard({ qt }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-hero/10 border border-hero/20 rounded-lg overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-hero/5 transition-colors cursor-pointer">
        <span className="text-xs font-medium text-hero"><span className="text-hero/80 mr-1.5">{qt.code}</span>{qt.title}</span>
        <div className="flex items-center gap-2">
          <CopyBtn text={qt.text} />
          {open ? <ChevronUp size={12} className="text-hero/50" /> : <ChevronDown size={12} className="text-hero/50" />}
        </div>
      </button>
      {open && <pre className="px-3 pb-3 text-xs text-fg-1 whitespace-pre-wrap leading-relaxed border-t border-hero/10 pt-2">{qt.text}</pre>}
    </div>
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
   CASE INFO COMPONENT
   ═══════════════════════════════════════════════════════════════ */

function CaseInfo({ data, setData }) {
  return (
    <div className="bg-bg-1 border border-border-0 rounded-xl p-4">
      <h3 className="text-xs font-semibold text-fg-1 mb-3">Case Details (auto-fills escalation notes)</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <input
          placeholder="UID"
          value={data.uid}
          onChange={e => setData(p => ({ ...p, uid: e.target.value }))}
          className="bg-bg-2 border border-border-0 focus:border-hero/50 rounded-lg px-3 py-1.5 text-xs text-fg-0 outline-none transition-colors"
          aria-label="UID"
        />
        <input
          placeholder="Order ID"
          value={data.oid}
          onChange={e => setData(p => ({ ...p, oid: e.target.value }))}
          className="bg-bg-2 border border-border-0 focus:border-hero/50 rounded-lg px-3 py-1.5 text-xs text-fg-0 outline-none transition-colors"
          aria-label="Order ID"
        />
        <select
          value={data.role}
          onChange={e => setData(p => ({ ...p, role: e.target.value }))}
          className="bg-bg-2 border border-border-0 focus:border-hero/50 rounded-lg px-3 py-1.5 text-xs text-fg-0 outline-none transition-colors cursor-pointer"
          aria-label="User role"
        >
          <option value="">Role...</option>
          <option value="buyer">Buyer</option>
          <option value="seller">Seller</option>
        </select>
        <select
          value={data.status}
          onChange={e => setData(p => ({ ...p, status: e.target.value }))}
          className="bg-bg-2 border border-border-0 focus:border-hero/50 rounded-lg px-3 py-1.5 text-xs text-fg-0 outline-none transition-colors cursor-pointer"
          aria-label="Order status"
        >
          <option value="">Order status...</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SCENARIO 1 — YELLOW ALERT
   ═══════════════════════════════════════════════════════════════ */

function YellowAlertFlow({ onBack, caseData }) {
  return (
    <div className="space-y-4">
      <BackBtn onClick={onBack} />
      <h3 className="text-sm font-bold text-fg-0">🚨 Yellow Alert — Urgent Escalation</h3>

      {/* Trigger conditions */}
      <div className="bg-crit/10 border border-crit/20 rounded-xl p-4 space-y-2">
        <h4 className="text-xs font-semibold text-crit flex items-center gap-1.5">
          <AlertTriangle size={13} /> Trigger Conditions
        </h4>
        <ul className="text-xs text-fg-1 space-y-1.5 leading-relaxed">
          <li className="flex gap-2"><span className="text-crit shrink-0">Issue = Scam:</span><span>Amount &gt; $100 USD, Bybit employee impersonation</span></li>
          <li className="flex gap-2"><span className="text-crit shrink-0">Attitude = Threaten/Blackmail:</span><span>"I will post to social media", "I'm going to sue Bybit"</span></li>
          <li className="flex gap-2"><span className="text-crit shrink-0">Behavior = Spam:</span><span>Same inquiry &gt; 3 times within 1 week</span></li>
        </ul>
      </div>

      {/* Steps */}
      <StepCard
        title="Handling Steps"
        steps={[
          'Ask for Order ID and collect all relevant details',
          'Request proofs — direct user to appeal page or webform if they cannot submit appeal',
          'Raise Case Expedition form with Yellow Alert flag in P2P Lark group',
          'Manage expectations — do not promise recovery, advise user to negotiate with counterparty or report to authorities if applicable',
        ]}
        caseType={CASE_TYPES.both}
        escalation={ESCALATION_NOTE(
          caseData.uid,
          caseData.oid,
          'YELLOW ALERT — Urgent P2P dispute escalation',
          '[Attach evidence] — Yellow Alert flagged'
        )}
      />

      {/* Time expectation */}
      <div className="bg-info/10 border border-info/20 rounded-lg p-3">
        <p className="text-xs font-medium text-info mb-1">Time Expectation (tell the user):</p>
        <p className="text-xs text-fg-1">"You will receive the updates at earliest opportunity, our team is already looking into your case"</p>
        <div className="mt-1.5"><CopyBtn text="You will receive the updates at earliest opportunity, our team is already looking into your case" /></div>
      </div>

      {/* Important notes */}
      <div className="bg-warn/10 border border-warn/20 rounded-xl p-4 space-y-2">
        <h4 className="text-xs font-semibold text-warn">Important Notes</h4>
        <ul className="text-xs text-fg-1 space-y-1">
          <li>If no reply in 3 min, PM P2P shift leader</li>
          <li>Must document PM proof</li>
          <li>Engage with P2P Division agent in thread</li>
        </ul>
      </div>

      {/* Quicktexts */}
      <div className="space-y-2">
        <QTCard qt={QT.followup} />
        <QTCard qt={QT.asap} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SCENARIO 2 — RESET APPEAL LIMIT
   ═══════════════════════════════════════════════════════════════ */

function ResetAppealFlow({ onBack, caseData }) {
  const [hasInfo, setHasInfo] = useState(null);

  return (
    <div className="space-y-4">
      <BackBtn onClick={onBack} />
      <h3 className="text-sm font-bold text-fg-0">🔄 Reset Appeal Limit</h3>

      {/* Info */}
      <div className="bg-bg-2/40 border border-border-0/50 rounded-lg p-3">
        <p className="text-xs text-fg-1 leading-relaxed">Users have 2 appeal chances per order. Once exhausted, they cannot submit further appeals without agent intervention. Follow the steps below to reset.</p>
      </div>

      {/* Steps */}
      <StepCard
        title="Handling Steps"
        steps={[
          'Ask for the P2P Order ID',
          'Ask for screenshot showing they cannot raise a new appeal (limit reached)',
          'If provided: escalate with note + Pool 1 to Pool 2 + Case Expedition form',
          'If not provided: send ET 1111b to request information',
          'Send QT follow-up to manage expectations',
          'Follow up after chat ends',
        ]}
        caseType={CASE_TYPES.both}
      />

      {/* Decision fork */}
      <div className="bg-bg-1 border border-border-0 rounded-xl p-4 space-y-3">
        <h4 className="text-xs font-semibold text-fg-1">Does the user have OID + screenshot?</h4>
        <div className="flex gap-2">
          <button
            onClick={() => setHasInfo(true)}
            className={cn(
              'px-4 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer',
              hasInfo === true ? 'bg-ok/20 border border-ok/40 text-ok' : 'bg-bg-2 border border-border-0 text-fg-1 hover:border-ok/30'
            )}
          >
            Yes — Escalate
          </button>
          <button
            onClick={() => setHasInfo(false)}
            className={cn(
              'px-4 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer',
              hasInfo === false ? 'bg-crit/20 border border-crit/40 text-crit' : 'bg-bg-2 border border-border-0 text-fg-1 hover:border-crit/30'
            )}
          >
            No — Request info
          </button>
        </div>

        {hasInfo === true && (
          <div className="space-y-3 pt-2">
            <div className="bg-crit/10 border border-crit/20 rounded-lg p-3 space-y-2">
              <p className="text-xs font-medium text-crit">Escalation Required</p>
              <pre className="text-xs text-fg-1 whitespace-pre-wrap">{ESCALATION_NOTE(caseData.uid, caseData.oid, 'Appeal limit exhausted (2/2) — requesting reset', '[Screenshot of appeal limit attached]')}</pre>
              <CopyBtn text={ESCALATION_NOTE(caseData.uid, caseData.oid, 'Appeal limit exhausted (2/2) — requesting reset', '[Screenshot of appeal limit attached]')} />
            </div>
            <QTCard qt={QT.followup} />
            <QTCard qt={QT.a06_followup} />
          </div>
        )}

        {hasInfo === false && (
          <div className="space-y-3 pt-2">
            <TemplateCard et={ET['1111b']} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SCENARIO 3 — PENDING COIN RELEASE (BEFORE APPEAL)
   ═══════════════════════════════════════════════════════════════ */

function PendingBeforeFlow({ onBack, caseData }) {
  const [role, setRole] = useState(null);
  const [sub, setSub] = useState(null);

  const buyerSubs = [
    { id: 'faster', label: 'Requests faster coin release' },
    { id: 'overpaid', label: 'Overpaid the seller' },
    { id: 'seller_rules', label: 'Seller breaks rules (extra fees, 3rd party)' },
  ];

  const sellerSubs = [
    { id: 'no_payment', label: 'Buyer did not make payment' },
    { id: 'less_payment', label: 'Buyer paying less than required' },
    { id: 'buyer_rules', label: 'Buyer violated rules (3rd party)' },
    { id: 'bank_frozen', label: 'Bank account frozen after payment' },
  ];

  return (
    <div className="space-y-4">
      <BackBtn onClick={onBack} />
      <h3 className="text-sm font-bold text-fg-0">⏳ Pending Coin Release — Before Appeal</h3>

      {/* Appeal limit note */}
      <div className="bg-hero/10 border border-hero/20 rounded-lg p-3">
        <p className="text-xs text-hero leading-relaxed">If user can't submit appeal due to limit issues → use QT a06 follow-up → escalate to P2</p>
      </div>

      {/* Role selector */}
      {!role && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button onClick={() => { setRole('buyer'); setSub(null); }}
            className="text-left bg-bg-2/50 border border-border-0/50 hover:border-hero/30 rounded-xl p-4 transition-all cursor-pointer">
            <h4 className="text-sm font-semibold text-fg-0">Buyer Issues</h4>
            <p className="text-xs text-fg-2 mt-1">User is the buyer in the P2P order</p>
          </button>
          <button onClick={() => { setRole('seller'); setSub(null); }}
            className="text-left bg-bg-2/50 border border-border-0/50 hover:border-hero/30 rounded-xl p-4 transition-all cursor-pointer">
            <h4 className="text-sm font-semibold text-fg-0">Seller Issues</h4>
            <p className="text-xs text-fg-2 mt-1">User is the seller in the P2P order</p>
          </button>
        </div>
      )}

      {/* Sub-scenario selector */}
      {role && !sub && (
        <div>
          <button onClick={() => setRole(null)} className="text-xs text-fg-2 hover:text-fg-1 transition-colors mb-3 cursor-pointer">
            ← Back to role selection
          </button>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(role === 'buyer' ? buyerSubs : sellerSubs).map(s => (
              <button key={s.id} onClick={() => setSub(s.id)}
                className="text-left bg-bg-2/50 border border-border-0/50 hover:border-hero/30 rounded-lg px-3 py-2.5 text-xs text-fg-1 hover:text-fg-0 transition-all cursor-pointer">
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Buyer sub-scenarios */}
      {role === 'buyer' && sub && (
        <div>
          <button onClick={() => setSub(null)} className="text-xs text-fg-2 hover:text-fg-1 transition-colors mb-3 cursor-pointer">
            ← Back to buyer issues
          </button>

          {sub === 'faster' && (
            <div className="space-y-3">
              <StepCard
                title="Buyer Requests Faster Coin Release"
                steps={[
                  'Confirm whether fiat transfer has been completed',
                  'Some payment methods do not process instantly — seller may need time',
                  'Advise: do NOT cancel the order if payment was made',
                  'Communicate with seller or submit an appeal if unresolved',
                ]}
                caseType={CASE_TYPES.guide}
              />
              <QTCard qt={QT.buyer_a} />
              <p className="text-xs text-fg-2">If counterparty uncooperative: advise to submit appeal</p>
            </div>
          )}

          {sub === 'overpaid' && (
            <div className="space-y-3">
              <StepCard
                title="Buyer Overpaid the Seller"
                steps={[
                  'Quick solution: place a new order with the same counterparty for the overpaid amount',
                  'If new order not feasible: submit an appeal',
                  'Recovering the overpaid amount is not guaranteed — depends on seller cooperation',
                ]}
                caseType={CASE_TYPES.guide}
              />
              <QTCard qt={QT.buyer_b} />
              <p className="text-xs text-fg-2">If counterparty uncooperative: advise to submit appeal</p>
            </div>
          )}

          {sub === 'seller_rules' && (
            <div className="space-y-3">
              <StepCard
                title="Seller Breaks Rules (Extra Fees, 3rd Party)"
                steps={[
                  'Advise: request a refund from the seller',
                  'Consider avoiding future trades with this counterparty',
                  'DO NOT cancel the order until refund is secured',
                  'Share refund details via P2P Order Chat Box using same payment details',
                  'If seller uncooperative: submit an appeal',
                ]}
                caseType={CASE_TYPES.guide}
              />
              <QTCard qt={QT.buyer_c} />
              <p className="text-xs text-fg-2">If counterparty uncooperative: advise to submit appeal</p>
            </div>
          )}
        </div>
      )}

      {/* Seller sub-scenarios */}
      {role === 'seller' && sub && (
        <div>
          <button onClick={() => setSub(null)} className="text-xs text-fg-2 hover:text-fg-1 transition-colors mb-3 cursor-pointer">
            ← Back to seller issues
          </button>

          {sub === 'no_payment' && (
            <div className="space-y-3">
              <StepCard
                title="Buyer Did Not Make Payment"
                steps={[
                  'Ask buyer to show proof of payment to the correct account',
                  'Some payments take longer — may not appear immediately',
                  'Validate proof with payment service provider',
                  'DO NOT release coins until money is confirmed credited',
                ]}
                caseType={CASE_TYPES.guide}
              />
              <QTCard qt={QT.seller_a} />
              <p className="text-xs text-fg-2">If counterparty uncooperative: advise to submit appeal</p>
            </div>
          )}

          {sub === 'less_payment' && (
            <div className="space-y-3">
              <StepCard
                title="Buyer Paying Less Than Required"
                steps={[
                  'DO NOT release any coins until full payment received',
                  'Option 1: Discuss with buyer to complete remaining payment',
                  'Option 2: Refund partial payment and ask buyer to cancel order',
                  'If buyer uncooperative: submit an appeal',
                ]}
                caseType={CASE_TYPES.guide}
              />
              <QTCard qt={QT.seller_b} />
              <p className="text-xs text-fg-2">If counterparty uncooperative: advise to submit appeal</p>
            </div>
          )}

          {sub === 'buyer_rules' && (
            <div className="space-y-3">
              <StepCard
                title="Buyer Violated Rules (3rd Party Account)"
                steps={[
                  'Recommend: refund the buyer and stop trading with this counterparty',
                  'Use P2P Order Chat Box to request refund details and order cancellation',
                  'If buyer uncooperative or refuses to cancel: submit an appeal',
                ]}
                caseType={CASE_TYPES.guide}
              />
              <QTCard qt={QT.seller_c} />
              <p className="text-xs text-fg-2">If counterparty uncooperative: advise to submit appeal</p>
            </div>
          )}

          {sub === 'bank_frozen' && (
            <div className="space-y-3">
              <StepCard
                title="Seller's Bank Account Frozen After Receiving Payment"
                steps={[
                  'This situation is not uncommon in P2P trading',
                  'Contact bank immediately to discuss unfreezing the account',
                  'If cooperation from buyer needed: reach out via P2P Order Chat Box',
                  'If bank can reverse payment: request them to do so',
                  'If buyer uncooperative or refuses to cancel: submit an appeal',
                ]}
                caseType={CASE_TYPES.guide}
              />
              <QTCard qt={QT.seller_d} />
              <p className="text-xs text-fg-2">If counterparty uncooperative: advise to submit appeal</p>
            </div>
          )}
        </div>
      )}

      {/* Appeal limit fallback QT */}
      {role && sub && (
        <div className="mt-2">
          <QTCard qt={QT.a06_followup} />
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SCENARIO 4 — PENDING COIN RELEASE (AFTER APPEAL)
   ═══════════════════════════════════════════════════════════════ */

function PendingAfterFlow({ onBack, caseData }) {
  const [tpcPassed, setTpcPassed] = useState(null);
  const [showStatuses, setShowStatuses] = useState(false);
  const [showFactors, setShowFactors] = useState(false);

  return (
    <div className="space-y-4">
      <BackBtn onClick={onBack} />
      <h3 className="text-sm font-bold text-fg-0">📋 Pending Coin Release — After Appeal</h3>

      {/* Steps */}
      <StepCard
        title="Handling Steps"
        steps={[
          'Ask for the P2P Order ID',
          'Search in SF: P2P Ongoing Order Appeal → Under Appeal',
          'Check TPC (Third-Party Check) Follow-up Date & Time',
          'Decide based on whether TPC date has passed',
        ]}
        caseType={CASE_TYPES.both}
      />

      {/* TPC Decision */}
      <div className="bg-bg-1 border border-border-0 rounded-xl p-4 space-y-3">
        <h4 className="text-xs font-semibold text-fg-1">Has the TPC Follow-up Date & Time passed?</h4>
        <div className="flex gap-2">
          <button
            onClick={() => setTpcPassed(true)}
            className={cn(
              'px-4 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer',
              tpcPassed === true ? 'bg-ok/20 border border-ok/40 text-ok' : 'bg-bg-2 border border-border-0 text-fg-1 hover:border-ok/30'
            )}
          >
            Yes — TPC Passed
          </button>
          <button
            onClick={() => setTpcPassed(false)}
            className={cn(
              'px-4 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer',
              tpcPassed === false ? 'bg-warn/20 border border-warn/40 text-warn' : 'bg-bg-2 border border-border-0 text-fg-1 hover:border-warn/30'
            )}
          >
            No — TPC Not Passed
          </button>
        </div>

        {tpcPassed === true && (
          <div className="space-y-3 pt-2">
            <div className="bg-ok/10 border border-ok/20 rounded-lg p-3">
              <p className="text-xs text-ok font-medium mb-1">Action: Raise Case Expedition + send QT</p>
              <p className="text-xs text-fg-1">Escalate for immediate review. Use Case Expedition form in P2P Lark group.</p>
            </div>
            <QTCard qt={QT.asap} />
            <TemplateCard et={ET['1111p_opt1']} />
            <div className="bg-crit/10 border border-crit/20 rounded-lg p-3 space-y-2">
              <p className="text-xs font-medium text-crit">Escalation Required</p>
              <pre className="text-xs text-fg-1 whitespace-pre-wrap">{ESCALATION_NOTE(caseData.uid, caseData.oid, 'Ongoing appeal — TPC passed, requesting expedited review')}</pre>
              <CopyBtn text={ESCALATION_NOTE(caseData.uid, caseData.oid, 'Ongoing appeal — TPC passed, requesting expedited review')} />
            </div>
          </div>
        )}

        {tpcPassed === false && (
          <div className="space-y-3 pt-2">
            <div className="bg-warn/10 border border-warn/20 rounded-lg p-3">
              <p className="text-xs text-warn font-medium mb-1">Action: Ask user to be patient</p>
              <p className="text-xs text-fg-1">Include TPC date in your response. Appeal is still within processing window.</p>
            </div>
            <QTCard qt={QT.be_patient} />
            <TemplateCard et={ET['1111p_opt2']} />
          </div>
        )}
      </div>

      {/* Collapsible: Appeal Statuses Reference */}
      <div className="bg-bg-1 border border-border-0 rounded-xl overflow-hidden">
        <button onClick={() => setShowStatuses(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-bg-2/50 transition-colors cursor-pointer">
          <span className="text-xs font-semibold text-fg-0">Appeal Status Reference ({APPEAL_STATUSES.length} statuses)</span>
          {showStatuses ? <ChevronUp size={14} className="text-fg-2" /> : <ChevronDown size={14} className="text-fg-2" />}
        </button>
        {showStatuses && (
          <div className="px-4 pb-4">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border-0">
                    <th className="text-left py-2 pr-3 text-fg-2 font-medium">Appeal Status</th>
                    <th className="text-left py-2 pr-3 text-fg-2 font-medium">SF Equivalent</th>
                    <th className="text-left py-2 text-fg-2 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {APPEAL_STATUSES.map((a, i) => (
                    <tr key={i} className="border-b border-border-0/50">
                      <td className="py-2 pr-3 text-hero font-medium whitespace-nowrap">{a.status}</td>
                      <td className="py-2 pr-3 text-info font-mono whitespace-nowrap">{a.sfEquiv}</td>
                      <td className="py-2 text-fg-1 leading-relaxed">{a.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Collapsible: Handling Time Factors */}
      <div className="bg-bg-1 border border-border-0 rounded-xl overflow-hidden">
        <button onClick={() => setShowFactors(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-bg-2/50 transition-colors cursor-pointer">
          <span className="text-xs font-semibold text-fg-0">Handling Time Factors</span>
          {showFactors ? <ChevronUp size={14} className="text-fg-2" /> : <ChevronDown size={14} className="text-fg-2" />}
        </button>
        {showFactors && (
          <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-ok/10 border border-ok/20 rounded-lg p-3">
              <h5 className="text-xs font-semibold text-ok mb-2">Fast Resolution</h5>
              <ul className="text-xs text-fg-1 space-y-1">
                <li>Both parties cooperate</li>
                <li>Clear evidence provided</li>
                <li>Straightforward payment dispute</li>
                <li>VA/VIP fast-track eligible</li>
              </ul>
            </div>
            <div className="bg-crit/10 border border-crit/20 rounded-lg p-3">
              <h5 className="text-xs font-semibold text-crit mb-2">Slow Resolution</h5>
              <ul className="text-xs text-fg-1 space-y-1">
                <li>Unresponsive counterparty</li>
                <li>Insufficient or unclear evidence</li>
                <li>Cross-department investigation needed</li>
                <li>Multiple disputed amounts or orders</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SCENARIO 5 — COMPLETED/CANCELLED ORDER WITH ASSET LOSS
   ═══════════════════════════════════════════════════════════════ */

function ClosedLossFlow({ onBack, caseData }) {
  const [role, setRole] = useState(null);
  const [sub, setSub] = useState(null);

  const buyerSubs = [
    { id: 'paid_cancelled', label: 'Paid but order cancelled' },
    { id: 'overpaid_completed', label: 'Overpaid + order Completed' },
    { id: 'extra_fees', label: 'Paid extra fees + order Completed' },
  ];

  const sellerSubs = [
    { id: 'underpaid', label: 'Buyer underpaid + order Completed' },
    { id: 'no_payment', label: 'No payment received + order Completed' },
    { id: 'reversed', label: 'Buyer reversed payment + order Completed' },
  ];

  return (
    <div className="space-y-4">
      <BackBtn onClick={onBack} />
      <h3 className="text-sm font-bold text-fg-0">💰 Completed/Cancelled Order — Asset Loss</h3>

      {/* Appeal limit note */}
      <div className="bg-hero/10 border border-hero/20 rounded-lg p-3">
        <p className="text-xs text-hero leading-relaxed">If user can't submit appeal due to limit → use QT a06 follow-up → escalate to P2</p>
      </div>

      {/* HC link */}
      <a href="https://www.bybit.com/en/help-center/article/P2P-Closed-Order-Appeal" target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-2 text-xs text-info hover:text-info transition-colors py-1">
        <ExternalLink size={11} className="shrink-0" /> P2P Appeal Solutions for Canceled/Completed Orders
      </a>

      {/* Role selector */}
      {!role && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button onClick={() => { setRole('buyer'); setSub(null); }}
            className="text-left bg-bg-2/50 border border-border-0/50 hover:border-hero/30 rounded-xl p-4 transition-all cursor-pointer">
            <h4 className="text-sm font-semibold text-fg-0">Buyer</h4>
            <p className="text-xs text-fg-2 mt-1">User is the buyer in the P2P order</p>
          </button>
          <button onClick={() => { setRole('seller'); setSub(null); }}
            className="text-left bg-bg-2/50 border border-border-0/50 hover:border-hero/30 rounded-xl p-4 transition-all cursor-pointer">
            <h4 className="text-sm font-semibold text-fg-0">Seller</h4>
            <p className="text-xs text-fg-2 mt-1">User is the seller in the P2P order</p>
          </button>
        </div>
      )}

      {/* Sub-scenario selector */}
      {role && !sub && (
        <div>
          <button onClick={() => setRole(null)} className="text-xs text-fg-2 hover:text-fg-1 transition-colors mb-3 cursor-pointer">
            ← Back to role selection
          </button>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(role === 'buyer' ? buyerSubs : sellerSubs).map(s => (
              <button key={s.id} onClick={() => setSub(s.id)}
                className="text-left bg-bg-2/50 border border-border-0/50 hover:border-hero/30 rounded-lg px-3 py-2.5 text-xs text-fg-1 hover:text-fg-0 transition-all cursor-pointer">
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Buyer sub-scenarios (5.1) */}
      {role === 'buyer' && sub && (
        <div>
          <button onClick={() => setSub(null)} className="text-xs text-fg-2 hover:text-fg-1 transition-colors mb-3 cursor-pointer">
            ← Back to buyer issues
          </button>

          {sub === 'paid_cancelled' && (
            <div className="space-y-3">
              <StepCard
                title="Paid but Order Cancelled"
                steps={[
                  'Solution 1: Place new order for same amount with same counterparty',
                  'Solution 2: Request seller to send crypto via internal transfer',
                  'Solution 3: Request seller to refund the payment',
                  'Tip: Always click "Payment Completed" button before timer expires',
                ]}
                caseType={CASE_TYPES.buyer}
              />
              <div className="bg-info/10 border border-info/20 rounded-lg p-3 flex items-start gap-2">
                <Info size={13} className="text-info shrink-0 mt-0.5" />
                <p className="text-xs text-fg-1">If counterparty uncooperative → advise user to submit appeal</p>
              </div>
              <QTCard qt={QT.closed_appeal} />
            </div>
          )}

          {sub === 'overpaid_completed' && (
            <div className="space-y-3">
              <StepCard
                title="Overpaid + Order Completed"
                steps={[
                  'Solution 1: Request seller to send crypto equivalent via internal transfer',
                  'Solution 2: Request seller to refund the overpaid amount',
                  'Tip: Carefully review transaction details before completing payment',
                ]}
                caseType={CASE_TYPES.buyer}
              />
              <div className="bg-info/10 border border-info/20 rounded-lg p-3 flex items-start gap-2">
                <Info size={13} className="text-info shrink-0 mt-0.5" />
                <p className="text-xs text-fg-1">If counterparty uncooperative → advise user to submit appeal</p>
              </div>
              <QTCard qt={QT.closed_appeal} />
            </div>
          )}

          {sub === 'extra_fees' && (
            <div className="space-y-3">
              <StepCard
                title="Paid Extra Fees + Order Completed"
                steps={[
                  'Solution 1: Guide user to leave a negative review on the seller',
                  'Tip: If you disagree with extra fees, do not make payment',
                ]}
                caseType={CASE_TYPES.buyer}
              />
              <QTCard qt={QT.report_user} />
              <div className="bg-hero/10 border border-hero/20 rounded-lg p-3">
                <p className="text-xs text-hero leading-relaxed">If user wants to appeal fees/refund → treat as overpaid scenario above</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Seller sub-scenarios (5.2) */}
      {role === 'seller' && sub && (
        <div>
          <button onClick={() => setSub(null)} className="text-xs text-fg-2 hover:text-fg-1 transition-colors mb-3 cursor-pointer">
            ← Back to seller issues
          </button>

          {sub === 'underpaid' && (
            <div className="space-y-3">
              <StepCard
                title="Buyer Underpaid + Order Completed"
                steps={[
                  'Solution 1: Request payment top-up from buyer for the remaining amount',
                  'Solution 2: Request buyer to send crypto equivalent via internal transfer',
                  'Tip: Review order details carefully before releasing coins',
                ]}
                caseType={CASE_TYPES.seller}
              />
              <div className="bg-info/10 border border-info/20 rounded-lg p-3 flex items-start gap-2">
                <Info size={13} className="text-info shrink-0 mt-0.5" />
                <p className="text-xs text-fg-1">If counterparty uncooperative → advise user to submit appeal</p>
              </div>
              <QTCard qt={QT.closed_appeal} />
            </div>
          )}

          {sub === 'no_payment' && (
            <div className="space-y-3">
              <StepCard
                title="No Payment Received + Order Completed"
                steps={[
                  'Solution 1: Request outstanding payment from buyer',
                  'Solution 2: Request buyer to send crypto equivalent via internal transfer',
                  'Tip: Review order details carefully before releasing coins',
                ]}
                caseType={CASE_TYPES.seller}
              />
              <div className="bg-info/10 border border-info/20 rounded-lg p-3 flex items-start gap-2">
                <Info size={13} className="text-info shrink-0 mt-0.5" />
                <p className="text-xs text-fg-1">If counterparty uncooperative → advise user to submit appeal</p>
              </div>
              <QTCard qt={QT.closed_appeal} />
            </div>
          )}

          {sub === 'reversed' && (
            <div className="space-y-3">
              <StepCard
                title="Buyer Reversed Payment + Order Completed"
                steps={[
                  'Solution 1: Request outstanding payment from buyer',
                  'Solution 2: Request buyer to send crypto equivalent via internal transfer',
                  'Solution 3: Contact payment method provider to dispute the reversal',
                  'Tip: Block uncooperative counterparty via their profile page',
                ]}
                caseType={CASE_TYPES.seller}
              />
              <div className="bg-info/10 border border-info/20 rounded-lg p-3 flex items-start gap-2">
                <Info size={13} className="text-info shrink-0 mt-0.5" />
                <p className="text-xs text-fg-1">If counterparty uncooperative → advise user to submit appeal</p>
              </div>
              <QTCard qt={QT.closed_appeal} />
            </div>
          )}
        </div>
      )}

      {/* Appeal limit fallback QT */}
      {role && sub && (
        <div className="mt-2">
          <QTCard qt={QT.a06_followup} />
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SCENARIO 6 — COMPLETED/CANCELLED, NO ASSET LOSS
   ═══════════════════════════════════════════════════════════════ */

function ClosedNoLossFlow({ onBack, caseData }) {
  const [sub, setSub] = useState(null);
  const [completionPath, setCompletionPath] = useState(null);

  const subs = [
    { id: 'bank_frozen', label: "Seller's bank frozen" },
    { id: 'third_party_seller', label: 'Third-party account (seller reports buyer)' },
    { id: 'third_party_buyer', label: 'Third-party account (buyer reports seller)' },
    { id: 'extra_fees', label: 'Seller requests extra fees' },
    { id: 'communication', label: 'Communication issues' },
    { id: 'unethical', label: 'Unethical behavior' },
    { id: 'completion', label: 'Completion rate concerns' },
  ];

  return (
    <div className="space-y-4">
      <BackBtn onClick={onBack} />
      <h3 className="text-sm font-bold text-fg-0">📝 Completed/Cancelled — No Asset Loss</h3>

      {/* Sub-scenario selector */}
      {!sub && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {subs.map(s => (
            <button key={s.id} onClick={() => { setSub(s.id); setCompletionPath(null); }}
              className="text-left bg-bg-2/50 border border-border-0/50 hover:border-hero/30 rounded-lg px-3 py-2.5 text-xs text-fg-1 hover:text-fg-0 transition-all cursor-pointer">
              {s.label}
            </button>
          ))}
        </div>
      )}

      {sub && (
        <div>
          <button onClick={() => { setSub(null); setCompletionPath(null); }} className="text-xs text-fg-2 hover:text-fg-1 transition-colors mb-3 cursor-pointer">
            ← Back to sub-scenarios
          </button>

          {sub === 'bank_frozen' && (
            <div className="space-y-3">
              <StepCard
                title="Seller's Bank Frozen"
                steps={[
                  'Contact bank immediately to discuss unfreezing',
                  'If bank requires buyer cooperation → reach out via P2P Order Chat Box',
                  'If bank can reverse payment → request them to do so',
                  'Bybit has no direct relationship with payment providers — limited intervention',
                ]}
                caseType={CASE_TYPES.seller}
              />
              <QTCard qt={QT.bank_frozen} />
            </div>
          )}

          {sub === 'third_party_seller' && (
            <div className="space-y-3">
              <StepCard
                title="Third-Party Account — Seller Reports Buyer"
                steps={[
                  'Third-party payment is prohibited per P2P Terms of User Service',
                  'Once order is completed and coins released, transaction cannot be reversed',
                  'Advise: refund payment and request buyer to cancel order',
                  'If buyer uncooperative → submit appeal',
                ]}
                caseType={CASE_TYPES.seller}
              />
              <QTCard qt={QT.third_party} />
            </div>
          )}

          {sub === 'third_party_buyer' && (
            <div className="space-y-3">
              <StepCard
                title="Third-Party Account — Buyer Reports Seller"
                steps={[
                  'Third-party payment is prohibited per P2P Terms of User Service',
                  'Once order is completed and coins released, transaction cannot be reversed',
                  'Advise buyer: for future trades, refund and request cancellation if 3rd party detected',
                  'If seller uncooperative → submit appeal',
                ]}
                caseType={CASE_TYPES.buyer}
              />
              <QTCard qt={QT.third_party} />
            </div>
          )}

          {sub === 'extra_fees' && (
            <div className="space-y-3">
              <StepCard
                title="Seller Requests Extra Fees"
                steps={[
                  'Acknowledge the user\'s frustration',
                  'Emphasize this behavior is not in line with P2P guidelines',
                  'Advise: leave a negative review, report the seller, and block them',
                ]}
                caseType={CASE_TYPES.buyer}
              />
              <QTCard qt={QT.report_user} />
            </div>
          )}

          {sub === 'communication' && (
            <div className="space-y-3">
              <StepCard
                title="Communication Issues"
                steps={[
                  'Users are expected to interact respectfully per P2P Terms of Service',
                  'Offensive or abusive language is not tolerated',
                  'Advise: leave negative review, block counterparty',
                  'Check P2P profile reviews for future trading partners',
                ]}
                caseType={CASE_TYPES.both}
              />
              <QTCard qt={QT.verbal_attack} />
            </div>
          )}

          {sub === 'unethical' && (
            <div className="space-y-3">
              <StepCard
                title="Unethical Behavior"
                steps={[
                  'Bybit does not condone malicious activities',
                  'Advise: leave negative review, report, and block the trader',
                  'Feedback is visible on the user\'s P2P profile to help others',
                ]}
                caseType={CASE_TYPES.trading_guide}
              />
              <div className="bg-crit/10 border border-crit/20 rounded-lg p-3">
                <p className="text-xs font-medium text-crit mb-2">Common Unethical Behaviors</p>
                <ul className="text-xs text-fg-1 space-y-1">
                  <li>• Attempting scam / fraud</li>
                  <li>• Using unauthorized trading platforms</li>
                  <li>• Invalid or expired payment methods</li>
                  <li>• Price manipulation</li>
                  <li>• Unauthorized fees / surcharges</li>
                  <li>• Third-party payment</li>
                </ul>
              </div>
              <QTCard qt={QT.report_user} />
            </div>
          )}

          {sub === 'completion' && (
            <div className="space-y-3">
              <StepCard
                title="Completion Rate Concerns"
                steps={[
                  'Completion rate is calculated from the last 30 days',
                  'Rate is affected by order cancellations — reason selected matters',
                  'Select the correct "seller issue" reason to avoid rate impact',
                ]}
                caseType={CASE_TYPES.completion}
              />

              {/* Completion sub-paths */}
              {!completionPath && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button onClick={() => setCompletionPath('not_cancelled')}
                    className="text-left bg-bg-2/50 border border-border-0/50 hover:border-hero/30 rounded-lg px-3 py-2.5 text-xs text-fg-1 hover:text-fg-0 transition-all cursor-pointer">
                    Not yet cancelled — select correct reason
                  </button>
                  <button onClick={() => setCompletionPath('seller_refuses')}
                    className="text-left bg-bg-2/50 border border-border-0/50 hover:border-hero/30 rounded-lg px-3 py-2.5 text-xs text-fg-1 hover:text-fg-0 transition-all cursor-pointer">
                    Seller refuses responsibility
                  </button>
                  <button onClick={() => setCompletionPath('wrong_reason')}
                    className="text-left bg-bg-2/50 border border-border-0/50 hover:border-hero/30 rounded-lg px-3 py-2.5 text-xs text-fg-1 hover:text-fg-0 transition-all cursor-pointer">
                    Already cancelled with wrong reason
                  </button>
                </div>
              )}

              {completionPath && (
                <button onClick={() => setCompletionPath(null)} className="text-xs text-fg-2 hover:text-fg-1 transition-colors cursor-pointer">
                  ← Back to completion rate paths
                </button>
              )}

              {completionPath === 'not_cancelled' && (
                <div className="space-y-3">
                  <StepCard
                    title="Not Yet Cancelled — Select Correct Reason"
                    steps={[
                      'Inform user: completion rate will NOT be affected if "seller issue" reason is selected',
                      'Guide user through the correct cancellation flow',
                    ]}
                    caseType={CASE_TYPES.completion}
                  />
                  <QTCard qt={QT.completion_select} />
                </div>
              )}

              {completionPath === 'seller_refuses' && (
                <div className="space-y-3">
                  <StepCard
                    title="Seller Refuses Responsibility"
                    steps={[
                      'Request evidence from the user supporting their claim',
                      'Escalate to Pool 2 for re-investigation',
                      'Ensure proof is clear, accurate, and directly related to the appeal reason',
                    ]}
                    caseType={CASE_TYPES.completion}
                    escalation={ESCALATION_NOTE(caseData.uid, caseData.oid, 'Completion rate dispute — seller refuses responsibility', '[Supporting evidence attached]')}
                  />
                  <QTCard qt={QT.completion_reappeal} />
                </div>
              )}

              {completionPath === 'wrong_reason' && (
                <div className="space-y-3">
                  <StepCard
                    title="Already Cancelled with Wrong Reason"
                    steps={[
                      'Explain: the cancellation reason is irreversible and cannot be changed',
                      'Ways to improve completion rate:',
                      '— Wait 30 days for the impact to naturally diminish',
                      '— Complete more successful P2P trades going forward',
                    ]}
                    caseType={CASE_TYPES.completion}
                  />
                  <QTCard qt={QT.completion_alt} />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SCENARIO 7 — SCAM & SUSPICION REPORTING
   ═══════════════════════════════════════════════════════════════ */

function ScamReportFlow({ onBack, caseData }) {
  const [sub, setSub] = useState(null);

  const subs = [
    { id: 'unethical', label: 'Unethical/non-compliant behavior' },
    { id: 'malicious_hold', label: 'Seller claims buyer holds order with malicious intent' },
    { id: 'scammed', label: 'P2P trader scammed with asset loss' },
  ];

  return (
    <div className="space-y-4">
      <BackBtn onClick={onBack} />
      <h3 className="text-sm font-bold text-fg-0">🕵️ Scam & Suspicion Reporting</h3>

      {/* Sub-scenario selector */}
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

      {sub && (
        <div>
          <button onClick={() => setSub(null)} className="text-xs text-fg-2 hover:text-fg-1 transition-colors mb-3 cursor-pointer">
            ← Back to sub-scenarios
          </button>

          {sub === 'unethical' && (
            <div className="space-y-3">
              <StepCard
                title="Unethical / Non-Compliant Behavior"
                steps={[
                  'Bybit does not condone malicious activities',
                  'Advise: leave negative review, report, and block the trader',
                  'Feedback is visible on the user\'s P2P profile to help others',
                ]}
                caseType={CASE_TYPES.trading_guide}
              />
              <div className="bg-crit/10 border border-crit/20 rounded-lg p-3">
                <p className="text-xs font-medium text-crit mb-2">Common Unethical Behaviors</p>
                <ul className="text-xs text-fg-1 space-y-1">
                  <li>• Attempting scam / fraud</li>
                  <li>• Using unauthorized trading platforms</li>
                  <li>• Invalid or expired payment methods</li>
                  <li>• Price manipulation</li>
                  <li>• Unauthorized fees / surcharges</li>
                  <li>• Third-party payment</li>
                </ul>
              </div>
              <QTCard qt={QT.report_user} />
            </div>
          )}

          {sub === 'malicious_hold' && (
            <div className="space-y-3">
              <StepCard
                title="Seller Claims Buyer Holds Order with Malicious Intent"
                steps={[
                  'Collect the P2P Order ID from the seller',
                  'Check if an appeal is currently ongoing for this order',
                  'If no appeal: advise the seller to submit an appeal',
                  'If appeal ongoing: collect screenshot of chat with counterparty',
                  'Raise Case Expedition form in P2P Lark group',
                ]}
                caseType={CASE_TYPES.seller}
              />
              <div className="bg-info/10 border border-info/20 rounded-lg p-3">
                <p className="text-xs font-medium text-info mb-1">Time Expectation:</p>
                <p className="text-xs text-fg-1">"You will receive the updates at earliest opportunity"</p>
                <div className="mt-1.5"><CopyBtn text="You will receive the updates at earliest opportunity" /></div>
              </div>
              <div className="bg-ok/10 border border-ok/20 rounded-lg p-3">
                <p className="text-xs text-ok">No need to escalate to Pool 2 — P2P team handles Case Expedition directly.</p>
              </div>
              <QTCard qt={QT.followup} />
            </div>
          )}

          {sub === 'scammed' && (
            <div className="space-y-3">
              <StepCard
                title="P2P Trader Scammed with Asset Loss"
                steps={[
                  'Advise user to review "How to Avoid Crypto P2P Scams" article',
                  'Collect Order ID and all relevant evidence',
                  'Use QT a06 follow-up to manage expectations',
                  'Escalate to Pool 2 + raise Case Expedition with Yellow Alert',
                ]}
                caseType={CASE_TYPES.both}
                escalation={ESCALATION_NOTE(caseData.uid, caseData.oid, 'P2P scam with asset loss — YELLOW ALERT', '[Evidence attached] — Case Expedition with Yellow Alert')}
              />
              <a href="https://www.bybit.com/en/help-center/article/P2P-Avoid-Scams" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-info hover:text-info transition-colors py-1">
                <ExternalLink size={11} className="shrink-0" /> How to Avoid Crypto P2P Scams
              </a>
              <div className="bg-crit/10 border border-crit/20 rounded-lg p-3">
                <p className="text-xs font-medium text-crit mb-2">Common P2P Scams</p>
                <ul className="text-xs text-fg-1 space-y-1">
                  <li>• Fake payment proof / forged screenshots</li>
                  <li>• Social engineering to release coins early</li>
                  <li>• Impersonating Bybit support staff</li>
                  <li>• Phishing links in order chat</li>
                  <li>• Triangulation scam (3rd party payment)</li>
                </ul>
              </div>
              <QTCard qt={QT.a06_followup} />
              <QTCard qt={QT.asap} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SCENARIO 8 — RISK WARNING (FRAUD DETECTION)
   ═══════════════════════════════════════════════════════════════ */

function RiskWarningFlow({ onBack, caseData }) {
  const [hasBan, setHasBan] = useState(null);
  const [hasAppeal, setHasAppeal] = useState(null);
  const [victimRole, setVictimRole] = useState(null);
  const [buyerPaid, setBuyerPaid] = useState(null);
  const [canAppealNow, setCanAppealNow] = useState(null);

  const resetTree = () => {
    setHasBan(null);
    setHasAppeal(null);
    setVictimRole(null);
    setBuyerPaid(null);
    setCanAppealNow(null);
  };

  return (
    <div className="space-y-4">
      <BackBtn onClick={onBack} />
      <h3 className="text-sm font-bold text-fg-0">⚠️ Risk Warning (Fraud Detection)</h3>

      {/* Explanation card */}
      <div className="bg-warn/10 border border-warn/20 rounded-xl p-4 space-y-2">
        <h4 className="text-xs font-semibold text-warn flex items-center gap-1.5">
          <AlertTriangle size={13} /> What is a Risk Warning?
        </h4>
        <p className="text-xs text-fg-1 leading-relaxed">When fraud is suspected, both parties see a "Risk Warning" popup. Payment details are hidden from both sides. Check the ban remark in CS-GO: UID → account status → look for <span className="text-hero font-mono">Fraud_P2P_InTransitOrderAnomalies</span>.</p>
      </div>

      {/* General handling checklist */}
      <StepCard
        title="General Handling Checklist"
        steps={[
          'Identify account status (check CS-GO for ban remark)',
          'Identify the user\'s role (buyer or seller)',
          'Confirm whether actual payment has been completed',
          'Request the Risk Warning popup message from the user',
        ]}
      />

      {/* Decision tree — Step 1: Ban remark */}
      <div className="bg-bg-1 border border-border-0 rounded-xl p-4 space-y-3">
        <h4 className="text-xs font-semibold text-fg-1">Does the user have a ban remark?</h4>
        <div className="flex gap-2">
          <button onClick={() => { resetTree(); setHasBan(true); }}
            className={cn(
              'px-4 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer',
              hasBan === true ? 'bg-crit/20 border border-crit/40 text-crit' : 'bg-bg-2 border border-border-0 text-fg-1 hover:border-crit/30'
            )}>
            Yes — Suspected Scammer
          </button>
          <button onClick={() => { resetTree(); setHasBan(false); }}
            className={cn(
              'px-4 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer',
              hasBan === false ? 'bg-ok/20 border border-ok/40 text-ok' : 'bg-bg-2 border border-border-0 text-fg-1 hover:border-ok/30'
            )}>
            No — Victim
          </button>
        </div>

        {/* Branch: Suspected Scammer */}
        {hasBan === true && (
          <div className="space-y-3 pt-2">
            <div className="bg-crit/10 border border-crit/20 rounded-lg p-3">
              <p className="text-xs text-crit font-medium mb-1">Suspected Scammer — Under Investigation</p>
              <p className="text-xs text-fg-1">User cannot trade. Advise full cooperation with P2P specialist during investigation.</p>
            </div>
            <StepCard caseType={CASE_TYPES.risk_ban} />
            <QTCard qt={QT.risk_investigation} />
          </div>
        )}

        {/* Branch: Victim */}
        {hasBan === false && (
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-semibold text-fg-1">Has an appeal been submitted?</h4>
            <div className="flex gap-2">
              <button onClick={() => { setHasAppeal(true); setVictimRole(null); setBuyerPaid(null); setCanAppealNow(null); }}
                className={cn(
                  'px-4 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer',
                  hasAppeal === true ? 'bg-info/20 border border-info/40 text-info' : 'bg-bg-2 border border-border-0 text-fg-1 hover:border-info/30'
                )}>
                Yes — After Appeal
              </button>
              <button onClick={() => { setHasAppeal(false); setVictimRole(null); setBuyerPaid(null); setCanAppealNow(null); }}
                className={cn(
                  'px-4 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer',
                  hasAppeal === false ? 'bg-warn/20 border border-warn/40 text-warn' : 'bg-bg-2 border border-border-0 text-fg-1 hover:border-warn/30'
                )}>
                No — Before Appeal
              </button>
            </div>

            {/* After Appeal */}
            {hasAppeal === true && (
              <div className="space-y-3 pt-2">
                <div className="bg-info/10 border border-info/20 rounded-lg p-3">
                  <p className="text-xs text-info font-medium mb-1">Appeal Submitted — Advise Patience</p>
                  <ul className="text-xs text-fg-1 space-y-1 mt-2">
                    <li>• Do NOT cancel the appeal</li>
                    <li>• Fully cooperate and provide all necessary proof</li>
                    <li>• Only follow instructions from the official support agent</li>
                    <li>• Do NOT blindly follow counterparty instructions</li>
                  </ul>
                </div>
                <StepCard caseType={CASE_TYPES.both} />
                <QTCard qt={QT.risk_patient} />
              </div>
            )}

            {/* Before Appeal */}
            {hasAppeal === false && (
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-semibold text-fg-1">What is the user's role?</h4>
                <div className="flex gap-2">
                  <button onClick={() => { setVictimRole('buyer'); setBuyerPaid(null); setCanAppealNow(null); }}
                    className={cn(
                      'px-4 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer',
                      victimRole === 'buyer' ? 'bg-hero/20 border border-hero/40 text-hero' : 'bg-bg-2 border border-border-0 text-fg-1 hover:border-hero/30'
                    )}>
                    Buyer
                  </button>
                  <button onClick={() => { setVictimRole('seller'); setBuyerPaid(null); setCanAppealNow(null); }}
                    className={cn(
                      'px-4 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer',
                      victimRole === 'seller' ? 'bg-hero/20 border border-hero/40 text-hero' : 'bg-bg-2 border border-border-0 text-fg-1 hover:border-hero/30'
                    )}>
                    Seller
                  </button>
                </div>

                {/* Buyer path */}
                {victimRole === 'buyer' && (
                  <div className="space-y-3 pt-2">
                    <h4 className="text-xs font-semibold text-fg-1">Has actual payment been made?</h4>
                    <div className="flex gap-2">
                      <button onClick={() => { setBuyerPaid(true); setCanAppealNow(null); }}
                        className={cn(
                          'px-4 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer',
                          buyerPaid === true ? 'bg-ok/20 border border-ok/40 text-ok' : 'bg-bg-2 border border-border-0 text-fg-1 hover:border-ok/30'
                        )}>
                        Yes — Payment Made
                      </button>
                      <button onClick={() => { setBuyerPaid(false); setCanAppealNow(null); }}
                        className={cn(
                          'px-4 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer',
                          buyerPaid === false ? 'bg-crit/20 border border-crit/40 text-crit' : 'bg-bg-2 border border-border-0 text-fg-1 hover:border-crit/30'
                        )}>
                        No — No Payment
                      </button>
                    </div>

                    {/* Buyer paid */}
                    {buyerPaid === true && (
                      <div className="space-y-3 pt-2">
                        <h4 className="text-xs font-semibold text-fg-1">Can the buyer submit an appeal now?</h4>
                        <div className="flex gap-2">
                          <button onClick={() => setCanAppealNow(true)}
                            className={cn(
                              'px-4 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer',
                              canAppealNow === true ? 'bg-ok/20 border border-ok/40 text-ok' : 'bg-bg-2 border border-border-0 text-fg-1 hover:border-ok/30'
                            )}>
                            Yes — Can Appeal Now
                          </button>
                          <button onClick={() => setCanAppealNow(false)}
                            className={cn(
                              'px-4 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer',
                              canAppealNow === false ? 'bg-warn/20 border border-warn/40 text-warn' : 'bg-bg-2 border border-border-0 text-fg-1 hover:border-warn/30'
                            )}>
                            No — Must Wait for Auto-Cancel
                          </button>
                        </div>

                        {canAppealNow === true && (
                          <div className="space-y-3 pt-2">
                            <div className="bg-ok/10 border border-ok/20 rounded-lg p-3">
                              <p className="text-xs text-ok font-medium">Action: Submit appeal immediately — do NOT cancel the order</p>
                            </div>
                            <StepCard caseType={CASE_TYPES.buyer} />
                            <QTCard qt={QT.risk_buyer_b} />
                          </div>
                        )}

                        {canAppealNow === false && (
                          <div className="space-y-3 pt-2">
                            <div className="bg-warn/10 border border-warn/20 rounded-lg p-3">
                              <p className="text-xs text-warn font-medium">Action: Wait 15-30 min for auto-cancel, then submit appeal when button appears</p>
                            </div>
                            <StepCard caseType={CASE_TYPES.buyer} />
                            <QTCard qt={QT.risk_buyer_a} />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Buyer not paid */}
                    {buyerPaid === false && (
                      <div className="space-y-3 pt-2">
                        <div className="bg-ok/10 border border-ok/20 rounded-lg p-3">
                          <p className="text-xs text-ok font-medium">Action: Cancel the order directly — no payment was made</p>
                        </div>
                        <StepCard caseType={CASE_TYPES.trading_guide} />
                        <QTCard qt={QT.risk_buyer_c} />
                      </div>
                    )}
                  </div>
                )}

                {/* Seller path */}
                {victimRole === 'seller' && (
                  <div className="space-y-3 pt-2">
                    <div className="bg-warn/10 border border-warn/20 rounded-lg p-3">
                      <p className="text-xs text-warn font-medium">Action: Submit appeal immediately with video proof</p>
                      <ul className="text-xs text-fg-1 space-y-1 mt-2">
                        <li>• Account details page (account number and name visible)</li>
                        <li>• Transaction history page (refreshed)</li>
                        <li>• All transaction records from order date to today</li>
                      </ul>
                    </div>
                    <StepCard caseType={CASE_TYPES.seller} />
                    <QTCard qt={QT.risk_seller_d} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT — P2P DISPUTE
   ═══════════════════════════════════════════════════════════════ */

export default function P2PDispute() {
  const { state } = useLocation();
  const handoff = state?.fromNBA ? state : null;
  const [scenario, setScenario] = useState(null);
  const [caseData, setCaseData] = useState({ uid: '', oid: '', role: '', status: '' });
  const [showQTs, setShowQTs] = useState(false);
  const [showETs, setShowETs] = useState(false);
  const [showLinks, setShowLinks] = useState(false);

  // Pre-fill from handoff
  useEffect(() => {
    if (handoff) {
      setCaseData(prev => ({
        ...prev,
        uid: handoff.uid || prev.uid,
        oid: handoff.orderId || prev.oid,
      }));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const chatContext = () => {
    const sc = scenario ? SCENARIOS.find(s => s.id === scenario) : null;
    return `You are ACE, helping a Bybit support agent with a P2P Dispute case.

CURRENT SCENARIO: ${sc ? `${sc.name} — ${sc.desc}` : 'No scenario selected'}
CASE DATA: UID: ${caseData.uid || 'not provided'}, Order ID: ${caseData.oid || 'not provided'}, Role: ${caseData.role || 'not specified'}, Order Status: ${caseData.status || 'not specified'}

KEY RULES:
- Appeals: In Progress or within 5 days → online appeal. Over 5 days → webform only. 2 chances max.
- Yellow Alert: scam >$100, impersonation, threats → Case Expedition with Yellow Alert
- Escalations go to designated P2P Lark group only
- Time expectation for expedited cases: "earliest opportunity"
- Standard follow-up: 24h weekdays / 48h weekends
- Pool 1 agents cannot send dispute email templates not in the SOP
- Fast-Track appeals (VA/VIP): 15-min system judgment — NEVER tell customer it's system-judged

INSTRUCTIONS: Answer concisely. Draft ready-to-send messages when asked. Format escalation notes with UID/OID/Summary. The agent is mid-shift.`;
  };

  const suggestions = scenario === 'risk'
    ? ['How to check ban remark in CS-GO?', 'What video proof does buyer need?', 'Draft escalation for Risk Warning case']
    : scenario === 'yellow'
    ? ['Draft Yellow Alert expedition note', 'What proofs to collect from buyer?', 'What proofs to collect from seller?']
    : ['Draft reply to customer', 'Generate escalation note', 'What case type for this scenario?', 'How long until resolution?'];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      {/* NBA handoff banner */}
      {handoff && (
        <div className="bg-hero/10 border border-hero/30 rounded-xl px-4 py-3 space-y-1">
          <p className="text-xs font-semibold text-hero flex items-center gap-1.5">
            <span>⚡</span> Routed from Live Chat
            {handoff.vipLevel >= 3 && <span className="bg-hero/20 border border-hero/40 px-1.5 py-0.5 rounded text-hero font-bold ml-1">VIP {handoff.vipLevel}</span>}
          </p>
          {handoff.uid && <p className="text-xs text-fg-1">UID: <span className="text-fg-0 font-mono">{scrubPII(handoff.uid)}</span></p>}
          {handoff.orderId && <p className="text-xs text-fg-1">Order: <span className="text-fg-0 font-mono">{scrubPII(handoff.orderId)}</span></p>}
        </div>
      )}

      <div>
        <h1 className="text-xl font-bold text-fg-0">⚖️ P2P Dispute</h1>
        <p className="text-sm text-fg-2 mt-0.5">SOP-driven dispute resolution · 8 scenarios · Integrated ACE chat</p>
      </div>

      {/* Case info */}
      <CaseInfo data={caseData} setData={setCaseData} />

      {/* Appeal rules banner */}
      <div className="bg-info/10 border border-info/20 rounded-xl p-4">
        <h4 className="text-xs font-semibold text-info mb-1.5">Appeal Submission Rules</h4>
        <ul className="text-xs text-fg-1 space-y-1">
          {APPEAL_RULES.map((r, i) => <li key={i}>• {r}</li>)}
        </ul>
      </div>

      {/* Scenario selector */}
      {!scenario && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {SCENARIOS.map(s => (
            <button key={s.id} onClick={() => setScenario(s.id)}
              className={cn(
                "group text-left bg-bg-1 border rounded-xl p-3.5 transition-all cursor-pointer",
                s.id === 'yellow' ? 'border-crit/30 hover:border-crit/60' : 'border-border-0 hover:border-hero/30'
              )}>
              <span className="text-xl">{s.icon}</span>
              <h3 className={cn("text-sm font-semibold mt-2 transition-colors", s.id === 'yellow' ? 'text-crit' : 'text-fg-0 group-hover:text-hero')}>{s.name}</h3>
              <p className="text-xs text-fg-2 mt-1 leading-relaxed">{s.desc}</p>
            </button>
          ))}
        </div>
      )}

      {/* Active scenario */}
      {scenario === 'yellow' && <YellowAlertFlow onBack={() => setScenario(null)} caseData={caseData} />}
      {scenario === 'reset' && <ResetAppealFlow onBack={() => setScenario(null)} caseData={caseData} />}
      {scenario === 'pending_before' && <PendingBeforeFlow onBack={() => setScenario(null)} caseData={caseData} />}
      {scenario === 'pending_after' && <PendingAfterFlow onBack={() => setScenario(null)} caseData={caseData} />}
      {scenario === 'closed_loss' && <ClosedLossFlow onBack={() => setScenario(null)} caseData={caseData} />}
      {scenario === 'closed_no_loss' && <ClosedNoLossFlow onBack={() => setScenario(null)} caseData={caseData} />}
      {scenario === 'scam' && <ScamReportFlow onBack={() => setScenario(null)} caseData={caseData} />}
      {scenario === 'risk' && <RiskWarningFlow onBack={() => setScenario(null)} caseData={caseData} />}

      {/* ACE Chat */}
      {scenario && (
        <WorkflowChat
          title="Ask ACE about this dispute"
          systemContext={chatContext}
          suggestions={suggestions}
          kbDomains={['P2P']}
        />
      )}

      {/* Collapsible: All Quicktexts */}
      <div className="bg-bg-1 border border-border-0 rounded-xl overflow-hidden">
        <button onClick={() => setShowQTs(o => !o)}
          className="w-full flex items-center justify-between px-5 py-3 hover:bg-bg-2/50 transition-colors cursor-pointer">
          <span className="text-sm font-semibold text-fg-0">💬 All Quicktexts ({Object.keys(QT).length})</span>
          {showQTs ? <ChevronUp size={14} className="text-fg-2" /> : <ChevronDown size={14} className="text-fg-2" />}
        </button>
        {showQTs && (
          <div className="px-4 pb-4 space-y-2">
            {Object.values(QT).map(q => <QTCard key={q.code} qt={q} />)}
          </div>
        )}
      </div>

      {/* Collapsible: Email Templates */}
      <div className="bg-bg-1 border border-border-0 rounded-xl overflow-hidden">
        <button onClick={() => setShowETs(o => !o)}
          className="w-full flex items-center justify-between px-5 py-3 hover:bg-bg-2/50 transition-colors cursor-pointer">
          <span className="text-sm font-semibold text-fg-0">📨 Email Templates ({Object.keys(ET).length})</span>
          {showETs ? <ChevronUp size={14} className="text-fg-2" /> : <ChevronDown size={14} className="text-fg-2" />}
        </button>
        {showETs && (
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

      {/* Escalation protocol */}
      <div className="bg-warn/10 border border-warn/20 rounded-xl p-4">
        <h4 className="text-xs font-semibold text-warn mb-1.5">Escalation Protocol</h4>
        <ul className="text-xs text-fg-1 space-y-1">
          <li>• P2P escalations → designated P2P Lark group only</li>
          <li>• Yellow Alert → Case Expedition form with "Yellow Alert" option</li>
          <li>• If no reply in 3 min → PM P2P shift leader (document proof)</li>
          <li>• Pool 1 agents cannot send dispute email templates not in this SOP</li>
          <li>• Salesforce: adjust case type → internal note → Pool 1 to Pool 2 macro</li>
        </ul>
      </div>
    </div>
  );
}
