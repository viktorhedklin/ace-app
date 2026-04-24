import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';

const FLOWS = {
  email: {
    title: 'Email Change (E01-E)',
    icon: '✉️',
    steps: [
      { step: 'Verify Identity', items: ['Confirm UID from system', 'Verify current registered email matches system records', 'Check KYC full name in system', 'Verify date of birth matches KYC'] },
      { step: 'Check Eligibility', items: ['Confirm account is not under security hold', 'Check if email was changed in last 30 days (30-day cooldown applies)', 'Verify account is KYC Level 1+'] },
      { step: 'Process Request', items: ['Ask customer to submit via: Account > Security > Email > Change Email', 'A verification code will be sent to the OLD email', 'If they cannot access old email → escalate to E01 Security Review team', 'Note: Process takes up to 24 hours after verification'] },
      { step: 'Inform Customer', items: ['Advise: withdrawal is frozen for 24 hours after email change (security policy)', 'Confirm the new email address they want', 'Send confirmation once change is processed'] },
    ],
    template: `Thank you for contacting Bybit support. I've verified your identity and I can confirm your email change request has been received.

Please follow these steps:
1. Go to Account → Security → Email → Change Email
2. You'll receive a verification code to your current email address
3. Enter the code and set your new email address

Important: For security, withdrawals will be suspended for 24 hours after the change is applied.

If you're unable to access your current email, please reply and I'll escalate your case for a manual review.

Case ID: [CASE_ID]`,
  },
  phone: {
    title: 'Phone Number Change (E01-P)',
    icon: '📱',
    steps: [
      { step: 'Verify Identity', items: ['Confirm UID from system', 'Verify registered email matches system records', 'Check KYC full name in system', 'Check last 4 digits of current phone number in system'] },
      { step: 'Check Eligibility', items: ['Phone changes allowed once per 30 days', 'Account must not be under security hold', 'KYC Level 1+ required'] },
      { step: 'Process Request', items: ['Guide to: Account > Security > Phone > Change Phone', 'Verification code sent to current phone number', 'If no access to old phone → escalate to security team for manual change', 'New number must be able to receive SMS'] },
      { step: 'Post-Change', items: ['Advise: 24-hour withdrawal freeze applies', 'Confirm new phone number is active', 'Recommend enabling Google Authenticator as backup'] },
    ],
    template: `Thank you for contacting Bybit support. I've completed your identity verification.

To change your phone number:
1. Go to Account → Security → Phone Number → Change
2. Enter the verification code sent to your current number
3. Enter your new phone number and confirm

Note: A 24-hour withdrawal restriction will apply after the change for your security.

If you no longer have access to your registered phone number, please reply so I can escalate this to our security review team.

Case ID: [CASE_ID]`,
  },
  ga: {
    title: 'Google Authenticator Reset (E01-GA)',
    icon: '🔐',
    steps: [
      { step: 'Verify Identity (Strict)', items: ['Confirm UID from system', 'Verify registered email in full from system records', 'Check KYC full name + date of birth in system', 'Verify government ID document number on file (last 4 digits)', 'Check last known login date/location in security logs'] },
      { step: 'Check Eligibility', items: ['GA reset only if customer has lost access to authenticator app/device', 'Account must not show signs of compromise (check login history)', 'KYC Level 2 may be required for high-value accounts'] },
      { step: 'Escalation Process', items: ['GA resets cannot be done in chat — must be escalated to Security team', 'Submit ticket: [INPUT UID], email, reason, identity verification completed', 'Timeline: 24–72 hours', 'Customer will receive instructions via registered email'] },
      { step: 'Advise Customer', items: ['Do NOT disable old GA until new one is set up (if they still have access)', 'After reset: enable GA immediately and save backup codes', 'Consider enabling SMS as backup 2FA method'] },
    ],
    template: `Thank you for contacting Bybit support regarding your Google Authenticator reset.

I've completed your identity verification. Because this involves account security, I've escalated your request to our specialized security team.

What happens next:
• Our security team will review your request within 24–72 hours
• You'll receive an email to [CUSTOMER_EMAIL] with further instructions
• Please check your spam folder if you don't see it

Your case reference: [CASE_ID]

Important: Do not attempt to log in repeatedly as this may trigger additional security holds on your account.`,
  },
};

function FlowCard({ flow }) {
  const [openStep, setOpenStep] = useState(null);
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(flow.template);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-bg-1 border border-border-0 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border-0">
        <h2 className="font-semibold text-fg-0 flex items-center gap-2">
          <span>{flow.icon}</span> {flow.title}
        </h2>
      </div>
      <div className="p-4 space-y-2">
        {flow.steps.map((s, i) => (
          <div key={i} className="border border-border-0 rounded-lg overflow-hidden">
            <button
              onClick={() => setOpenStep(openStep === i ? null : i)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-fg-1 hover:bg-bg-2 transition-colors text-left"
            >
              <span><span className="text-hero mr-2">{i + 1}.</span>{s.step}</span>
              {openStep === i ? <ChevronUp size={14} className="text-fg-2" /> : <ChevronDown size={14} className="text-fg-2" />}
            </button>
            {openStep === i && (
              <div className="px-4 pb-3 space-y-1.5 bg-bg-2/30">
                {s.items.map((item, j) => (
                  <p key={j} className="text-xs text-fg-1 flex items-start gap-2">
                    <span className="text-hero shrink-0 mt-0.5">→</span> {item}
                  </p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="px-4 pb-4">
        <div className="bg-bg-2/50 rounded-lg p-3 relative">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-fg-2">📋 Customer message template</span>
            <button onClick={copy} className="text-fg-2 hover:text-hero transition-colors">
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </button>
          </div>
          <p className="text-xs text-fg-1 whitespace-pre-wrap leading-relaxed">{flow.template}</p>
        </div>
      </div>
    </div>
  );
}

export default function AccountMatters() {
  const [active, setActive] = useState('email');

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-fg-0">👤 Account Matters</h1>
        <p className="text-sm text-fg-2">E01 workflows for email, phone and Google Authenticator</p>
      </div>

      <div className="flex gap-2">
        {Object.entries(FLOWS).map(([key, flow]) => (
          <button
            key={key}
            onClick={() => setActive(key)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              active === key
                ? 'bg-hero/20 text-hero border border-hero/30'
                : 'bg-bg-2 text-fg-1 hover:text-fg-0 border border-border-0'
            )}
          >
            {flow.icon} {key === 'ga' ? 'Google Auth' : key.charAt(0).toUpperCase() + key.slice(1)}
          </button>
        ))}
      </div>

      <FlowCard flow={FLOWS[active]} />
    </div>
  );
}
