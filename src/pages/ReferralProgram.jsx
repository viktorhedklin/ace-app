import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Copy, Check, ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, Users, Gift, RotateCcw, Link2, CreditCard, Wallet } from 'lucide-react';

/* ─── CONSTANTS ─────────────────────────────────────────────────────────────── */

const PRODUCTS = [
  { key: 'referral', label: 'Referral Program', icon: Users, desc: 'Standard friend invite referral' },
  { key: 'card', label: 'Card Referral', icon: CreditCard, desc: 'Bybit Card referral program' },
  { key: 'pay', label: 'Pay Referral', icon: Wallet, desc: 'Bybit Pay referral program' },
];

const COMMISSION_TIERS = [
  { rate: '20%', requirement: 'Default rate' },
  { rate: '25%', requirement: 'Invite 5 qualified referees in a quarter' },
  { rate: '30%', requirement: 'Invite 100 qualified referees in a quarter, OR $15M+ derivatives volume from referees in a quarter' },
];

/* ─── TEMPLATES ─────────────────────────────────────────────────────────────── */

const TEMPLATES = {
  no_amendment_referral: `Thank you for reaching out.

We understand that you would like to add/change the referral code on your account. Unfortunately, referral codes are bound at the time of registration and cannot be changed, added, or modified after account creation.

We sincerely apologize for any inconvenience. If you have any other questions, please don't hesitate to contact us.`,

  no_amendment_card: `Thank you for reaching out.

We understand that you would like to add/change the Bybit Card referral code on your account. Unfortunately, the referral code cannot be changed once a Bybit Card application has been submitted.

We sincerely apologize for any inconvenience. If you have any other questions, please don't hesitate to contact us.`,

  no_amendment_pay: `Thank you for reaching out.

We understand that you would like to add/change the Bybit Pay referral code. Unfortunately, the referral code cannot be changed once a Bybit Pay registration has been completed.

We sincerely apologize for any inconvenience. If you have any other questions, please don't hesitate to contact us.`,

  no_disclosure: `Thank you for your inquiry.

Due to privacy and data protection policies, we are unable to disclose the specific referral code or referrer ID associated with your account. We can confirm whether a referral code is bound to your account, but the details cannot be shared.

We appreciate your understanding and are happy to assist with any other questions.`,

  referrer_reward_check: `To investigate the referral reward, we will need to verify the following:

1. Referee UID: [provide the UID you're inquiring about]
2. Was the referee registered using your referral link/code?
3. Has the referee completed:
   - A cumulative deposit of at least 100 USDT within 7 days of sign-up?
   - A cumulative trading volume of at least 500 USDT within 30 days? (or $100,000 for TradeFi)

Please note:
- Bybit performs a 14-day risk review after referee task completion
- Referee must NOT withdraw tokens during the review period
- Spot trading pairs with zero fees do not count toward volume
- Internal transfers are not counted as eligible deposits

You can check your referral performance at: https://www.bybit.com/en/referral/my-performance`,

  referee_reward_check: `To check on your referral reward status:

1. Please visit the Reward Hub to check your task ID and completion status
2. Ensure you have completed ALL required tasks:
   - Deposited at least 100 USDT (or equivalent) within 7 days of registration
   - Achieved at least 500 USDT cumulative trading volume within 30 days
   - (TradeFi users: $100,000 trading volume requirement)

Important notes:
- Eligible deposits: One-Click Buy, P2P Trading, Crypto Deposits, Fiat Deposits
- Internal transfers do NOT count
- Spot pairs with zero fees do NOT count toward trading volume
- A 14-day risk review period applies after task completion

Reward Hub: Check your task status and completion progress in the Reward Hub section of your account.`,

  quarterly_cap_info: `Regarding the quarterly commission cap:

- Each referrer can earn up to $5,000 (or equivalent) per quarter
- Effective since: February 7, 2026

Exemption: Users who invite at least 15 new referred users within the current quarter — each depositing at least $100 and completing their first trade — will NOT be subject to the cap in the following quarter.

VIP users: For special commission arrangements, please contact your Relationship Manager (RM).

Reference: https://announcements.bybit.com/article/update-on-referral-program-new-quarterly-commission-cap-blte3790f55046610b6/`,
};

/* ─── COMPONENTS ────────────────────────────────────────────────────────────── */

function CopyBtn({ text, copyKey, copied, onCopy }) {
  return (
    <button onClick={() => onCopy(text, copyKey)} className="flex items-center gap-1 text-xs text-fg-2 hover:text-hero transition-colors duration-150 cursor-pointer shrink-0" aria-label={`Copy ${copyKey}`}>
      {copied === copyKey ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
    </button>
  );
}

function TemplateBlock({ title, text, copyKey, copied, onCopy }) {
  return (
    <div className="bg-bg-2/50 border border-border-0 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-fg-1">{title}</p>
        <CopyBtn text={text} copyKey={copyKey} copied={copied} onCopy={onCopy} />
      </div>
      <p className="text-xs text-fg-1 whitespace-pre-wrap leading-relaxed font-mono">{text}</p>
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
      {children && <div className="text-xs text-fg-1 space-y-1">{children}</div>}
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

export default function ReferralProgram() {
  const [product, setProduct] = useState('');
  const [inquiryType, setInquiryType] = useState('');
  const [role, setRole] = useState('');
  const [codeScenario, setCodeScenario] = useState('');
  const [inviterBound, setInviterBound] = useState('');
  const [hasCardApp, setHasCardApp] = useState('');
  const [copied, setCopied] = useState(null);

  function copy(text, key) { navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 2000); }
  function resetAll() {
    if (!confirm('Reset this workflow?')) return;
    setProduct(''); setInquiryType(''); setRole(''); setCodeScenario(''); setInviterBound(''); setHasCardApp('');
  }

  const _noAmendmentTemplate = product === 'card' ? TEMPLATES.no_amendment_card : product === 'pay' ? TEMPLATES.no_amendment_pay : TEMPLATES.no_amendment_referral;
  const csgoField = product === 'card' ? 'Bybit Card Inviter ID' : product === 'pay' ? 'Pay Inviter ID' : 'Inviter ID';

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-fg-0">🎁 Referral Program</h1>
          <p className="text-sm text-fg-2">Guided workflow for referral inquiries</p>
        </div>
        <button onClick={resetAll} className="flex items-center gap-1 text-xs text-fg-2 hover:text-crit transition-colors duration-150 cursor-pointer" aria-label="Reset referral form">
          <RotateCcw size={13} /> Reset
        </button>
      </div>

      {/* Important notes */}
      <Alert color="yellow" icon={AlertTriangle} title="Key Rules">
        <ul className="space-y-0.5 ml-3 list-disc">
          <li>Resolve all inquiries within live chat whenever possible</li>
          <li>For C&B escalations, seek assistance from <strong className="text-hero">SME C&B</strong> through the shift group first</li>
          <li>Escalations must go to SME C&B only — do NOT route to other departments directly</li>
          <li>Do NOT disclose Inviter IDs due to privacy policy</li>
        </ul>
      </Alert>

      {/* Product selection */}
      <Section title="Step 1 — Referral Product">
        <div className="grid grid-cols-3 gap-2">
          {PRODUCTS.map(p => {
            const Icon = p.icon;
            return (
              <OptionBtn key={p.key} selected={product === p.key} onClick={() => { setProduct(p.key); setInquiryType(''); setRole(''); setCodeScenario(''); setInviterBound(''); setHasCardApp(''); }}>
                <div className="flex flex-col items-center text-center gap-1 w-full py-1">
                  <Icon size={18} />
                  <p className="text-xs font-medium">{p.label}</p>
                </div>
              </OptionBtn>
            );
          })}
        </div>
      </Section>

      {/* Inquiry type */}
      {product && (
        <Section title="Step 2 — Inquiry Type">
          <div className="grid grid-cols-1 gap-2">
            <OptionBtn selected={inquiryType === 'code'} onClick={() => { setInquiryType('code'); setRole(''); setCodeScenario(''); setInviterBound(''); setHasCardApp(''); }}>
              <Link2 size={16} className="shrink-0" />
              <div>
                <p className="font-medium">Referral Code Inquiry</p>
                <p className="text-xs text-fg-2">Check, add, change, or bind a referral code</p>
              </div>
            </OptionBtn>
            <OptionBtn selected={inquiryType === 'reward'} onClick={() => { setInquiryType('reward'); setCodeScenario(''); setInviterBound(''); setHasCardApp(''); }}>
              <Gift size={16} className="shrink-0" />
              <div>
                <p className="font-medium">Reward / Commission Inquiry</p>
                <p className="text-xs text-fg-2">Did not receive rewards or commission</p>
              </div>
            </OptionBtn>
          </div>
        </Section>
      )}

      {/* ═══ CODE INQUIRY ═════════════════════════════════════════════════ */}
      {inquiryType === 'code' && (
        <Section title="Referral Code — Scenario">
          <div className="space-y-3">
            <p className="text-xs text-fg-1">Check CS:GO &gt; User Profile &gt; <strong className="text-fg-1">{csgoField}</strong></p>

            <div className="grid grid-cols-1 gap-2">
              <OptionBtn selected={codeScenario === 'check'} onClick={() => { setCodeScenario('check'); setInviterBound(''); setHasCardApp(''); }}>
                User wants to check if account has a referral code
              </OptionBtn>
              <OptionBtn selected={codeScenario === 'disclose'} onClick={() => { setCodeScenario('disclose'); setInviterBound(''); }}>
                User wants to know the referral ID/code
              </OptionBtn>
              <OptionBtn selected={codeScenario === 'change'} onClick={() => { setCodeScenario('change'); setInviterBound(''); setHasCardApp(''); }}>
                User wants to change / add / bind a referral code
              </OptionBtn>
            </div>

            {/* Check if bound */}
            {codeScenario === 'check' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <OptionBtn selected={inviterBound === 'yes'} onClick={() => setInviterBound('yes')}>
                    <CheckCircle2 size={14} className="shrink-0" /> Bound with {csgoField}
                  </OptionBtn>
                  <OptionBtn selected={inviterBound === 'no'} onClick={() => setInviterBound('no')}>
                    <AlertTriangle size={14} className="shrink-0" /> Not Bound
                  </OptionBtn>
                </div>
                {inviterBound === 'yes' && (
                  <Alert color="green" icon={CheckCircle2} title="Account Has Referral Bound">
                    <p>Inform user their account was registered with a referral code. Do NOT disclose the actual Inviter ID (privacy policy).</p>
                  </Alert>
                )}
                {inviterBound === 'no' && (
                  <>
                    {product === 'referral' && (
                      <>
                        <Alert color="orange" icon={AlertTriangle} title="No Inviter ID — Cannot Add After Registration">
                          <p>Referral code can only be applied at registration time. Use QT rp14.</p>
                        </Alert>
                        <TemplateBlock title="Reply — No Amendment" text={TEMPLATES.no_amendment_referral} copyKey="no-amend-ref" copied={copied} onCopy={copy} />
                      </>
                    )}
                    {product === 'card' && (
                      <div className="space-y-2">
                        <p className="text-xs text-fg-1">Check CS:GO &gt; BybitCard &gt; Application History</p>
                        <div className="grid grid-cols-2 gap-2">
                          <OptionBtn selected={hasCardApp === 'yes'} onClick={() => setHasCardApp('yes')}>Has Card Application</OptionBtn>
                          <OptionBtn selected={hasCardApp === 'no'} onClick={() => setHasCardApp('no')}>No Card Application</OptionBtn>
                        </div>
                        {hasCardApp === 'yes' && (
                          <>
                            <Alert color="orange" icon={AlertTriangle} title="Cannot Change After Card Application">
                              <p>Use QT rp16-card/pay referral-no amendment / ET No Amendment Option 2</p>
                            </Alert>
                            <TemplateBlock title="Reply — No Amendment (Card)" text={TEMPLATES.no_amendment_card} copyKey="no-amend-card" copied={copied} onCopy={copy} />
                          </>
                        )}
                        {hasCardApp === 'no' && (
                          <Alert color="blue" icon={CheckCircle2} title="No Application Yet">
                            <p>Advise user to apply for Bybit Card with the referral code. Code cannot be changed after application submission.</p>
                          </Alert>
                        )}
                      </div>
                    )}
                    {product === 'pay' && (
                      <>
                        <Alert color="orange" icon={AlertTriangle} title="No Pay Inviter ID — Cannot Add After Registration">
                          <p>Pay referral code is bound during Pay registration.</p>
                        </Alert>
                        <TemplateBlock title="Reply — No Amendment (Pay)" text={TEMPLATES.no_amendment_pay} copyKey="no-amend-pay" copied={copied} onCopy={copy} />
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Disclose request */}
            {codeScenario === 'disclose' && (
              <>
                <Alert color="red" icon={AlertTriangle} title="Cannot Disclose Referral ID">
                  <p>Due to privacy policy, we cannot disclose the referral code or Inviter ID. Use QT rp15-referral-nodisclosure.</p>
                </Alert>
                <TemplateBlock title="Reply — No Disclosure" text={TEMPLATES.no_disclosure} copyKey="no-disclose" copied={copied} onCopy={copy} />
              </>
            )}

            {/* Change / add / bind */}
            {codeScenario === 'change' && (
              <div className="space-y-3">
                {product === 'referral' && (
                  <>
                    <Alert color="orange" icon={AlertTriangle} title="Cannot Change / Add / Bind Referral Code">
                      <p>Referral codes are permanently bound at registration. Use QT rp14-referral-no amendment.</p>
                    </Alert>
                    <TemplateBlock title="Reply — No Amendment" text={TEMPLATES.no_amendment_referral} copyKey="no-amend-change-ref" copied={copied} onCopy={copy} />
                  </>
                )}
                {product === 'card' && (
                  <div className="space-y-2">
                    <p className="text-xs text-fg-1">Check CS:GO &gt; User Profile for Bybit Card Inviter ID</p>
                    <div className="grid grid-cols-2 gap-2">
                      <OptionBtn selected={inviterBound === 'yes'} onClick={() => setInviterBound('yes')}>Already Bound</OptionBtn>
                      <OptionBtn selected={inviterBound === 'no'} onClick={() => { setInviterBound('no'); setHasCardApp(''); }}>Not Bound</OptionBtn>
                    </div>
                    {inviterBound === 'yes' && (
                      <>
                        <Alert color="orange" icon={AlertTriangle} title="Cannot Change After Card Application">
                          <p>Use QT rp16 / ET No Amendment Option 2</p>
                        </Alert>
                        <TemplateBlock title="Reply — No Amendment (Card)" text={TEMPLATES.no_amendment_card} copyKey="no-amend-card-change" copied={copied} onCopy={copy} />
                      </>
                    )}
                    {inviterBound === 'no' && (
                      <div className="space-y-2">
                        <p className="text-xs text-fg-1">Check Card Application History:</p>
                        <div className="grid grid-cols-2 gap-2">
                          <OptionBtn selected={hasCardApp === 'yes'} onClick={() => setHasCardApp('yes')}>Has Application</OptionBtn>
                          <OptionBtn selected={hasCardApp === 'no'} onClick={() => setHasCardApp('no')}>No Application</OptionBtn>
                        </div>
                        {hasCardApp === 'yes' && (
                          <>
                            <Alert color="orange" icon={AlertTriangle} title="Cannot Change — Application Already Submitted" />
                            <TemplateBlock title="Reply — No Amendment (Card)" text={TEMPLATES.no_amendment_card} copyKey="no-amend-card-app" copied={copied} onCopy={copy} />
                          </>
                        )}
                        {hasCardApp === 'no' && (
                          <Alert color="blue" icon={CheckCircle2} title="Can Apply With Referral Code">
                            <p>Advise user to apply for Bybit Card using the referral code. Cannot be changed after submission.</p>
                          </Alert>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {product === 'pay' && (
                  <>
                    <Alert color="orange" icon={AlertTriangle} title="Cannot Change / Add / Bind Pay Referral Code">
                      <p>Pay referral is permanently bound at registration.</p>
                    </Alert>
                    <TemplateBlock title="Reply — No Amendment (Pay)" text={TEMPLATES.no_amendment_pay} copyKey="no-amend-change-pay" copied={copied} onCopy={copy} />
                  </>
                )}
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ═══ REWARD INQUIRY ═══════════════════════════════════════════════ */}
      {inquiryType === 'reward' && (
        <>
          <Section title="Reward Inquiry — User Role">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <OptionBtn selected={role === 'referrer'} onClick={() => setRole('referrer')}>
                  <div className="text-center w-full">
                    <p className="font-medium">Referrer (M1)</p>
                    <p className="text-xs text-fg-2">Inviter — not receiving commission</p>
                  </div>
                </OptionBtn>
                <OptionBtn selected={role === 'referee'} onClick={() => setRole('referee')}>
                  <div className="text-center w-full">
                    <p className="font-medium">Referee (M2)</p>
                    <p className="text-xs text-fg-2">Invitee — not receiving reward</p>
                  </div>
                </OptionBtn>
              </div>

              {role === 'referrer' && (
                <div className="space-y-3">
                  <Alert color="blue" icon={Users} title="Referrer (M1) — Commission Not Received">
                    <p>Verify which referee UID the user is asking about. Get a screenshot from their referral dashboard.</p>
                    <p className="mt-1">Dashboard: https://www.bybit.com/en/referral/my-performance</p>
                    {product === 'pay' && <p>Pay Dashboard: https://www.bybit.com/en/bybitpay/dashboard/referral/</p>}
                  </Alert>
                  <TemplateBlock title="Reply — Referrer Reward Check" text={TEMPLATES.referrer_reward_check} copyKey="referrer-check" copied={copied} onCopy={copy} />
                </div>
              )}

              {role === 'referee' && (
                <div className="space-y-3">
                  <Alert color="blue" icon={Gift} title="Referee (M2) — Reward Not Received">
                    <p>Verify the task ID from the Reward Hub. Check if all tasks are completed.</p>
                  </Alert>
                  <TemplateBlock title="Reply — Referee Reward Check" text={TEMPLATES.referee_reward_check} copyKey="referee-check" copied={copied} onCopy={copy} />
                </div>
              )}
            </div>
          </Section>
        </>
      )}

      {/* ═══ GENERAL KNOWLEDGE ════════════════════════════════════════════ */}
      <Section title="General Knowledge — Quick Reference" defaultOpen={false}>
        <div className="space-y-4">
          {/* Qualified referee */}
          <div className="bg-bg-2/50 rounded-lg p-4 space-y-2">
            <p className="text-xs font-semibold text-hero">What is a Qualified Referee?</p>
            <ol className="text-xs text-fg-1 list-decimal ml-4 space-y-1">
              <li>Sign up using M1's referral link or code</li>
              <li>Deposit at least <strong className="text-fg-1">100 USDT</strong> (or equivalent) within <strong className="text-fg-1">7 days</strong> of sign-up</li>
              <li>Accumulate trading volume of at least <strong className="text-fg-1">500 USDT</strong> within <strong className="text-fg-1">30 days</strong> (TradeFi: $100,000)</li>
            </ol>
            <p className="text-[10px] text-fg-2">Eligible deposits: One-Click Buy, P2P, Crypto, Fiat. Internal transfers do NOT count. Zero-fee spot pairs do NOT count.</p>
          </div>

          {/* Commission tiers */}
          <div className="bg-bg-2/50 rounded-lg p-4 space-y-2">
            <p className="text-xs font-semibold text-hero">Commission Rates</p>
            <div className="space-y-1.5">
              {COMMISSION_TIERS.map((t, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-xs font-bold text-emerald-400 w-8 shrink-0">{t.rate}</span>
                  <span className="text-xs text-fg-1">{t.requirement}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-fg-2">Commission valid for 365 days from referee registration. Quarters: Jan-Mar, Apr-Jun, Jul-Sep, Oct-Dec.</p>
          </div>

          {/* Quarterly cap */}
          <div className="bg-bg-2/50 rounded-lg p-4 space-y-2">
            <p className="text-xs font-semibold text-hero">Quarterly Commission Cap</p>
            <p className="text-xs text-fg-1">Max <strong className="text-fg-1">$5,000</strong>/quarter (effective Feb 7, 2026)</p>
            <p className="text-xs text-fg-1"><strong className="text-emerald-400">Exemption:</strong> Invite 15+ new users (each deposits $100+ and completes first trade) = no cap next quarter</p>
            <p className="text-xs text-fg-1"><strong className="text-info">VIP:</strong> Contact Relationship Manager for special arrangements</p>
          </div>

          {/* Referral vs Affiliate */}
          <div className="bg-bg-2/50 rounded-lg p-4 space-y-2">
            <p className="text-xs font-semibold text-hero">Referral vs Affiliate — How to Tell</p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-fg-2 font-medium mb-1">Referral</p>
                <ul className="text-fg-1 space-y-0.5">
                  <li>Bound when user registers via friend invite</li>
                  <li>Shows as "Inviter ID" in CS:GO</li>
                  <li>Cannot be manually added after registration</li>
                </ul>
              </div>
              <div>
                <p className="text-fg-2 font-medium mb-1">Affiliate</p>
                <ul className="text-fg-1 space-y-0.5">
                  <li>Bound via Affiliate Code or Link</li>
                  <li>Shows as separate field in CS:GO</li>
                  <li>Can be manually added if requirements met</li>
                </ul>
              </div>
            </div>
            <p className="text-[10px] text-fg-2">If affiliate-related, refer to SOP - C01 - Affiliate related inquiries</p>
          </div>

          {/* Template for quarterly cap */}
          <TemplateBlock title="Quarterly Cap Information" text={TEMPLATES.quarterly_cap_info} copyKey="quarterly-cap" copied={copied} onCopy={copy} />
        </div>
      </Section>

      {/* Case type */}
      {product && (
        <div className="bg-bg-2/50 border border-border-0 rounded-xl px-4 py-3">
          <p className="text-xs text-fg-2 mb-1">Case Type</p>
          <p className="text-sm text-fg-0 font-mono">
            C01 - Campaign & Bonus &gt; {product === 'card' ? 'Card Referral Program' : product === 'pay' ? 'Pay Referral Program' : 'Referral Program'} &gt; {inquiryType === 'code' ? 'Code Inquiry' : inquiryType === 'reward' ? 'Reward Inquiry' : '[Select Inquiry Type]'}
          </p>
        </div>
      )}
    </div>
  );
}
