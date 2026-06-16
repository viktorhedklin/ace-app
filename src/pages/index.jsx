import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Layout from './Layout.jsx';

// Spring physics: ω₀=20 rad/s, ζ=0.75 — settles in ~261ms, 2.8% overshoot (tactile click)
const PAGE_SPRING = { type: 'spring', stiffness: 400, damping: 30 };

// Route-level code splitting — each page loads on demand
const Dashboard      = lazy(() => import('./Dashboard.jsx'));
const Chat           = lazy(() => import('./Chat.jsx'));
const QuickLookup    = lazy(() => import('./QuickLookup.jsx'));
const Campaign       = lazy(() => import('./Campaign.jsx'));
const ShiftTracker   = lazy(() => import('./ShiftTracker.jsx'));
const HackCase       = lazy(() => import('./HackCase.jsx'));
const MissingDeposit = lazy(() => import('./MissingDeposit.jsx'));
const AccountMatters = lazy(() => import('./AccountMatters.jsx'));
const P2PAdvertiser  = lazy(() => import('./P2PAdvertiser.jsx'));
const P2PDispute     = lazy(() => import('./P2PDispute.jsx'));
const P2PRestriction = lazy(() => import('./P2PRestriction.jsx'));
const FiatWithdrawal = lazy(() => import('./FiatWithdrawal.jsx'));
const ReferralProgram = lazy(() => import('./ReferralProgram.jsx'));
const CardDecline    = lazy(() => import('./CardDecline.jsx'));
const ChainLookup    = lazy(() => import('./ChainLookup.jsx'));
const QualityCheck   = lazy(() => import('./QualityCheck.jsx'));
const ClosedCases    = lazy(() => import('./ClosedCases.jsx'));
const Trajectory     = lazy(() => import('./Trajectory.jsx'));
const KnowledgeBase  = lazy(() => import('./KnowledgeBase.jsx'));
const QuickTemplates = lazy(() => import('./QuickTemplates.jsx'));
const FollowUp       = lazy(() => import('./FollowUp.jsx'));
const Translate      = lazy(() => import('./Translate.jsx'));
const Settings       = lazy(() => import('./Settings.jsx'));
const MultiChat      = lazy(() => import('./MultiChat.jsx'));
const SepaDelay      = lazy(() => import('./SepaDelay.jsx'));
const CsatPredictor  = lazy(() => import('./CsatPredictor.jsx'));
const FiatDeposit    = lazy(() => import('./FiatDeposit.jsx'));
const Models         = lazy(() => import('./Models.jsx'));
const Workflows      = lazy(() => import('./Workflows.jsx'));
const ScenarioStudio = lazy(() => import('./ScenarioStudio.jsx'));

const EU_EMAIL = {
  id: 'bybit-eu',
  name: 'Bybit EU',
  flag: '🇪🇺',
  subtitle: 'European Exchange · MiCA Regulated',
  type: 'EMAIL',
  systemContext: `ACTIVE PLATFORM: BYBIT EU — confirmed. Do not ask to confirm the platform.

CHANNEL AWARENESS: The agent is handling this customer via EMAIL support. Do NOT suggest the customer "email support", "contact us", or "reach out to our team" — this IS the support email response. Describe the next step directly (e.g., "reply with your TxID" not "contact our support team"). If internal escalation is needed, tell the agent what to do (submit a case, escalate to P2), not the customer.

You are helping a Bybit EU support agent write professional email responses. Bybit EU operates under a separate EU regulatory framework (MiCA). Compliance tone is non-negotiable here.

BYBIT EU — KEY RULES:
- Do NOT assume any Global product or feature is available on EU. If unsure, say so.
- Bybit EU has formal complaint and escalation paths — direct users to the EU webform, not Global help center.
- GDPR applies — no unnecessary personal data in templates.
- Travel Rule: some crypto transfers require sender/recipient verification. Explain it as a regulatory requirement, not an optional check. Wording: "This is related to an EU transfer requirement. In some cases, Bybit EU must verify sender and recipient information before a crypto transfer can be completed."
- SEPA/Fiat: confirm exact flow (SEPA deposit, SEPA withdrawal, or bank card payment) before giving guidance. Fiat availability depends on region and KYC status — livechat cannot manually activate fiat services.
- Bybit EU Card: confirm whether issue is application, decline, wallet setup (Apple/Google Pay), limits, or delivery. Physical card requires virtual card first. Never ask for full card details.
- EU complaints: "For Bybit EU, the correct next step is the support and complaint webform. Please include your UID, contactable email, relevant transaction/order IDs, and supporting evidence."
- Campaigns: use EU announcement pages only. Never assume a Global promo applies to EU. EU promos: https://www.bybit.eu/en-EU/promo/campaign/Card-New-Signup

EMAIL STRUCTURE: Answer → Educate → Link → Next step. Concise, professional, empathetic. No waffle.`,
};

const EU_CHAT = {
  id: 'eu-live-chat',
  name: 'EU Live Chat',
  flag: '🇪🇺',
  subtitle: 'European Exchange · MiCA Regulated',
  type: 'CHAT',
  systemContext: `ACTIVE PLATFORM: BYBIT EU — confirmed. Do not ask to confirm the platform.

CHANNEL AWARENESS: The customer is ALREADY in a live chat session with the agent RIGHT NOW. NEVER suggest the customer "contact support via Live Chat", "reach out to our support team", "submit a ticket", or "contact us" — the agent IS the support team and the customer is already being helped in real-time. If escalation is needed, tell the agent what to do internally (submit a case, escalate to P2), not tell the customer to contact support. The only exception is directing to the EU complaint webform when a formal complaint is requested.

You're the agent's real-time partner on Bybit EU live chat. They're mid-conversation — fast, accurate, ready-to-send.

If they paste a customer message, give a reply they can send immediately. If they ask a policy question, answer directly.

BYBIT EU — ALWAYS APPLY:
- Never mix EU and Global rules. EU operates under a separate regulatory framework (MiCA).
- Travel Rule: "This check is related to an EU transfer requirement. In some cases, Bybit EU must verify sender and recipient information before a crypto transfer can be completed." Direct user to complete requested info in the official flow.
- SEPA/Fiat: clarify exact flow first (SEPA deposit/withdrawal or bank card). Fiat cannot be manually activated from livechat.
- Bybit Card issues: narrow to application / declined payment / wallet setup / limits / delivery. Never ask for full card details.
- EU complaints: direct to EU webform. "For Bybit EU, the correct next step is the support and complaint webform."
- EU campaign questions: never assume Global promos apply. Check EU page: https://announcements.bybit.global/en/ and https://www.bybit.eu/en-EU/promo/campaign/Card-New-Signup
- Escalation triggers: Bybit Pay stuck, KYC/EDD pending beyond expected time, Travel Rule still pending after info submitted, card/SEPA issue after standard checks, user requests formal complaint.

CHAT STARTERS TO USE:
- Card: "I can help with your Bybit EU Card issue. Is this about the application, a declined payment, wallet setup, limits, or delivery?"
- SEPA: "I can help check this fiat transaction. Was this a SEPA deposit, a SEPA withdrawal, or a bank card payment?"
- EU product availability: "Bybit EU and Bybit Global do not always offer the same products. Let's confirm which platform and which feature you're trying to access."
- Complaints: "If this needs formal review, the correct next step is the Bybit EU support and complaint webform."`,
};

const GLOBAL_EMAIL = {
  id: 'bybit-global',
  name: 'Bybit Global',
  flag: '🌍',
  subtitle: 'Global Exchange · 180+ Countries',
  type: 'EMAIL',
  systemContext: `ACTIVE PLATFORM: BYBIT GLOBAL — confirmed. Do not ask to confirm the platform.

CHANNEL AWARENESS: The agent is handling this customer via EMAIL support. Do NOT suggest the customer "email support", "contact us", or "reach out to our team" — this IS the support email response. Describe the next step directly (e.g., "reply with your TxID" not "contact our support team"). If internal escalation is needed, tell the agent what to do (submit a case, escalate to P2), not the customer.

You are helping a Bybit Global support agent write emails to customers across 180+ countries.

Draft clear, professional, empathetic responses. Get to the point. Address the issue, give the resolution or next steps, close with warmth. Avoid jargon. Keep in mind customers may not speak English as a first language — simple, clear language wins every time.`,
};

const GLOBAL_CHAT = {
  id: 'global-live-chat',
  name: 'Global Live Chat',
  flag: '🌍',
  subtitle: 'Global Exchange · 180+ Countries',
  type: 'CHAT',
  systemContext: `ACTIVE PLATFORM: BYBIT GLOBAL — confirmed. Do not ask to confirm the platform.

CHANNEL AWARENESS: The customer is ALREADY in a live chat session with the agent RIGHT NOW. NEVER suggest the customer "contact support via Live Chat", "reach out to our support team", "submit a ticket", or "contact us" — the agent IS the support team and the customer is already being helped in real-time. If escalation is needed, tell the agent what to do internally (submit a case, escalate to P2), not tell the customer to contact support.

You're the agent's real-time partner on Bybit Global live chat. They need fast answers and ready-to-send replies.

If they paste a customer message, give a reply they can send immediately — professional, clear, empathetic. If they ask a question, answer it directly. No fluff. Speed matters here — they're mid-shift.`,
};

const PERSONAL = {
  id: 'personal',
  name: 'Personal',
  flag: '✦',
  subtitle: 'Your space · Powered by Ace',
  type: 'CHAT',
  systemContext: `This is the agent's personal space. You're their go-to for everything — work stuff, life stuff, whatever's on their mind.

Be real with them. Talk like a close friend who also happens to be incredibly knowledgeable. Help them decompress after a rough shift, think through a tricky case, write something, research something, or just chat. No topic is off limits. No corporate filter here — just be genuinely helpful and human.`,
};

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full min-h-[200px]">
      <div className="w-5 h-5 border-2 border-hero/30 border-t-hero rounded-full animate-spin" />
    </div>
  );
}

// AnimatedRoutes must live inside <Router> to access useLocation()
function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0, transition: PAGE_SPRING }}
        exit={{ opacity: 0, transition: { duration: 0.06 } }}
        className="w-full h-full"
      >
        <Suspense fallback={<PageLoader />}>
          <Routes location={location}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/bybit-eu" element={<Chat channel={EU_EMAIL} />} />
            <Route path="/eu-live-chat" element={<Chat channel={EU_CHAT} />} />
            <Route path="/bybit-global" element={<Chat channel={GLOBAL_EMAIL} />} />
            <Route path="/global-live-chat" element={<Chat channel={GLOBAL_CHAT} />} />
            <Route path="/personal" element={<Chat channel={PERSONAL} />} />
            <Route path="/quick-lookup" element={<QuickLookup />} />
            <Route path="/campaign" element={<Campaign />} />
            <Route path="/shift-tracker" element={<ShiftTracker />} />
            <Route path="/hack-case" element={<HackCase />} />
            <Route path="/missing-deposit" element={<MissingDeposit />} />
            <Route path="/account-matters" element={<AccountMatters />} />
            <Route path="/p2p-advertiser" element={<P2PAdvertiser />} />
            <Route path="/p2p-dispute" element={<P2PDispute />} />
            <Route path="/p2p-restriction" element={<P2PRestriction />} />
            <Route path="/fiat-withdrawal" element={<FiatWithdrawal />} />
            <Route path="/referral-program" element={<ReferralProgram />} />
            <Route path="/card-decline" element={<CardDecline />} />
            <Route path="/chain-lookup" element={<ChainLookup />} />
            <Route path="/quality-check" element={<QualityCheck />} />
            <Route path="/closed-cases" element={<ClosedCases />} />
            <Route path="/trajectory" element={<Trajectory />} />
            <Route path="/probation-prep" element={<Trajectory />} />
            <Route path="/knowledge" element={<KnowledgeBase />} />
            <Route path="/quick-templates" element={<QuickTemplates />} />
            <Route path="/follow-up" element={<FollowUp />} />
            <Route path="/translate" element={<Translate />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/workspace" element={<MultiChat />} />
            <Route path="/sepa-delay" element={<SepaDelay />} />
            <Route path="/fiat-deposit" element={<FiatDeposit />} />
            <Route path="/csat-predictor" element={<CsatPredictor />} />
            <Route path="/models" element={<Models />} />
            <Route path="/workflows" element={<Workflows />} />
            <Route path="/scenario-studio" element={<ScenarioStudio />} />
          </Routes>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}

export default function Pages() {
  return (
    <Router>
      <Layout>
        <AnimatedRoutes />
      </Layout>
    </Router>
  );
}
