import { useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, Circle, Loader2, Copy, Check, RotateCcw, AlertTriangle } from 'lucide-react';
import { InvokeLLM } from '@/api/integrations';
import { scrubPII } from '@/lib/SecurityModule';

const SOP_STEPS = [
  { key: 'type_confirmed', label: 'Confirmed: EXCHANGE hack or Web3 hack?' },
  { key: 'uid_confirmed', label: 'UID / registered email / phone confirmed from system' },
  { key: 'access_checked', label: 'Checked if customer still has account access' },
  { key: 'ban_offered', label: 'Offered account ban — verified Full Name (KYC doc) + Date of Birth if yes' },
  { key: 'ban_applied', label: 'Shift-co notified: Withdraw Ban (All) + Trading Ban (Close Only) + Transfer Ban' },
  { key: 'withdrawals_checked', label: 'Withdrawal history checked in CS:GO — Status 2-13 or 2-14: tag Risk Ops to cancel' },
  { key: 'positions_checked', label: 'Open positions checked — customer informed trading ban allows close-only' },
  { key: 'vip_assessed', label: 'VIP level confirmed — VIP2+ or amount ≥ 100,000: tag KYC SME + shift-co for hotline' },
  { key: 'internal_note', label: 'Internal note written and saved in SF' },
  { key: 'case_type_set', label: 'Case type: E01-Account Matters > Security Issue > Hack (+ Level 4 if applicable)' },
  { key: 'expedition_raised', label: 'Case Expedition Form raised' },
  { key: 'pool_macro', label: 'Macro run: Pool 1 → Pool 2' },
];

const LARK_TEMPLATE_EU = (uid, sf, remark) =>
`@Pool Escalation Log EU
📑 Inquiry directed to: EU:
👤 UID(s): ${uid || '[INPUT UID]'}
💼 SF(s): ${sf || '[CASE_ID]'}
🏷️ Remark(s) in the Thread: ${remark || '[case summary]'}
Can you please assist in checking this?
Thank you`;

const LARK_TEMPLATE_GLOBAL = (uid, sf, remark) =>
`@Pool Escalation Log
📑 Inquiry directed to:
👤 UID(s): ${uid || '[INPUT UID]'}
💼 SF(s): ${sf || '[CASE_ID]'}
🏷️ Remark(s) in the Thread: ${remark || '[case summary]'}
Can you please assist in checking this? Thank you`;

export default function HackCase() {
  const [checked, setChecked] = useState({});
  const [form, setForm] = useState({
    team: 'EU',
    hackType: 'exchange',
    vipLevel: 'non-vip',
    incidentTime: '',
    missingAssets: '',
    twoFaStatus: '',
    apiKeys: '',
    accessStatus: 'has_access',
    additionalNotes: '',
  });
  const [generated, setGenerated] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(null);

  function tick(key) {
    setChecked(p => ({ ...p, [key]: !p[key] }));
  }

  function update(field, val) {
    setForm(p => ({ ...p, [field]: val }));
  }

  function reset() {
    if (!confirm('Reset this case?')) return;
    setChecked({});
    setForm({ team: 'EU', hackType: 'exchange', vipLevel: 'non-vip', incidentTime: '', missingAssets: '', twoFaStatus: '', apiKeys: '', accessStatus: 'has_access', additionalNotes: '' });
    setGenerated(null);
  }

  // Kinetic SOP Sensing: auto-check steps confirmed by AI response
  function autoCheckFromResponse(responseText) {
    if (!responseText) return;
    const lower = responseText.toLowerCase();
    const signals = {
      type_confirmed: /hack\s*type|exchange\s*hack|web3\s*hack|confirmed.*hack/i,
      uid_confirmed: /uid[:\s]|registered\s*email|user\s*id/i,
      access_checked: /account\s*access|still\s*has\s*access|locked\s*out|access\s*status/i,
      ban_offered: /ban.*offered|full\s*name.*date\s*of\s*birth|verified.*identity/i,
      ban_applied: /withdraw\s*ban|trading\s*ban|transfer\s*ban|close[- ]only/i,
      withdrawals_checked: /withdrawal\s*history|status\s*2-1[34]|risk\s*ops/i,
      positions_checked: /open\s*positions|close[- ]only\s*mode/i,
      vip_assessed: /vip\s*level|vip\s*\d|hotline|kyc\s*sme/i,
      internal_note: /internal\s*note|saved\s*in\s*sf|summary.*uid/i,
      case_type_set: /e01[- ]account|security\s*issue.*hack|case\s*type/i,
      expedition_raised: /expedition\s*form|case\s*expedition/i,
      pool_macro: /pool\s*1.*pool\s*2|macro.*pool/i,
    };
    const updates = {};
    for (const [key, rx] of Object.entries(signals)) {
      if (rx.test(responseText) && !checked[key]) {
        updates[key] = true;
      }
    }
    if (Object.keys(updates).length > 0) {
      setChecked(prev => ({ ...prev, ...updates }));
    }
  }

  const isHighPriority = form.vipLevel === 'vip2plus';
  const larkTemplate = form.team === 'EU'
    ? LARK_TEMPLATE_EU('[INPUT UID]', '[CASE_ID]', form.incidentTime ? `Hack report — ${form.hackType === 'web3' ? 'Web3' : 'Exchange'} — ${form.incidentTime}${form.missingAssets ? ` — Assets: ${form.missingAssets}` : ''}` : '')
    : LARK_TEMPLATE_GLOBAL('[INPUT UID]', '[CASE_ID]', form.incidentTime ? `Hack report — ${form.hackType === 'web3' ? 'Web3' : 'Exchange'} — ${form.incidentTime}${form.missingAssets ? ` — Assets: ${form.missingAssets}` : ''}` : '');

  async function generate() {
    setLoading(true);
    setGenerated(null);
    try {
      const isWeb3 = form.hackType === 'web3';
      const res = await InvokeLLM({
        prompt: `Generate outputs for a Bybit ${isWeb3 ? 'Web3' : 'Exchange'} account hack case. Team: Bybit ${form.team}. VIP Level: ${form.vipLevel}.

CASE DETAILS:
- Hack type: ${isWeb3 ? 'Web3 wallet hack' : 'Exchange account hack'}
- Incident time: ${form.incidentTime || 'Not specified'}
- Missing/moved assets: ${scrubPII(form.missingAssets || 'Not specified')}
- 2FA status: ${form.twoFaStatus || 'Unknown'}
- API keys on account: ${form.apiKeys || 'Unknown'}
- Account access: ${form.accessStatus === 'has_access' ? 'Customer can still access account' : 'Customer locked out'}
- Additional notes: ${scrubPII(form.additionalNotes || 'None')}

Generate THREE sections exactly:

CUSTOMER MESSAGE:
A warm, empathetic, professional message to send to the customer. Acknowledge the distressing situation, confirm you are escalating to the security team urgently, provide the immediate security steps they should take now, and set expectations (investigation takes 3–7 business days). Use [INPUT UID] where UID appears and [CASE_ID] for case reference. No markdown asterisks — plain text only.

INTERNAL NOTE:
Use this exact format:
UID: [INPUT UID]
VIP level: ${form.vipLevel}
Account status: Withdraw Ban (All) + Trading Ban (Close Only) + Transfer Ban
Request origin: Live chat / Email (update as needed)
Request category: Hack${isWeb3 ? ' (Web3)' : ''}
Summary:
(a) How user discovered abnormality: ${form.additionalNotes || '[to be filled]'}
(b) Affected timeframe: ${form.incidentTime || '[to be filled]'}
(c) Capital loss: ${form.missingAssets || 'To be confirmed'}
(d) Other info: 2FA — ${form.twoFaStatus || 'unknown'} | API keys — ${form.apiKeys || 'unknown'}
(e) Screenshots: [attach if provided]
${isWeb3 ? 'User wallet address: [confirm]\nType of wallet: [Bybit cloud / seed phrase / keyless]\nAffected TXID: [confirm]\nChain: [confirm]' : 'Contactable email: [if user lost email access]'}

CASE TYPE:
E01-Account Matters > Security Issue > Hack${isWeb3 ? ' | Level 4: Hacked (Web3)' : ' | Level 4: Hacked Account Alert'}`,
        system_prompt: 'You are a Bybit security case specialist. Generate professional, accurate outputs for the agent. Use plain text only — no markdown asterisks. Follow the exact format requested.',
        useKB: true,
      });

      const customerMatch = res.match(/CUSTOMER MESSAGE:\n([\s\S]*?)(?=INTERNAL NOTE:|$)/i);
      const internalNoteMatch = res.match(/INTERNAL NOTE:\n([\s\S]*?)(?=CASE TYPE:|$)/i);
      const caseTypeMatch = res.match(/CASE TYPE:\n([\s\S]*?)$/i);

      setGenerated({
        customer: customerMatch?.[1]?.trim() || res,
        internalNote: internalNoteMatch?.[1]?.trim() || '',
        caseType: caseTypeMatch?.[1]?.trim() || `E01-Account Matters > Security Issue > Hack`,
        lark: larkTemplate,
      });
      // Kinetic SOP: auto-check steps confirmed by the AI response + form data
      autoCheckFromResponse(res + ' ' + JSON.stringify(form));
    } catch (e) {
      setGenerated({ error: e.message });
    }
    setLoading(false);
  }

  function copy(text, key) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  const doneCount = Object.values(checked).filter(Boolean).length;
  const canGenerate = form.incidentTime || form.missingAssets;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">🔴 Hack Case</h1>
          <p className="text-sm text-slate-500">Real-time SOP + auto-generates customer message, internal note & Lark escalation</p>
        </div>
        <button onClick={reset} className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-400 transition-colors cursor-pointer" aria-label="Reset hack case form">
          <RotateCcw size={13} /> Reset
        </button>
      </div>

      {/* High priority alert */}
      {isHighPriority && (
        <div className="bg-red-500/10 border border-red-500/40 rounded-xl px-4 py-3 flex items-center gap-3">
          <AlertTriangle size={16} className="text-red-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-400">VIP 2+ — Hotline Required</p>
            <p className="text-xs text-slate-400 mt-0.5">Tag KYC SME + shift-co immediately. Call P0 → 33 Account-Security (or 34 Web3-Security for Web3). Do not wait.</p>
          </div>
        </div>
      )}

      {/* Case info form */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-slate-100 text-sm">📋 Case Details</h2>

        {/* Team + Hack type + VIP */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-xs text-slate-500 mb-1 block" id="hc-team-label">Team</label>
            <div className="flex gap-1" role="group" aria-labelledby="hc-team-label">
              {['EU', 'Global'].map(t => (
                <button key={t} onClick={() => update('team', t)} aria-label={`Select team ${t}`}
                  className={cn('flex-1 text-sm py-2 rounded-lg border transition-all cursor-pointer',
                    form.team === t ? 'bg-yellow-400/15 border-yellow-400/40 text-yellow-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200')}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block" id="hc-type-label">Hack type</label>
            <div className="flex gap-1" role="group" aria-labelledby="hc-type-label">
              {[{ val: 'exchange', label: 'Exchange' }, { val: 'web3', label: 'Web3' }].map(o => (
                <button key={o.val} onClick={() => update('hackType', o.val)} aria-label={`Select ${o.label} hack type`}
                  className={cn('flex-1 text-xs py-2 rounded-lg border transition-all cursor-pointer',
                    form.hackType === o.val ? 'bg-yellow-400/15 border-yellow-400/40 text-yellow-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200')}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="hc-vip" className="text-xs text-slate-500 mb-1 block">VIP level</label>
            <select id="hc-vip" value={form.vipLevel} onChange={e => update('vipLevel', e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-yellow-400/50 cursor-pointer">
              <option value="non-vip">Non-VIP</option>
              <option value="vip1">VIP 1</option>
              <option value="vip2plus">VIP 2+ 🔥</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="hc-time" className="text-xs text-slate-500 mb-1 block">When did it happen?</label>
            <input id="hc-time" value={form.incidentTime} onChange={e => update('incidentTime', e.target.value)}
              placeholder="e.g. Today around 2pm, yesterday evening..."
              className="w-full bg-slate-800 border border-slate-700 focus:border-yellow-400/50 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 outline-none" />
          </div>
          <div>
            <label htmlFor="hc-assets" className="text-xs text-slate-500 mb-1 block">Missing / moved assets</label>
            <input id="hc-assets" value={form.missingAssets} onChange={e => update('missingAssets', e.target.value)}
              placeholder="e.g. 500 USDT withdrawn, BTC transfer..."
              className="w-full bg-slate-800 border border-slate-700 focus:border-yellow-400/50 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 outline-none" />
          </div>
          <div>
            <label htmlFor="hc-2fa" className="text-xs text-slate-500 mb-1 block">2FA status at time</label>
            <input id="hc-2fa" value={form.twoFaStatus} onChange={e => update('twoFaStatus', e.target.value)}
              placeholder="e.g. GA active, SMS only, disabled..."
              className="w-full bg-slate-800 border border-slate-700 focus:border-yellow-400/50 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 outline-none" />
          </div>
          <div>
            <label htmlFor="hc-api" className="text-xs text-slate-500 mb-1 block">API keys on account?</label>
            <input id="hc-api" value={form.apiKeys} onChange={e => update('apiKeys', e.target.value)}
              placeholder="e.g. Yes - 2 active keys, None found..."
              className="w-full bg-slate-800 border border-slate-700 focus:border-yellow-400/50 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 outline-none" />
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-500 mb-1 block" id="hc-access-label">Account access</label>
          <div className="flex gap-2" role="group" aria-labelledby="hc-access-label">
            {[{ val: 'has_access', label: 'Customer can access account' }, { val: 'locked_out', label: 'Customer locked out' }].map(opt => (
              <button key={opt.val} onClick={() => update('accessStatus', opt.val)} aria-label={opt.label}
                className={cn('flex-1 text-sm px-3 py-2 rounded-lg border transition-all cursor-pointer',
                  form.accessStatus === opt.val ? 'bg-yellow-400/15 border-yellow-400/40 text-yellow-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200')}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="hc-notes" className="text-xs text-slate-500 mb-1 block">Additional notes</label>
          <textarea id="hc-notes" value={form.additionalNotes} onChange={e => update('additionalNotes', e.target.value)}
            placeholder="Suspicious emails, phishing links, third-party app access, how they noticed the hack..."
            rows={2}
            className="w-full bg-slate-800 border border-slate-700 focus:border-yellow-400/50 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 outline-none resize-none" />
        </div>
      </div>

      {/* SOP Checklist */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-100 text-sm">✅ SOP Checklist</h2>
          <span className="text-xs text-slate-500">{doneCount}/{SOP_STEPS.length}</span>
        </div>
        <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-yellow-400 rounded-full transition-all duration-300" style={{ width: `${(doneCount / SOP_STEPS.length) * 100}%` }} />
        </div>
        <div className="space-y-2 pt-1">
          {SOP_STEPS.map(step => (
            <button key={step.key} onClick={() => tick(step.key)} className="flex items-center gap-3 w-full text-left group cursor-pointer" aria-label={`Toggle: ${step.label}`}>
              {checked[step.key]
                ? <CheckCircle2 size={16} className="text-green-400 shrink-0" />
                : <Circle size={16} className="text-slate-600 group-hover:text-slate-400 shrink-0" />}
              <span className={cn('text-sm', checked[step.key] ? 'line-through text-slate-600' : 'text-slate-300')}>
                {step.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Lark template preview */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-slate-400">📲 Lark {form.team} Escalation Template</p>
          <button onClick={() => copy(larkTemplate, 'lark-preview')} className="flex items-center gap-1 text-xs text-slate-500 hover:text-yellow-400 transition-colors cursor-pointer" aria-label="Copy Lark escalation template">
            {copied === 'lark-preview' ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
          </button>
        </div>
        <p className="text-xs text-slate-400 font-mono whitespace-pre-wrap leading-relaxed">{larkTemplate}</p>
      </div>

      {/* Generate button */}
      <button onClick={generate} disabled={loading || !canGenerate} aria-label="Generate customer message and internal note"
        className="w-full bg-yellow-400 hover:bg-yellow-300 disabled:bg-slate-800 disabled:text-slate-600 text-slate-900 font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer">
        {loading ? <><Loader2 size={16} className="animate-spin" /> Generating...</> : '✦ Generate customer message + internal note'}
      </button>
      {!canGenerate && !loading && (
        <p className="text-xs text-slate-600 text-center -mt-4">Fill in incident time or missing assets to generate</p>
      )}

      {/* Error */}
      {generated?.error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-400">{generated.error}</div>
      )}

      {/* Generated outputs */}
      {generated && !generated.error && (
        <div className="space-y-4">
          {generated.customer && (
            <div className="bg-slate-900 border border-green-500/20 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-green-400 text-sm">💬 Customer Message</h3>
                <button onClick={() => copy(generated.customer, 'customer')} className="flex items-center gap-1 text-xs text-slate-500 hover:text-yellow-400 transition-colors">
                  {copied === 'customer' ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                </button>
              </div>
              <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{generated.customer}</p>
            </div>
          )}

          {generated.internalNote && (
            <div className="bg-slate-900 border border-blue-500/20 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-blue-400 text-sm">📝 Internal Note</h3>
                <button onClick={() => copy(generated.internalNote, 'note')} className="flex items-center gap-1 text-xs text-slate-500 hover:text-yellow-400 transition-colors">
                  {copied === 'note' ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                </button>
              </div>
              <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed font-mono">{generated.internalNote}</p>
            </div>
          )}

          {generated.lark && (
            <div className="bg-slate-900 border border-yellow-400/20 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-yellow-400 text-sm">📲 Lark {form.team} Escalation</h3>
                <button onClick={() => copy(generated.lark, 'lark')} className="flex items-center gap-1 text-xs text-slate-500 hover:text-yellow-400 transition-colors">
                  {copied === 'lark' ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                </button>
              </div>
              <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed font-mono">{generated.lark}</p>
            </div>
          )}

          {generated.caseType && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3">
              <p className="text-xs text-slate-500 mb-1">Case Type</p>
              <p className="text-sm text-slate-200 font-mono">{generated.caseType}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
