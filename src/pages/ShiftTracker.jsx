import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, FileText, Loader2, TrendingUp, BarChart3 } from 'lucide-react';
import { getRecentCases } from '@/lib/caseMemory';
import { InvokeLLM, getApiKey } from '@/api/claude';
import { cn } from '@/lib/utils';

function todayKey() {
  return `shift_${new Date().toISOString().split('T')[0]}`;
}

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
  notes: '',
};

function loadToday() {
  try {
    const d = JSON.parse(localStorage.getItem(todayKey()));
    return d ? { ...DEFAULT_DATA, ...d } : { ...DEFAULT_DATA };
  } catch { return { ...DEFAULT_DATA }; }
}

function loadHistory() {
  const keys = Object.keys(localStorage).filter(k => k.startsWith('shift_')).sort().reverse();
  return keys.map(k => {
    try {
      const d = JSON.parse(localStorage.getItem(k));
      const date = k.replace('shift_', '');
      const avgChat = d.csatLiveChat?.length
        ? (d.csatLiveChat.reduce((a, b) => a + b, 0) / d.csatLiveChat.length).toFixed(1) : '—';
      const avgMsg = d.csatMessaging?.length
        ? (d.csatMessaging.reduce((a, b) => a + b, 0) / d.csatMessaging.length).toFixed(1) : '—';
      const total = (d.chatsTaken || 0) + (d.messagingTaken || 0) + (d.emailProd || 0) + (d.internalNotes || 0) * 0.5 + (d.taskHours || 0) * 10;
      return { date, ...d, avgChat, avgMsg, total };
    } catch { return null; }
  }).filter(Boolean);
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
  const [data, setData] = useState(loadToday);
  const [csatChatInput, setCsatChatInput] = useState('');
  const [csatMsgInput, setCsatMsgInput] = useState('');
  const [history] = useState(loadHistory);

  // Intelligence Report
  const [report, setReport] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(todayKey(), JSON.stringify(data));
  }, [data]);

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

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-fg-0">📊 Shift Tracker</h1>
        <p className="text-sm text-fg-2">{today}</p>
      </div>

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

      {/* Notes */}
      <div className="bg-bg-1 border border-border-0 rounded-xl p-4">
        <p className="text-xs text-fg-2 mb-2">📝 Shift notes</p>
        <textarea value={data.notes || ''} onChange={e => update('notes', e.target.value)}
          placeholder="Notable cases, issues, or things to remember..."
          rows={3}
          className="w-full bg-transparent text-sm text-fg-0 placeholder-fg-3 outline-none resize-none" />
      </div>

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
