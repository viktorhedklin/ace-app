import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { InvokeChatWithHistory, getKnowledge, saveKnowledge, parseAndExtractMemory } from '@/api/claude';
import { Send, Trash2, Copy, Check, Brain, X, Zap, Plus, Briefcase, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Channel Definitions ──────────────────────────────────────────────────────

const CHANNELS = [
  {
    id: 'eu-live-chat',
    name: 'EU Live Chat',
    shortName: 'EU Chat',
    flag: '🇪🇺',
    subtitle: 'European Exchange · MiCA Regulated',
    type: 'CHAT',
    systemContext: `ACTIVE PLATFORM: BYBIT EU — confirmed. Do not ask to confirm the platform.\n\nYou're the agent's real-time partner on Bybit EU live chat. They're mid-conversation — fast, accurate, ready-to-send.\n\nIf they paste a customer message, give a reply they can send immediately. If they ask a policy question, answer directly.\n\nBYBIT EU — ALWAYS APPLY:\n- Never mix EU and Global rules. EU operates under a separate regulatory framework (MiCA).\n- Travel Rule: "This check is related to an EU transfer requirement. In some cases, Bybit EU must verify sender and recipient information before a crypto transfer can be completed." Direct user to complete requested info in the official flow.\n- SEPA/Fiat: clarify exact flow first (SEPA deposit/withdrawal or bank card). Fiat cannot be manually activated from livechat.\n- Bybit Card issues: narrow to application / declined payment / wallet setup / limits / delivery. Never ask for full card details.\n- EU complaints: direct to EU webform. "For Bybit EU, the correct next step is the support and complaint webform."\n- EU campaign questions: never assume Global promos apply. Check EU page: https://announcements.bybit.global/en/ and https://www.bybit.eu/en-EU/promo/campaign/Card-New-Signup\n- Escalation triggers: Bybit Pay stuck, KYC/EDD pending beyond expected time, Travel Rule still pending after info submitted, card/SEPA issue after standard checks, user requests formal complaint.\n\nCHAT STARTERS TO USE:\n- Card: "I can help with your Bybit EU Card issue. Is this about the application, a declined payment, wallet setup, limits, or delivery?"\n- SEPA: "I can help check this fiat transaction. Was this a SEPA deposit, a SEPA withdrawal, or a bank card payment?"\n- EU product availability: "Bybit EU and Bybit Global do not always offer the same products. Let's confirm which platform and which feature you're trying to access."\n- Complaints: "If this needs formal review, the correct next step is the Bybit EU support and complaint webform."`,
  },
  {
    id: 'bybit-eu',
    name: 'Bybit EU Email',
    shortName: 'EU Email',
    flag: '🇪🇺',
    subtitle: 'European Exchange · MiCA Regulated',
    type: 'EMAIL',
    systemContext: `ACTIVE PLATFORM: BYBIT EU — confirmed. Do not ask to confirm the platform.\n\nYou are helping a Bybit EU support agent write professional email responses. Bybit EU operates under a separate EU regulatory framework (MiCA). Compliance tone is non-negotiable here.\n\nBYBIT EU — KEY RULES:\n- Do NOT assume any Global product or feature is available on EU. If unsure, say so.\n- Bybit EU has formal complaint and escalation paths — direct users to the EU webform, not Global help center.\n- GDPR applies — no unnecessary personal data in templates.\n- Travel Rule: some crypto transfers require sender/recipient verification. Explain it as a regulatory requirement, not an optional check. Wording: "This is related to an EU transfer requirement. In some cases, Bybit EU must verify sender and recipient information before a crypto transfer can be completed."\n- SEPA/Fiat: confirm exact flow (SEPA deposit, SEPA withdrawal, or bank card payment) before giving guidance. Fiat availability depends on region and KYC status — livechat cannot manually activate fiat services.\n- Bybit EU Card: confirm whether issue is application, decline, wallet setup (Apple/Google Pay), limits, or delivery. Physical card requires virtual card first. Never ask for full card details.\n- EU complaints: "For Bybit EU, the correct next step is the support and complaint webform. Please include your UID, contactable email, relevant transaction/order IDs, and supporting evidence."\n- Campaigns: use EU announcement pages only. Never assume a Global promo applies to EU.\n\nEMAIL STRUCTURE: Answer → Educate → Link → Next step. Concise, professional, empathetic. No waffle.`,
  },
  {
    id: 'global-live-chat',
    name: 'Global Live Chat',
    shortName: 'Global Chat',
    flag: '🌍',
    subtitle: 'Global Exchange · 180+ Countries',
    type: 'CHAT',
    systemContext: `ACTIVE PLATFORM: BYBIT GLOBAL — confirmed. Do not ask to confirm the platform.\n\nYou're the agent's real-time partner on Bybit Global live chat. They need fast answers and ready-to-send replies.\n\nIf they paste a customer message, give a reply they can send immediately — professional, clear, empathetic. If they ask a question, answer it directly. No fluff. Speed matters here — they're mid-shift.`,
  },
  {
    id: 'bybit-global',
    name: 'Bybit Global Email',
    shortName: 'Global Email',
    flag: '🌍',
    subtitle: 'Global Exchange · 180+ Countries',
    type: 'EMAIL',
    systemContext: `ACTIVE PLATFORM: BYBIT GLOBAL — confirmed. Do not ask to confirm the platform.\n\nYou are helping a Bybit Global support agent write emails to customers across 180+ countries.\n\nDraft clear, professional, empathetic responses. Get to the point. Address the issue, give the resolution or next steps, close with warmth. Avoid jargon. Keep in mind customers may not speak English as a first language — simple, clear language wins every time.`,
  },
  {
    id: 'personal',
    name: 'Personal',
    shortName: 'Personal',
    flag: '✦',
    subtitle: 'Your space · Powered by Ace',
    type: 'CHAT',
    systemContext: `This is the agent's personal space. You're their go-to for everything — work stuff, life stuff, whatever's on their mind.\n\nBe real with them. Talk like a close friend who also happens to be incredibly knowledgeable. Help them decompress after a rough shift, think through a tricky case, write something, research something, or just chat. No topic is off limits. No corporate filter here — just be genuinely helpful and human.`,
  },
];

// ─── Case Types ───────────────────────────────────────────────────────────────

const CASE_TYPES = [
  'Missing Deposit', 'Withdrawal Issue', 'KYC / Verification', 'P2P Dispute',
  'Card Issue', 'Security / Hack', 'Account Access / Login', 'Travel Rule',
  'SEPA / Fiat', 'Campaign / Bonus', 'Fee Dispute', 'Limit Increase', 'Other',
];

// ─── Quick Prompts ────────────────────────────────────────────────────────────

const QUICK_PROMPTS = {
  'eu-live-chat': ['Quick reply for EU customer saying:', 'EU escalation path for:', 'MiCA compliance note on:', 'How do I handle EU'],
  'bybit-eu': ['Help me reply to this EU customer:', 'Is this covered under MiCA?', 'Draft a professional email for:', "What's the EU policy on"],
  'global-live-chat': ['Quick reply for customer saying:', 'Fastest resolution for:', 'What do I say when customer asks about', 'How do I handle'],
  'bybit-global': ['Help me reply to this customer:', 'Draft a global support email for:', "What's the policy on", 'How do I escalate'],
  personal: ['Help me think through this case:', "I'm stuck on something —", "Quick — what's the SOP for", 'Roast this response I wrote:'],
};

// ─── Tab Factory ──────────────────────────────────────────────────────────────

function newTab() {
  return {
    id: `tab_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    channelId: null,
    context: { caseType: '', issue: '', notes: '' },
    autoMemory: false,
    messages: [],
    input: '',
    loading: false,
    copied: null,
    savingMem: null,
    memTitle: '',
    memSaved: null,
    autoSaved: null,
    showContext: false,
    closingCase: false,
    closeSummary: '',
    closeSaving: false,
  };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MultiChat() {
  const [tabs, setTabs] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('multitab_tabs'));
      if (saved?.configs?.length) {
        return saved.configs.map(c => ({
          ...c,
          messages: JSON.parse(localStorage.getItem(`multitab_msgs_${c.id}`) || '[]'),
          input: '',
          loading: false,
          copied: null,
          savingMem: null,
          memTitle: '',
          memSaved: null,
          autoSaved: null,
          showContext: false,
          closingCase: false,
          closeSummary: '',
          closeSaving: false,
        }));
      }
    } catch {}
    return [newTab()];
  });

  // ─── Persistence ────────────────────────────────────────────────────────────

  useEffect(() => {
    const configs = tabs.map(({ messages, input, loading, copied, savingMem, memTitle, memSaved, autoSaved, showContext, closingCase, closeSummary, closeSaving, ...rest }) => rest);
    localStorage.setItem('multitab_tabs', JSON.stringify({ configs }));
    tabs.forEach(t => {
      localStorage.setItem(`multitab_msgs_${t.id}`, JSON.stringify(t.messages));
    });
  }, [tabs]);

  // ─── Tab Helpers ─────────────────────────────────────────────────────────────

  function updateTab(id, updates) {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }

  function addTab() {
    if (tabs.length >= 4) return;
    const tab = newTab();
    setTabs(prev => [...prev, tab]);
  }

  function closeTab(tabId) {
    if (tabs.length <= 1) return;
    localStorage.removeItem(`multitab_msgs_${tabId}`);
    setTabs(prev => prev.filter(t => t.id !== tabId));
  }

  // ─── Chat Actions ────────────────────────────────────────────────────────────

  function saveToMemory(tabId, msgIdx) {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab || !tab.memTitle.trim()) return;
    const msg = tab.messages[msgIdx];
    const existing = getKnowledge();
    saveKnowledge([...existing, { id: Date.now(), title: tab.memTitle.trim(), content: msg.content, active: true }]);
    updateTab(tabId, { savingMem: null, memTitle: '', memSaved: msgIdx });
    setTimeout(() => updateTab(tabId, { memSaved: null }), 2500);
  }

  function copyMsg(tabId, content, idx) {
    navigator.clipboard.writeText(content);
    updateTab(tabId, { copied: idx });
    setTimeout(() => updateTab(tabId, { copied: null }), 2000);
  }

  function clearTabHistory(tabId) {
    if (confirm('Clear this conversation?')) {
      updateTab(tabId, { messages: [] });
      localStorage.removeItem(`multitab_msgs_${tabId}`);
    }
  }

  async function send(tabId) {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;
    const text = tab.input.trim();
    if (!text || tab.loading) return;

    const channel = CHANNELS.find(c => c.id === tab.channelId);
    if (!channel) return;

    // "remember:" shortcut
    if (text.toLowerCase().startsWith('remember:')) {
      const body = text.slice('remember:'.length).trim();
      const sep = body.includes(' — ') ? ' — ' : body.includes(' - ') ? ' - ' : null;
      let title = 'Quick note';
      let content = body;
      if (sep) {
        const sepIdx = body.indexOf(sep);
        title = body.slice(0, sepIdx).trim() || 'Quick note';
        content = body.slice(sepIdx + sep.length).trim();
      }
      if (content) {
        saveKnowledge([...getKnowledge(), { id: Date.now(), title, content, active: true }]);
        updateTab(tabId, {
          messages: [
            ...tab.messages,
            { role: 'user', content: text, ts: Date.now() },
            { role: 'assistant', content: `✓ Saved to memory — "${title}"\n\n${content.slice(0, 150)}${content.length > 150 ? '…' : ''}`, ts: Date.now() },
          ],
          input: '',
        });
        return;
      }
    }

    const userMsg = { role: 'user', content: text, ts: Date.now() };
    const newMessages = [...tab.messages, userMsg];
    updateTab(tabId, { messages: newMessages, input: '', loading: true });

    let systemPrompt = channel.systemContext;
    const { caseType, issue, notes } = tab.context;
    if (caseType || issue || notes) {
      systemPrompt += `\n\n--- CURRENT CASE CONTEXT ---`;
      if (caseType) systemPrompt += `\nCase type: ${caseType}`;
      if (issue) systemPrompt += `\nCustomer issue: ${issue}`;
      if (notes) systemPrompt += `\nAdditional notes: ${notes}`;
      systemPrompt += `\n---\nUse this context to give targeted, relevant responses from the start. Do not repeat this back unless asked.`;
    }

    try {
      const historyForApi = newMessages.map(m => ({ role: m.role, content: m.content }));
      const raw = await InvokeChatWithHistory({
        messages: historyForApi,
        system_prompt: systemPrompt,
        autoMemory: tab.autoMemory,
      });
      const { clean, saved } = parseAndExtractMemory(raw);
      updateTab(tabId, {
        messages: [...newMessages, { role: 'assistant', content: clean, ts: Date.now() }],
        loading: false,
        autoSaved: saved.length ? { count: saved.length, ts: Date.now() } : null,
      });
      if (saved.length) {
        setTimeout(() => updateTab(tabId, { autoSaved: null }), 3000);
      }
    } catch (e) {
      updateTab(tabId, {
        messages: [
          ...newMessages,
          {
            role: 'assistant',
            content: e.message === 'NO_API_KEY'
              ? '⚠️ No API key set. Go to Settings to configure it.'
              : `⚠️ ${e.message || 'Something went wrong. Try again.'}`,
            ts: Date.now(),
          },
        ],
        loading: false,
      });
    }
  }

  async function closeCase(tabId) {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;
    const summary = tab.closeSummary.trim();
    updateTab(tabId, { closeSaving: true });
    if (summary) {
      const { caseType, issue } = tab.context;
      const label = issue || caseType || 'Chat';
      const today = new Date().toLocaleDateString('en-GB');
      const title = `Case: ${label} — ${today}`;
      const existing = getKnowledge();
      saveKnowledge([...existing, { id: Date.now(), title, content: summary, active: true }]);
    }
    updateTab(tabId, {
      messages: [],
      closingCase: false,
      closeSummary: '',
      closeSaving: false,
    });
    localStorage.removeItem(`multitab_msgs_${tabId}`);
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  const gridClass = tabs.length === 1
    ? 'grid-cols-1'
    : tabs.length === 2
    ? 'grid-cols-2'
    : tabs.length === 3
    ? 'grid-cols-3'
    : 'grid-cols-2 grid-rows-2';

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Workspace header */}
      <div className="bg-slate-950 border-b border-slate-800 flex items-center justify-between px-4 py-2 shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-semibold text-slate-100">🗂️ Workspace</span>
          <span className="text-xs text-slate-600">{tabs.length} / 4 window{tabs.length !== 1 ? 's' : ''}</span>
        </div>
        <button
          onClick={addTab}
          disabled={tabs.length >= 4}
          title={tabs.length >= 4 ? 'Max 4 windows open' : 'Add a new chat window'}
          className={cn(
            'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors duration-150',
            tabs.length >= 4
              ? 'text-slate-700 border-slate-800 cursor-not-allowed opacity-50'
              : 'text-slate-400 border-slate-700 hover:text-yellow-400 hover:border-yellow-400/30 hover:bg-yellow-400/5'
          )}
        >
          <Plus size={12} />
          Add window
        </button>
      </div>

      {/* Grid of chat panels */}
      <div className={cn('flex-1 min-h-0 grid gap-px bg-slate-800/60', gridClass)}>
        {tabs.map(tab => (
          <TabContent
            key={tab.id}
            tab={tab}
            channel={CHANNELS.find(c => c.id === tab.channelId) || null}
            canClose={tabs.length > 1}
            updateTab={updateTab}
            send={send}
            closeCase={closeCase}
            clearTabHistory={clearTabHistory}
            copyMsg={copyMsg}
            saveToMemory={saveToMemory}
            closeTab={closeTab}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Tab Content (self-contained panel) ──────────────────────────────────────

function TabContent({
  tab, channel, canClose,
  updateTab, send, closeCase,
  clearTabHistory, copyMsg, saveToMemory, closeTab,
}) {
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const hasContext = !!(tab.context.caseType || tab.context.issue || tab.context.notes);
  const prompts = QUICK_PROMPTS[tab.channelId] || QUICK_PROMPTS.personal;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [tab.messages, tab.loading]);

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(tab.id);
    }
  }

  function useQuickPrompt(prompt) {
    updateTab(tab.id, { input: prompt });
    setTimeout(() => textareaRef.current?.focus(), 30);
  }

  return (
    <div className="flex flex-col bg-slate-950 overflow-hidden">
      {/* ── Panel Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-slate-900 shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {channel ? (
            <>
              <span className="text-base shrink-0">{channel.flag}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-slate-100 text-xs truncate">{channel.shortName}</span>
                  <span className={cn(
                    'text-xs px-1 py-0.5 rounded font-medium shrink-0',
                    channel.type === 'CHAT' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
                  )}>{channel.type}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-yellow-400/60" />
              </span>
              <span className="text-xs font-medium text-slate-400">New Chat</span>
            </div>
          )}
          {hasContext && tab.context.issue && (
            <span className="text-xs text-yellow-400/80 bg-yellow-400/10 px-1.5 py-0.5 rounded truncate max-w-[100px] hidden sm:block">
              {tab.context.issue}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {tab.autoSaved && (
            <span className="text-xs text-yellow-400 flex items-center gap-1 animate-pulse mr-1">
              <Brain size={10} /> {tab.autoSaved.count}
            </span>
          )}

          {/* Context */}
          <button
            onClick={() => updateTab(tab.id, { showContext: !tab.showContext })}
            className={cn(
              'flex items-center gap-0.5 text-xs px-1.5 py-1 rounded-lg border transition-all duration-150',
              hasContext
                ? 'bg-yellow-400/15 border-yellow-400/30 text-yellow-400'
                : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'
            )}
            title="Set case context"
            aria-label="Set case context"
          >
            <Briefcase size={11} />
          </button>

          {/* Auto-memory */}
          <button
            onClick={() => updateTab(tab.id, { autoMemory: !tab.autoMemory })}
            className={cn(
              'flex items-center gap-0.5 text-xs px-1.5 py-1 rounded-lg border transition-all duration-150',
              tab.autoMemory
                ? 'bg-yellow-400/15 border-yellow-400/30 text-yellow-400'
                : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'
            )}
            title={tab.autoMemory ? 'Auto-memory on' : 'Auto-memory off'}
            aria-label={tab.autoMemory ? 'Auto-memory on' : 'Auto-memory off'}
          >
            <Zap size={11} className={tab.autoMemory ? 'fill-yellow-400' : ''} />
          </button>

          {/* Close case */}
          {channel && (
            <button
              onClick={() => updateTab(tab.id, { closingCase: true, showContext: false })}
              className="flex items-center gap-0.5 text-xs px-1.5 py-1 rounded-lg border bg-slate-800 border-slate-700 text-slate-500 hover:text-red-400 hover:border-red-400/30 transition-all duration-150"
              title="Close case"
              aria-label="Close case"
            >
              <XCircle size={11} />
            </button>
          )}

          {/* Clear history */}
          {tab.messages.length > 0 && (
            <button
              onClick={() => clearTabHistory(tab.id)}
              className="text-slate-600 hover:text-red-400 transition-colors duration-150 p-1 rounded-lg hover:bg-slate-800"
              title="Clear conversation"
              aria-label="Clear conversation"
            >
              <Trash2 size={11} />
            </button>
          )}

          {/* Close this window */}
          {canClose && (
            <button
              onClick={() => closeTab(tab.id)}
              className="text-slate-700 hover:text-red-400 transition-colors duration-150 p-1 rounded-lg hover:bg-slate-800 ml-0.5"
              title="Close this window"
              aria-label="Close this window"
            >
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* ── Context Panel ────────────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {tab.showContext && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeInOut' }}
            className="overflow-hidden shrink-0"
          >
            <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 space-y-2">
              <div className="flex gap-2">
                <select
                  value={tab.context.caseType}
                  onChange={e => updateTab(tab.id, { context: { ...tab.context, caseType: e.target.value } })}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-yellow-400/50 appearance-none"
                  aria-label="Case type"
                >
                  <option value="">Case type…</option>
                  {CASE_TYPES.map(ct => (
                    <option key={ct} value={ct}>{ct}</option>
                  ))}
                </select>
                <input
                  value={tab.context.issue}
                  onChange={e => updateTab(tab.id, { context: { ...tab.context, issue: e.target.value } })}
                  placeholder="Customer issue…"
                  className="flex-[2] bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-yellow-400/50"
                  aria-label="Customer issue"
                />
              </div>
              <textarea
                value={tab.context.notes}
                onChange={e => updateTab(tab.id, { context: { ...tab.context, notes: e.target.value } })}
                placeholder="TXIDs, order IDs, notes…"
                rows={2}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-yellow-400/50 resize-none"
                aria-label="Additional notes"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => updateTab(tab.id, { showContext: false })}
                  className="text-xs bg-yellow-400/20 text-yellow-400 hover:bg-yellow-400/30 px-3 py-1.5 rounded-lg transition-colors duration-150 font-medium"
                >
                  Set Context
                </button>
                {hasContext && (
                  <button
                    onClick={() => updateTab(tab.id, { context: { caseType: '', issue: '', notes: '' }, showContext: false })}
                    className="text-xs text-slate-500 hover:text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors duration-150"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Messages Area ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3 min-h-0">
        {/* Channel selector */}
        {!channel && (
          <div className="flex flex-col items-center justify-center min-h-full text-center gap-4 py-6">
            <div>
              <p className="text-slate-300 font-semibold text-sm">Select a channel</p>
              <p className="text-xs text-slate-600 mt-1">Which channel is this case for?</p>
            </div>
            <div className="grid grid-cols-2 gap-2 max-w-xs w-full mx-auto">
              {CHANNELS.map(ch => (
                <button
                  key={ch.id}
                  onClick={() => updateTab(tab.id, { channelId: ch.id })}
                  className="bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-yellow-400/30 rounded-xl p-3 flex flex-col items-center gap-1.5 text-center transition-all group"
                >
                  <span className="text-xl">{ch.flag}</span>
                  <p className="text-xs font-medium text-slate-300 group-hover:text-yellow-400 transition-colors leading-tight">{ch.name}</p>
                  <span className={cn(
                    'text-xs px-1.5 py-0.5 rounded font-medium',
                    ch.type === 'CHAT' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
                  )}>{ch.type}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {channel && tab.messages.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-full text-center gap-3 py-6">
            <span className="text-4xl opacity-60">{channel.flag}</span>
            <div>
              <p className="text-slate-400 font-medium text-sm">{channel.name}</p>
              <p className="text-xs text-slate-600 mt-0.5">{channel.subtitle}</p>
            </div>
            <div className="grid grid-cols-2 gap-1.5 mt-1 max-w-xs w-full">
              {prompts.map(p => (
                <button
                  key={p}
                  onClick={() => useQuickPrompt(p)}
                  className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 px-2 py-1.5 rounded-lg text-left transition-colors duration-150 border border-slate-700"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {channel && tab.messages.map((m, i) => (
          <div key={i} className={cn('flex gap-2', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            {m.role === 'assistant' && (
              <div className="w-6 h-6 rounded-full bg-yellow-400/20 flex items-center justify-center text-xs shrink-0 mt-0.5 select-none font-bold text-yellow-400">A</div>
            )}
            <div className="max-w-[82%] flex flex-col gap-1">
              <div className={cn(
                'rounded-2xl px-3 py-2.5 text-xs relative group',
                m.role === 'user'
                  ? 'bg-slate-700/80 border border-slate-600/60 text-slate-100 rounded-tr-sm'
                  : 'bg-slate-800/60 border border-slate-700/40 text-slate-200 rounded-tl-sm'
              )}>
                <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                <div className="absolute -top-1.5 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg px-1.5 py-1">
                  {m.role === 'assistant' && (
                    <button
                      onClick={() => updateTab(tab.id, { savingMem: i, memTitle: '' })}
                      className={cn('transition-colors duration-150', tab.memSaved === i ? 'text-yellow-400' : 'text-slate-500 hover:text-yellow-400')}
                      aria-label="Save to memory"
                    >
                      {tab.memSaved === i ? <Check size={11} /> : <Brain size={11} />}
                    </button>
                  )}
                  <button
                    onClick={() => copyMsg(tab.id, m.content, i)}
                    className="text-slate-500 hover:text-slate-300 transition-colors duration-150"
                    aria-label="Copy message"
                  >
                    {tab.copied === i ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
                  </button>
                </div>
              </div>

              {/* Save to memory form */}
              {tab.savingMem === i && (
                <div className="bg-slate-900 border border-yellow-400/30 rounded-xl px-3 py-2.5 space-y-2">
                  <p className="text-xs text-yellow-400 font-medium">Save to Knowledge Base</p>
                  <input
                    autoFocus
                    value={tab.memTitle}
                    onChange={e => updateTab(tab.id, { memTitle: e.target.value })}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveToMemory(tab.id, i);
                      if (e.key === 'Escape') updateTab(tab.id, { savingMem: null });
                    }}
                    placeholder="Title for this memory…"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-yellow-400/50"
                    aria-label="Memory title"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveToMemory(tab.id, i)}
                      disabled={!tab.memTitle.trim()}
                      className="text-xs bg-yellow-400/20 disabled:bg-slate-800 disabled:text-slate-600 text-yellow-400 hover:bg-yellow-400/30 px-3 py-1.5 rounded-lg transition-colors duration-150 flex items-center gap-1"
                    >
                      <Brain size={10} /> Save
                    </button>
                    <button
                      onClick={() => updateTab(tab.id, { savingMem: null })}
                      className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1.5 transition-colors duration-150 flex items-center gap-1"
                    >
                      <X size={10} /> Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
            {m.role === 'user' && (
              <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs text-slate-400 shrink-0 mt-0.5 select-none font-medium">V</div>
            )}
          </div>
        ))}

        {/* Loading */}
        {tab.loading && (
          <div className="flex gap-2 justify-start">
            <div className="w-6 h-6 rounded-full bg-yellow-400/20 flex items-center justify-center text-xs shrink-0 font-bold text-yellow-400">A</div>
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl rounded-tl-sm px-3 py-2.5">
              <div className="flex gap-1 items-center">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-1 h-1 bg-yellow-400/50 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Close Case Panel ─────────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {tab.closingCase && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="bg-slate-950 border-t-2 border-red-500/30 px-4 py-3 shrink-0 space-y-2"
          >
            <div>
              <p className="text-xs font-semibold text-slate-100">Close this case</p>
              <p className="text-xs text-slate-600 mt-0.5">Optionally save a summary to Knowledge Base before clearing.</p>
            </div>
            <textarea
              autoFocus
              value={tab.closeSummary}
              onChange={e => updateTab(tab.id, { closeSummary: e.target.value })}
              placeholder="Case summary (optional)…"
              rows={2}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-red-400/40 resize-none"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => closeCase(tab.id)}
                disabled={tab.closeSaving}
                className="text-xs bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-semibold px-3 py-1.5 rounded-lg transition-colors duration-150 disabled:opacity-60"
              >
                {tab.closeSaving ? 'Saving…' : 'Save & clear'}
              </button>
              <button
                onClick={() => {
                  updateTab(tab.id, { messages: [], closingCase: false, closeSummary: '' });
                  localStorage.removeItem(`multitab_msgs_${tab.id}`);
                }}
                className="text-xs text-slate-400 hover:text-slate-100 px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors duration-150"
              >
                Just clear
              </button>
              <button
                onClick={() => updateTab(tab.id, { closingCase: false, closeSummary: '' })}
                className="text-xs text-slate-600 hover:text-slate-400 px-2 py-1.5 transition-colors duration-150"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Input Bar ────────────────────────────────────────────────────── */}
      {channel && (
        <div className="px-3 py-2.5 border-t border-slate-800 bg-slate-900 shrink-0">
          <div className="flex gap-2 items-end bg-slate-800/60 border border-slate-700/50 focus-within:border-yellow-400/40 rounded-xl px-3 py-2 transition-colors duration-200">
            <textarea
              ref={textareaRef}
              value={tab.input}
              onChange={e => updateTab(tab.id, { input: e.target.value })}
              onKeyDown={handleKey}
              placeholder="Ask Ace… (Enter to send)"
              rows={1}
              className="flex-1 bg-transparent text-xs text-slate-100 placeholder-slate-500 resize-none outline-none min-h-[18px] max-h-[100px] leading-relaxed"
              onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
              aria-label="Message input"
            />
            <button
              onClick={() => send(tab.id)}
              disabled={!tab.input.trim() || tab.loading}
              className="w-6 h-6 rounded-lg flex items-center justify-center bg-yellow-400 disabled:bg-slate-700 text-slate-900 disabled:text-slate-500 transition-colors duration-150 shrink-0"
              aria-label="Send message"
            >
              <Send size={11} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
