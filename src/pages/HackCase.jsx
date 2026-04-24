import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, Circle, Loader2, Copy, Check, RotateCcw, AlertTriangle, ChevronRight, Shield, ShieldAlert, ShieldOff, Clock, ArrowLeft } from 'lucide-react';
import { InvokeLLM } from '@/api/integrations';
import { hasAnyApiKey } from '@/api/claude';
import { scrubPII } from '@/lib/SecurityModule';

/* ─── CONSTANTS ─────────────────────────────────────────────────────────────── */

const SECURITY_SETTINGS = ['Password', 'Email Address', 'Mobile Number', 'Google Authenticator (2FA)'];

const VERIFICATION_LOGGED_IN = [
  { key: 'fullName', label: 'Full Name', required: true },
  { key: 'dob', label: 'Date of Birth', required: true },
];

const VERIFICATION_LOGGED_OUT = [
  { key: 'fullName', label: 'Full Name', required: true },
  { key: 'dob', label: 'Date of Birth', required: true },
  { key: 'lastToken', label: 'Last Deposited Token', required: true },
  { key: 'regDate', label: 'Account Registration Year & Month (+/- 3 months OK)', required: true },
];

const SOP_CHECKLIST = {
  exchange: [
    { key: 'type_confirmed', label: 'Confirmed: Exchange account hack' },
    { key: 'uid_confirmed', label: 'UID / registered email / phone confirmed from system' },
    { key: 'kyc_checked', label: 'KYC verification status checked' },
    { key: 'access_checked', label: 'Checked if customer still has account access' },
    { key: 'asset_loss', label: 'Confirmed whether asset loss occurred' },
    { key: 'identity_verified', label: 'Identity verification completed (Name + DOB / full 4-field)' },
    { key: 'ban_applied', label: 'Account ban executed within 2 minutes — Shift-Co tagged' },
    { key: 'withdrawals_checked', label: 'Withdrawal history checked — Status 2-13 or 2-14: tag Risk Ops' },
    { key: 'positions_checked', label: 'Open positions checked — close-only mode confirmed' },
    { key: 'vip_assessed', label: 'VIP level confirmed — VIP 2+ = tag KYC SME for hotline' },
    { key: 'internal_note', label: 'Internal note written and saved in SF' },
    { key: 'case_type_set', label: 'Case type: E01 > Account Matters > Security Issue > Hack' },
    { key: 'level4_updated', label: 'Level 4 Form updated: Main Issue > Hacked Account Alert' },
    { key: 'expedition_raised', label: 'Case Expedition Form raised' },
    { key: 'pool_macro', label: 'Macro run: Pool 1 > Pool 2' },
    { key: 'no_merge', label: 'Confirmed: tickets NOT merged with P2 cases' },
  ],
  web3: [
    { key: 'type_confirmed', label: 'Confirmed: Web3 wallet hack (not Exchange)' },
    { key: 'uid_confirmed', label: 'UID confirmed' },
    { key: 'acknowledged', label: 'Acknowledged user concern empathetically' },
    { key: 'informed', label: 'Informed user: Bybit cannot assist with Web3 wallet hacks' },
    { key: 'template_sent', label: 'Web3 hack email template applied' },
    { key: 'no_restriction', label: 'Confirmed: NO account restriction applied' },
    { key: 'no_escalation', label: 'Confirmed: NOT escalated as standard hack case' },
  ],
  noAssetLoss: [
    { key: 'type_confirmed', label: 'Confirmed: Exchange account hack' },
    { key: 'uid_confirmed', label: 'UID confirmed' },
    { key: 'no_loss_confirmed', label: 'User confirmed: NO asset loss' },
    { key: 'password_changed', label: 'Advised: Change Password' },
    { key: 'email_changed', label: 'Advised: Update Email Address' },
    { key: 'mobile_changed', label: 'Advised: Update Mobile Number' },
    { key: 'ga_changed', label: 'Advised: Reset Google Authenticator (2FA)' },
    { key: 'no_restriction', label: 'Confirmed: NO account restriction offered (unless user requests)' },
  ],
};

const LARK_TEMPLATE_EU = (uid, sf, remark) =>
  `@Pool Escalation Log EU\n📑 Inquiry directed to: EU:\n👤 UID(s): ${uid || '[INPUT UID]'}\n💼 SF(s): ${sf || '[CASE_ID]'}\n🏷️ Remark(s) in the Thread: ${remark || '[case summary]'}\nCan you please assist in checking this?\nThank you`;

const LARK_TEMPLATE_GLOBAL = (uid, sf, remark) =>
  `@Pool Escalation Log\n📑 Inquiry directed to:\n👤 UID(s): ${uid || '[INPUT UID]'}\n💼 SF(s): ${sf || '[CASE_ID]'}\n🏷️ Remark(s) in the Thread: ${remark || '[case summary]'}\nCan you please assist in checking this? Thank you`;

/* ─── WEB3 CUSTOMER TEMPLATE ───────────────────────────────────────────────── */

const WEB3_CUSTOMER_TEMPLATE = `Dear Trader,

Thank you for contacting Bybit Customer Support.

We understand this is a concerning situation and sincerely empathize with your experience.

However, please be informed that Bybit Web3 wallets are fully non-custodial. This means they operate independently from Bybit's centralized exchange systems. Bybit does NOT store, manage, or have access to seed phrases or private keys associated with Web3 wallets.

As such, Bybit is unable to intervene, freeze, recover assets, or reverse any transactions involving Web3 wallets.

Please note that Cloud and Keyless Wallets were officially delisted on 31 May 2025 and are no longer supported.

For your security, we recommend:
- Revoking any suspicious token approvals immediately
- Transferring remaining assets to a new wallet with a fresh seed phrase
- Never sharing your seed phrase or private keys with anyone
- Reporting the incident to relevant blockchain security services

We apologize for the inconvenience and hope you understand the limitations of non-custodial wallet services.

With warmest regards,
Bybit Support | Help Center`;

/* ─── NO ASSET LOSS TEMPLATE ───────────────────────────────────────────────── */

function buildNoAssetLossReply() {
  return `Thank you for reporting this concern. After reviewing your account, we can confirm that no asset loss has occurred at this time.

To secure your account immediately, please update ALL of the following security settings:

1. Password - Change to a new, strong password
2. Email Address - Update if you suspect it may be compromised
3. Mobile Number - Update your bound phone number
4. Google Authenticator (2FA) - Reset and rebind your 2FA

You can update these settings by going to Account & Security in your Bybit account.

If you notice any unauthorized activity in the future, please contact us immediately and we will assist you further.`;
}

/* ─── INTERNAL NOTE TEMPLATES ──────────────────────────────────────────────── */

function buildInternalNote(form) {
  const accessLabel = form.accessStatus === 'has_access' ? 'Logged-in (has access)' : 'Logged-out (no access)';
  const vipLabel = form.vipLevel === 'vip2plus' ? 'VIP 2+' : form.vipLevel === 'vip1' ? 'VIP 1' : 'Non-VIP';

  return `UID: ${form.uid || '[INPUT UID]'}
VIP Level: ${vipLabel}
Account Access: ${accessLabel}
Account Status: Withdraw Ban (All) + Trading Ban (Close Only) + Transfer Ban
Request Origin: Live chat / Email (update as needed)
Request Category: Hack (Exchange)

Summary:
(a) How user discovered abnormality: ${form.additionalNotes || '[to be filled]'}
(b) Affected timeframe: ${form.incidentTime || '[to be filled]'}
(c) Capital loss: ${form.missingAssets || 'To be confirmed'}
(d) 2FA status: ${form.twoFaStatus || 'Unknown'}
(e) API keys: ${form.apiKeys || 'Unknown'}
(f) Contactable email: ${form.accessStatus === 'no_access' ? '[confirm — user locked out]' : '[if applicable]'}
(g) Screenshots: [attach if provided]

Identity Verification: ${form.accessStatus === 'has_access' ? '2/2 (Full Name + DOB)' : '4/4 (Full Name + DOB + Last Token + Registration)'} — ${form.verificationResult === 'matched' ? 'MATCHED' : 'PENDING'}

Case Type: E01 > Account Matters > Security Issue > Hack
Level 4: Main Issue > Hacked Account Alert`;
}

/* ─── COMPONENTS ────────────────────────────────────────────────────────────── */

function OptionButton({ selected, onClick, children, danger, className }) {
  return (
    <button
      onClick={onClick}
      aria-label={typeof children === 'string' ? children : undefined}
      className={cn(
        'flex items-center gap-2 px-4 py-3 rounded-xl border text-left transition-all duration-150 cursor-pointer',
        selected
          ? danger
            ? 'bg-crit/10 border-crit/40 text-crit'
            : 'bg-hero/10 border-hero/30 text-hero'
          : 'bg-bg-2 border-border-0 text-fg-1 hover:text-fg-0 hover:border-border-1',
        className
      )}
    >
      {children}
    </button>
  );
}

function Section({ title, icon: Icon, children, alert, alertColor }) {
  return (
    <div className={cn('bg-bg-1 border rounded-xl overflow-hidden', alert ? `border-${alertColor || 'yellow'}-400/30` : 'border-border-0')}>
      <div className="px-5 py-4 border-b border-border-0 flex items-center gap-2">
        {Icon && <Icon size={15} className="text-hero" />}
        <h2 className="font-semibold text-fg-0 text-sm">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function CopyButton({ text, copyKey, copied, onCopy }) {
  return (
    <button
      onClick={() => onCopy(text, copyKey)}
      className="flex items-center gap-1 text-xs text-fg-2 hover:text-hero transition-colors duration-150 cursor-pointer"
      aria-label={`Copy ${copyKey}`}
    >
      {copied === copyKey ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
    </button>
  );
}

function OutputBlock({ title, titleColor, borderColor, text, copyKey, copied, onCopy, mono }) {
  return (
    <div className={cn('bg-bg-1 border rounded-xl p-5', borderColor)}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={cn('font-semibold text-sm', titleColor)}>{title}</h3>
        <CopyButton text={text} copyKey={copyKey} copied={copied} onCopy={onCopy} />
      </div>
      <p className={cn('text-sm text-fg-1 whitespace-pre-wrap leading-relaxed', mono && 'font-mono')}>{text}</p>
    </div>
  );
}

/* ─── MAIN COMPONENT ────────────────────────────────────────────────────────── */

export default function HackCase() {
  const [form, setForm] = useState({
    team: 'EU',
    hackType: '',
    kycStatus: '',
    accessStatus: '',
    assetLoss: '',
    correctAccount: '',
    vipLevel: '',
    verificationResult: '',
    uid: '',
    incidentTime: '',
    missingAssets: '',
    twoFaStatus: '',
    apiKeys: '',
    additionalNotes: '',
  });
  const [checked, setChecked] = useState({});
  const [generated, setGenerated] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(null);

  function update(field, val) {
    setForm(p => {
      const next = { ...p, [field]: val };
      // Reset downstream state when changing upstream decisions
      if (field === 'hackType') {
        next.kycStatus = '';
        next.accessStatus = '';
        next.assetLoss = '';
        next.correctAccount = '';
        next.vipLevel = '';
        next.verificationResult = '';
        setChecked({});
        setGenerated(null);
      }
      if (field === 'kycStatus') {
        next.accessStatus = '';
        next.assetLoss = '';
        next.correctAccount = '';
        next.vipLevel = '';
        next.verificationResult = '';
      }
      if (field === 'accessStatus') {
        next.assetLoss = '';
        next.vipLevel = '';
        next.verificationResult = '';
      }
      if (field === 'assetLoss') {
        next.vipLevel = '';
        next.verificationResult = '';
      }
      return next;
    });
  }

  function tick(key) {
    setChecked(p => ({ ...p, [key]: !p[key] }));
  }

  function reset() {
    if (!confirm('Reset this case?')) return;
    setForm({ team: 'EU', hackType: '', kycStatus: '', accessStatus: '', assetLoss: '', correctAccount: '', vipLevel: '', verificationResult: '', uid: '', incidentTime: '', missingAssets: '', twoFaStatus: '', apiKeys: '', additionalNotes: '' });
    setChecked({});
    setGenerated(null);
  }

  function copy(text, key) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  /* ─── Derived state ─────────────────────────────────────────────────────── */

  const isWeb3 = form.hackType === 'web3';
  const isExchange = form.hackType === 'exchange';
  const kycVerified = form.kycStatus === 'verified';
  const kycUnverified = form.kycStatus === 'unverified';
  const hasAccess = form.accessStatus === 'has_access';
  const noAccess = form.accessStatus === 'no_access';
  const noAssetLoss = form.assetLoss === 'none';
  const assetLost = form.assetLoss === 'confirmed';
  const isVip2Plus = form.vipLevel === 'vip2plus';
  const verMatched = form.verificationResult === 'matched';
  const verMismatched = form.verificationResult === 'mismatched';

  // Determine which checklist to show
  const activeChecklist = useMemo(() => {
    if (isWeb3) return SOP_CHECKLIST.web3;
    if (isExchange && noAssetLoss) return SOP_CHECKLIST.noAssetLoss;
    if (isExchange) return SOP_CHECKLIST.exchange;
    return [];
  }, [isWeb3, isExchange, noAssetLoss]);

  const doneCount = activeChecklist.filter(s => checked[s.key]).length;

  // Determine the current path/outcome
  const currentPath = useMemo(() => {
    if (isWeb3) return 'web3';
    if (!isExchange) return 'pending';
    if (kycUnverified && form.correctAccount === 'correct') return 'escalate_p2_unverified';
    if (kycUnverified && form.correctAccount === 'wrong') return 'request_new_info';
    if (!kycVerified) return 'pending';
    if (noAssetLoss) return 'no_asset_loss';
    if (!assetLost) return 'pending';
    if (verMismatched) return 'verification_failed';
    if (!verMatched) return 'pending';
    if (isVip2Plus) return 'escalate_vip2plus';
    if (form.vipLevel) return 'escalate_standard';
    return 'pending';
  }, [form, isWeb3, isExchange, kycVerified, kycUnverified, noAssetLoss, assetLost, verMatched, verMismatched, isVip2Plus]);

  const verificationFields = hasAccess ? VERIFICATION_LOGGED_IN : VERIFICATION_LOGGED_OUT;

  const larkRemark = form.incidentTime
    ? `Hack report — Exchange — ${form.incidentTime}${form.missingAssets ? ` — Assets: ${form.missingAssets}` : ''}`
    : '[case summary]';
  const larkTemplate = form.team === 'EU'
    ? LARK_TEMPLATE_EU(form.uid, '[CASE_ID]', larkRemark)
    : LARK_TEMPLATE_GLOBAL(form.uid, '[CASE_ID]', larkRemark);

  /* ─── AI Generate ───────────────────────────────────────────────────────── */

  async function generate() {
    setLoading(true);
    setGenerated(null);
    try {
      const accessLabel = hasAccess ? 'Logged-in (has access)' : 'Logged-out (no access)';
      const vipLabel = isVip2Plus ? 'VIP 2+' : form.vipLevel === 'vip1' ? 'VIP 1' : 'Non-VIP';

      const res = await InvokeLLM({
        prompt: `Generate outputs for a Bybit Exchange account hack case.
Team: Bybit ${form.team}. VIP Level: ${vipLabel}. Account access: ${accessLabel}.

CASE DETAILS:
- UID: ${form.uid || '[INPUT UID]'}
- Incident time: ${form.incidentTime || 'Not specified'}
- Missing/moved assets: ${scrubPII(form.missingAssets || 'Not specified')}
- 2FA status: ${form.twoFaStatus || 'Unknown'}
- API keys on account: ${form.apiKeys || 'Unknown'}
- Additional notes: ${scrubPII(form.additionalNotes || 'None')}

IMPORTANT RULES (April 2026 SOP):
- Account ban must be executed within 2 MINUTES of verification
- NEVER merge tickets with P2 cases
- Hotline call only for VIP 2+ (NOT based on asset amount)
- ${hasAccess ? 'Verification: Full Name + DOB (2/2 must match)' : 'Verification: Full Name + DOB + Last Deposited Token + Registration Year & Month (4/4 must match)'}
- Level 4 Form: E01 > Account Matters > Security Issue > Hack > Main Issue > Hacked Account Alert

Generate THREE sections exactly:

CUSTOMER MESSAGE:
A warm, empathetic, professional message to the customer. Acknowledge the distressing situation. Confirm you are escalating urgently. Provide immediate security steps. Set expectations (3-7 business days for investigation). Use ${form.uid || '[INPUT UID]'} where UID appears. Plain text only, no markdown asterisks.

INTERNAL NOTE:
${buildInternalNote(form)}

CASE TYPE:
E01 > Account Matters > Security Issue > Hack | Level 4: Main Issue > Hacked Account Alert`,
        system_prompt: 'You are a Bybit security case specialist following the April 2026 SOP. Generate professional, accurate outputs. Use plain text only — no markdown asterisks. Follow the exact format requested.',
        useKB: true,
      });

      const customerMatch = res.match(/CUSTOMER MESSAGE:\n([\s\S]*?)(?=INTERNAL NOTE:|$)/i);
      const internalNoteMatch = res.match(/INTERNAL NOTE:\n([\s\S]*?)(?=CASE TYPE:|$)/i);
      const caseTypeMatch = res.match(/CASE TYPE:\n([\s\S]*?)$/i);

      setGenerated({
        customer: customerMatch?.[1]?.trim() || res,
        internalNote: internalNoteMatch?.[1]?.trim() || buildInternalNote(form),
        caseType: caseTypeMatch?.[1]?.trim() || 'E01 > Account Matters > Security Issue > Hack',
        lark: larkTemplate,
      });
    } catch (e) {
      setGenerated({ error: e.message });
    }
    setLoading(false);
  }

  /* ─── RENDER ────────────────────────────────────────────────────────────── */

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-fg-0">🔴 Hack Case</h1>
          <p className="text-sm text-fg-2">Guided SOP workflow — April 2026</p>
        </div>
        <button onClick={reset} className="flex items-center gap-1 text-xs text-fg-2 hover:text-crit transition-colors duration-150 cursor-pointer" aria-label="Reset hack case form">
          <RotateCcw size={13} /> Reset
        </button>
      </div>

      {/* Critical reminders */}
      <div className="bg-crit/5 border border-crit/20 rounded-xl px-4 py-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-crit shrink-0" />
          <p className="text-xs font-semibold text-crit">Critical Reminders</p>
        </div>
        <ul className="text-xs text-fg-1 space-y-1 ml-5">
          <li>Account ban must be executed <strong className="text-crit">within 2 minutes</strong> upon verification</li>
          <li><strong className="text-crit">NEVER</strong> merge tickets with P2 cases</li>
          <li>Hotline call required for <strong className="text-crit">VIP 2+ only</strong> — tag KYC SME</li>
          <li>Level 4 Form: E01 &gt; Account Matters &gt; Security Issue &gt; Hack</li>
        </ul>
      </div>

      {/* ─── STEP 1: Team + Hack Type ────────────────────────────────────── */}
      <Section title="Step 1 — Team & Hack Type" icon={Shield}>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-fg-2 mb-2 block" id="hc-team-label">Team</label>
            <div className="flex gap-2" role="group" aria-labelledby="hc-team-label">
              {['EU', 'Global'].map(t => (
                <OptionButton key={t} selected={form.team === t} onClick={() => update('team', t)}>
                  <span className="text-sm font-medium">{t === 'EU' ? '🇪🇺' : '🌍'} {t}</span>
                </OptionButton>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-fg-2 mb-2 block" id="hc-type-label">Hack Type</label>
            <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby="hc-type-label">
              <OptionButton selected={isExchange} onClick={() => update('hackType', 'exchange')}>
                <ShieldAlert size={16} className="shrink-0" />
                <div>
                  <p className="text-sm font-medium">Exchange Hack</p>
                  <p className="text-xs text-fg-2">Bybit account compromised</p>
                </div>
              </OptionButton>
              <OptionButton selected={isWeb3} onClick={() => update('hackType', 'web3')}>
                <ShieldOff size={16} className="shrink-0" />
                <div>
                  <p className="text-sm font-medium">Web3 Wallet Hack</p>
                  <p className="text-xs text-fg-2">Non-custodial — simplified flow</p>
                </div>
              </OptionButton>
            </div>
          </div>
        </div>
      </Section>

      {/* ─── WEB3 PATH — Simplified ──────────────────────────────────────── */}
      {isWeb3 && (
        <>
          <div className="bg-warn/5 border border-warn/20 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <ShieldOff size={14} className="text-warn shrink-0" />
              <p className="text-xs font-semibold text-warn">Web3 Wallet — Non-Custodial (Simplified Handling)</p>
            </div>
            <ul className="text-xs text-fg-1 space-y-1 ml-5">
              <li>Web3 wallets operate <strong className="text-warn">independently</strong> from Bybit's systems</li>
              <li>Bybit does NOT store, manage, or access seed phrases / private keys</li>
              <li>Bybit CANNOT intervene, freeze, recover, or reverse Web3 transactions</li>
              <li>Cloud/Keyless wallets were delisted on <strong className="text-warn">31 May 2025</strong></li>
              <li className="text-crit">Do NOT apply account restrictions or escalate as standard hack</li>
            </ul>
          </div>

          <div>
            <label htmlFor="hc-uid-web3" className="text-xs text-fg-2 mb-1 block">UID</label>
            <input id="hc-uid-web3" value={form.uid} onChange={e => update('uid', e.target.value)} placeholder="Enter customer UID"
              className="w-full bg-bg-2 border border-border-0 focus:border-hero/50 rounded-lg px-3 py-2 text-sm text-fg-0 placeholder-fg-3 outline-none" />
          </div>

          <OutputBlock
            title="Customer Reply (Web3 Hack)"
            titleColor="text-ok"
            borderColor="border-ok/20"
            text={WEB3_CUSTOMER_TEMPLATE}
            copyKey="web3-customer"
            copied={copied}
            onCopy={copy}
          />
        </>
      )}

      {/* ─── EXCHANGE PATH ───────────────────────────────────────────────── */}
      {isExchange && (
        <>
          {/* ─── STEP 2: KYC & Access ─────────────────────────────────────── */}
          <Section title="Step 2 — KYC & Account Status" icon={Shield}>
            <div className="space-y-4">
              <div>
                <label htmlFor="hc-uid" className="text-xs text-fg-2 mb-1 block">UID</label>
                <input id="hc-uid" value={form.uid} onChange={e => update('uid', e.target.value)} placeholder="Enter customer UID"
                  className="w-full bg-bg-2 border border-border-0 focus:border-hero/50 rounded-lg px-3 py-2 text-sm text-fg-0 placeholder-fg-3 outline-none" />
              </div>

              <div>
                <label className="text-xs text-fg-2 mb-2 block" id="hc-kyc-label">KYC Verification Status</label>
                <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby="hc-kyc-label">
                  <OptionButton selected={kycVerified} onClick={() => update('kycStatus', 'verified')}>
                    <CheckCircle2 size={14} className="shrink-0" /> KYC Verified
                  </OptionButton>
                  <OptionButton selected={kycUnverified} onClick={() => update('kycStatus', 'unverified')}>
                    <AlertTriangle size={14} className="shrink-0" /> KYC Unverified
                  </OptionButton>
                </div>
              </div>

              {/* KYC Unverified → Correct account check */}
              {kycUnverified && (
                <div className="bg-bg-2/50 rounded-xl p-4 space-y-3">
                  <p className="text-xs text-fg-1">KYC Unverified — confirm if reporting to the correct account:</p>
                  <div className="grid grid-cols-2 gap-2">
                    <OptionButton selected={form.correctAccount === 'correct'} onClick={() => update('correctAccount', 'correct')}>
                      Correct Account
                    </OptionButton>
                    <OptionButton selected={form.correctAccount === 'wrong'} onClick={() => update('correctAccount', 'wrong')} danger>
                      Wrong Account
                    </OptionButton>
                  </div>

                  {form.correctAccount === 'correct' && (
                    <div className="bg-info/10 border border-info/20 rounded-lg px-4 py-3">
                      <p className="text-xs text-info font-semibold">Action: Escalate to P2 for further investigation</p>
                      <p className="text-xs text-fg-1 mt-1">KYC unverified but correct account — run macro Pool 1 &gt; Pool 2</p>
                    </div>
                  )}

                  {form.correctAccount === 'wrong' && (
                    <div className="bg-warn/10 border border-warn/20 rounded-lg px-4 py-3">
                      <p className="text-xs text-warn font-semibold">Action: Request another email/mobile/UID</p>
                      <p className="text-xs text-fg-1 mt-1">Ask customer to provide the correct account details. Check KYC status of the new account.</p>
                      <p className="text-xs text-fg-1 mt-1">If new account also KYC Unverified or Not Found &rarr; Escalate to P2</p>
                    </div>
                  )}
                </div>
              )}

              {/* KYC Verified → Access check */}
              {kycVerified && (
                <div>
                  <label className="text-xs text-fg-2 mb-2 block" id="hc-access-label">Account Access Status</label>
                  <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby="hc-access-label">
                    <OptionButton selected={hasAccess} onClick={() => update('accessStatus', 'has_access')}>
                      <CheckCircle2 size={14} className="shrink-0" /> Has Access (Logged-in)
                    </OptionButton>
                    <OptionButton selected={noAccess} onClick={() => update('accessStatus', 'no_access')} danger>
                      <ShieldOff size={14} className="shrink-0" /> No Access (Logged-out)
                    </OptionButton>
                  </div>
                </div>
              )}
            </div>
          </Section>

          {/* ─── STEP 3: Asset Loss Assessment (only if has access) ────── */}
          {kycVerified && hasAccess && (
            <Section title="Step 3 — Asset Loss Assessment" icon={ShieldAlert}>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-fg-2 mb-2 block" id="hc-asset-label">Confirm with user: has any asset been lost?</label>
                  <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby="hc-asset-label">
                    <OptionButton selected={noAssetLoss} onClick={() => update('assetLoss', 'none')}>
                      <Shield size={14} className="shrink-0" /> No Asset Lost
                    </OptionButton>
                    <OptionButton selected={assetLost} onClick={() => update('assetLoss', 'confirmed')} danger>
                      <AlertTriangle size={14} className="shrink-0" /> Asset Lost
                    </OptionButton>
                  </div>
                </div>

                {/* No asset loss → Security advice only */}
                {noAssetLoss && (
                  <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Shield size={14} className="text-emerald-400" />
                      <p className="text-xs font-semibold text-emerald-400">No Asset Loss — Advise Security Settings Update</p>
                    </div>
                    <p className="text-xs text-fg-1">Guide the user to update <strong className="text-fg-1">ALL</strong> of the following immediately:</p>
                    <div className="space-y-1.5">
                      {SECURITY_SETTINGS.map((s, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                          <span className="text-xs text-fg-1">{s}</span>
                        </div>
                      ))}
                    </div>
                    <div className="bg-crit/5 border border-crit/20 rounded-lg px-3 py-2 mt-2">
                      <p className="text-xs text-crit">Do NOT offer account restriction unless the user explicitly requests it</p>
                    </div>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* ─── STEP 3 (alt): No Access → Direct to Verification ────── */}
          {kycVerified && noAccess && (
            <div className="bg-crit/5 border border-crit/20 rounded-xl px-4 py-3">
              <p className="text-xs text-crit font-semibold">User Locked Out — Proceed directly to Ban Account Procedure</p>
              <p className="text-xs text-fg-1 mt-1">Full 4-field verification required (Name + DOB + Last Token + Registration)</p>
            </div>
          )}

          {/* ─── STEP 4: Identity Verification (asset lost OR no access) ── */}
          {kycVerified && (assetLost || noAccess) && (
            <Section title={`Step ${noAccess ? '3' : '4'} — Identity Verification`} icon={Shield}>
              <div className="space-y-4">
                <div className="bg-bg-2/50 rounded-lg px-4 py-3">
                  <p className="text-xs text-fg-2 font-medium mb-2">
                    {hasAccess ? 'Logged-In Verification (2/2 must match)' : 'Logged-Out Verification (4/4 must match)'}
                  </p>
                  <div className="space-y-2">
                    {verificationFields.map(f => (
                      <div key={f.key} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-hero shrink-0" />
                        <span className="text-sm text-fg-1">{f.label}</span>
                      </div>
                    ))}
                  </div>
                  {!hasAccess && (
                    <p className="text-xs text-fg-2 mt-2 italic">+/- 3 months is acceptable for Account Registration Month</p>
                  )}
                </div>

                <div>
                  <label className="text-xs text-fg-2 mb-2 block" id="hc-ver-label">Verification Result</label>
                  <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby="hc-ver-label">
                    <OptionButton selected={verMatched} onClick={() => update('verificationResult', 'matched')}>
                      <CheckCircle2 size={14} className="shrink-0" /> Information Matched
                    </OptionButton>
                    <OptionButton selected={verMismatched} onClick={() => update('verificationResult', 'mismatched')} danger>
                      <AlertTriangle size={14} className="shrink-0" /> Information Mismatched
                    </OptionButton>
                  </div>
                </div>

                {verMismatched && (
                  <div className="bg-crit/10 border border-crit/20 rounded-lg px-4 py-3">
                    <p className="text-xs text-crit font-semibold">Verification Failed — Offer follow-up and reject user</p>
                    <p className="text-xs text-fg-1 mt-1">Cannot proceed with account ban. Advise user to submit a support ticket with valid identification documents.</p>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* ─── STEP 5: VIP Level & Escalation (verification matched) ── */}
          {kycVerified && verMatched && (assetLost || noAccess) && (
            <Section title={`Step ${noAccess ? '4' : '5'} — VIP Level & Escalation`} icon={Clock}>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-fg-2 mb-2 block" id="hc-vip-label">VIP Level</label>
                  <div className="grid grid-cols-3 gap-2" role="group" aria-labelledby="hc-vip-label">
                    <OptionButton selected={form.vipLevel === 'non-vip'} onClick={() => update('vipLevel', 'non-vip')}>
                      Non-VIP
                    </OptionButton>
                    <OptionButton selected={form.vipLevel === 'vip1'} onClick={() => update('vipLevel', 'vip1')}>
                      VIP 1
                    </OptionButton>
                    <OptionButton selected={isVip2Plus} onClick={() => update('vipLevel', 'vip2plus')}>
                      VIP 2+ 🔥
                    </OptionButton>
                  </div>
                </div>

                {/* VIP 2+ Alert */}
                {isVip2Plus && (
                  <div className="bg-crit/10 border border-crit/40 rounded-xl px-4 py-3 space-y-1">
                    <p className="text-sm font-semibold text-crit">VIP 2+ — Hotline Required</p>
                    <ol className="text-xs text-fg-1 space-y-0.5 list-decimal ml-4">
                      <li>Tag Shift-Co to ban account <strong className="text-crit">immediately</strong></li>
                      <li>Tag <strong className="text-crit">KYC SME</strong> for hotline call</li>
                      <li>Escalate to P2</li>
                    </ol>
                  </div>
                )}

                {/* Non-VIP / VIP 1 */}
                {(form.vipLevel === 'non-vip' || form.vipLevel === 'vip1') && form.vipLevel && (
                  <div className="bg-info/10 border border-info/20 rounded-xl px-4 py-3 space-y-1">
                    <p className="text-sm font-semibold text-info">Standard Escalation</p>
                    <ol className="text-xs text-fg-1 space-y-0.5 list-decimal ml-4">
                      <li>Tag Shift-Co to ban account <strong className="text-info">within 2 minutes</strong></li>
                      <li>Escalate to P2</li>
                      <li>Submit Case Expedition Form</li>
                    </ol>
                  </div>
                )}

                {/* Account ban details */}
                {form.vipLevel && (
                  <div className="bg-bg-2/50 rounded-lg px-4 py-3 space-y-1.5">
                    <p className="text-xs text-fg-2 font-medium">Account Ban (Tag Shift-Co)</p>
                    <div className="space-y-1">
                      <p className="text-xs text-fg-1">Withdraw Ban (All) + Trading Ban (Close Only) + Transfer Ban</p>
                    </div>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* ─── Case Details ─────────────────────────────────────────── */}
          {isExchange && form.hackType && (currentPath !== 'pending') && (
            <Section title="Case Details" icon={Shield}>
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="hc-time" className="text-xs text-fg-2 mb-1 block">When did it happen?</label>
                    <input id="hc-time" value={form.incidentTime} onChange={e => update('incidentTime', e.target.value)}
                      placeholder="e.g. Today around 2pm..."
                      className="w-full bg-bg-2 border border-border-0 focus:border-hero/50 rounded-lg px-3 py-2 text-sm text-fg-0 placeholder-fg-3 outline-none" />
                  </div>
                  <div>
                    <label htmlFor="hc-assets" className="text-xs text-fg-2 mb-1 block">Missing / moved assets</label>
                    <input id="hc-assets" value={form.missingAssets} onChange={e => update('missingAssets', e.target.value)}
                      placeholder="e.g. 500 USDT withdrawn..."
                      className="w-full bg-bg-2 border border-border-0 focus:border-hero/50 rounded-lg px-3 py-2 text-sm text-fg-0 placeholder-fg-3 outline-none" />
                  </div>
                  <div>
                    <label htmlFor="hc-2fa" className="text-xs text-fg-2 mb-1 block">2FA status</label>
                    <input id="hc-2fa" value={form.twoFaStatus} onChange={e => update('twoFaStatus', e.target.value)}
                      placeholder="e.g. GA active, SMS only..."
                      className="w-full bg-bg-2 border border-border-0 focus:border-hero/50 rounded-lg px-3 py-2 text-sm text-fg-0 placeholder-fg-3 outline-none" />
                  </div>
                  <div>
                    <label htmlFor="hc-api" className="text-xs text-fg-2 mb-1 block">API keys on account?</label>
                    <input id="hc-api" value={form.apiKeys} onChange={e => update('apiKeys', e.target.value)}
                      placeholder="e.g. 2 active keys, None..."
                      className="w-full bg-bg-2 border border-border-0 focus:border-hero/50 rounded-lg px-3 py-2 text-sm text-fg-0 placeholder-fg-3 outline-none" />
                  </div>
                </div>
                <div>
                  <label htmlFor="hc-notes" className="text-xs text-fg-2 mb-1 block">Additional notes</label>
                  <textarea id="hc-notes" value={form.additionalNotes} onChange={e => update('additionalNotes', e.target.value)}
                    placeholder="Suspicious emails, phishing links, how they noticed..."
                    rows={2}
                    className="w-full bg-bg-2 border border-border-0 focus:border-hero/50 rounded-lg px-3 py-2 text-sm text-fg-0 placeholder-fg-3 outline-none resize-none" />
                </div>
              </div>
            </Section>
          )}
        </>
      )}

      {/* ─── SOP Checklist ───────────────────────────────────────────────── */}
      {form.hackType && activeChecklist.length > 0 && (
        <div className="bg-bg-1 border border-border-0 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-fg-0 text-sm">
              {isWeb3 ? '✅ Web3 Checklist' : noAssetLoss ? '✅ No Asset Loss Checklist' : '✅ SOP Checklist'}
            </h2>
            <span className="text-xs text-fg-2">{doneCount}/{activeChecklist.length}</span>
          </div>
          <div className="h-1 bg-bg-2 rounded-full overflow-hidden">
            <div className="h-full bg-hero rounded-full transition-all duration-300" style={{ width: `${(doneCount / activeChecklist.length) * 100}%` }} />
          </div>
          <div className="space-y-2 pt-1">
            {activeChecklist.map(step => (
              <button key={step.key} onClick={() => tick(step.key)} className="flex items-center gap-3 w-full text-left group cursor-pointer" aria-label={`Toggle: ${step.label}`}>
                {checked[step.key]
                  ? <CheckCircle2 size={16} className="text-ok shrink-0" />
                  : <Circle size={16} className="text-fg-2 group-hover:text-fg-1 shrink-0" />}
                <span className={cn('text-sm', checked[step.key] ? 'line-through text-fg-2' : 'text-fg-1')}>
                  {step.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── Pre-built templates (no asset loss) ─────────────────────── */}
      {isExchange && noAssetLoss && (
        <OutputBlock
          title="Customer Reply (No Asset Loss)"
          titleColor="text-ok"
          borderColor="border-ok/20"
          text={buildNoAssetLossReply()}
          copyKey="no-loss-reply"
          copied={copied}
          onCopy={copy}
        />
      )}

      {/* ─── Lark Escalation (exchange with escalation path) ──────── */}
      {isExchange && form.vipLevel && verMatched && (
        <div className="bg-bg-1 border border-border-0 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-fg-1">Lark {form.team} Escalation Template</p>
            <CopyButton text={larkTemplate} copyKey="lark-preview" copied={copied} onCopy={copy} />
          </div>
          <p className="text-xs text-fg-1 font-mono whitespace-pre-wrap leading-relaxed">{larkTemplate}</p>
        </div>
      )}

      {/* ─── Pre-built Internal Note (exchange with escalation) ───── */}
      {isExchange && form.vipLevel && verMatched && (
        <OutputBlock
          title="Internal Note (Template)"
          titleColor="text-info"
          borderColor="border-info/20"
          text={buildInternalNote(form)}
          copyKey="internal-note-template"
          copied={copied}
          onCopy={copy}
          mono
        />
      )}

      {/* ─── Generate with ACE button ────────────────────────────────── */}
      {isExchange && form.vipLevel && verMatched && hasAnyApiKey() && (
        <>
          <button onClick={generate} disabled={loading} aria-label="Generate customer message and internal note with ACE"
            className="w-full bg-hero hover:bg-hero disabled:bg-bg-2 disabled:text-fg-2 text-[#021418] font-semibold py-3 rounded-xl transition-colors duration-150 flex items-center justify-center gap-2 cursor-pointer">
            {loading ? <><Loader2 size={16} className="animate-spin" /> Generating...</> : '✦ Generate with ACE — Customer message + polished note'}
          </button>

          {generated?.error && (
            <div className="bg-crit/10 border border-crit/30 rounded-xl p-4 text-sm text-crit">{generated.error}</div>
          )}

          {generated && !generated.error && (
            <div className="space-y-4">
              {generated.customer && (
                <OutputBlock title="Customer Message (ACE)" titleColor="text-ok" borderColor="border-ok/20"
                  text={generated.customer} copyKey="customer" copied={copied} onCopy={copy} />
              )}
              {generated.internalNote && (
                <OutputBlock title="Internal Note (ACE)" titleColor="text-info" borderColor="border-info/20"
                  text={generated.internalNote} copyKey="note" copied={copied} onCopy={copy} mono />
              )}
              {generated.lark && (
                <OutputBlock title={`Lark ${form.team} Escalation (ACE)`} titleColor="text-hero" borderColor="border-hero/20"
                  text={generated.lark} copyKey="lark" copied={copied} onCopy={copy} mono />
              )}
              {generated.caseType && (
                <div className="bg-bg-2 border border-border-0 rounded-xl px-4 py-3">
                  <p className="text-xs text-fg-2 mb-1">Case Type</p>
                  <p className="text-sm text-fg-0 font-mono">{generated.caseType}</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ─── Case Type reminder ──────────────────────────────────────── */}
      {form.hackType && (
        <div className="bg-bg-2/50 border border-border-0 rounded-xl px-4 py-3">
          <p className="text-xs text-fg-2 mb-1">Case Type</p>
          <p className="text-sm text-fg-0 font-mono">
            {isWeb3
              ? 'E01 > Account Matters > Security Issue > Hack | Level 4: Hacked (Web3)'
              : 'E01 > Account Matters > Security Issue > Hack | Level 4: Main Issue > Hacked Account Alert'}
          </p>
        </div>
      )}
    </div>
  );
}
