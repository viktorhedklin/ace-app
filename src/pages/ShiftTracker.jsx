import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, FileText, Loader2, TrendingUp, BarChart3, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { getRecentCases } from '@/lib/caseMemory';
import { InvokeLLM } from '@/api/claude';
import { cn } from '@/lib/utils';
import { loadShift, saveShift, listShifts } from '@/lib/shifts';
import QAReviewInput from '@/components/QAReviewInput';

/* ─── Date helpers ────────────────────────────────────────────────────────── */
function toIso(d) { return d.toISOString().split('T')[0]; }
function todayIso() { return toIso(new Date()); }
function addDays(iso, n) { const d = new Date(iso); d.setDate(d.getDate() + n); return toIso(d); }
function friendlyDate(iso) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}
function shortDate(iso) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
function isToday(iso) { return iso === todayIso(); }

const DEFAULT_DATA = {
  chatsTaken: 0,
  messagingTaken: 0,
  emailProd: 0,
  internalNotes: 0,
  taskHours: 0,
  csatLiveChat: [],
  csatMessaging: [],
  chatEscalations: 0,
  msgEscalations: 0,
  qaChat: [],      // Array of numbers 0-100 (chat review scores)
  qaEmail: [],     // Array of numbers 0-100 (email review scores)
  qaReviews: [],   // Array of { date, channel: 'chat'|'email', score, issues: [], summary }
  notes: '',
};

function loadForDate(iso) {
  const d = loadShift(iso);
  return d ? { ...DEFAULT_DATA, ...d } : { ...DEFAULT_DATA };
}

function loadHistory() {
  return listShifts().map(({ date, data: d }) => {
    const avgChat = d.csatLiveChat?.length
      ? (d.csatLiveChat.reduce((a, b) => a + b, 0) / d.csatLiveChat.length).toFixed(1) : '—';
    const avgMsg = d.csatMessaging?.length
      ? (d.csatMessaging.reduce((a, b) => a + b, 0) / d.csatMessaging.length).toFixed(1) : '—';
    const total = (d.chatsTaken || 0) + (d.messagingTaken || 0) + (d.emailProd || 0) + (d.internalNotes || 0) * 0.5 + (d.taskHours || 0) * 10;
    return { date, ...d, avgChat, avgMsg, total };
  });
}

function Counter({ label, icon, value, onInc, onDec }) {
  return (
    <div className="bg-bg-1 border border-border-0 rounded-xl p-4">
      <p className="text-xs text-fg-2 mb-2">{icon} {label}</p>
      <div className="flex items-center gap-2">
        <button onClick={onDec} className="w-8 h-8 rounded-lg bg-bg-3 hover:bg-fg-2 text-fg-1 font-bold transition-colors">−</button>
        <span className="flex-1 text-center text-2xl font-bold text-fg-0">{value}</span>
        <button onClick={onInc} className="w-8 h-8 rounded-lg bg-hero/20 hover:bg-hero/30 text-hero font-bold transition-colors">+</button>
      </div>
    </div>
  );
}

export default function ShiftTracker() {
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [period, setPeriod] = useState('daily'); // 'daily' | 'weekly' | 'monthly'
  const [data, setData] = useState(() => loadForDate(todayIso()));
  const [csatChatInput, setCsatChatInput] = useState('');
  const [csatMsgInput, setCsatMsgInput] = useState('');
  const [history, setHistory] = useState(loadHistory);

  // Intelligence Report
  const [report, setReport] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  // Reload data when selectedDate changes
  useEffect(() => {
    setData(loadForDate(selectedDate));
  }, [selectedDate]);

  // Persist whenever data changes — keyed to selectedDate
  useEffect(() => {
    saveShift(selectedDate, data).catch(() => { /* storage is local-first */ });
    setHistory(loadHistory());
  }, [data, selectedDate]);

  function update(field, val) {
    setData(prev => ({ ...prev, [field]: val }));
  }

  function inc(field) {
    setData(prev => ({ ...prev, [field]: (prev[field] || 0) + 1 }));
  }

  function dec(field) {
    setData(prev => ({ ...prev, [field]: Math.max(0, (prev[field] || 0) - 1) }));
  }

  function addCsat(field, inputVal, setInput) {
    const score = parseFloat(inputVal);
    if (isNaN(score) || score < 1 || score > 5) return;
    setData(prev => ({ ...prev, [field]: [...(prev[field] || []), score] }));
    setInput('');
  }

  function removeCsat(field, i) {
    setData(prev => ({ ...prev, [field]: prev[field].filter((_, idx) => idx !== i) }));
  }

  const avgChatCsat = data.csatLiveChat?.length
    ? (data.csatLiveChat.reduce((a, b) => a + b, 0) / data.csatLiveChat.length).toFixed(1) : '—';
  const avgMsgCsat = data.csatMessaging?.length
    ? (data.csatMessaging.reduce((a, b) => a + b, 0) / data.csatMessaging.length).toFixed(1) : '—';
  const baseCases = (data.chatsTaken || 0) + (data.messagingTaken || 0) + (data.emailProd || 0);
  const notesPts = (data.internalNotes || 0) * 0.5;
  const taskPts = (data.taskHours || 0) * 10;
  const totalCases = baseCases + notesPts + taskPts;

  const generateReport = useCallback(async () => {
    if (reportLoading) return;
    setReportLoading(true);
    setReportOpen(true);
    setReport('');
    try {
      const cases = await getRecentCases(12);
      const caseSummary = cases.length
        ? cases.map(c => `• [${c.tool || 'chat'}] ${c.channel || '—'} — VIP ${c.vipLevel || 0}${c.notes ? ': ' + c.notes.slice(0, 80) : ''}`).join('\n')
        : 'No case records in IndexedDB today.';

      const prompt = `Generate a concise Shift-End Intelligence Report for a Bybit customer support agent.

## Today's Shift Data
- Date: ${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
- Chats Taken: ${data.chatsTaken || 0}
- Messaging Taken: ${data.messagingTaken || 0}
- Email/Web: ${data.emailProd || 0}
- Total Points: ${totalCases}
- Internal Notes: ${data.internalNotes || 0} (${notesPts} pts @ 0.5 each)
- Task Hours: ${data.taskHours || 0} (${taskPts} pts @ 10 each)
- CSAT Live Chat: ${avgChatCsat} avg (${data.csatLiveChat?.length || 0} ratings)
- CSAT Messaging: ${avgMsgCsat} avg (${data.csatMessaging?.length || 0} ratings)
- Chat Escalations: ${data.chatEscalations || 0}
- MSG Escalations: ${data.msgEscalations || 0}
- Agent Notes: ${data.notes || 'None'}

## Case Memory (scrubbed)
${caseSummary}

## Instructions
Write a professional, structured shift-end report with these sections:
1. **Shift Overview** — volume breakdown, close rate
2. **CSAT Analysis** — scores vs targets (4.0+ is good), trends
3. **Escalation Review** — escalation rate and observations
4. **Issue Patterns** — common themes from cases (if available)
5. **Key Takeaways** — 2-3 actionable insights for next shift

Keep it under 300 words. Use bullet points. No PII. Professional tone suitable for team lead review.`;

      const result = await InvokeLLM({ prompt, system_prompt: 'You are a shift analytics assistant for Bybit customer support. Be concise, data-driven, and actionable.' });
      setReport(result);
    } catch (err) {
      setReport(`Error generating report: ${err.message === 'NO_API_KEY' ? 'No API key configured — add one in Settings.' : err.message}`);
    } finally {
      setReportLoading(false);
    }
  }, [data, totalCases, notesPts, taskPts, avgChatCsat, avgMsgCsat, reportLoading]);

  // Weekly/monthly aggregates — computed from history
  const weekAgg = useMemo(() => aggregate(history, selectedDate, 7), [history, selectedDate]);
  const monthAgg = useMemo(() => aggregate(history, selectedDate, 30), [history, selectedDate]);

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div>
          <h1 className="type-h1 text-fg-0 flex items-center gap-2">
            <span className="text-xl">📊</span> Shift Console
          </h1>
          <p className="type-body-sm text-fg-2 mt-1">{friendlyDate(selectedDate)}{isToday(selectedDate) && <span className="text-hero ml-2">· Today</span>}</p>
        </div>
        <DateNavigator selectedDate={selectedDate} onChange={setSelectedDate} />
      </div>

      {/* ── PERIOD TABS ────────────────────────────────────────────────── */}
      <PeriodTabs period={period} onChange={setPeriod} />

      <AnimatePresence mode="wait">
      {period !== 'daily' ? (
        <motion.div key={period} {...panelMotion}>
          <PeriodView period={period} agg={period === 'weekly' ? weekAgg : monthAgg} />
        </motion.div>
      ) : (
      <motion.div key={'daily-' + selectedDate} {...panelMotion} className="space-y-6">

      {/* Productivity counters */}
      <div>
        <p className="text-xs text-fg-2 uppercase tracking-wider mb-3">Productivity</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Counter label="Chats Taken" icon="💬" value={data.chatsTaken || 0} onInc={() => inc('chatsTaken')} onDec={() => dec('chatsTaken')} />
          <Counter label="Messaging Taken" icon="📨" value={data.messagingTaken || 0} onInc={() => inc('messagingTaken')} onDec={() => dec('messagingTaken')} />
          <Counter label="Email / Web" icon="📧" value={data.emailProd || 0} onInc={() => inc('emailProd')} onDec={() => dec('emailProd')} />
          <Counter label="Internal Notes" icon="📝" value={data.internalNotes || 0} onInc={() => inc('internalNotes')} onDec={() => dec('internalNotes')} />
          <Counter label="Task Hours" icon="⏱" value={data.taskHours || 0} onInc={() => inc('taskHours')} onDec={() => dec('taskHours')} />
        </div>
      </div>

      {/* Escalations */}
      <div>
        <p className="text-xs text-fg-2 uppercase tracking-wider mb-3">Escalations</p>
        <div className="grid grid-cols-2 gap-3">
          <Counter label="Chat Escalations" icon="📤" value={data.chatEscalations || 0} onInc={() => inc('chatEscalations')} onDec={() => dec('chatEscalations')} />
          <Counter label="MSG Escalations" icon="📤" value={data.msgEscalations || 0} onInc={() => inc('msgEscalations')} onDec={() => dec('msgEscalations')} />
        </div>
      </div>

      {/* CSAT */}
      <div>
        <p className="text-xs text-fg-2 uppercase tracking-wider mb-3">CSAT Scores</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Live Chat CSAT */}
          <div className="bg-bg-1 border border-border-0 rounded-xl p-4">
            <p className="text-xs text-fg-2 mb-3">⭐ CSAT — Live Chat</p>
            <div className="flex items-center gap-2 mb-3">
              <input type="number" min="1" max="5" step="0.1" value={csatChatInput}
                onChange={e => setCsatChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCsat('csatLiveChat', csatChatInput, setCsatChatInput)}
                placeholder="1–5"
                className="w-20 bg-bg-2 border border-border-0 rounded-lg px-3 py-2 text-sm text-fg-0 outline-none focus:border-hero/50" />
              <button onClick={() => addCsat('csatLiveChat', csatChatInput, setCsatChatInput)}
                className="flex items-center gap-1 text-xs bg-hero/20 hover:bg-hero/30 text-hero px-3 py-2 rounded-lg transition-colors">
                <Plus size={13} /> Add
              </button>
              <span className="ml-auto text-xl font-bold text-fg-0">{avgChatCsat} <span className="text-xs text-fg-2 font-normal">avg</span></span>
            </div>
            {data.csatLiveChat?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {data.csatLiveChat.map((s, i) => (
                  <div key={i} className="flex items-center gap-1 bg-bg-2 rounded-lg px-2 py-1 text-xs text-fg-1">
                    <span>⭐ {s}</span>
                    <button onClick={() => removeCsat('csatLiveChat', i)} className="text-fg-2 hover:text-crit ml-0.5">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Messaging CSAT */}
          <div className="bg-bg-1 border border-border-0 rounded-xl p-4">
            <p className="text-xs text-fg-2 mb-3">⭐ CSAT — Messaging</p>
            <div className="flex items-center gap-2 mb-3">
              <input type="number" min="1" max="5" step="0.1" value={csatMsgInput}
                onChange={e => setCsatMsgInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCsat('csatMessaging', csatMsgInput, setCsatMsgInput)}
                placeholder="1–5"
                className="w-20 bg-bg-2 border border-border-0 rounded-lg px-3 py-2 text-sm text-fg-0 outline-none focus:border-hero/50" />
              <button onClick={() => addCsat('csatMessaging', csatMsgInput, setCsatMsgInput)}
                className="flex items-center gap-1 text-xs bg-hero/20 hover:bg-hero/30 text-hero px-3 py-2 rounded-lg transition-colors">
                <Plus size={13} /> Add
              </button>
              <span className="ml-auto text-xl font-bold text-fg-0">{avgMsgCsat} <span className="text-xs text-fg-2 font-normal">avg</span></span>
            </div>
            {data.csatMessaging?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {data.csatMessaging.map((s, i) => (
                  <div key={i} className="flex items-center gap-1 bg-bg-2 rounded-lg px-2 py-1 text-xs text-fg-1">
                    <span>⭐ {s}</span>
                    <button onClick={() => removeCsat('csatMessaging', i)} className="text-fg-2 hover:text-crit ml-0.5">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Today summary + Intelligence Report trigger */}
      <div className="bg-hero/5 border border-hero/20 rounded-xl px-4 py-3 flex items-center gap-6 text-sm flex-wrap">
        <span className="text-fg-1">Total pts: <strong className="text-fg-0">{totalCases % 1 === 0 ? totalCases : totalCases.toFixed(1)}</strong></span>
        <span className="text-fg-1">Notes: <strong className="text-fg-0">{data.internalNotes || 0} <span className="text-fg-2 font-normal">({notesPts % 1 === 0 ? notesPts : notesPts.toFixed(1)} pts)</span></strong></span>
        <span className="text-fg-1">Tasks: <strong className="text-fg-0">{data.taskHours || 0}h <span className="text-fg-2 font-normal">({taskPts} pts)</span></strong></span>
        <span className="text-fg-1">CSAT Chat: <strong className="text-fg-0">{avgChatCsat}</strong></span>
        <span className="text-fg-1">CSAT MSG: <strong className="text-fg-0">{avgMsgCsat}</strong></span>
        <span className="text-fg-1">Escalations: <strong className="text-fg-0">{(data.chatEscalations || 0) + (data.msgEscalations || 0)}</strong></span>
        <button
          onClick={generateReport}
          disabled={reportLoading}
          className="ml-auto flex items-center gap-1.5 text-xs bg-hero/20 hover:bg-hero/30 text-hero px-3 py-2 rounded-lg transition-colors duration-150 disabled:opacity-50 cursor-pointer"
          aria-label="Generate shift-end intelligence report"
        >
          {reportLoading ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
          Intelligence Report
        </button>
      </div>

      {/* Intelligence Report panel */}
      {reportOpen && (
        <div className="bg-bg-1 border border-border-0 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-hero font-semibold uppercase tracking-wider">📊 Shift-End Intelligence Report</p>
            <div className="flex items-center gap-2">
              {report && !reportLoading && (
                <button
                  onClick={() => { navigator.clipboard.writeText(report); }}
                  className="text-xs text-fg-2 hover:text-fg-1 transition-colors cursor-pointer"
                  aria-label="Copy report to clipboard"
                >
                  Copy
                </button>
              )}
              <button
                onClick={() => setReportOpen(false)}
                className="text-xs text-fg-2 hover:text-fg-1 transition-colors cursor-pointer"
                aria-label="Close report"
              >
                ×
              </button>
            </div>
          </div>
          {reportLoading ? (
            <div className="flex items-center gap-2 py-6 justify-center text-sm text-fg-2">
              <Loader2 size={16} className="animate-spin" />
              Analyzing shift data...
            </div>
          ) : (
            <div className="text-sm text-fg-1 whitespace-pre-wrap leading-relaxed">{report}</div>
          )}
        </div>
      )}

      {/* QA Reviews */}
      <QAReviewInput
        data={data}
        onAdd={(entry) => setData(prev => ({
          ...prev,
          qaReviews: [...(prev.qaReviews || []), entry],
          [entry.channel === 'chat' ? 'qaChat' : 'qaEmail']: [
            ...(prev[entry.channel === 'chat' ? 'qaChat' : 'qaEmail'] || []),
            entry.score,
          ],
        }))}
        onRemove={(idx) => setData(prev => {
          const review = prev.qaReviews[idx];
          if (!review) return prev;
          const field = review.channel === 'chat' ? 'qaChat' : 'qaEmail';
          const scoreIdx = prev[field].indexOf(review.score);
          return {
            ...prev,
            qaReviews: prev.qaReviews.filter((_, i) => i !== idx),
            [field]: scoreIdx >= 0 ? prev[field].filter((_, i) => i !== scoreIdx) : prev[field],
          };
        })}
      />

      {/* Notes */}
      <div className="bg-bg-1 border border-border-0 rounded-xl p-4">
        <p className="text-xs text-fg-2 mb-2">📝 Shift notes</p>
        <textarea value={data.notes || ''} onChange={e => update('notes', e.target.value)}
          placeholder="Notable cases, issues, or things to remember..."
          rows={3}
          className="w-full bg-transparent text-sm text-fg-0 placeholder-fg-3 outline-none resize-none" />
      </div>
      </motion.div>
      )}
      </AnimatePresence>

      {/* Analytics Dashboard */}
      {history.length > 1 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <BarChart3 size={14} className="text-hero" />
            <h2 className="text-xs font-semibold text-fg-2 uppercase tracking-wider">Analytics — Last {Math.min(history.length, 14)} Days</h2>
          </div>

          {/* Cases per day bar chart */}
          <div className="bg-bg-1 border border-border-0 rounded-xl p-4">
            <p className="text-xs text-fg-2 mb-3">Cases per day</p>
            <div className="flex items-end gap-1.5" style={{ height: 80 }}>
              {history.slice(0, 14).reverse().map(d => {
                const max = Math.max(...history.slice(0, 14).map(h => h.total || 1));
                const pct = Math.max(4, ((d.total || 0) / max) * 100);
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group" title={`${d.date}: ${d.total?.toFixed?.(1) || d.total || 0} pts`}>
                    <span className="text-[9px] text-fg-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">{d.total?.toFixed?.(0) || 0}</span>
                    <div
                      className="w-full rounded-t-sm bg-hero/60 group-hover:bg-hero transition-colors duration-150"
                      style={{ height: `${pct}%`, minHeight: 3 }}
                    />
                    <span className="text-[8px] text-fg-3">{d.date.slice(5)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CSAT trend */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-bg-1 border border-border-0 rounded-xl p-4">
              <p className="text-xs text-fg-2 mb-2">CSAT Chat — Trend</p>
              <div className="flex items-end gap-1.5" style={{ height: 50 }}>
                {history.slice(0, 14).reverse().map(d => {
                  const val = parseFloat(d.avgChat);
                  const pct = isNaN(val) ? 0 : Math.max(4, ((val - 1) / 4) * 100);
                  const color = val >= 4 ? 'bg-ok/70' : val >= 3 ? 'bg-hero/70' : 'bg-crit/70';
                  return (
                    <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group" title={`${d.date}: ${d.avgChat}`}>
                      <div className={cn('w-full rounded-t-sm transition-colors duration-150', color)} style={{ height: `${pct}%`, minHeight: isNaN(val) ? 0 : 3 }} />
                    </div>
                  );
                })}
              </div>
              {(() => {
                const vals = history.slice(0, 7).map(d => parseFloat(d.avgChat)).filter(v => !isNaN(v));
                const avg = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : '—';
                return <p className="text-xs text-fg-1 mt-2">7-day avg: <strong className="text-fg-0">{avg}</strong></p>;
              })()}
            </div>
            <div className="bg-bg-1 border border-border-0 rounded-xl p-4">
              <p className="text-xs text-fg-2 mb-2">Escalation Rate</p>
              <div className="flex items-end gap-1.5" style={{ height: 50 }}>
                {history.slice(0, 14).reverse().map(d => {
                  const cases = (d.chatsTaken || 0) + (d.messagingTaken || 0) + (d.emailProd || 0);
                  const esc = (d.chatEscalations || 0) + (d.msgEscalations || 0);
                  const rate = cases > 0 ? (esc / cases) * 100 : 0;
                  const pct = Math.max(4, Math.min(rate * 5, 100));
                  const color = rate <= 10 ? 'bg-ok/70' : rate <= 20 ? 'bg-hero/70' : 'bg-crit/70';
                  return (
                    <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group" title={`${d.date}: ${rate.toFixed(0)}%`}>
                      <div className={cn('w-full rounded-t-sm transition-colors duration-150', color)} style={{ height: `${pct}%`, minHeight: esc > 0 ? 3 : 0 }} />
                    </div>
                  );
                })}
              </div>
              {(() => {
                const totEsc = history.slice(0, 7).reduce((s, d) => s + (d.chatEscalations || 0) + (d.msgEscalations || 0), 0);
                const totCases = history.slice(0, 7).reduce((s, d) => s + (d.chatsTaken || 0) + (d.messagingTaken || 0) + (d.emailProd || 0), 0);
                const rate = totCases > 0 ? ((totEsc / totCases) * 100).toFixed(1) : '0';
                return <p className="text-xs text-fg-1 mt-2">7-day rate: <strong className="text-fg-0">{rate}%</strong></p>;
              })()}
            </div>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-4 gap-3">
            {(() => {
              const week = history.slice(0, 7);
              const totalPts = week.reduce((s, d) => s + (d.total || 0), 0);
              const totalCasesW = week.reduce((s, d) => s + (d.chatsTaken || 0) + (d.messagingTaken || 0) + (d.emailProd || 0), 0);
              const avgPts = week.length ? (totalPts / week.length).toFixed(1) : '0';
              const chatVals = week.map(d => parseFloat(d.avgChat)).filter(v => !isNaN(v));
              const avgCsat = chatVals.length ? (chatVals.reduce((a, b) => a + b, 0) / chatVals.length).toFixed(2) : '—';
              return [
                { label: '7d Total Pts', value: totalPts.toFixed(0), icon: <TrendingUp size={12} className="text-hero" /> },
                { label: 'Daily Avg', value: avgPts, icon: <BarChart3 size={12} className="text-info" /> },
                { label: '7d Cases', value: totalCasesW, icon: <span className="text-xs">💬</span> },
                { label: '7d CSAT', value: avgCsat, icon: <span className="text-xs">⭐</span> },
              ].map(s => (
                <div key={s.label} className="bg-bg-1 border border-border-0 rounded-xl p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">{s.icon}</div>
                  <p className="text-lg font-bold text-fg-0">{s.value}</p>
                  <p className="text-[10px] text-fg-2">{s.label}</p>
                </div>
              ));
            })()}
          </div>

          {/* History rows */}
          <div>
            <h2 className="text-xs font-semibold text-fg-2 uppercase tracking-wider mb-3">Daily Log</h2>
            <div className="space-y-2">
              {history.slice(1, 14).map(d => (
                <div key={d.date} className="bg-bg-1 border border-border-0 rounded-xl px-4 py-3 flex items-center gap-4 text-xs flex-wrap">
                  <span className="text-fg-1 w-24 shrink-0">{d.date}</span>
                  <span className="text-fg-1">💬 {d.chatsTaken || 0}</span>
                  <span className="text-fg-1">📨 {d.messagingTaken || 0}</span>
                  <span className="text-fg-1">📧 {d.emailProd || 0}</span>
                  <span className="text-fg-1">📝 {d.internalNotes || 0}</span>
                  <span className="text-fg-1">⏱ {d.taskHours || 0}h</span>
                  <span className="text-fg-1">⭐ {d.avgChat}</span>
                  <span className="text-fg-1">📤 {(d.chatEscalations || 0) + (d.msgEscalations || 0)}</span>
                  <span className="ml-auto text-fg-2 font-medium">{d.total?.toFixed?.(1) || d.total || 0} pts</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   SUPPORT COMPONENTS & HELPERS
   ════════════════════════════════════════════════════════════════════════════ */

const panelMotion = {
  initial: { opacity: 0, y: 8, filter: 'blur(4px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -8, filter: 'blur(4px)' },
  transition: { duration: 0.25, ease: [0.2, 0, 0.2, 1] },
};

function DateNavigator({ selectedDate, onChange }) {
  const isTod = isToday(selectedDate);
  const isFuture = selectedDate > todayIso();

  return (
    <div className="flex items-center gap-2 bg-bg-1 border border-border-0 rounded-xl p-1">
      <button
        onClick={() => onChange(addDays(selectedDate, -1))}
        className="w-8 h-8 rounded-lg hover:bg-bg-2 text-fg-1 hover:text-hero transition-colors duration-220 flex items-center justify-center cursor-pointer"
        aria-label="Previous day"
      >
        <ChevronLeft size={15} />
      </button>

      <input
        type="date"
        value={selectedDate}
        max={todayIso()}
        onChange={e => onChange(e.target.value)}
        className="bg-transparent font-mono text-xs text-fg-0 outline-none border-none cursor-pointer px-2 py-1 tabular-nums"
        aria-label="Pick a date"
        style={{ colorScheme: 'dark' }}
      />

      {!isTod && (
        <button
          onClick={() => onChange(todayIso())}
          className="type-caption font-display text-hero hover:text-hero/80 transition-colors px-2 cursor-pointer"
        >
          Today
        </button>
      )}

      <button
        onClick={() => !isFuture && onChange(addDays(selectedDate, 1))}
        disabled={isTod || isFuture}
        className="w-8 h-8 rounded-lg hover:bg-bg-2 text-fg-1 hover:text-hero transition-colors duration-220 flex items-center justify-center cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Next day"
      >
        <ChevronRight size={15} />
      </button>
    </div>
  );
}

function PeriodTabs({ period, onChange }) {
  const tabs = [
    { id: 'daily', label: 'Daily' },
    { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' },
  ];
  return (
    <div className="inline-flex bg-bg-1 border border-border-0 rounded-xl p-1 gap-1">
      {tabs.map(t => {
        const active = period === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={cn(
              'relative type-caption font-display font-semibold px-4 py-1.5 rounded-lg transition-colors duration-220 cursor-pointer',
              active ? 'text-hero' : 'text-fg-2 hover:text-fg-0'
            )}
          >
            {active && (
              <motion.span
                layoutId="period-active-pill"
                className="absolute inset-0 bg-hero/10 border border-border-hero rounded-lg"
                transition={{ duration: 0.26, ease: [0.2, 0, 0.2, 1] }}
              />
            )}
            <span className="relative z-10">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function aggregate(history, anchorDate, days) {
  const end = new Date(anchorDate + 'T12:00:00');
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  const startIso = toIso(start);
  const endIso = toIso(end);

  const slice = history.filter(d => d.date >= startIso && d.date <= endIso);
  const cases = slice.reduce((s, d) => s + (d.chatsTaken || 0) + (d.messagingTaken || 0) + (d.emailProd || 0), 0);
  const closed = slice.reduce((s, d) => s + (d.closedCases || 0), 0);
  const escalations = slice.reduce((s, d) => s + (d.chatEscalations || 0) + (d.msgEscalations || 0), 0);
  const csatAll = slice.flatMap(d => [...(d.csatLiveChat || []), ...(d.csatMessaging || [])]);
  const qaAll = slice.flatMap(d => [...(d.qaChat || []), ...(d.qaEmail || [])]);
  const qaChat = slice.flatMap(d => d.qaChat || []);
  const qaEmail = slice.flatMap(d => d.qaEmail || []);
  const activeDays = slice.filter(d =>
    (d.chatsTaken || 0) + (d.messagingTaken || 0) + (d.emailProd || 0) +
    (d.csatLiveChat?.length || 0) + (d.csatMessaging?.length || 0) > 0
  ).length;

  return {
    range: { startIso, endIso, days },
    cases,
    closed,
    escalations,
    activeDays,
    avgCsat: csatAll.length ? (csatAll.reduce((a, b) => a + b, 0) / csatAll.length).toFixed(2) : '—',
    avgQA: qaAll.length ? (qaAll.reduce((a, b) => a + b, 0) / qaAll.length).toFixed(0) : '—',
    avgQAChat: qaChat.length ? (qaChat.reduce((a, b) => a + b, 0) / qaChat.length).toFixed(0) : '—',
    avgQAEmail: qaEmail.length ? (qaEmail.reduce((a, b) => a + b, 0) / qaEmail.length).toFixed(0) : '—',
    daily: slice.sort((a, b) => a.date.localeCompare(b.date)),
  };
}

function PeriodView({ period, agg }) {
  const title = period === 'weekly' ? 'Last 7 days' : 'Last 30 days';
  const { range, cases, closed, escalations, avgCsat, avgQA, avgQAChat, avgQAEmail, activeDays, daily } = agg;

  return (
    <div className="space-y-5">
      <div className="panel">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="type-h2 text-fg-0">{title}</h2>
            <p className="type-caption text-fg-2 mt-0.5">
              {shortDate(range.startIso)} → {shortDate(range.endIso)} · {activeDays} active day{activeDays !== 1 ? 's' : ''}
            </p>
          </div>
          <Sparkles size={14} className="text-hero" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Cases', value: cases },
            { label: 'Closed', value: closed },
            { label: 'Escalations', value: escalations },
            { label: 'Avg CSAT', value: avgCsat },
          ].map(s => (
            <div key={s.label} className="bg-bg-2 border border-border-0 rounded-xl p-3 text-center">
              <p className="type-kpi-label text-fg-2">{s.label}</p>
              <p className="font-display font-bold text-xl text-fg-0 tabular-nums mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3 mt-3">
          {[
            { label: 'QA · Chat', value: avgQAChat },
            { label: 'QA · Email', value: avgQAEmail },
            { label: 'QA · Combined', value: avgQA },
          ].map(q => (
            <div key={q.label} className="bg-bg-2 border border-border-0 rounded-xl p-3 text-center">
              <p className="type-kpi-label text-fg-2">{q.label}</p>
              <p className="font-display font-bold text-xl text-fg-0 tabular-nums mt-1">
                {q.value}{q.value !== '—' && <span className="type-caption text-fg-3 font-normal ml-0.5">/100</span>}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Daily breakdown list */}
      <div className="panel">
        <h3 className="type-h3 text-fg-0 mb-3">Day-by-day</h3>
        {daily.length === 0 ? (
          <p className="type-caption text-fg-3 text-center py-4">No activity in this range.</p>
        ) : (
          <div className="space-y-1.5">
            {daily.slice().reverse().map(d => {
              const dayCases = (d.chatsTaken || 0) + (d.messagingTaken || 0) + (d.emailProd || 0);
              const dayEsc = (d.chatEscalations || 0) + (d.msgEscalations || 0);
              return (
                <div key={d.date} className="bg-bg-2 border border-border-0 rounded-lg px-3 py-2 flex items-center gap-3 font-mono text-xs flex-wrap">
                  <span className="text-fg-1 w-20 shrink-0 tabular-nums">{d.date.slice(5)}</span>
                  <span className="text-fg-1">💬 {dayCases}</span>
                  <span className="text-fg-1">⭐ {d.avgChat}</span>
                  <span className="text-fg-1">📤 {dayEsc}</span>
                  <span className="text-fg-1">🎯 {d.qaChat?.length || d.qaEmail?.length ? [...(d.qaChat || []), ...(d.qaEmail || [])].reduce((a,b)=>a+b,0) / ((d.qaChat?.length || 0) + (d.qaEmail?.length || 0)) : '—'}</span>
                  <span className="ml-auto text-fg-2">{d.total?.toFixed?.(0) || d.total || 0} pts</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
