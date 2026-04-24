import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const CATEGORIES = [
  {
    label: 'Deposits & Withdrawals',
    color: 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/20',
    accent: 'text-emerald-400',
    items: [
      { name: 'Missing Deposit', icon: '💸', path: '/missing-deposit', desc: 'Crypto blockchain lookup + SEPA tracing' },
      { name: 'Fiat Deposit', icon: '🏦', path: '/fiat-deposit', desc: 'Order status routing, risk review, escalation' },
      { name: 'Fiat Withdrawal', icon: '💶', path: '/fiat-withdrawal', desc: 'Withdrawal issues, holds, and refunds' },
      { name: 'SEPA Delay', icon: '🕐', path: '/sepa-delay', desc: 'SEPA processing times and delay handling' },
    ],
  },
  {
    label: 'P2P Trading',
    color: 'from-blue-500/10 to-blue-500/5 border-info/20',
    accent: 'text-info',
    items: [
      { name: 'P2P Trading & Advertise', icon: '🤝', path: '/p2p-advertiser', desc: 'Payment methods, nicknames, reviews, advertiser status' },
      { name: 'P2P Dispute', icon: '⚖️', path: '/p2p-dispute', desc: 'Order disputes, appeals, and resolution' },
      { name: 'P2P Restriction', icon: '🔒', path: '/p2p-restriction', desc: '13 scenarios: high risk, violation, scammer, reports, frozen' },
    ],
  },
  {
    label: 'Security & Compliance',
    color: 'from-red-500/10 to-red-500/5 border-crit/20',
    accent: 'text-crit',
    items: [
      { name: 'Hack Case', icon: '🔴', path: '/hack-case', desc: 'Account compromise investigation workflow' },
      { name: 'Account Matters', icon: '👤', path: '/account-matters', desc: 'KYC, restrictions, and account issues' },
    ],
  },
  {
    label: 'Products & Services',
    color: 'from-purple-500/10 to-purple-500/5 border-purple-500/20',
    accent: 'text-purple-400',
    items: [
      { name: 'Card Decline', icon: '💳', path: '/card-decline', desc: 'Bybit Card payment issues and troubleshooting' },
      { name: 'Chain Lookup', icon: '🔗', path: '/chain-lookup', desc: 'Blockchain network and token verification' },
      { name: 'Referral Program', icon: '🎁', path: '/referral-program', desc: 'Referral codes, rewards, and disputes' },
      { name: 'Campaign', icon: '🎉', path: '/campaign', desc: 'Promotional campaigns and eligibility checks' },
    ],
  },
  {
    label: 'Quality & Tracking',
    color: 'from-hero-soft/10 to-hero-soft/5 border-hero/20',
    accent: 'text-hero',
    items: [
      { name: 'Quality Check', icon: '🎯', path: '/quality-check', desc: 'QA scoring and review analysis' },
      { name: 'Closed Cases', icon: '📋', path: '/closed-cases', desc: 'Case history and resolution tracking' },
      { name: 'Quick Lookup', icon: '⚡', path: '/quick-lookup', desc: 'Fast UID / order / policy search' },
    ],
  },
];

const card = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

export default function Workflows() {
  const navigate = useNavigate();

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-bold text-fg-0">Workflow Hub</h1>
        <p className="text-sm text-fg-2 mt-1">SOP-driven workflows with integrated ACE assistance. Pick a workflow to start.</p>
      </div>

      {CATEGORIES.map((cat, ci) => (
        <motion.div
          key={cat.label}
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.06, delayChildren: ci * 0.1 } } }}
        >
          <h2 className={cn('text-xs font-semibold uppercase tracking-wider mb-3', cat.accent)}>{cat.label}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {cat.items.map(item => (
              <motion.button
                key={item.path}
                variants={card}
                onClick={() => navigate(item.path)}
                className={cn(
                  'group text-left bg-gradient-to-br border rounded-xl p-4 transition-all duration-200',
                  'hover:scale-[1.02] hover:shadow-lg hover:shadow-bg-0/50 cursor-pointer',
                  cat.color
                )}
              >
                <div className="flex items-start justify-between">
                  <span className="text-2xl">{item.icon}</span>
                  <ArrowRight size={14} className="text-fg-2 group-hover:text-fg-1 group-hover:translate-x-0.5 transition-all mt-1" />
                </div>
                <h3 className="text-sm font-semibold text-fg-0 mt-2">{item.name}</h3>
                <p className="text-xs text-fg-2 mt-1 leading-relaxed">{item.desc}</p>
              </motion.button>
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
