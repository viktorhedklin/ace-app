import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── data ─────────────────────────────────────────────────────────────────────

const COLLECT = [
  'UID', 'Deposit amount + currency', 'Transfer date & time',
  'Sender bank name', 'Receiving IBAN used', 'Reference / memo used',
  'Bank status (pending / completed)', 'Proof of transfer / receipt',
];

const CAUSES = [
  { label: 'Bank still processing', color: 'yellow' },
  { label: 'Outside banking hours', color: 'yellow' },
  { label: 'Weekend / holiday', color: 'yellow' },
  { label: 'Wrong / missing reference', color: 'red' },
  { label: 'Wrong beneficiary details', color: 'red' },
  { label: 'Third-party sender', color: 'red' },
  { label: 'Old bank details used', color: 'red' },
  { label: 'Compliance review', color: 'orange' },
  { label: 'Transfer returned', color: 'orange' },
];

const ESCALATE_WHEN = [
  'Bank shows completed + no record on our side',
  'Transfer appears unmatched',
  'Funds may have gone to old/incorrect details',
  'Name mismatch / third-party sender',
  'Duplicate transfer',
  'Returned funds not received back',
  'Compliance hold visible — needs back office',
];

const PROOF_NEEDS = [
  'Sender full name', 'IBAN / account (masked ok)', 'Amount',
  'Date', 'Transaction status', 'Reference / confirmation number', 'Recipient details',
];

const TRIAGE = [
  {
    condition: 'Bank = PENDING',
    icon: '🕐',
    color: 'yellow',
    action: 'Customer waits on bank side first. No action from us yet.',
    tag: 'WAIT',
  },
  {
    condition: 'Bank = COMPLETED + no record',
    icon: '🔍',
    color: 'red',
    action: 'Collect proof → verify details match → escalate if beyond expected time.',
    tag: 'ESCALATE',
  },
  {
    condition: 'Wrong / missing reference',
    icon: '⚠️',
    color: 'orange',
    action: 'Explain it may delay or prevent crediting. Collect proof and escalate per SOP.',
    tag: 'ESCALATE',
  },
  {
    condition: 'Internal review showing',
    icon: '🔒',
    color: 'blue',
    action: 'Neutral wording only. No ETA. Tell customer the process is ongoing.',
    tag: 'HOLD',
  },
];

const SAFE_WORDING = `The transfer may still be under bank or payment partner processing. We're not able to manually credit it unless the payment is confirmed and successfully matched. If you've already passed the usual processing time, please share your transfer proof and we'll check whether it needs further review.`;

const INTERNAL_NOTE = `Platform: [EU / Global]
Amount / Currency:
Transfer date-time:
Sender name:
Receiving IBAN used:
Reference used:
Bank status: [pending / completed]
Deposit record exists: [yes / no]
Proof attached: [yes / no]
Issue: [delayed / unmatched / wrong reference / possible return]`;

const TAG_STYLE = {
  WAIT:    'bg-hero/15 text-hero border-hero/30',
  ESCALATE:'bg-crit/15 text-crit border-crit/30',
  HOLD:    'bg-info/15 text-info border-info/30',
};

const COLOR = {
  yellow: { border: 'border-hero/25', dot: 'bg-hero', label: 'text-hero' },
  red:    { border: 'border-crit/25',    dot: 'bg-crit',    label: 'text-crit' },
  orange: { border: 'border-orange-400/25', dot: 'bg-orange-400', label: 'text-warn' },
  blue:   { border: 'border-info/25',   dot: 'bg-info',   label: 'text-info' },
  green:  { border: 'border-ok/25',  dot: 'bg-ok',  label: 'text-ok' },
};

// ── helpers ───────────────────────────────────────────────────────────────────

function useCopy(text, ms = 2000) {
  const [done, setDone] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text);
    setDone(true);
    setTimeout(() => setDone(false), ms);
  }
  return [done, copy];
}

function CopyBtn({ text, className = '' }) {
  const [done, copy] = useCopy(text);
  return (
    <button
      onClick={copy}
      className={cn(
        'flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border transition-all',
        done
          ? 'bg-ok/15 border-ok/30 text-ok'
          : 'bg-bg-2 border-border-0 text-fg-1 hover:text-hero hover:border-hero/40',
        className
      )}
    >
      {done ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
    </button>
  );
}

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-bg-1 border border-border-0 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-xs font-semibold text-fg-1 uppercase tracking-widest">{title}</span>
        {open ? <ChevronUp size={13} className="text-fg-2" /> : <ChevronDown size={13} className="text-fg-2" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── main ──────────────────────────────────────────────────────────────────────

export default function SepaDelay() {
  const [checkedItems, setCheckedItems] = useState({});

  function toggleCheck(label) {
    setCheckedItems(p => ({ ...p, [label]: !p[label] }));
  }

  const checkedCount = Object.values(checkedItems).filter(Boolean).length;

  return (
    <div className="p-5 max-w-4xl mx-auto space-y-4">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-xl font-bold text-fg-0">💶 SEPA Deposit Delay</h1>
          <p className="text-sm text-fg-2 mt-0.5">Step-by-step cheat sheet — keep this open during the case</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-info/15 border border-info/30 text-info px-2.5 py-1 rounded-lg font-medium">🇪🇺 EU</span>
          <span className="text-xs bg-bg-2 border border-border-0 text-fg-2 px-2.5 py-1 rounded-lg font-medium">🌍 Global</span>
        </div>
      </motion.div>

      {/* Step flow */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, delay: 0.05 }}
        className="grid grid-cols-3 gap-2"
      >
        {[
          { n: '01', label: 'Platform first', sub: 'EU or Global?', color: 'yellow' },
          { n: '02', label: 'Collect info', sub: `${checkedCount}/${COLLECT.length} items`, color: checkedCount === COLLECT.length ? 'green' : 'slate' },
          { n: '03', label: 'Triage & act', sub: 'Match condition below', color: 'slate' },
        ].map((s, i) => (
          <div key={s.n} className={cn(
            'rounded-xl p-3 border flex items-center gap-3',
            s.color === 'yellow' ? 'bg-hero/8 border-hero/25' :
            s.color === 'green'  ? 'bg-ok/8 border-ok/25' :
            'bg-bg-1 border-border-0'
          )}>
            <span className={cn(
              'text-2xl font-black tabular-nums leading-none shrink-0',
              s.color === 'yellow' ? 'text-hero' :
              s.color === 'green'  ? 'text-ok' : 'text-fg-3'
            )}>{s.n}</span>
            <div>
              <p className={cn('font-semibold text-sm', s.color === 'yellow' ? 'text-hero' : s.color === 'green' ? 'text-ok' : 'text-fg-1')}>{s.label}</p>
              <p className="text-xs text-fg-2">{s.sub}</p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Main grid: Collect + Triage */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, delay: 0.1 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-4"
      >
        {/* Left: Collect + Causes */}
        <div className="space-y-4">

          {/* Collect */}
          <Section title="02 — Collect from customer">
            <div className="px-4 pb-4 space-y-1.5">
              {COLLECT.map(item => (
                <button
                  key={item}
                  onClick={() => toggleCheck(item)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left text-sm transition-all duration-150',
                    checkedItems[item]
                      ? 'bg-ok/10 border-ok/25 text-ok'
                      : 'bg-bg-2/60 border-border-0 text-fg-1 hover:border-border-1'
                  )}
                >
                  <span className={cn(
                    'w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all',
                    checkedItems[item] ? 'bg-ok border-ok' : 'border-border-1'
                  )}>
                    {checkedItems[item] && <Check size={10} className="text-[#021418]" />}
                  </span>
                  {item}
                </button>
              ))}
              {checkedCount > 0 && (
                <button
                  onClick={() => setCheckedItems({})}
                  className="text-xs text-fg-2 hover:text-fg-1 transition-colors mt-1"
                >
                  Clear all
                </button>
              )}
            </div>
          </Section>

          {/* Causes */}
          <Section title="Common delay causes" defaultOpen={false}>
            <div className="px-4 pb-4 flex flex-wrap gap-2">
              {CAUSES.map(c => (
                <span key={c.label} className={cn(
                  'text-xs px-2.5 py-1 rounded-lg border font-medium',
                  c.color === 'yellow' ? 'bg-hero/10 border-hero/25 text-hero' :
                  c.color === 'red'    ? 'bg-crit/10 border-crit/25 text-crit' :
                  'bg-orange-400/10 border-orange-400/25 text-warn'
                )}>{c.label}</span>
              ))}
            </div>
          </Section>

          {/* Proof needed */}
          <Section title="Proof must show" defaultOpen={false}>
            <div className="px-4 pb-4 flex flex-wrap gap-2">
              {PROOF_NEEDS.map(p => (
                <span key={p} className="text-xs px-2.5 py-1 rounded-lg border bg-bg-2 border-border-0 text-fg-1">{p}</span>
              ))}
              <p className="w-full text-xs text-fg-2 mt-1">Never ask for password, 2FA, or full card details.</p>
            </div>
          </Section>
        </div>

        {/* Right: Fast Triage */}
        <div className="space-y-4">
          <Section title="03 — Fast triage">
            <div className="px-4 pb-4 space-y-2">
              {TRIAGE.map((t, i) => (
                <motion.div
                  key={t.condition}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + i * 0.05 }}
                  className={cn('rounded-xl border p-3.5', COLOR[t.color].border, 'bg-bg-2/40')}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-base leading-none">{t.icon}</span>
                      <p className={cn('text-sm font-semibold', COLOR[t.color].label)}>{t.condition}</p>
                    </div>
                    <span className={cn('text-xs px-2 py-0.5 rounded border font-bold shrink-0', TAG_STYLE[t.tag])}>{t.tag}</span>
                  </div>
                  <p className="text-xs text-fg-1 leading-relaxed pl-7">{t.action}</p>
                </motion.div>
              ))}
            </div>
          </Section>

          {/* Escalate when */}
          <Section title="When to escalate" defaultOpen={false}>
            <div className="px-4 pb-4 space-y-1.5">
              {ESCALATE_WHEN.map(e => (
                <div key={e} className="flex items-start gap-2 text-sm text-fg-1">
                  <span className="text-crit mt-1 shrink-0 text-xs">◆</span>
                  {e}
                </div>
              ))}
            </div>
          </Section>
        </div>
      </motion.div>

      {/* Wording blocks */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, delay: 0.18 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        {/* Safe wording */}
        <div className="bg-bg-1 border border-hero/20 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-0">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-hero animate-pulse" />
              <span className="text-xs font-semibold text-hero uppercase tracking-widest">Safe wording — customer</span>
            </div>
            <CopyBtn text={SAFE_WORDING} />
          </div>
          <p className="px-4 py-3 text-sm text-fg-1 leading-relaxed">{SAFE_WORDING}</p>
        </div>

        {/* Internal note */}
        <div className="bg-bg-1 border border-border-0 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-0">
            <span className="text-xs font-semibold text-fg-1 uppercase tracking-widest">Internal note template</span>
            <CopyBtn text={INTERNAL_NOTE} />
          </div>
          <pre className="px-4 py-3 text-xs text-fg-1 leading-relaxed font-mono whitespace-pre-wrap">{INTERNAL_NOTE}</pre>
        </div>
      </motion.div>

      {/* Never do */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18, delay: 0.22 }}
        className="bg-crit/5 border border-crit/20 rounded-xl px-5 py-3"
      >
        <p className="text-xs font-semibold text-crit uppercase tracking-widest mb-2">Never</p>
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          {['Promise an ETA', 'Say "it will arrive today"', 'Blame user before confirming facts', 'Mention internal review logic', 'Share internal system details'].map(d => (
            <span key={d} className="text-xs text-fg-2 flex items-center gap-1.5">
              <span className="text-crit text-xs">✕</span> {d}
            </span>
          ))}
        </div>
      </motion.div>

    </div>
  );
}
