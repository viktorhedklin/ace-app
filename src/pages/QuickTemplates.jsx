import { useState } from 'react';
import { Copy, Check, Plus, Trash2, Star, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

const BUILT_IN = [
  // Greetings
  { id: 'g1', cat: 'Greeting', title: 'Standard open', text: `Thank you for contacting Bybit support! My name is [NAME] and I'll be assisting you today. Could you please provide more details about your issue so I can help you as quickly as possible?` },
  { id: 'g2', cat: 'Greeting', title: 'Warm open (chat)', text: `Hey! Thanks for reaching out to Bybit. I'm here and ready to help — what's going on?` },
  { id: 'g3', cat: 'Greeting', title: 'Returning customer', text: `Welcome back! Thank you for contacting Bybit support again. I'm happy to assist — could you share what you're experiencing today?` },

  // Holds
  { id: 'h1', cat: 'Hold', title: 'Quick check', text: `Bear with me for just a moment while I look into this for you!` },
  { id: 'h2', cat: 'Hold', title: 'Longer check', text: `Thank you for your patience. I'm reviewing your account details right now — this will take a couple of minutes.` },
  { id: 'h3', cat: 'Hold', title: 'Still working', text: `Still working on this for you! Thank you so much for your patience — I want to make sure I give you the right information.` },

  // Identity Verification
  { id: 'v1', cat: 'Verification', title: 'Standard verify', text: `For the security of your account, I need to verify your identity before proceeding. Could you please confirm the email address registered to your Bybit account?` },
  { id: 'v2', cat: 'Verification', title: 'Verify KYC', text: `I'll need to verify a few account details to assist you further. Could you confirm your full name as it appears on your KYC documents?` },
  { id: 'v3', cat: 'Verification', title: 'Cannot verify', text: `Unfortunately, I'm unable to verify your identity based on the information provided. For the security of your account, I'm unable to proceed without successful verification. Please ensure the details match your registered account.` },

  // Escalation
  { id: 'e1', cat: 'Escalation', title: 'Standard escalation', text: `I've reviewed your case and I'll be escalating this to our specialist team who will be able to assist you further. Your case reference is [CASE_ID]. You can expect a response within 3–5 business days. You'll receive an update via your registered email.` },
  { id: 'e2', cat: 'Escalation', title: 'Urgent escalation', text: `I understand the urgency of your situation. I'm escalating this to our priority team right now. Your case reference is [CASE_ID]. Our team will review this as a high-priority case and you'll hear back within 24 hours.` },
  { id: 'e3', cat: 'Escalation', title: 'Technical escalation', text: `This requires review by our technical team. I've created a ticket on your behalf — reference [CASE_ID]. Our technical specialists will investigate and respond within 3–7 business days via your registered email.` },

  // P2P
  { id: 'p1', cat: 'P2P', title: 'Raise dispute prompt', text: `If the seller hasn't released your crypto within the time limit, please click "Appeal" in the order to raise a dispute. Your funds are safely held in escrow and will not be lost. Our dispute team will review the case within 24 hours.` },
  { id: 'p2', cat: 'P2P', title: 'Payment proof request', text: `To resolve this quickly, could you please provide clear proof of payment? This should show: the amount transferred, your name as sender, the recipient's name, date and time, and a transaction reference number.` },
  { id: 'p3', cat: 'P2P', title: 'Crypto in escrow reassurance', text: `Please don't worry — your cryptocurrency is safely held in escrow. It will not be released until this matter is resolved. You are protected throughout this process.` },
  { id: 'p4', cat: 'P2P', title: 'Do not release warning', text: `Important: Please do NOT release the cryptocurrency until you have confirmed receipt of the full payment in your account. Once released, transactions cannot be reversed.` },

  // Deposits
  { id: 'd1', cat: 'Deposit', title: 'Confirmations pending', text: `Your transaction has been received and is currently awaiting the required blockchain confirmations. This is a normal part of the process and is not an error. You can track the status on a block explorer using your transaction ID. Credits are applied automatically once confirmed.` },
  { id: 'd2', cat: 'Deposit', title: 'Wrong network', text: `I'm sorry to hear about this issue. Unfortunately, when funds are sent on the incorrect network, recovery is very difficult and cannot always be guaranteed. I've raised a recovery request with our technical team — reference [CASE_ID]. Please note a recovery fee applies and the process takes 7–14 business days. We'll update you via email.` },
  { id: 'd3', cat: 'Deposit', title: 'Missing memo', text: `I understand this is concerning. For XRP/XLM deposits, the MEMO/Destination Tag is mandatory. I've submitted a manual recovery ticket for your deposit — reference [CASE_ID]. Recovery takes 3–7 business days and a processing fee applies. We'll keep you updated via email.` },
  { id: 'd4', cat: 'Deposit', title: 'Below minimum', text: `Your deposit amount is below our minimum deposit threshold for this cryptocurrency. Your funds are safe and held in our system. Please top up the amount to meet the minimum deposit requirement, and the funds will be credited to your account.` },

  // Withdrawals
  { id: 'w1', cat: 'Withdrawal', title: 'Withdrawal under review', text: `Your withdrawal is currently undergoing our standard security review. This is a routine process that applies to certain transactions for your protection. You'll receive a confirmation email once it's processed — this typically takes up to 24 hours.` },
  { id: 'w2', cat: 'Withdrawal', title: 'Withdrawal freeze (security change)', text: `As a security measure, withdrawals are temporarily suspended for 24 hours following recent changes to your account security settings. This is to protect your funds. Withdrawals will resume automatically after this period.` },

  // Security
  { id: 's1', cat: 'Security', title: 'Account secure steps', text: `To secure your account immediately, please:\n1. Change your password at account.bybit.com/security\n2. Revoke all API keys under API Management\n3. Remove unrecognised devices under Security > Device Management\n4. Disable and re-enable Google Authenticator on a trusted device\n5. Enable withdrawal address whitelist` },
  { id: 's2', cat: 'Security', title: 'Phishing warning', text: `Please be aware that Bybit will never ask for your password, Google Authenticator code, or SMS verification code via chat, email, or phone. If you've shared this information with anyone, please change your password immediately and contact us.` },

  // Account
  { id: 'a1', cat: 'Account', title: 'KYC required', text: `To continue with this request, your account requires Identity Verification (KYC). Please complete verification by going to Account > Identity Verification. Most verifications are processed within 15 minutes.` },
  { id: 'a2', cat: 'Account', title: '24h withdrawal freeze', text: `For your security, a 24-hour withdrawal hold has been applied following the changes made to your account. This is an automatic security measure to protect against unauthorised access. Withdrawals will resume automatically after this period.` },
  { id: 'a3', cat: 'Account', title: 'Account restricted', text: `Your account currently has a restriction applied. Our compliance team is reviewing your account and will reach out via your registered email within 3–5 business days. For privacy and security reasons, I'm unable to provide further details about the review via chat.` },

  // Card
  { id: 'c1', cat: 'Card', title: 'Bank declined — contact bank', text: `Your bank has declined this transaction. This is a bank-side decision and Bybit has no control over it. Please contact your bank directly to authorise payments to Bybit, or try an alternative payment method.` },
  { id: 'c2', cat: 'Card', title: '3DS failure', text: `The 3D Secure authentication for your card was not completed. Please ensure your mobile number is up to date with your bank to receive OTP codes. If the issue persists, please contact your bank to enable 3DS or try a different card.` },

  // Closings
  { id: 'cl1', cat: 'Closing', title: 'Standard close', text: `Is there anything else I can help you with today?` },
  { id: 'cl2', cat: 'Closing', title: 'Warm close', text: `I'm glad I could help! If you ever have any more questions, don't hesitate to reach out to us. Have a great day! 😊` },
  { id: 'cl3', cat: 'Closing', title: 'Case resolved close', text: `I'm happy to confirm that your case has been resolved. Thank you for your patience throughout this process. Please don't hesitate to contact us if you need any further assistance. Take care!` },
  { id: 'cl4', cat: 'Closing', title: 'No response close', text: `I haven't heard back from you for a while so I'll be closing this chat for now. If you need further assistance, please don't hesitate to reach out — we're available 24/7. Have a great day!` },

  // EU Specific
  { id: 'eu1', cat: 'EU-Specific', title: 'MiCA compliance note', text: `As a MiCA-regulated exchange operating in the European Union, Bybit EU is required to comply with strict financial regulations. This means certain products, features, or processes may differ from the Global platform.` },
  { id: 'eu2', cat: 'EU-Specific', title: 'EU data request', text: `Under GDPR, you have the right to request access to your personal data held by Bybit EU. To submit a formal data request, please contact our Data Protection team at privacy@bybit.com with your UID and registered email.` },

  // CSAT Phrases
  { id: 'cs1', cat: 'CSAT Phrases', title: 'Standard greeting', text: `Thank you for reaching out to Bybit Customer Support via live chat. My name is [NAME] and I'm happy to assist you further.` },
  { id: 'cs2', cat: 'CSAT Phrases', title: 'Transfer handover', text: `Hello, my name is [NAME]. The previous agent has handed your conversation over to me. You do not need to explain everything again — I'll review the chat history and guide you from here.` },
  { id: 'cs3', cat: 'CSAT Phrases', title: 'Empathy — frustrating', text: `Thank you for explaining the situation clearly. I understand this may feel frustrating, and I'll go through it step by step with you.` },
  { id: 'cs4', cat: 'CSAT Phrases', title: 'Empathy — stressful', text: `I can understand how stressful this must feel. Let's work through the details carefully so we can identify the best next step.` },
  { id: 'cs5', cat: 'CSAT Phrases', title: 'Empathy — reassure', text: `No worries — you did the right thing by reaching out. Let's check this together.` },
  { id: 'cs6', cat: 'CSAT Phrases', title: 'Confirm understanding', text: `Just to confirm my understanding, your request is about [issue], correct?` },
  { id: 'cs7', cat: 'CSAT Phrases', title: 'Short wait', text: `Thanks. Let me check this properly for you. Could you stay with me for around 3–5 minutes?` },
  { id: 'cs8', cat: 'CSAT Phrases', title: 'Longer wait', text: `Thank you for your patience. I'm still checking this for you. Is it ok if I take another 5–7 minutes?` },
  { id: 'cs9', cat: 'CSAT Phrases', title: 'Review status', text: `Your case is still under review with the relevant team. As soon as there is an update, it will be sent to your registered email address.` },
  { id: 'cs10', cat: 'CSAT Phrases', title: 'Saying no safely', text: `I understand you were hoping for a different outcome. Unfortunately, this cannot be changed manually from live chat. Here is what can still be done instead: [option].` },
  { id: 'cs11', cat: 'CSAT Phrases', title: 'No = fairness', text: `We need to follow the same rules for all users to ensure fairness.` },
  { id: 'cs12', cat: 'CSAT Phrases', title: 'Security restriction', text: `This may feel inconvenient, but it is a standard security or regulatory process and not a personal decision.` },
  { id: 'cs13', cat: 'CSAT Phrases', title: 'Angry user pivot', text: `I understand this feels frustrating. Let's confirm the exact status first so I can guide you correctly.` },
  { id: 'cs14', cat: 'CSAT Phrases', title: 'Duplicate warning', text: `To avoid delays, please do not submit duplicate requests for the same issue.` },
  { id: 'cs15', cat: 'CSAT Phrases', title: 'CSAT close', text: `Before we finish up, is there anything else I can double-check for you today?` },
  { id: 'cs16', cat: 'CSAT Phrases', title: 'CSAT close — warm', text: `I hope things are clearer now. If today's help made things easier, your feedback would mean a lot.` },
  { id: 'cs17', cat: 'CSAT Phrases', title: 'Never asked for credentials', text: `Bybit will never ask for your password, 2FA codes, or verification codes.` },
  { id: 'cs18', cat: 'CSAT Phrases', title: 'EU Travel Rule', text: `This check is related to an EU transfer requirement. In some cases, sender and recipient details must be verified before the crypto transfer can continue. Please complete the requested details in the official flow so the review can proceed.` },
  { id: 'cs19', cat: 'CSAT Phrases', title: 'EU SEPA opener', text: `I can help check this fiat transaction with you. Was this a SEPA deposit, a SEPA withdrawal, or a bank card payment?` },
  { id: 'cs20', cat: 'CSAT Phrases', title: 'EU Card opener', text: `I can help with your Bybit EU Card issue. Is this about the application, a declined payment, wallet setup, card limits, or delivery?` },
  { id: 'cs21', cat: 'CSAT Phrases', title: 'EU vs Global clarifier', text: `Bybit EU and Bybit Global do not always offer the same products or services, so let's first confirm which platform your account is using.` },
  { id: 'cs22', cat: 'CSAT Phrases', title: 'EU complaint escalation', text: `I understand you want this reviewed formally. For Bybit EU, the correct next step is to submit the issue through the EU support and complaint webform. Please include your UID, contactable email, the relevant transaction or order ID, and any supporting screenshots so the correct team can review it without delay.` },
  { id: 'cs23', cat: 'CSAT Phrases', title: 'EU fiat unavailable', text: `If fiat services are unavailable on your account, this can depend on your region and verification details, and it cannot be enabled manually from live chat.` },
  { id: 'cs24', cat: 'CSAT Phrases', title: 'EU product unavailable', text: `Bybit EU operates under a separate EU regulatory framework, so some products or features can differ from Bybit Global. If this feature is not available on your EU account, livechat cannot enable it manually. What we can do is check whether there is a supported alternative.` },

  // Lark Escalation Templates
  { id: 'lk1', cat: 'Lark', title: 'EU Escalation Template', text: `@Pool Escalation Log EU\n📑 Inquiry directed to: EU:\n👤 UID(s): [INPUT UID]\n💼 SF(s): [CASE_ID]\n🏷️ Remark(s) in the Thread: [case summary]\nCan you please assist in checking this?\nThank you` },
  { id: 'lk2', cat: 'Lark', title: 'Global Escalation Template', text: `@Pool Escalation Log\n📑 Inquiry directed to:\n👤 UID(s): [INPUT UID]\n💼 SF(s): [CASE_ID]\n🏷️ Remark(s) in the Thread: [case summary]\nCan you please assist in checking this? Thank you` },
  { id: 'lk3', cat: 'Lark', title: 'Emergency hack case (deadair note)', text: `Handling emergency hack case in SF: [CASE_ID] please be lenient to deadair.` },

  // Hack Quicktexts
  { id: 'hk1', cat: 'Hack', title: 'as05 — Cancel withdrawal request', text: `Could you please confirm with us that you would like Bybit to cancel the withdrawal of [COIN/AMOUNT]?\n\nIf yes, please reply as follows: "I would like to request Bybit to cancel my unauthorized withdrawal." so we can process your request.` },
  { id: 'hk2', cat: 'Hack', title: 'as06 — Request account ban', text: `If you want any assistance to restrict the withdrawal and trading functions on your account temporarily, please reply as follows: "I would like to request Bybit to restrict my withdrawal and trading function temporarily for security purposes." so we can assist you further.` },
  { id: 'hk3', cat: 'Hack', title: 'as07 — Security steps advice', text: `We would like to advise you to complete the following steps to better secure your account:\n1. Enable Google Two Factor Authentication\n2. Set Up Your Fund Password\n3. Set Up Your YubiKey Authentication\n4. Set Up Anti-phishing Code\n5. Enable New Address Withdrawal Lock\n6. Deactivate Account for Suspicious Activity\n7. Use Bybit Authenticity Check\n\nFor detailed information, please refer to: https://www.bybit.com/en/help-center/article/How-to-Enhance-Your-Account-Security` },
  { id: 'hk4', cat: 'Hack', title: 'as08 — API key confirmation', text: `In order to assist you better, please let us know more details about this incident. Can we confirm with you that the trading was done by yourself or did you share your API key with any third party?` },
  { id: 'hk5', cat: 'Hack', title: 'Exchange/Web3 clarification', text: `Please clarify whether the hacking incident occurred in your Bybit account or Web3 wallet?` },
  { id: 'hk6', cat: 'Hack', title: 'Web3 info collection', text: `In order to investigate your Web3 hack reporting, kindly advise us:\n1. UID: (if any)\n2. Did you encounter any asset loss? If yes, please share the amount.\n3. Your affected wallet address:\n4. Type of wallet: Bybit cloud wallet / seed phrase wallet / keyless wallet\n5. Affected TXID:\n6. Chain of your hack reporting:` },
  { id: 'hk7', cat: 'Hack', title: 'Wallet address hijacked — resolution', text: `Upon thorough investigation, our system has detected your withdrawal/deposit address might have been compromised by a browser plug-in, resulting in the display of a fake address. To safeguard your funds:\n- Uninstall any suspicious plug-ins\n- Reinstall the official browser before proceeding with any deposit/withdrawal activities\n- Use a different device that has not detected any malware to resubmit your request\n\nAll data on the Bybit platform is 100% secure — this incident is not a result of any data leakage from our servers.` },

  // Follow-up Email Templates
  { id: 'em1', cat: 'Email Templates', title: 'Lost Chat Follow-up', text: `{{{Case.Anti_Phishing_Text__c}}}\n{{{Case.Anti_Phishing_Code__c}}}\n\nDear valued Bybit trader,\n\nThank you for contacting Bybit Customer Support.\n\nWe would like to express our sincere apologies for the chat due to [state reason for losing the chat]. Allow me to assist you further on your [issue/concern of client].\n\n[your response / solution here]\n\nHope that answers your inquiry. Please do not hesitate to contact us again should you require any assistance. Thank you.` },
  { id: 'em2', cat: 'Email Templates', title: 'Empty Chat / Inactivity Follow-up', text: `Thank you for contacting Bybit Customer Support.\n\nWe would like to express our sincere apologies that the chat had to be closed due to inactivity. Allow me to assist you further with your inquiry.\n\nWe noticed that the chat was disconnected before you were able to share your concern with us. Kindly reply to this message with more details regarding the issue so we can assist you accordingly.\n\nYou may also visit our Help Center for answers and step-by-step guides to common inquiries.\n\nThank you and we hope to hear from you soon.` },
];

const CATEGORIES = ['All', ...new Set(BUILT_IN.map(t => t.cat))];

function TemplateCard({ tpl, onCopy, copied, onPin, pinned, onDelete, isCustom }) {
  return (
    <div className={cn(
      'bg-bg-1 border rounded-xl p-4 group transition-all',
      pinned ? 'border-hero/30' : 'border-border-0 hover:border-border-0'
    )}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs bg-bg-2 text-fg-1 px-2 py-0.5 rounded shrink-0">{tpl.cat}</span>
          <span className="font-medium text-fg-0 text-sm truncate">{tpl.title}</span>
          {pinned && <Star size={11} className="text-hero shrink-0 fill-hero" />}
        </div>
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onPin(tpl.id)} className={cn('transition-colors', pinned ? 'text-hero' : 'text-fg-2 hover:text-hero')} title={pinned ? 'Unpin' : 'Pin'}>
            <Star size={13} className={pinned ? 'fill-hero' : ''} />
          </button>
          <button onClick={() => onCopy(tpl.id, tpl.text)} className="text-fg-2 hover:text-hero transition-colors">
            {copied === tpl.id ? <Check size={13} className="text-ok" /> : <Copy size={13} />}
          </button>
          {isCustom && (
            <button onClick={() => onDelete(tpl.id)} className="text-fg-2 hover:text-crit transition-colors">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
      <p className="text-xs text-fg-1 leading-relaxed whitespace-pre-wrap line-clamp-3">{tpl.text}</p>
      <button
        onClick={() => onCopy(tpl.id, tpl.text)}
        className="mt-2 text-xs text-fg-2 hover:text-hero transition-colors"
      >
        {copied === tpl.id ? '✓ Copied!' : 'Copy'}
      </button>
    </div>
  );
}

export default function QuickTemplates() {
  const [cat, setCat] = useState('All');
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(null);
  const [pinned, setPinned] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pinned_templates')) || []; } catch { return []; }
  });
  const [custom, setCustom] = useState(() => {
    try { return JSON.parse(localStorage.getItem('custom_templates')) || []; } catch { return []; }
  });
  const [showAdd, setShowAdd] = useState(false);
  const [newForm, setNewForm] = useState({ cat: 'Custom', title: '', text: '' });

  function copy(id, text) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  function pin(id) {
    const updated = pinned.includes(id) ? pinned.filter(p => p !== id) : [...pinned, id];
    setPinned(updated);
    localStorage.setItem('pinned_templates', JSON.stringify(updated));
  }

  function addCustom() {
    if (!newForm.title.trim() || !newForm.text.trim()) return;
    const entry = { ...newForm, id: `c_${Date.now()}` };
    const updated = [...custom, entry];
    setCustom(updated);
    localStorage.setItem('custom_templates', JSON.stringify(updated));
    setNewForm({ cat: 'Custom', title: '', text: '' });
    setShowAdd(false);
  }

  function deleteCustom(id) {
    const updated = custom.filter(t => t.id !== id);
    setCustom(updated);
    localStorage.setItem('custom_templates', JSON.stringify(updated));
  }

  const all = [...BUILT_IN, ...custom];

  const filtered = all.filter(t => {
    const matchCat = cat === 'All' || t.cat === cat;
    const q = search.toLowerCase();
    const matchSearch = !q || t.title.toLowerCase().includes(q) || t.text.toLowerCase().includes(q) || t.cat.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  const pinnedTemplates = filtered.filter(t => pinned.includes(t.id));
  const unpinnedTemplates = filtered.filter(t => !pinned.includes(t.id));

  const allCats = ['All', ...new Set(all.map(t => t.cat))];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-fg-0">💬 Quick Templates</h1>
          <p className="text-sm text-fg-2">Ready-to-send responses — copy and go</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-2 bg-hero/20 hover:bg-hero/30 text-hero text-sm px-4 py-2 rounded-lg transition-colors">
          <Plus size={14} /> Add template
        </button>
      </div>

      {/* Add custom template */}
      {showAdd && (
        <div className="bg-bg-1 border border-hero/20 rounded-xl p-5 space-y-3">
          <p className="text-sm font-medium text-fg-1">New template</p>
          <div className="grid grid-cols-2 gap-3">
            <input value={newForm.title} onChange={e => setNewForm(p => ({ ...p, title: e.target.value }))} placeholder="Template title" className="bg-bg-2 border border-border-0 rounded-lg px-3 py-2 text-sm text-fg-0 outline-none focus:border-hero/50" />
            <input value={newForm.cat} onChange={e => setNewForm(p => ({ ...p, cat: e.target.value }))} placeholder="Category (e.g. Greeting, P2P...)" className="bg-bg-2 border border-border-0 rounded-lg px-3 py-2 text-sm text-fg-0 outline-none focus:border-hero/50" />
          </div>
          <textarea value={newForm.text} onChange={e => setNewForm(p => ({ ...p, text: e.target.value }))} placeholder="Template text — use [PLACEHOLDERS] for things to fill in..." rows={4} className="w-full bg-bg-2 border border-border-0 rounded-lg px-3 py-2 text-sm text-fg-0 outline-none resize-none focus:border-hero/50" />
          <div className="flex gap-2">
            <button onClick={addCustom} disabled={!newForm.title || !newForm.text} className="bg-hero disabled:bg-bg-3 disabled:text-fg-2 text-[#021418] font-medium text-sm px-5 py-2 rounded-lg hover:bg-hero transition-colors">Save</button>
            <button onClick={() => setShowAdd(false)} className="text-fg-2 text-sm px-4 py-2">Cancel</button>
          </div>
        </div>
      )}

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 flex items-center gap-2 bg-bg-1 border border-border-0 focus-within:border-hero/50 rounded-xl px-4 py-3">
          <Search size={15} className="text-fg-2 shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search templates..." className="flex-1 bg-transparent text-sm text-fg-0 placeholder-fg-2 outline-none" />
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2">
        {allCats.map(c => (
          <button key={c} onClick={() => setCat(c)} className={cn(
            'text-xs px-3 py-1.5 rounded-lg border transition-all font-medium',
            cat === c ? 'bg-hero/20 border-hero/40 text-hero' : 'bg-bg-1 border-border-0 text-fg-1 hover:text-fg-0'
          )}>{c}</button>
        ))}
      </div>

      {/* Pinned */}
      {pinnedTemplates.length > 0 && (
        <div>
          <p className="text-xs text-fg-2 uppercase tracking-wider mb-3 flex items-center gap-2"><Star size={11} className="fill-hero text-hero" /> Pinned</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pinnedTemplates.map(t => (
              <TemplateCard key={t.id} tpl={t} onCopy={copy} copied={copied} onPin={pin} pinned={true} onDelete={deleteCustom} isCustom={t.id.startsWith('c_')} />
            ))}
          </div>
        </div>
      )}

      {/* All results */}
      {unpinnedTemplates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {unpinnedTemplates.map(t => (
            <TemplateCard key={t.id} tpl={t} onCopy={copy} copied={copied} onPin={pin} pinned={false} onDelete={deleteCustom} isCustom={t.id.startsWith('c_')} />
          ))}
        </div>
      ) : filtered.length === 0 && (
        <p className="text-center text-fg-2 py-12">No templates match your search</p>
      )}
    </div>
  );
}
