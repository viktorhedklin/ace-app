// Single source of truth for sidebar nav + ⌘K palette tool data.
// P2P Restriction (/p2p-restriction) is intentionally omitted — not linked anywhere in the app.
export const TOOL_GROUPS = [
  {
    id: 'case-tools',
    label: 'Case Tools',
    tools: [
      { name: 'Hack Case', icon: '🔴', path: '/hack-case' },
      { name: 'Missing Deposit', icon: '💸', path: '/missing-deposit' },
      { name: 'Account Matters', icon: '👤', path: '/account-matters' },
      { name: 'P2P Advertiser', icon: '🤝', path: '/p2p-advertiser' },
      { name: 'P2P Dispute', icon: '⚖️', path: '/p2p-dispute' },
      { name: 'Card Decline', icon: '💳', path: '/card-decline' },
      { name: 'Chain Lookup', icon: '🔗', path: '/chain-lookup' },
    ],
  },
  {
    id: 'payments',
    label: 'Payments',
    tools: [
      { name: 'SEPA Delay', icon: '💶', path: '/sepa-delay' },
      { name: 'Fiat Deposit', icon: '🏦', path: '/fiat-deposit' },
      { name: 'Fiat Withdrawal', icon: '💶', path: '/fiat-withdrawal' },
      { name: 'Quick Lookup', icon: '⚡', path: '/quick-lookup' },
    ],
  },
  {
    id: 'comms-templates',
    label: 'Comms & Templates',
    tools: [
      { name: 'Quick Templates', icon: '💬', path: '/quick-templates' },
      { name: 'Follow-up', icon: '📬', path: '/follow-up' },
      { name: 'Translate', icon: '🌐', path: '/translate' },
      { name: 'Campaign', icon: '🎁', path: '/campaign' },
      { name: 'Referral Program', icon: '🎁', path: '/referral-program' },
    ],
  },
  {
    id: 'quality-performance',
    label: 'Quality & Performance',
    tools: [
      { name: 'Quality Check', icon: '🎯', path: '/quality-check' },
      { name: 'CSAT Predictor', icon: '⭐', path: '/csat-predictor' },
      { name: 'Closed Cases', icon: '📋', path: '/closed-cases' },
      { name: 'Trajectory', icon: '🎯', path: '/trajectory' },
      { name: 'Shift Tracker', icon: '📊', path: '/shift-tracker' },
    ],
  },
  {
    id: 'workflow-tools',
    label: 'Workflow Tools',
    tools: [
      { name: 'Workflow Hub', icon: '🔄', path: '/workflows' },
      { name: 'Scenario Studio', icon: '🎭', path: '/scenario-studio' },
    ],
  },
];

export const ALL_TOOLS = TOOL_GROUPS.flatMap(g => g.tools.map(t => ({ ...t, group: g.label })));
