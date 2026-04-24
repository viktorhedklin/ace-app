import { useState, useMemo } from 'react';
import { Copy, Check, ChevronDown, ChevronUp, ArrowLeft, CheckCircle2, AlertTriangle, ExternalLink, ClipboardList, Info, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { hasAnyApiKey } from '@/api/claude';
import WorkflowChat from '@/components/WorkflowChat';

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS & DATA — E05-P2P Restriction SOP v2.3
   ═══════════════════════════════════════════════════════════════ */

const SCENARIOS = [
  { id: 'high_risk', name: 'High Risk Transaction', icon: '🔒', desc: 'Risk order review — pending, under review, approved, rejected' },
  { id: 'violation', name: 'P2P Violation', icon: '⚠️', desc: 'P2P Terms of Service violation ban' },
  { id: 'sensitive', name: 'Sensitive Words', icon: '🔤', desc: 'Sensitive content detected in P2P chat images' },
  { id: 'offline_appeal', name: 'Offline Appeal', icon: '📧', desc: 'Order closed >5 days — financial loss' },
  { id: 'online_appeal', name: 'Online Appeal', icon: '🖥️', desc: 'Order closed ≤5 days — financial loss' },
  { id: 'scammer_no_asset', name: 'Scammer — No Asset', icon: '🚫', desc: 'Scammed counterparty, no assets remaining' },
  { id: 'scammer_with_asset', name: 'Scammer — With Asset', icon: '💰', desc: '90-day hold, or Serious Suspection escalation' },
  { id: 'wrong_judgment', name: 'Wrong Judgment', icon: '⚖️', desc: 'Agent error — temporary ban, 3-5 day asset transfer' },
  { id: 'report', name: 'P2P Report / Disagree', icon: '📋', desc: 'Report ban and report disagree scenarios' },
  { id: 'company_risk', name: 'Company Risk', icon: '🏢', desc: 'Company risk team flagged UID' },
  { id: 'frozen', name: 'Amount Frozen', icon: '❄️', desc: 'Order amount frozen after cancel/complete' },
  { id: 't1', name: 'T+1 Restriction', icon: '⏰', desc: 'Withdrawal restricted 1 day after P2P order' },
  { id: 'high_risk_adv', name: 'High Risk Advertiser', icon: '📢', desc: 'Advertiser flagged — security deposit + docs required' },
];

const CASE_TYPES = {
  risk_high: 'E05-P2P > Risk Control > High Risk',
  risk_ban: 'E05-P2P > Risk Control > P2P Ban',
  risk_asset: 'E05-P2P > Risk Control > Asset Frozen',
  risk_report: 'E05-P2P > Risk Control > P2P Report',
  risk_objection: 'E05-P2P > Risk Control > P2P Report Objection',
  dispute_both: 'E05-P2P > P2P Dispute > With Buyer/With Seller',
  trading_guide: 'E05-P2P > P2P Trading > User Guide',
  advertiser_app: 'E05-P2P > P2P Advertise > Advertiser Application',
};

/* ═══ QUICKTEXTS ═══ */

const QT = {
  highRisk_a: { code: 'p2pG1-en-HighRisk-a', title: 'Submit documents for risk review', text: `After reviewing your account, our system has detected security risks or unusual activity in your account or transactions. To ensure the safety and integrity of your account, you are required to submit the requested documents for review.\nPlease follow the instructions to complete the review, and this step is necessary to continue using P2P Trading.\nFor detailed guidance, you can also refer to our FAQ article here: https://www.bybit.com/en/help-center/article/FAQ-Buy-Crypto-Transaction-Error-or-Risk-Warning` },

  highRisk_b: { code: 'p2pG1-en-HighRisk-b', title: 'Under review — 48 hours', text: `Thank you for your patience. Upon checking, we have received your document submission, and it is currently under review.\n\nPlease allow the relevant team to review within 48 hours. Once the review is finalized, the result will be sent to your registered email address and also reflected in your Notification Center: https://www.bybit.com/en/notifications\n\nWe appreciate your patience on this matter.` },

  highRisk_c: { code: 'p2pG1-en-HighRisk-c', title: 'Review approved — retry in 24h', text: `We appreciate your kind cooperation and patience during the review process. We are pleased to inform you that your review has been approved. You may proceed with P2P trading in the next 24 hours.\n\nJust a quick note, the risk review may be triggered again in the future. Worry not, you can pre-submit the required documents to prevent the hassle. For more information, you may refer to our FAQ article here: https://www.bybit.com/en/help-center/article/FAQ-Buy-Crypto-Transaction-Error-or-Risk-Warning\n\nHope the article helps.` },

  highRisk_d: { code: 'p2pG1-en-HighRisk-d', title: 'P2P temporarily restricted (with expiry)', text: `I am sorry to inform you that (choose according to the scenarios)\n1. Risk review failed - your review was not approved\n2. P2P Violation - you may have violated our P2P Terms of User Service.\nAs a result, your P2P trading feature has been temporarily restricted, and any active advertisements have been delisted. However, the restriction will be lifted on DD-MM-YYYY, after which you can resume P2P trading normally.\n\nPlease note that this decision was made after a careful review by our relevant teams and is final, and no appeal can be made.\n\nRest assured, your asset balance remains unaffected, and you can continue using all other Bybit trading functions without limitation during this period.` },

  highRisk_e: { code: 'p2pG1-en-HighRisk-e', title: 'P2P Ads restricted temporarily (with expiry)', text: `I am sorry to inform you that your review was not approved. As a result, your P2P advertisement posting feature has been temporarily restricted, and any active advertisements have been delisted. However, the restriction will be lifted on DD-MM-YYYY, after which you can resume P2P trading normally.\n\nPlease note that this decision was made after a careful review by our relevant teams and is final, and no appeal can be made.\n\nRest assured, your asset balance remains unaffected, and you can continue using all other Bybit trading functions without limitation during this period.` },

  followup: { code: 'p2pG1-en-email-followup', title: 'Standard escalation — 48h email follow-up', text: `Regarding your inquiry, it will need to be escalated for further checking. Please allow our team some time to check and we will update you again via email within 48 hours. Thank you for being so understanding and sorry for any inconvenience caused.` },

  assetFrozen: { code: 'p2pG2-en-assetfrozen', title: 'Asset frozen — 48h review', text: `Thank you for your patience. Upon checking, this is due to the risk control system detecting abnormal activities on your account. Thus, your respective order amount will not be able to be withdrawn immediately after the order is canceled/completed until the review process is done. Please allow the relevant team to review within 48 hours. The result will be sent to you via the account-registered email address and the Notification Center. We appreciate your patience on this matter.\n\nYour trading activities (Spot, Futures, Margin trading, etc.) will not be affected during this period. This strategy provides a buffer against the potential loss of user assets due to illegal funding.` },

  t1Restriction: { code: 'p2pG2-en-T+1-withdrawalrestriction', title: 'T+1 withdrawal freeze', text: `Thank you for your patience. Upon checking, this is due to the risk control system detecting abnormal activities on your account. Thus, your asset will be temporarily frozen until XXX UTC+0. The restriction cannot be lifted within this period, you may find the unfrozen time on your P2P Order History Page as well.\n\nYour other trading functions of your account will not be affected during this period.` },

  offlineAppeal: { code: 'p2pG3-en-DAS-unsolvedappeal', title: 'Offline — account restricted, unresolved order', text: `Upon checking, your account is restricted due to an unresolved P2P order (Order ID: XXX). The restriction will be lifted only once the order issue is resolved. The relevant team has sent an email to your registered email address regarding this case (Case #XXX). Please follow the necessary steps we advised and reply with the required proof for further review. Thank you for your cooperation.` },

  onlineAppeal: { code: 'p2pG3-en-COA-unsolvedappeal', title: 'Online — account restricted, unresolved order', text: `Upon checking, your account is restricted due to an unresolved P2P order (Order ID: XXX). The restriction will be lifted only once the order issue is resolved. We have sent an email to your registered email address regarding this case. Please follow the instructions and provide us with the video proof for further review. May I confirm that you have provided valid video proof by submitting a form or email?` },

  scammer90d: { code: 'p2pG3-en-p2pscammers-withdrawafter90days', title: 'Scammer — withdraw after 90 days', text: `We're sorry to inform you that your account has been permanently restricted due to a violation of our P2P Terms of User Service and Terms of Service. As a result, your P2P advertisements have been removed, and trading, position opening, and withdrawals are currently unavailable.\n\nYou may withdraw your remaining balance after DD-MM-YYYY by submitting the form under "Asset Withdrawal after 90 days." Please ensure you select the correct request to avoid any delay in processing.\n\nWe understand this may be disappointing, but please note that this decision is final. The platform reserves the right to restrict or terminate services for accounts found to have breached our terms.` },

  wrongJudgment: { code: 'p2pG3-en-wrongjudgment', title: 'Wrong judgment — 3-5 business days', text: `We apologize for the inconvenience caused by the temporary suspension of your withdrawal function due to an error in P2P order judgment. Upon checking, the relevant team is currently addressing the issue and expects the asset transfer process to take 3-5 business days. Once the assets are transferred, we will promptly lift the ban on your account. Thank you for your patience and understanding.` },

  reportApprovedIn72: { code: 'p2pG3-en-ReportBan-approved-within72hours', title: 'Report reviewed — 3 days for counterparty dispute', text: `We have received your P2P report, and our team has reviewed it. Please note this isn't the outcome yet, as the reported user has up to 3 days to submit supporting documents if they wish to dispute the report.\nWe appreciate your patience during this process. You'll receive a system notification via email once the final result is available.` },

  reportApprovedAfter72: { code: 'p2pG3-en-ReportBan-approved-after72hours', title: 'Report approved after 72h — refer to system email', text: `We have received your P2P report, and our team has reviewed it. The reported user has passed the 3-day dispute window and the result is now final. Please refer to the system notification email for details.` },

  reportRejectedNoBan: { code: 'p2pG3-en-ReportBan-rejected-noban', title: 'Report rejected — no ban', text: `We regret to inform you that your P2P report has been reviewed and found invalid. Please note that submitting false reports may result in certain account restrictions, so we encourage you to ensure all future submissions are accurate and supported with valid evidence.\n\nIf you believe your report is valid, you may reply to the notification email within 3 days to request an additional review.` },

  reportDisagreeSubmit: { code: 'p2pG3-en-ReportBanDisagree-SubmitDispute', title: 'Report disagree — submit dispute within 72h', text: `We are sorry to inform you that your account has been reported by other traders, resulting in a temporary restriction. A notification email with details has been sent to your registered address.\n\nIf you believe the report is inaccurate, you can submit a Report Objection via the Support Hub within 3 days of the report being accepted. Please include a short explanation and supporting documents.\n\nOnce submitted, the relevant team will review and provide the outcome via notification and email within 2 business days.` },

  reportDisagreeExpired: { code: 'p2pG3-en-ReportBanDisagree-ObjectionExpired', title: 'Objection period expired', text: `We are sorry to inform you that your account has been restricted following a report from other traders.\nAs the objection period has already passed and no objection was received, the restriction will remain in place. Please note that no further appeals can be accepted in this case.` },

  reportDisagreeSuccess: { code: 'p2pG3-en-ReportBanDisagree-ObjectionSuccess', title: 'Objection accepted — full access restored', text: `We are sorry for the inconvenience caused by the recent restriction on your account due to a false report. The good news is, your objection has been accepted, and full access to your account has been restored.\nFor more details, you may refer to the notification email sent to your registered email address.` },

  highRiskAdv_a: { code: 'p2pG4-en-HighRiskAdvertiser-a', title: 'Flagged as risk — deposit + submit docs', text: `Upon checking, your account was flagged as potential risks by the system evaluation. Thus, you will be required to make a security deposit and submit additional documents for risk review. Kindly follow the instructions and complete the Risk Review from the Security Deposit on your My Ads page in order to become a P2P advertiser. You may refer to this FAQ: https://www.bybit.com/en/help-center/article/FAQ-Security-Deposit-Requirements-in-P2P-Trading for more information.` },

  highRiskAdv_b: { code: 'p2pG4-en-HighRiskAdvertiser-b', title: 'Review successful — proceed to apply', text: `Upon checking, previously you were unable to post advertisements is due to your account flagged as potential risks by the system evaluation. After review by the relevant team, you have successfully obtained the privilege of the P2P advertiser on our platform. You may refer https://www.bybit.com/en/help-center/article/Requirements-and-Benefits-to-Become-P2P-Advertisers for more information.` },

  highRiskAdv_c: { code: 'p2pG4-en-HighRiskAdvertiser-c', title: 'Review rejected — resubmit docs', text: `Upon checking, your P2P advertiser risk review has not been approved yet due to the documents that you submitted do not meet the requirements. Kindly visit your Security Deposit page to provide the relevant documents again. Please ensure that you follow the instructions and requirements to submit the required documents this time. You can find the detailed guide here: https://www.bybit.com/en/help-center/article/How-to-Deposit-and-Unfreeze-Security-Deposit-in-P2P-Trading.` },
};

/* ═══ EMAIL TEMPLATES ═══ */

const ET = {
  G6660: { code: 'ET G6660', title: 'Risk Review — Submit Documents', body: `Dear Trader,\n\nThank you for supporting Bybit.\n\nOur system has detected potential security risks associated with your account. To ensure account safety and allow continued access to P2P trading, please submit the required documents for review.\n\nPlease follow the instructions provided in your account to complete the submission. The review will be processed within 48 hours.\n\nWith warmest regards,\nBybit Support | Help Center` },

  G6661: { code: 'ET G6661', title: 'P2P Trading Ban Permanently (High Risk Rejected)', body: `Dear Trader,\n\nThank you for supporting Bybit.\n\nWe regret to share with you that your Risk Review result is Rejected. With immediate effect, you are restricted from using P2P Trading on Bybit permanently. Your advertisements will be delisted as well if there are any.\n\nOur Risk Team has reviewed your information carefully and examined the trading risk level of your account closely. Taking into consideration all the factors, the Risk Team and the Management Team made such a decision together. Unfortunately, this decision is final and no appeal is allowed.\n\nNevertheless, your asset balance will not be affected, and you may continue to use all other trading functions on Bybit without limitation.\n\nWith warmest regards\nBybit Support | Help Center` },

  G6662: { code: 'ET G6662', title: 'P2P Trading Ban Temporarily (with expiry)', body: `Dear Trader,\n\nThank you for supporting Bybit.\n\nWe regret to inform you that your P2P trading feature has been temporarily restricted due to your risk review result. Your advertisements have been delisted. The restriction will be lifted on DD-MM-YYYY.\n\nPlease note this decision is final. Your asset balance is unaffected, and all other Bybit trading functions remain available.\n\nWith warmest regards,\nBybit Support | Help Center` },

  G6663: { code: 'ET G6663', title: 'P2P Post Ads Ban Permanently (High Risk Rejected)', body: `Dear Trader,\n\nThank you for supporting Bybit.\n\nWe regret to share with you that your Risk Review result is Rejected. With immediate effect, you are restricted from posting any P2P advertisement on Bybit permanently. Your existing advertisements will be delisted as well if there are any.\n\nNevertheless, your asset balance will not be affected, and you may continue to trade P2P as a taker. You are still allowed to place P2P orders in both buy and sell directions.\n\nWith warmest regards\nBybit Support | Help Center` },

  G6664: { code: 'ET G6664', title: 'P2P Post Ads Ban Temporarily (with expiry)', body: `Dear Trader,\n\nThank you for supporting Bybit.\n\nWe regret to inform you that your P2P advertisement posting feature has been temporarily restricted. Your existing advertisements have been delisted. The restriction will be lifted on DD-MM-YYYY.\n\nPlease note this decision is final. Your asset balance is unaffected.\n\nWith warmest regards,\nBybit Support | Help Center` },

  G6665: { code: 'ET G6665', title: 'Risk Review Approved', body: `Dear Trader,\n\nThank you for supporting Bybit.\n\nWe are pleased to inform you that your risk review has been approved. You may resume P2P trading within 24 hours.\n\nPlease note that risk reviews may be triggered again in the future. You can pre-submit documents to expedite the process.\n\nWith warmest regards,\nBybit Support | Help Center` },

  G6331: { code: 'ET G6331', title: 'P2P Ban Permanently (Violation)', body: `Dear Trader,\n\nThank you for supporting Bybit.\n\nUnfortunately, due to a violation of our P2P Terms of User Service, we regret to share with you that you are restricted from using P2P Trading on Bybit permanently with immediate effect. Your advertisements will be delisted as well if there are any.\n\nOur Risk Team has conducted a thorough review of your account activities. After obtaining concrete evidence that you have violated our policies, the Risk Team and the Management Team made such a decision together. This decision is final and no appeal is allowed.\n\nNevertheless, your asset balance will not be affected, and you may continue to use all other trading functions on Bybit without limitation.\n\nWith warmest regards\nBybit Support | Help Center` },

  G6332: { code: 'ET G6332', title: 'P2P Ban Temporarily (Violation with expiry)', body: `Dear Trader,\n\nThank you for supporting Bybit.\n\nDue to a violation of our P2P Terms of User Service, your P2P trading feature has been temporarily restricted. The restriction will be lifted on DD-MM-YYYY.\n\nPlease note this decision is final. Your asset balance is unaffected.\n\nWith warmest regards,\nBybit Support | Help Center` },

  G6001: { code: 'ET G6001', title: 'P2P Scammer — No Asset (Permanent Ban)', body: `Dear Trader,\n\nThank you for supporting Bybit.\n\nDue to a violation of our P2P Terms of User Service and Terms of Service, your account is banned with immediate effect. Your P2P advertisements have been delisted as well if there are any. You will no longer be able to perform any trades to open/increase any open positions or submit any withdrawal requests including the P2P Sell function.\n\nWe regret to inform you that this decision is final and we will not accommodate any further appeals regarding this matter.\n\nWith warmest regards\nBybit Support | Help Center` },

  G6002: { code: 'ET G6002', title: 'P2P Scammer — With Asset (90 Day Hold)', body: `Dear Trader,\n\nThank you for supporting Bybit.\n\nDue to a violation of our P2P Terms of User Service, your account has been restricted. You may withdraw your remaining balance after DD-MM-YYYY (90 days from the operation date) by submitting a request through the designated form.\n\nPlease note that this holding period is for investigation purposes. If additional victims are identified, the assets may be used for compensation.\n\nWith warmest regards,\nBybit Support | Help Center` },

  G6982: { code: 'ET G6982', title: 'Under Review — 48 Hours', body: `Dear Trader,\n\nThank you for contacting Bybit Customer Support.\n\nYour submission is currently under review. Please allow our team up to 48 hours to process your case. You will receive the result via your registered email address.\n\nWith warmest regards,\nBybit Support | Help Center` },

  G6980: { code: 'ET G6980', title: 'Amount Frozen / Under Review', body: `Dear Trader,\n\nThank you for contacting Bybit Customer Support.\n\nThe relevant amount has been temporarily frozen for review. Please allow up to 48 hours for the review to be completed.\n\nWith warmest regards,\nBybit Support | Help Center` },

  G6882: { code: 'ET G6882', title: 'T+1 Withdrawal Restriction', body: `Dear Trader,\n\nThank you for contacting Bybit Customer Support.\n\nYour asset is temporarily frozen due to the T+1 risk control system. The restriction will be lifted at XXX UTC+0. You may check the unfrozen time on your P2P Order History Page.\n\nYour other trading functions remain unaffected during this period.\n\nWith warmest regards,\nBybit Support | Help Center` },

  G6650: { code: 'ET G6650', title: 'High Risk Advertiser — Submit Docs', body: `Dear Trader,\n\nThank you for contacting Bybit Customer Support.\n\nYour account has been flagged for a security review. To proceed with the P2P advertiser program, please make a security deposit (200 USDT) and submit the required documents via your My Ads page.\n\nWith warmest regards,\nBybit Support | Help Center` },

  G6651: { code: 'ET G6651', title: 'High Risk Advertiser — Under Review', body: `Dear Trader,\n\nThank you for contacting Bybit Customer Support.\n\nYour documents are currently under review. Please allow up to 48 hours for the review to be completed.\n\nWith warmest regards,\nBybit Support | Help Center` },

  G6652: { code: 'ET G6652', title: 'High Risk Advertiser — Approved', body: `Dear Trader,\n\nThank you for contacting Bybit Customer Support.\n\nYour risk review has been approved. You may now proceed to the Advertiser Program page to apply.\n\nWith warmest regards,\nBybit Support | Help Center` },

  G6653: { code: 'ET G6653', title: 'High Risk Advertiser — Rejected', body: `Dear Trader,\n\nThank you for contacting Bybit Customer Support.\n\nYour P2P advertiser risk review has not been approved as the submitted documents did not meet the requirements. You may resubmit the required documents via your Security Deposit page. The review will take another 48 hours.\n\nWith warmest regards,\nBybit Support | Help Center` },

  G6985: { code: 'ET G6985', title: 'P2P Report Approved (Within 72h)', body: `Dear Trader,\n\nThank you for contacting Bybit Customer Support.\n\nYour P2P report has been reviewed. Please note this is not the final outcome — the reported user has up to 3 days to submit a dispute. You will be notified via email once the final result is available.\n\nWith warmest regards,\nBybit Support | Help Center` },

  G6985a: { code: 'ET G6985a', title: 'P2P Report Approved (After 72h)', body: `Dear Trader,\n\nThank you for contacting Bybit Customer Support.\n\nYour P2P report has been approved. Please refer to the system notification email for details.\n\nWith warmest regards,\nBybit Support | Help Center` },

  G6986a: { code: 'ET G6986a', title: 'P2P Report Rejected (No Ban)', body: `Dear Trader,\n\nThank you for contacting Bybit Customer Support.\n\nYour P2P report has been reviewed and found to be invalid. If you wish to dispute this result, please reply to the notification email within 3 days with your reason, P2P order number, and supporting documents.\n\nWith warmest regards,\nBybit Support | Help Center` },

  G6981: { code: 'ET G6981', title: 'P2P Report Appeal', body: `Dear Trader,\n\nThank you for contacting Bybit Customer Support.\n\nWe have received your appeal regarding the P2P report decision. Our team will review your case and provide an update within 2 business days.\n\nWith warmest regards,\nBybit Support | Help Center` },

  G6987a: { code: 'ET G6987a', title: 'Report Rejected — Report Function Restricted', body: `Dear Trader,\n\nThank you for contacting Bybit Customer Support.\n\nWe regret to inform you that your report has been found invalid and malicious. As a result, your P2P Report function has been permanently restricted.\n\nWith warmest regards,\nBybit Support | Help Center` },

  G6987b: { code: 'ET G6987b', title: 'Report Rejected — P2P Report Ban', body: `Dear Trader,\n\nThank you for contacting Bybit Customer Support.\n\nFollowing the review, your P2P Report access has been restricted. A notification email has been sent to your registered address.\n\nWith warmest regards,\nBybit Support | Help Center` },

  G6988a: { code: 'ET G6988a', title: 'P2P Trading Ban (Report Approved After 72h)', body: `Dear Trader,\n\nThank you for contacting Bybit Customer Support.\n\nFollowing the P2P report review, your P2P trading access has been restricted. A notification email has been sent to your registered address.\n\nWith warmest regards,\nBybit Support | Help Center` },

  G6988b: { code: 'ET G6988b', title: 'P2P Trading Ban (Report Rejected)', body: `Dear Trader,\n\nThank you for contacting Bybit Customer Support.\n\nFollowing the review, your P2P trading access has been restricted. A notification email has been sent to your registered address.\n\nWith warmest regards,\nBybit Support | Help Center` },

  G6983: { code: 'ET G6983', title: 'P2P Report Ban — Objection Successful', body: `Dear Trader,\n\nThank you for contacting Bybit Customer Support.\n\nWe are pleased to inform you that your objection has been accepted. Full access to your account has been restored.\n\nWith warmest regards,\nBybit Support | Help Center` },

  G6989: { code: 'ET G6989', title: 'Report Disagree — Objection Expired', body: `Dear Trader,\n\nThank you for contacting Bybit Customer Support.\n\nThe objection period for the P2P report has already passed. As no objection was received within the allotted timeframe, the restriction will remain in place.\n\nWith warmest regards,\nBybit Support | Help Center` },
};

/* ═══ HELP CENTER LINKS ═══ */

const HC_LINKS = [
  { label: 'FAQ — Buy Crypto Risk Warning', url: 'https://www.bybit.com/en/help-center/article/FAQ-Buy-Crypto-Transaction-Error-or-Risk-Warning' },
  { label: 'P2P Terms of User Service', url: 'https://www.bybit.com/en/help-center/article/P2P-Terms-of-User-Service' },
  { label: 'How to Submit P2P Appeal', url: 'https://www.bybit.com/en/help-center/article/P2P-Appeal' },
  { label: 'Security Deposit in P2P Trading', url: 'https://www.bybit.com/en/help-center/article/FAQ-Security-Deposit-Requirements-in-P2P-Trading' },
  { label: 'P2P Advertiser Requirements', url: 'https://www.bybit.com/en/help-center/article/Requirements-and-Benefits-to-Become-P2P-Advertisers' },
  { label: 'P2P Webform (Order Disputes)', url: 'https://www.bybit.com/en-US/help-center/s/webform?state=187' },
];

/* ═══ ESCALATION NOTE HELPER ═══ */

const ESCALATION_NOTE = (uid, banRemark, summary, accountStatus = 'Abnormal') =>
`UID: ${uid || '[INPUT UID]'}
Account Status: ${accountStatus}
Ban Remark: ${banRemark || '[Paste ban remark]'}
Summary: ${summary || '[Brief description]'}
— Run Macro Pool 1 to Pool 2`;

const TECHOPS_NOTE = (uid, request) =>
`UID: ${uid || '[INPUT UID]'}
Request: ${request || 'Asking for report review progress'}
— Click Send to TechOps button`;

/* ═══════════════════════════════════════════════════════════════
   SHARED COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

function CopyBtn({ text }) {
  const [ok, setOk] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 2000); }}
      className="text-slate-500 hover:text-yellow-400 transition-colors cursor-pointer" aria-label="Copy">
      {ok ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

function QTCard({ qt }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-lg overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-yellow-400/5 transition-colors cursor-pointer">
        <span className="text-xs font-medium text-yellow-300"><span className="text-yellow-400/80 mr-1.5">{qt.code}</span>{qt.title}</span>
        <div className="flex items-center gap-2">
          <CopyBtn text={qt.text} />
          {open ? <ChevronUp size={12} className="text-yellow-400/50" /> : <ChevronDown size={12} className="text-yellow-400/50" />}
        </div>
      </button>
      {open && <pre className="px-3 pb-3 text-xs text-slate-400 whitespace-pre-wrap leading-relaxed border-t border-yellow-400/10 pt-2">{qt.text}</pre>}
    </div>
  );
}

function TemplateCard({ et }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-slate-800/50 rounded-lg overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-800 transition-colors cursor-pointer">
        <span className="text-xs font-medium text-slate-300"><span className="text-yellow-400/80 mr-1.5">{et.code}</span>{et.title}</span>
        <div className="flex items-center gap-2">
          <CopyBtn text={et.body} />
          {open ? <ChevronUp size={12} className="text-slate-600" /> : <ChevronDown size={12} className="text-slate-600" />}
        </div>
      </button>
      {open && <pre className="px-3 pb-3 text-xs text-slate-400 whitespace-pre-wrap leading-relaxed border-t border-slate-700/50 pt-2">{et.body}</pre>}
    </div>
  );
}

function StepCard({ title, steps, caseType, escalation, template, children }) {
  return (
    <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 space-y-3">
      {title && <h4 className="text-sm font-semibold text-slate-100">{title}</h4>}
      {steps && (
        <ol className="space-y-1.5 text-xs text-slate-300 leading-relaxed">
          {steps.map((s, i) => <li key={i} className="flex gap-2"><span className="text-yellow-400/70 shrink-0">{i + 1}.</span><span>{s}</span></li>)}
        </ol>
      )}
      {caseType && (
        <div className="flex items-center gap-2 text-xs">
          <ClipboardList size={12} className="text-blue-400 shrink-0" />
          <span className="text-slate-500">Case type:</span>
          <span className="text-blue-300 font-mono text-xs">{caseType}</span>
          <CopyBtn text={caseType} />
        </div>
      )}
      {escalation && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 space-y-2">
          <p className="text-xs font-medium text-red-400 flex items-center gap-1.5"><ShieldAlert size={12} /> Escalation Note</p>
          <pre className="text-xs text-slate-400 whitespace-pre-wrap">{escalation}</pre>
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
    <button onClick={onClick} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-yellow-400 transition-colors mb-4 cursor-pointer">
      <ArrowLeft size={13} /> Back to scenarios
    </button>
  );
}

function InfoBox({ children, tone = 'blue' }) {
  const toneMap = {
    blue: 'bg-blue-500/10 border-blue-500/20 text-blue-300',
    yellow: 'bg-yellow-400/10 border-yellow-400/20 text-yellow-300',
    red: 'bg-red-500/10 border-red-500/20 text-red-400',
  };
  return (
    <div className={cn('border rounded-lg p-3 flex gap-2 items-start', toneMap[tone])}>
      <Info size={13} className="shrink-0 mt-0.5" />
      <div className="text-xs leading-relaxed">{children}</div>
    </div>
  );
}

function SubOption({ label, active, onClick }) {
  return (
    <button onClick={onClick}
      className={cn(
        'text-left w-full bg-slate-800/40 border rounded-lg p-3 text-xs transition-colors cursor-pointer',
        active ? 'border-yellow-400/50 text-yellow-300' : 'border-slate-700/50 text-slate-300 hover:border-slate-600'
      )}>
      {label}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CASE INFO COMPONENT
   ═══════════════════════════════════════════════════════════════ */

function CaseInfo({ data, setData }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <h3 className="text-xs font-semibold text-slate-400 mb-3">Case Details (auto-fills escalation notes)</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <input placeholder="UID" value={data.uid}
          onChange={e => setData(p => ({ ...p, uid: e.target.value }))}
          className="bg-slate-800 border border-slate-700 focus:border-yellow-400/50 rounded-lg px-3 py-1.5 text-xs text-slate-100 outline-none transition-colors" aria-label="UID" />
        <input placeholder="Order ID (if any)" value={data.oid}
          onChange={e => setData(p => ({ ...p, oid: e.target.value }))}
          className="bg-slate-800 border border-slate-700 focus:border-yellow-400/50 rounded-lg px-3 py-1.5 text-xs text-slate-100 outline-none transition-colors" aria-label="Order ID" />
        <select value={data.accountStatus}
          onChange={e => setData(p => ({ ...p, accountStatus: e.target.value }))}
          className="bg-slate-800 border border-slate-700 focus:border-yellow-400/50 rounded-lg px-3 py-1.5 text-xs text-slate-100 outline-none transition-colors cursor-pointer" aria-label="Account status">
          <option value="">Account status...</option>
          <option value="Abnormal">Abnormal</option>
          <option value="Normal">Normal</option>
        </select>
        <select value={data.vip}
          onChange={e => setData(p => ({ ...p, vip: e.target.value }))}
          className="bg-slate-800 border border-slate-700 focus:border-yellow-400/50 rounded-lg px-3 py-1.5 text-xs text-slate-100 outline-none transition-colors cursor-pointer" aria-label="VIP status">
          <option value="">VIP status...</option>
          <option value="no">Non-VIP</option>
          <option value="yes">VIP</option>
        </select>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SCENARIO 1 — HIGH RISK TRANSACTION
   ═══════════════════════════════════════════════════════════════ */

function HighRiskFlow({ onBack, caseData }) {
  const [sub, setSub] = useState(null);
  const [reviewTime, setReviewTime] = useState(null);
  const [rejectedType, setRejectedType] = useState(null);

  return (
    <div className="space-y-4">
      <BackBtn onClick={onBack} />
      <h3 className="text-sm font-bold text-slate-100">🔒 High Risk Transaction</h3>

      <InfoBox tone="blue">
        <strong>How to check:</strong> CSGO {'>'} User Profile {'>'} Funding {'>'} Risk Order. If type = <span className="text-yellow-300 font-mono">APPEAL-P2P</span>, follow the status below. If no record found → see Scenario 10 (Company Risk).
      </InfoBox>

      {!sub && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <SubOption label="Pending Submission" onClick={() => setSub('pending')} />
          <SubOption label="Under Review" onClick={() => setSub('review')} />
          <SubOption label="Approved" onClick={() => setSub('approved')} />
          <SubOption label="Rejected (Appeal Failed)" onClick={() => setSub('rejected')} />
        </div>
      )}

      {sub === 'pending' && (
        <StepCard
          title="Pending Submission — User must upload docs"
          steps={['Inform user to upload supporting documents for Risk Review using the link in the backend.']}
          caseType={CASE_TYPES.risk_high}
          template={ET.G6660}
        >
          <QTCard qt={QT.highRisk_a} />
          <button onClick={() => setSub(null)} className="text-xs text-slate-500 hover:text-yellow-400 cursor-pointer">← Change status</button>
        </StepCard>
      )}

      {sub === 'review' && !reviewTime && (
        <div className="space-y-2">
          <p className="text-xs text-slate-400">How long has the review been pending?</p>
          <div className="grid grid-cols-2 gap-2">
            <SubOption label="≤ 48 hours" onClick={() => setReviewTime('lt48')} />
            <SubOption label="> 48 hours" onClick={() => setReviewTime('gt48')} />
          </div>
        </div>
      )}

      {sub === 'review' && reviewTime === 'lt48' && (
        <StepCard
          title="Under Review ≤ 48 hours"
          steps={['Inform user that the review may take up to 48 hours after receiving submitted documents.']}
          caseType={CASE_TYPES.risk_high}
          template={ET.G6982}
        >
          <QTCard qt={QT.highRisk_b} />
          <button onClick={() => setReviewTime(null)} className="text-xs text-slate-500 hover:text-yellow-400 cursor-pointer">← Change time</button>
        </StepCard>
      )}

      {sub === 'review' && reviewTime === 'gt48' && (
        <StepCard
          title="Under Review > 48 hours — Escalate to TechOps"
          steps={[
            'Offer a follow-up email with QT p2pG1-en-email-followup.',
            'Leave internal note (see below) and run Macro: P2P - High Risk Transaction (P1 to P2).',
            'Click "Send to TechOps" button.',
          ]}
          caseType={CASE_TYPES.risk_high}
          escalation={TECHOPS_NOTE(caseData.uid, 'Asking for report review progress')}
        >
          <QTCard qt={QT.followup} />
          <button onClick={() => setReviewTime(null)} className="text-xs text-slate-500 hover:text-yellow-400 cursor-pointer">← Change time</button>
        </StepCard>
      )}

      {sub === 'approved' && (
        <StepCard
          title="Approved — Retry in 24h"
          steps={['Inform user that review has been approved. Advise to retry P2P trading after 24 hours from ReviewTime.']}
          caseType={CASE_TYPES.risk_high}
          template={ET.G6665}
        >
          <QTCard qt={QT.highRisk_c} />
          <button onClick={() => setSub(null)} className="text-xs text-slate-500 hover:text-yellow-400 cursor-pointer">← Change status</button>
        </StepCard>
      )}

      {sub === 'rejected' && !rejectedType && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-slate-300">Scenario 1.1 — Check ban type + ExpireTime:</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <SubOption label="P2P Ban (All) + ExpireTime ✅" onClick={() => setRejectedType('p2pBan_exp')} />
            <SubOption label="P2P Ads Ban Only + ExpireTime ✅" onClick={() => setRejectedType('adsBan_exp')} />
            <SubOption label="P2P Ban (All) + No ExpireTime ❌" onClick={() => setRejectedType('p2pBan_perm')} />
            <SubOption label="P2P Ads Ban Only + No ExpireTime ❌" onClick={() => setRejectedType('adsBan_perm')} />
          </div>
        </div>
      )}

      {sub === 'rejected' && rejectedType === 'p2pBan_exp' && (
        <StepCard
          title="P2P Ban (All) — Temporary (with ExpireTime)"
          steps={['Inform user P2P trading is restricted temporarily and will be lifted on the expiration date shown in CSGO.', 'Modify "DD-MM-YYYY" in the ET to match the expiration date.']}
          caseType={CASE_TYPES.risk_high}
          template={ET.G6662}
        >
          <QTCard qt={QT.highRisk_d} />
          <button onClick={() => setRejectedType(null)} className="text-xs text-slate-500 hover:text-yellow-400 cursor-pointer">← Change ban type</button>
        </StepCard>
      )}

      {sub === 'rejected' && rejectedType === 'adsBan_exp' && (
        <StepCard
          title="P2P Ads Ban Only — Temporary (with ExpireTime)"
          steps={['Inform user P2P Ads feature is restricted temporarily and will be lifted on the expiration date.', 'Modify "DD-MM-YYYY" in the ET to match the expiration date.']}
          caseType={CASE_TYPES.risk_high}
          template={ET.G6664}
        >
          <QTCard qt={QT.highRisk_e} />
          <button onClick={() => setRejectedType(null)} className="text-xs text-slate-500 hover:text-yellow-400 cursor-pointer">← Change ban type</button>
        </StepCard>
      )}

      {sub === 'rejected' && rejectedType === 'p2pBan_perm' && (
        <StepCard
          title="P2P Ban (All) — Permanent"
          steps={['Offer follow-up email. Inform user Risk Review is Rejected and P2P Trading is permanently restricted.']}
          caseType={CASE_TYPES.risk_high}
          template={ET.G6661}
        >
          <QTCard qt={QT.followup} />
          <button onClick={() => setRejectedType(null)} className="text-xs text-slate-500 hover:text-yellow-400 cursor-pointer">← Change ban type</button>
        </StepCard>
      )}

      {sub === 'rejected' && rejectedType === 'adsBan_perm' && (
        <StepCard
          title="P2P Ads Ban Only — Permanent"
          steps={['Offer follow-up email. Inform user Risk Review is Rejected and P2P Ads posting is permanently restricted.']}
          caseType={CASE_TYPES.risk_high}
          template={ET.G6663}
        >
          <QTCard qt={QT.followup} />
          <button onClick={() => setRejectedType(null)} className="text-xs text-slate-500 hover:text-yellow-400 cursor-pointer">← Change ban type</button>
        </StepCard>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SCENARIO 2 — P2P VIOLATION
   ═══════════════════════════════════════════════════════════════ */

function ViolationFlow({ onBack, caseData }) {
  const [sub, setSub] = useState(null);

  return (
    <div className="space-y-4">
      <BackBtn onClick={onBack} />
      <h3 className="text-sm font-bold text-slate-100">⚠️ P2P Violation</h3>

      <InfoBox tone="blue">
        Ban remark contains <span className="font-mono text-yellow-300">maliciousComplaintOrReport</span> — check CSGO for ExpireDate.
      </InfoBox>

      {!sub && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <SubOption label="✅ With ExpireDate" onClick={() => setSub('with_expiry')} />
          <SubOption label="❌ No ExpireDate (Non-VIP)" onClick={() => setSub('no_expiry_non_vip')} />
          <SubOption label="❌ No ExpireDate (VIP)" onClick={() => setSub('no_expiry_vip')} />
        </div>
      )}

      {sub === 'with_expiry' && (
        <StepCard
          title="With ExpireDate — Temporary Ban"
          steps={['Inform user P2P Trading/Ads feature is restricted temporarily and will be lifted on the expiration date.', 'Modify "DD-MM-YYYY" in the ET to match the expiration date in CSGO.']}
          caseType={CASE_TYPES.risk_ban}
          template={ET.G6332}
        >
          <QTCard qt={QT.highRisk_d} />
          <button onClick={() => setSub(null)} className="text-xs text-slate-500 hover:text-yellow-400 cursor-pointer">← Change sub-scenario</button>
        </StepCard>
      )}

      {sub === 'no_expiry_non_vip' && (
        <StepCard
          title="No ExpireDate + Non-VIP — Permanent Ban"
          steps={['Offer follow-up email. Inform user that due to violation of P2P ToS, P2P Trading is permanently restricted.']}
          caseType={CASE_TYPES.risk_ban}
          template={ET.G6331}
        >
          <QTCard qt={QT.followup} />
          <button onClick={() => setSub(null)} className="text-xs text-slate-500 hover:text-yellow-400 cursor-pointer">← Change sub-scenario</button>
        </StepCard>
      )}

      {sub === 'no_expiry_vip' && (
        <StepCard
          title="No ExpireDate + VIP — Escalate to Pool 2"
          steps={[
            'Inform user that further escalation is required.',
            'Adjust case types and leave internal note (see below).',
            'Run Macro: Pool 1 to Pool 2.',
          ]}
          caseType={CASE_TYPES.risk_ban}
          escalation={`UID: ${caseData.uid || '[INPUT UID]'}\nAccount: VIP\nBan remark: [paste from CSGO]\nSummary: Account permanently banned. Please further review and follow up with the user.\n— Run Macro Pool 1 to Pool 2`}
        >
          <QTCard qt={QT.followup} />
          <button onClick={() => setSub(null)} className="text-xs text-slate-500 hover:text-yellow-400 cursor-pointer">← Change sub-scenario</button>
        </StepCard>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SCENARIO 3 — SENSITIVE WORDS
   ═══════════════════════════════════════════════════════════════ */

function SensitiveWordsFlow({ onBack, caseData }) {
  const [sub, setSub] = useState(null);
  const [reviewTime, setReviewTime] = useState(null);

  return (
    <div className="space-y-4">
      <BackBtn onClick={onBack} />
      <h3 className="text-sm font-bold text-slate-100">🔤 Sensitive Words Triggered</h3>

      <InfoBox tone="blue">
        Images in P2P chat window are scanned for sensitive content. If detected, account is restricted.
        <br /><strong>How to check:</strong> Risk Order for matching Order ID. If type = APPEAL-P2P, follow status below.
      </InfoBox>

      {!sub && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <SubOption label="Pending Submission" onClick={() => setSub('pending')} />
          <SubOption label="Under Review" onClick={() => setSub('review')} />
        </div>
      )}

      {sub === 'pending' && (
        <StepCard
          title="Pending Submission"
          steps={['Inform user to upload supporting documents for Risk Review using the link in the backend.']}
          caseType={CASE_TYPES.risk_ban}
          template={ET.G6660}
        >
          <QTCard qt={QT.highRisk_a} />
          <button onClick={() => setSub(null)} className="text-xs text-slate-500 hover:text-yellow-400 cursor-pointer">← Change status</button>
        </StepCard>
      )}

      {sub === 'review' && !reviewTime && (
        <div className="space-y-2">
          <p className="text-xs text-slate-400">How long has the review been pending?</p>
          <div className="grid grid-cols-2 gap-2">
            <SubOption label="≤ 48 hours" onClick={() => setReviewTime('lt48')} />
            <SubOption label="> 48 hours" onClick={() => setReviewTime('gt48')} />
          </div>
        </div>
      )}

      {sub === 'review' && reviewTime === 'lt48' && (
        <StepCard
          title="Under Review ≤ 48 hours"
          steps={['Inform user the review may take up to 48 hours after receiving submitted documents.']}
          caseType={CASE_TYPES.risk_ban}
          template={ET.G6982}
        >
          <QTCard qt={QT.highRisk_b} />
          <button onClick={() => setReviewTime(null)} className="text-xs text-slate-500 hover:text-yellow-400 cursor-pointer">← Change time</button>
        </StepCard>
      )}

      {sub === 'review' && reviewTime === 'gt48' && (
        <StepCard
          title="Under Review > 48 hours — Escalate to TechOps"
          steps={[
            'Offer follow-up email.',
            'Leave internal note and run Macro: P2P - Sensitive Words Triggered (P1 to P2).',
            'Click "Send to TechOps" button.',
          ]}
          caseType={CASE_TYPES.risk_ban}
          escalation={TECHOPS_NOTE(caseData.uid, 'Asking for report review progress')}
        >
          <QTCard qt={QT.followup} />
          <button onClick={() => setReviewTime(null)} className="text-xs text-slate-500 hover:text-yellow-400 cursor-pointer">← Change time</button>
        </StepCard>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SCENARIO 4 — OFFLINE APPEAL (>5 days)
   ═══════════════════════════════════════════════════════════════ */

function OfflineAppealFlow({ onBack, caseData }) {
  const [sub, setSub] = useState(null);
  const [replyTime, setReplyTime] = useState(null);

  return (
    <div className="space-y-4">
      <BackBtn onClick={onBack} />
      <h3 className="text-sm font-bold text-slate-100">📧 Offline Appeal — Financial Loss</h3>

      <InfoBox tone="blue">
        <strong>Offline appeal</strong> = P2P order closed &gt; 5 working days. User can no longer appeal via the Landing Page.
        Counterparty submitted appeal offline → asset loss.
      </InfoBox>

      <StepCard
        title="Step 1: Check for ongoing email/webform cases with same Order ID"
        steps={[
          'Search for existing email/webform cases matching the Order ID.',
          'If found → select case status below. If not found → proceed as "No case found" below.',
        ]}
      />

      {!sub && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <SubOption label="Case found — Pending CS Reply / Pending Trader Reply" onClick={() => setSub('found_pending')} />
          <SubOption label="Educate user + merge tickets" onClick={() => setSub('educate')} />
        </div>
      )}

      {sub === 'found_pending' && !replyTime && (
        <div className="space-y-2">
          <p className="text-xs text-slate-400">Last reply time:</p>
          <div className="grid grid-cols-2 gap-2">
            <SubOption label="≤ 48 hours" onClick={() => setReplyTime('lt48')} />
            <SubOption label="> 48 hours" onClick={() => setReplyTime('gt48')} />
          </div>
        </div>
      )}

      {sub === 'found_pending' && replyTime === 'lt48' && (
        <StepCard
          title="Last reply ≤ 48h — Wait patiently"
          steps={['Inform user the review may take up to 48 hours. Ask them to wait patiently during this period.']}
          caseType={CASE_TYPES.dispute_both}
        >
          <button onClick={() => setReplyTime(null)} className="text-xs text-slate-500 hover:text-yellow-400 cursor-pointer">← Change time</button>
        </StepCard>
      )}

      {sub === 'found_pending' && replyTime === 'gt48' && (
        <StepCard
          title="Last reply > 48h — Submit Case Expedition"
          steps={['Offer follow-up email.', 'Submit case expedition form to expedite the case.']}
          caseType={CASE_TYPES.dispute_both}
        >
          <QTCard qt={QT.followup} />
          <button onClick={() => setReplyTime(null)} className="text-xs text-slate-500 hover:text-yellow-400 cursor-pointer">← Change time</button>
        </StepCard>
      )}

      {sub === 'educate' && (
        <StepCard
          title="Educate user + merge new case into ongoing email/webform"
          steps={[
            'Educate user to follow instructions sent via email, and provide proof in the email reply.',
            'Merge new case into the ongoing email/webform case (NOT landing page cases).',
            'Set status: if last reply from Pool 2 → Pending Trader Reply; if from user → Pending CS Reply.',
          ]}
          caseType={CASE_TYPES.dispute_both}
        >
          <QTCard qt={QT.offlineAppeal} />
          <InfoBox tone="yellow">
            <strong>DO NOT</strong> merge into "landing page" cases. <strong>DO NOT</strong> leave internal notes on landing page cases.
          </InfoBox>
        </StepCard>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SCENARIO 5 — ONLINE APPEAL (≤5 days)
   ═══════════════════════════════════════════════════════════════ */

function OnlineAppealFlow({ onBack, caseData }) {
  const [sub, setSub] = useState(null);
  const [replyTime, setReplyTime] = useState(null);

  return (
    <div className="space-y-4">
      <BackBtn onClick={onBack} />
      <h3 className="text-sm font-bold text-slate-100">🖥️ Online Appeal — Financial Loss</h3>

      <InfoBox tone="blue">
        <strong>Online appeal</strong> = P2P order closed ≤ 5 working days. User can still appeal via the Landing Page.
        Counterparty submitted online appeal → ban due to no response and insufficient balance.
      </InfoBox>

      {!sub && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <SubOption label="No ongoing case found" onClick={() => setSub('no_case')} />
          <SubOption label="Case found — Pending CS/Trader Reply" onClick={() => setSub('found_pending')} />
          <SubOption label="Educate user + merge tickets" onClick={() => setSub('educate')} />
        </div>
      )}

      {sub === 'no_case' && (
        <StepCard
          title="No ongoing email/webform case — Expedite"
          steps={['Offer follow-up email.', 'Submit case expedition form to expedite the case.']}
          caseType={CASE_TYPES.dispute_both}
        >
          <QTCard qt={QT.followup} />
        </StepCard>
      )}

      {sub === 'found_pending' && !replyTime && (
        <div className="space-y-2">
          <p className="text-xs text-slate-400">Last reply time:</p>
          <div className="grid grid-cols-2 gap-2">
            <SubOption label="≤ 48 hours" onClick={() => setReplyTime('lt48')} />
            <SubOption label="> 48 hours" onClick={() => setReplyTime('gt48')} />
          </div>
        </div>
      )}

      {sub === 'found_pending' && replyTime === 'lt48' && (
        <StepCard
          title="Last reply ≤ 48h — Wait patiently"
          steps={['Inform user the review may take up to 48 hours.']}
          caseType={CASE_TYPES.dispute_both}
        />
      )}

      {sub === 'found_pending' && replyTime === 'gt48' && (
        <StepCard
          title="Last reply > 48h — Submit Case Expedition"
          steps={['Offer follow-up email.', 'Submit case expedition form to expedite the case.']}
          caseType={CASE_TYPES.dispute_both}
        >
          <QTCard qt={QT.followup} />
        </StepCard>
      )}

      {sub === 'educate' && (
        <StepCard
          title="Educate user + merge new case into ongoing email/webform"
          steps={[
            'Educate user to follow email instructions and provide proof in the reply.',
            'Merge new case into ongoing email/webform (NOT landing page cases).',
            'Set status: if last reply from Pool 2 → Pending Trader Reply; if from user → Pending CS Reply.',
          ]}
          caseType={CASE_TYPES.dispute_both}
        >
          <QTCard qt={QT.onlineAppeal} />
          <InfoBox tone="yellow">
            <strong>DO NOT</strong> merge into landing page cases. <strong>DO NOT</strong> leave internal notes there.
          </InfoBox>
        </StepCard>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SCENARIO 6 — P2P SCAMMER (NO ASSET)
   ═══════════════════════════════════════════════════════════════ */

function ScammerNoAssetFlow({ onBack }) {
  return (
    <div className="space-y-4">
      <BackBtn onClick={onBack} />
      <h3 className="text-sm font-bold text-slate-100">🚫 P2P Scammer — No Asset</h3>

      <InfoBox tone="red">
        User scammed counterparty in a P2P order, leaving <strong>no assets remaining</strong>. Account + P2P permanently restricted.
      </InfoBox>

      <StepCard
        title="Permanent ban — offer follow-up email"
        steps={[
          'Offer follow-up email.',
          'Inform user their account and P2P Trading access are permanently restricted.',
        ]}
        caseType={CASE_TYPES.dispute_both}
        template={ET.G6001}
      >
        <QTCard qt={QT.followup} />
      </StepCard>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SCENARIO 7 — P2P SCAMMER (WITH ASSET)
   ═══════════════════════════════════════════════════════════════ */

function ScammerWithAssetFlow({ onBack, caseData }) {
  const [sub, setSub] = useState(null);

  return (
    <div className="space-y-4">
      <BackBtn onClick={onBack} />
      <h3 className="text-sm font-bold text-slate-100">💰 P2P Scammer — With Asset</h3>

      <InfoBox tone="blue">
        User scammed counterparty but has remaining assets. Assets held for 90 days for investigation; may compensate additional victims.
      </InfoBox>

      {!sub && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <SubOption label="Regular — 90 day hold" onClick={() => setSub('regular')} />
          <SubOption label="Serious Suspection (封禁重度嫌疑)" onClick={() => setSub('serious')} />
        </div>
      )}

      {sub === 'regular' && (
        <div className="space-y-4">
          <StepCard
            title="Step 1: 90-day hold — submit webform after expiry"
            steps={[
              'Advise user account is restricted for 90 days.',
              'Submit webform to lift restriction based on expiration date in backend.',
              'Modify "DD-MM-YYYY" in ET to "Operation Time + 90 days".',
            ]}
            caseType={CASE_TYPES.dispute_both}
            template={ET.G6002}
          >
            <QTCard qt={QT.scammer90d} />
          </StepCard>

          <StepCard
            title="Step 2: If ban still applies after 90 days — Escalate to Pool 2"
            steps={[
              'Offer follow-up email.',
              'Adjust case types, leave internal note, and run Macro: Pool 1 to Pool 2.',
            ]}
            caseType={CASE_TYPES.dispute_both}
            escalation={`UID: ${caseData.uid || '[INPUT UID]'}\nAccount: VIP\nBan remark: [paste from CSGO]\nSummary: Account remain ban after 90 days. Please further review and follow up with the user.\n— Run Macro Pool 1 to Pool 2`}
          >
            <QTCard qt={QT.followup} />
          </StepCard>

          <button onClick={() => setSub(null)} className="text-xs text-slate-500 hover:text-yellow-400 cursor-pointer">← Change variant</button>
        </div>
      )}

      {sub === 'serious' && (
        <StepCard
          title="Serious Suspection — Immediate Escalation to Pool 2"
          steps={[
            'Inform user further escalation is required.',
            'Adjust case types, leave internal note, and run Macro: Pool 1 to Pool 2.',
          ]}
          caseType={CASE_TYPES.risk_ban}
          escalation={`UID: ${caseData.uid || '[INPUT UID]'}\nAccount: VIP\nBan remark: P2P-Scammer (Serious Suspection) [paste full remark]\nSummary: Account permanently banned. Please further review and follow up with the user.\n— Run Macro Pool 1 to Pool 2`}
        >
          <QTCard qt={QT.followup} />
          <InfoBox tone="red">
            In Charge Team: Product Risk Team. Restriction Reason: <strong>Scammer - Serious Suspection</strong>. Column 4 (Account Ban) must be completed thoroughly.
          </InfoBox>
          <button onClick={() => setSub(null)} className="text-xs text-slate-500 hover:text-yellow-400 cursor-pointer">← Change variant</button>
        </StepCard>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   SCENARIO 8 — WRONG JUDGMENT BY AGENT
   ═══════════════════════════════════════════════════════════════ */

function WrongJudgmentFlow({ onBack }) {
  return (
    <div className="space-y-4">
      <BackBtn onClick={onBack} />
      <h3 className="text-sm font-bold text-slate-100">⚖️ Wrong Judgment by Agent</h3>

      <InfoBox tone="blue">
        Order was incorrectly judged by the agent. Withdrawal ban is <strong>temporary</strong> — only for asset transfer. Process takes 3-5 business days.
      </InfoBox>

      <StepCard
        title="Notify user — 3-5 business days"
        steps={[
          'Inform user asset transfer takes 3-5 business days; ban lifts after.',
          'Check for ongoing email/webform cases with same Order ID.',
          'Merge new case into ongoing email/webform (NOT landing page cases).',
          'Set status: if last reply from Pool 2 → On hold (Others); if from user → On hold (Others).',
        ]}
        caseType={CASE_TYPES.dispute_both}
      >
        <QTCard qt={QT.wrongJudgment} />
        <InfoBox tone="yellow">
          <strong>DO NOT</strong> merge into landing page cases. <strong>DO NOT</strong> leave internal notes there.
        </InfoBox>
      </StepCard>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SCENARIO 9 — P2P REPORT / REPORT DISAGREE
   ═══════════════════════════════════════════════════════════════ */

function ReportFlow({ onBack, caseData }) {
  const [branch, setBranch] = useState(null);

  return (
    <div className="space-y-4">
      <BackBtn onClick={onBack} />
      <h3 className="text-sm font-bold text-slate-100">📋 P2P Report / Disagree</h3>

      <InfoBox tone="blue">
        Check CSGO {'>'} User Profile {'>'} Funding {'>'} Risk Order. Type = <span className="font-mono text-yellow-300">P2PReport</span> (filed report) or <span className="font-mono text-yellow-300">P2PReportDisagree</span> (counterparty disagreed within 72h).
      </InfoBox>

      {!branch && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <SubOption label="9.1 — P2P Report Ban" onClick={() => setBranch('report')} />
          <SubOption label="9.2 — P2P Report Disagree" onClick={() => setBranch('disagree')} />
        </div>
      )}

      {branch === 'report' && <ReportBanBranch onBack={() => setBranch(null)} caseData={caseData} />}
      {branch === 'disagree' && <ReportDisagreeBranch onBack={() => setBranch(null)} caseData={caseData} />}
    </div>
  );
}

function ReportBanBranch({ onBack, caseData }) {
  const [status, setStatus] = useState(null);
  const [subTime, setSubTime] = useState(null);
  const [rejectType, setRejectType] = useState(null);

  return (
    <div className="space-y-3">
      <button onClick={onBack} className="text-xs text-slate-500 hover:text-yellow-400 cursor-pointer">← Back to 9.1/9.2 choice</button>
      <h4 className="text-sm font-semibold text-slate-200">9.1 — P2P Report Ban</h4>

      {!status && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <SubOption label="Under Review" onClick={() => setStatus('review')} />
          <SubOption label="Approved" onClick={() => setStatus('approved')} />
          <SubOption label="Rejected" onClick={() => setStatus('rejected')} />
        </div>
      )}

      {status === 'review' && !subTime && (
        <div className="space-y-2">
          <p className="text-xs text-slate-400">Time since Trigger Time:</p>
          <div className="grid grid-cols-2 gap-2">
            <SubOption label="≤ 48 hours" onClick={() => setSubTime('lt48')} />
            <SubOption label="> 48 hours" onClick={() => setSubTime('gt48')} />
          </div>
        </div>
      )}

      {status === 'review' && subTime === 'lt48' && (
        <StepCard
          title="Under Review ≤ 48 hours"
          steps={['Inform user the review may take up to 48 hours.']}
          caseType={CASE_TYPES.risk_report}
          template={ET.G6982}
        >
          <QTCard qt={QT.highRisk_b} />
        </StepCard>
      )}

      {status === 'review' && subTime === 'gt48' && (
        <StepCard
          title="Under Review > 48 hours — Escalate to TechOps"
          steps={[
            'Offer follow-up email.',
            'Leave internal note and run Macro: P2P - P2P Report (P1 to P2).',
            'Click "Send to TechOps" button.',
          ]}
          caseType={CASE_TYPES.risk_report}
          escalation={TECHOPS_NOTE(caseData.uid, 'Asking for report review progress')}
        >
          <QTCard qt={QT.followup} />
        </StepCard>
      )}

      {status === 'approved' && !subTime && (
        <div className="space-y-2">
          <p className="text-xs text-slate-400">Time since Review Time:</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <SubOption label="≤ 72h (within dispute window)" onClick={() => setSubTime('within72')} />
            <SubOption label="> 72h — User has NO P2P ban" onClick={() => setSubTime('after72_noban')} />
            <SubOption label="> 72h — User has been banned" onClick={() => setSubTime('after72_banned')} />
          </div>
        </div>
      )}

      {status === 'approved' && subTime === 'within72' && (
        <StepCard
          title="Approved within 72h — Counterparty still has 3 days"
          steps={['Advise user review is complete but not final yet — counterparty has 3 days to dispute.']}
          caseType={CASE_TYPES.risk_report}
          template={ET.G6985}
        >
          <QTCard qt={QT.reportApprovedIn72} />
        </StepCard>
      )}

      {status === 'approved' && subTime === 'after72_noban' && (
        <StepCard
          title="Approved after 72h — User has no ban"
          steps={['Inform user the report was approved. Refer to system email notification.']}
          caseType={CASE_TYPES.risk_report}
          template={ET.G6985a}
        >
          <QTCard qt={QT.reportApprovedAfter72} />
        </StepCard>
      )}

      {status === 'approved' && subTime === 'after72_banned' && (
        <StepCard
          title="Approved after 72h — User has been banned"
          steps={[
            'Offer follow-up email.',
            'Inform user that Risk Review result is Rejected and P2P Trading/Ads is permanently restricted.',
            'Apply G6987a (Report Ban) OR G6988a (Trading Ban) depending on ban type.',
          ]}
          caseType={CASE_TYPES.risk_report}
        >
          <QTCard qt={QT.followup} />
          <TemplateCard et={ET.G6987a} />
          <TemplateCard et={ET.G6988a} />
        </StepCard>
      )}

      {status === 'rejected' && !rejectType && (
        <div className="space-y-2">
          <p className="text-xs text-slate-400">Account status:</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <SubOption label="No Restriction Found" onClick={() => setRejectType('no_ban')} />
            <SubOption label="P2P Report / Trading Ban" onClick={() => setRejectType('with_ban')} />
            <SubOption label="User wants to appeal result" onClick={() => setRejectType('appeal')} />
          </div>
        </div>
      )}

      {status === 'rejected' && rejectType === 'no_ban' && (
        <StepCard
          title="Rejected — No Ban"
          steps={['Inform user P2P report is rejected. User may reply to notification email within 3 days to request additional review.']}
          caseType={CASE_TYPES.risk_report}
          template={ET.G6986a}
        >
          <QTCard qt={QT.reportRejectedNoBan} />
        </StepCard>
      )}

      {status === 'rejected' && rejectType === 'with_ban' && (
        <StepCard
          title="Rejected — With P2P Report or Trading Ban"
          steps={[
            'Offer follow-up email.',
            'Apply G6987b (Report Ban) OR G6988b (Trading Ban) depending on ban type.',
          ]}
          caseType={CASE_TYPES.risk_report}
        >
          <QTCard qt={QT.followup} />
          <TemplateCard et={ET.G6987b} />
          <TemplateCard et={ET.G6988b} />
        </StepCard>
      )}

      {status === 'rejected' && rejectType === 'appeal' && (
        <StepCard
          title="User wants to appeal — Escalate to TechOps"
          steps={[
            'Apply ET G6981.',
            'Leave internal note (see below) and run Macro: P2P - P2P Report (P1 to P2).',
            'Click "Send to TechOps" button.',
          ]}
          caseType={CASE_TYPES.risk_report}
          escalation={`Summary: P2P Report was rejected, but the user wishes to object to this decision\nUID: ${caseData.uid || '[INPUT UID]'}\nAppeal ID: [paste]\nReason: [from user]\nOID: [if any]\nSupporting Documents: [attach]\n— Click Send to TechOps`}
          template={ET.G6981}
        />
      )}
    </div>
  );
}

function ReportDisagreeBranch({ onBack, caseData }) {
  const [status, setStatus] = useState(null);
  const [subTime, setSubTime] = useState(null);
  const [subType, setSubType] = useState(null);

  return (
    <div className="space-y-3">
      <button onClick={onBack} className="text-xs text-slate-500 hover:text-yellow-400 cursor-pointer">← Back to 9.1/9.2 choice</button>
      <h4 className="text-sm font-semibold text-slate-200">9.2 — P2P Report Disagree Ban</h4>

      <InfoBox tone="blue">
        Counterparty responded within 72h and disagrees with the report.
      </InfoBox>

      {!status && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <SubOption label="Pending Submission" onClick={() => setStatus('pending')} />
          <SubOption label="Under Review" onClick={() => setStatus('review')} />
          <SubOption label="Approved" onClick={() => setStatus('approved')} />
          <SubOption label="Rejected" onClick={() => setStatus('rejected')} />
        </div>
      )}

      {status === 'pending' && !subTime && (
        <div className="space-y-2">
          <p className="text-xs text-slate-400">Time since Trigger Time:</p>
          <div className="grid grid-cols-2 gap-2">
            <SubOption label="≤ 72 hours" onClick={() => setSubTime('lt72')} />
            <SubOption label="> 72 hours" onClick={() => setSubTime('gt72')} />
          </div>
        </div>
      )}

      {status === 'pending' && subTime === 'lt72' && (
        <StepCard
          title="Pending ≤ 72h — User submits dispute"
          steps={['Inform user to submit dispute within 72h if they believe the report is inaccurate.']}
          caseType={CASE_TYPES.risk_objection}
          template={ET.G6980}
        >
          <QTCard qt={QT.reportDisagreeSubmit} />
        </StepCard>
      )}

      {status === 'pending' && subTime === 'gt72' && (
        <div className="space-y-3">
          <p className="text-xs text-slate-400">VIP status:</p>
          <div className="grid grid-cols-2 gap-2">
            <SubOption label="Non-VIP" onClick={() => setSubType('non_vip')} />
            <SubOption label="VIP" onClick={() => setSubType('vip')} />
          </div>

          {subType === 'non_vip' && (
            <StepCard
              title="> 72h + Non-VIP — Objection Expired"
              steps={['Inform user the objection period has already passed. No more appeals allowed.']}
              caseType={CASE_TYPES.risk_objection}
              template={ET.G6989}
            >
              <QTCard qt={QT.reportDisagreeExpired} />
            </StepCard>
          )}

          {subType === 'vip' && (
            <StepCard
              title="> 72h + VIP — Escalate to Pool 2"
              steps={[
                'Offer follow-up email.',
                'Adjust case types, leave internal note, run Macro: Pool 1 to Pool 2.',
              ]}
              caseType={CASE_TYPES.risk_objection}
              escalation={`UID: ${caseData.uid || '[INPUT UID]'}\nAccount: VIP\nSummary: > 72 hours did not send the objection report. Kindly assist with this.\n— Run Macro Pool 1 to Pool 2`}
            >
              <QTCard qt={QT.followup} />
            </StepCard>
          )}
        </div>
      )}

      {status === 'review' && !subTime && (
        <div className="space-y-2">
          <p className="text-xs text-slate-400">Time since Review Time:</p>
          <div className="grid grid-cols-2 gap-2">
            <SubOption label="≤ 48 hours" onClick={() => setSubTime('lt48')} />
            <SubOption label="> 48 hours" onClick={() => setSubTime('gt48')} />
          </div>
        </div>
      )}

      {status === 'review' && subTime === 'lt48' && (
        <StepCard
          title="Under Review ≤ 48h"
          steps={['Inform user the review may take up to 48 hours.']}
          caseType={CASE_TYPES.risk_objection}
          template={ET.G6982}
        >
          <QTCard qt={QT.highRisk_b} />
        </StepCard>
      )}

      {status === 'review' && subTime === 'gt48' && (
        <StepCard
          title="Under Review > 48h — Escalate to TechOps"
          steps={[
            'Offer follow-up email.',
            'Leave internal note and run Macro: P2P Report Disagree (P1 to P2).',
            'Click "Send to TechOps" button.',
          ]}
          caseType={CASE_TYPES.risk_objection}
          escalation={TECHOPS_NOTE(caseData.uid, 'Asking for report review progress')}
        >
          <QTCard qt={QT.followup} />
        </StepCard>
      )}

      {status === 'approved' && (
        <StepCard
          title="Approved — Full access restored"
          steps={['Inform user review is approved. Full account access restored.']}
          caseType={CASE_TYPES.risk_objection}
          template={ET.G6983}
        >
          <QTCard qt={QT.reportDisagreeSuccess} />
        </StepCard>
      )}

      {status === 'rejected' && !subType && (
        <div className="space-y-2">
          <p className="text-xs text-slate-400">Account status:</p>
          <div className="grid grid-cols-2 gap-2">
            <SubOption label="No Restriction Found" onClick={() => setSubType('no_ban')} />
            <SubOption label="Withdrawal Ban Found" onClick={() => setSubType('withdrawal_ban')} />
          </div>
        </div>
      )}

      {status === 'rejected' && subType === 'no_ban' && (
        <StepCard
          title="Rejected — No Ban (Objection Accepted)"
          steps={['Inform user objection has been accepted and account resumes normal operation.']}
          caseType={CASE_TYPES.risk_objection}
          template={ET.G6983}
        >
          <QTCard qt={QT.reportRejectedNoBan} />
        </StepCard>
      )}

      {status === 'rejected' && subType === 'withdrawal_ban' && (
        <StepCard
          title="Rejected — Withdrawal Ban → Escalate to Pool 2"
          steps={[
            'Offer follow-up email.',
            'Adjust case types, leave internal note, run Macro: Pool 1 to Pool 2.',
          ]}
          caseType={CASE_TYPES.risk_objection}
          escalation={`UID: ${caseData.uid || '[INPUT UID]'}\nAccount status: [paste]\nBan remark: [paste]\nSummary: Kindly confirm if the user is scammer and follow-up with the user.\n— Run Macro Pool 1 to Pool 2`}
        >
          <QTCard qt={QT.followup} />
        </StepCard>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SCENARIO 10 — COMPANY RISK TRIGGERED
   ═══════════════════════════════════════════════════════════════ */

function CompanyRiskFlow({ onBack, caseData }) {
  return (
    <div className="space-y-4">
      <BackBtn onClick={onBack} />
      <h3 className="text-sm font-bold text-slate-100">🏢 Company Risk Triggered</h3>

      <InfoBox tone="blue">
        <strong>Conditions:</strong> No record found in CSGO Risk Order, BUT UID is found in P2P Company Risk Team Hits (Lark group).
      </InfoBox>

      <StepCard
        title="Escalate to Pool 2"
        steps={[
          'Inform user further escalation is required.',
          'Adjust case types, leave internal note (see below), and run Macro: Pool 1 to Pool 2.',
        ]}
        caseType={CASE_TYPES.risk_ban}
        escalation={`UID: ${caseData.uid || '[INPUT UID]'}\nLabel Remark: [Labeling from Lark Group]\nSummary: [Brief description of Company Risk Team hit]\n— Run Macro Pool 1 to Pool 2`}
      >
        <QTCard qt={QT.followup} />
        <InfoBox tone="red">
          Column 4 (Account Ban) must be completed thoroughly. In Charge Team: <strong>Product Risk Team</strong>. Restriction Reason: <strong>System - Company Risk</strong>.
        </InfoBox>
      </StepCard>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SCENARIO 11 — AMOUNT FROZEN
   ═══════════════════════════════════════════════════════════════ */

function FrozenFlow({ onBack, caseData }) {
  const [subTime, setSubTime] = useState(null);

  return (
    <div className="space-y-4">
      <BackBtn onClick={onBack} />
      <h3 className="text-sm font-bold text-slate-100">❄️ Amount Frozen After Order Cancel/Complete</h3>

      <InfoBox tone="blue">
        <strong>How to verify:</strong> Asset {'>'} Detail of Asset {'>'} OrderLock matches order amount. Asset {'>'} Frozen Asset Details {'>'} ChangeType = <span className="font-mono text-yellow-300">Fiat Deposit Freeze - Risk Control (Transfer in)</span>.
      </InfoBox>

      {!subTime && (
        <div className="grid grid-cols-2 gap-2">
          <SubOption label="≤ 48 hours" onClick={() => setSubTime('lt48')} />
          <SubOption label="> 48 hours" onClick={() => setSubTime('gt48')} />
        </div>
      )}

      {subTime === 'lt48' && (
        <StepCard
          title="≤ 48 hours — Wait patiently"
          steps={['Inform user the review may take up to 48 hours.']}
          caseType={CASE_TYPES.risk_asset}
          template={ET.G6980}
        >
          <QTCard qt={QT.assetFrozen} />
        </StepCard>
      )}

      {subTime === 'gt48' && (
        <StepCard
          title="> 48 hours — Escalate to Pool 2"
          steps={[
            'Offer follow-up email.',
            'Adjust case types, leave internal note, run Macro: Pool 1 to Pool 2.',
          ]}
          caseType={CASE_TYPES.risk_asset}
          escalation={`UID: ${caseData.uid || '[INPUT UID]'}\nP2P Order ID: ${caseData.oid || '[INPUT ORDER ID]'}\nFrozen amount: [paste]\nSummary: [Brief description]\n— Run Macro Pool 1 to Pool 2`}
        >
          <QTCard qt={QT.followup} />
          <InfoBox tone="red">
            Column 4 (Account Ban) must be completed thoroughly. In Charge Team: <strong>Product Risk Team</strong>.
          </InfoBox>
        </StepCard>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SCENARIO 12 — T+1 WITHDRAWAL RESTRICTION
   ═══════════════════════════════════════════════════════════════ */

function T1Flow({ onBack }) {
  return (
    <div className="space-y-4">
      <BackBtn onClick={onBack} />
      <h3 className="text-sm font-bold text-slate-100">⏰ T+1 Withdrawal Restriction</h3>

      <InfoBox tone="blue">
        <strong>How to verify:</strong> CSGO {'>'} Asset {'>'} Withdrawal Restriction {'>'} Type: <span className="font-mono text-yellow-300">Buy Crypto</span>.
        <br /><strong>Reason:</strong> P2P order triggered T+1 — fund withdrawals restricted for one full day (T) from transaction completion.
      </InfoBox>

      <StepCard
        title="Notify user of unfreeze time"
        steps={[
          'Inform user of the unfreeze time (UTC+0) from the P2P Order History Page.',
          'Modify "XXX UTC+0" in the ET to the exact unfreeze time.',
        ]}
        caseType={CASE_TYPES.trading_guide}
        template={ET.G6882}
      >
        <QTCard qt={QT.t1Restriction} />
      </StepCard>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SCENARIO 13 — HIGH RISK ADVERTISER
   ═══════════════════════════════════════════════════════════════ */

function HighRiskAdvFlow({ onBack, caseData }) {
  const [status, setStatus] = useState(null);
  const [subTime, setSubTime] = useState(null);
  const [subType, setSubType] = useState(null);

  return (
    <div className="space-y-4">
      <BackBtn onClick={onBack} />
      <h3 className="text-sm font-bold text-slate-100">📢 High Risk Advertiser</h3>

      <InfoBox tone="blue">
        Advertiser flagged by risk system — needs 200 USDT security deposit + documents for review.
        <br /><strong>How to check:</strong> CSGO {'>'} Risk Order. Type = MarginFrozenHighRisk / MarginFrozenLowRisk / MarginFrozenAppeal.
      </InfoBox>

      {!status && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <SubOption label="Pending Submission" onClick={() => setStatus('pending')} />
          <SubOption label="Under Review" onClick={() => setStatus('review')} />
          <SubOption label="Approved" onClick={() => setStatus('approved')} />
          <SubOption label="Rejected" onClick={() => setStatus('rejected')} />
        </div>
      )}

      {status === 'pending' && (
        <StepCard
          title="Pending — Security Deposit + Docs"
          steps={['Inform user to make security deposit (200 USDT) and submit required documents.']}
          caseType={CASE_TYPES.advertiser_app}
          template={ET.G6650}
        >
          <QTCard qt={QT.highRiskAdv_a} />
        </StepCard>
      )}

      {status === 'review' && !subTime && (
        <div className="space-y-2">
          <p className="text-xs text-slate-400">Time since submission:</p>
          <div className="grid grid-cols-2 gap-2">
            <SubOption label="≤ 48 hours" onClick={() => setSubTime('lt48')} />
            <SubOption label="> 48 hours" onClick={() => setSubTime('gt48')} />
          </div>
        </div>
      )}

      {status === 'review' && subTime === 'lt48' && (
        <StepCard
          title="Under Review ≤ 48h"
          steps={['Inform user the review may take up to 48 hours.']}
          caseType={CASE_TYPES.advertiser_app}
          template={ET.G6651}
        >
          <QTCard qt={QT.highRiskAdv_a} />
        </StepCard>
      )}

      {status === 'review' && subTime === 'gt48' && (
        <StepCard
          title="Under Review > 48h — Escalate to Pool 2"
          steps={[
            'Offer follow-up email.',
            'Adjust case types, leave internal note, run Macro: Pool 1 to Pool 2.',
          ]}
          caseType={CASE_TYPES.advertiser_app}
          escalation={`UID: ${caseData.uid || '[INPUT UID]'}\nSummary: [Brief description]\n— Run Macro Pool 1 to Pool 2`}
        >
          <QTCard qt={QT.followup} />
        </StepCard>
      )}

      {status === 'approved' && (
        <StepCard
          title="Approved — Proceed to Advertiser Program"
          steps={['Inform user review is successful. They may now apply via the Advertiser Program page.']}
          caseType={CASE_TYPES.advertiser_app}
          template={ET.G6652}
        >
          <QTCard qt={QT.highRiskAdv_b} />
        </StepCard>
      )}

      {status === 'rejected' && !subType && (
        <div className="space-y-2">
          <p className="text-xs text-slate-400">Account status:</p>
          <div className="grid grid-cols-2 gap-2">
            <SubOption label="No Restriction Found" onClick={() => setSubType('no_ban')} />
            <SubOption label="P2P Ads / Withdrawal Ban" onClick={() => setSubType('with_ban')} />
          </div>
        </div>
      )}

      {status === 'rejected' && subType === 'no_ban' && (
        <StepCard
          title="Rejected — No Ban — Resubmit"
          steps={['Inform user advertiser risk review was rejected — docs did not meet requirements. User may resubmit; another 48h review.']}
          caseType={CASE_TYPES.advertiser_app}
          template={ET.G6653}
        >
          <QTCard qt={QT.highRiskAdv_c} />
        </StepCard>
      )}

      {status === 'rejected' && subType === 'with_ban' && (
        <StepCard
          title="Rejected — With Ban"
          steps={[
            'Offer follow-up email.',
            'Apply ET G6653 and follow ticket/follow-up handling.',
          ]}
          caseType={CASE_TYPES.advertiser_app}
          template={ET.G6653}
        >
          <QTCard qt={QT.followup} />
        </StepCard>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN EXPORT
   ═══════════════════════════════════════════════════════════════ */

const FLOWS = {
  high_risk: HighRiskFlow,
  violation: ViolationFlow,
  sensitive: SensitiveWordsFlow,
  offline_appeal: OfflineAppealFlow,
  online_appeal: OnlineAppealFlow,
  scammer_no_asset: ScammerNoAssetFlow,
  scammer_with_asset: ScammerWithAssetFlow,
  wrong_judgment: WrongJudgmentFlow,
  report: ReportFlow,
  company_risk: CompanyRiskFlow,
  frozen: FrozenFlow,
  t1: T1Flow,
  high_risk_adv: HighRiskAdvFlow,
};

export default function P2PRestriction() {
  const [scenario, setScenario] = useState(null);
  const [caseData, setCaseData] = useState({ uid: '', oid: '', accountStatus: '', vip: '' });
  const [qtsOpen, setQtsOpen] = useState(false);
  const [etsOpen, setEtsOpen] = useState(false);
  const [hcOpen, setHcOpen] = useState(false);

  const currentScenario = SCENARIOS.find(s => s.id === scenario);
  const ActiveFlow = scenario && FLOWS[scenario];

  const workflowContext = useMemo(() => {
    const base = `You are ACE, assisting a Bybit P1 support agent handling a P2P Restriction case (SOP E05-P2P Restriction v2.3).

Key rules you must apply:
- Always check account status (Abnormal/Normal), ban type, and ban remarks first.
- Resolve P2P ban cases during live chat unless follow-up is required.
- If a case has been escalated >48h with no reply → submit Case Expedition Form to P2P Division.
- For TechOps escalations, Column 4 (Account Ban) must be completed thoroughly.
- Never merge new cases into "landing page" cases, and never leave internal notes there.

Scenarios and their account status:
- Abnormal: High Risk Transaction, P2P Violation, Sensitive Words, Offline/Online Appeal (financial loss), Scammer (No Asset/With Asset), Wrong Judgment, P2P Report Ban.
- Normal: Company Risk, Amount Frozen, T+1, High Risk Advertiser.

Current case: UID=${caseData.uid || 'N/A'}, OID=${caseData.oid || 'N/A'}, AccountStatus=${caseData.accountStatus || 'N/A'}, VIP=${caseData.vip || 'N/A'}.
Current scenario: ${currentScenario ? currentScenario.name : 'none selected'}.

When the agent asks for a reply draft, write concise, empathetic Bybit-style chat responses in English. Never include real UIDs, order IDs, emails, or wallet addresses in outputs.`;
    return base;
  }, [caseData, currentScenario]);

  const suggestions = useMemo(() => {
    if (!currentScenario) return [
      'Which scenario fits ban remark "p2p_service - System [security appeal review refuse]"?',
      'User has P2P Ban + Withdrawal Ban — which scenario is it?',
      'How do I know if it\'s online or offline appeal?',
    ];
    return [
      `Draft a reply for a user in the ${currentScenario.name} scenario`,
      `What\'s the escalation note format for ${currentScenario.name}?`,
      'Summarize the current case and my next action',
    ];
  }, [currentScenario]);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-100">P2P Restriction</h1>
          <p className="text-xs text-slate-500 mt-1">SOP E05-P2P Restriction v2.3 — 13 scenarios, integrated ACE chat</p>
        </div>
        <div className="text-xs text-slate-500 flex items-center gap-1.5">
          <ShieldAlert size={12} /> Always check (1) account status, (2) ban type, (3) ban remark first
        </div>
      </div>

      {/* Case info */}
      <CaseInfo data={caseData} setData={setCaseData} />

      {/* Scenario grid or active flow */}
      {!scenario ? (
        <div>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Select a scenario</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {SCENARIOS.map(s => (
              <button key={s.id} onClick={() => setScenario(s.id)}
                className="group text-left bg-slate-800/40 border border-slate-700/50 hover:border-yellow-400/40 hover:bg-slate-800 rounded-xl p-4 transition-all cursor-pointer">
                <div className="flex items-start gap-2">
                  <span className="text-xl">{s.icon}</span>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100 group-hover:text-yellow-300 transition-colors">{s.name}</h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <ActiveFlow onBack={() => setScenario(null)} caseData={caseData} />
      )}

      {/* ACE Workflow Chat */}
      {hasAnyApiKey() && (
        <WorkflowChat
          title="ACE — P2P Restriction Assistant"
          systemContext={workflowContext}
          suggestions={suggestions}
        />
      )}

      {/* Collapsible reference: QTs */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <button onClick={() => setQtsOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/50 transition-colors cursor-pointer">
          <span className="text-xs font-semibold text-slate-300">All Quicktexts ({Object.keys(QT).length})</span>
          {qtsOpen ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
        </button>
        {qtsOpen && (
          <div className="p-3 space-y-2 border-t border-slate-800">
            {Object.values(QT).map(qt => <QTCard key={qt.code} qt={qt} />)}
          </div>
        )}
      </div>

      {/* Collapsible reference: ETs */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <button onClick={() => setEtsOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/50 transition-colors cursor-pointer">
          <span className="text-xs font-semibold text-slate-300">All Email Templates ({Object.keys(ET).length})</span>
          {etsOpen ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
        </button>
        {etsOpen && (
          <div className="p-3 space-y-2 border-t border-slate-800">
            {Object.values(ET).map(et => <TemplateCard key={et.code} et={et} />)}
          </div>
        )}
      </div>

      {/* Collapsible reference: HC Links */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <button onClick={() => setHcOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/50 transition-colors cursor-pointer">
          <span className="text-xs font-semibold text-slate-300">Help Center Links ({HC_LINKS.length})</span>
          {hcOpen ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
        </button>
        {hcOpen && (
          <div className="p-3 space-y-1.5 border-t border-slate-800">
            {HC_LINKS.map(l => (
              <a key={l.url} href={l.url} target="_blank" rel="noreferrer"
                className="flex items-center justify-between text-xs text-blue-300 hover:text-yellow-300 bg-slate-800/40 hover:bg-slate-800 px-3 py-2 rounded-lg transition-colors">
                <span>{l.label}</span>
                <ExternalLink size={11} />
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Footer reminder */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs text-slate-500 leading-relaxed">
        <div className="flex items-center gap-1.5 mb-2 text-slate-300">
          <CheckCircle2 size={13} className="text-emerald-400" />
          <span className="font-semibold">Escalation protocol reminder</span>
        </div>
        P2P-related escalations {'>'} 48h without reply → submit Case Expedition Form, routed to Lark group "P2P Branch" for faster handling. For TechOps scenarios, complete Column 4 (Account Ban) thoroughly.
      </div>
    </div>
  );
}
