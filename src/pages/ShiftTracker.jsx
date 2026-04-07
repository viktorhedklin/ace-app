import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';

function todayKey() {
  return `shift_${new Date().toISOString().split('T')[0]}`;
}

const DEFAULT_DATA = {
  chatsTaken: 0,
  messagingTaken: 0,
  emailProd: 0,
  closedCases: 0,
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
      const total = (d.chatsTaken || 0) + (d.messagingTaken || 0) + (d.emailProd || 0);
      return { date, ...d, avgChat, avgMsg, total };
    } catch { return null; }
  }).filter(Boolean);
}

function Counter({ label, icon, value, onInc, onDec }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <p className="text-xs text-slate-500 mb-2">{icon} {label}</p>
      <div className="flex items-center gap-2">
        <button onClick={onDec} className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold transition-colors">−</button>
        <span className="flex-1 text-center text-2xl font-bold text-slate-100">{value}</span>
        <button onClick={onInc} className="w-8 h-8 rounded-lg bg-yellow-400/20 hover:bg-yellow-400/30 text-yellow-400 font-bold transition-colors">+</button>
      </div>
    </div>
  );
}

export default function ShiftTracker() {
  const [data, setData] = useState(loadToday);
  const [csatChatInput, setCsatChatInput] = useState('');
  const [csatMsgInput, setCsatMsgInput] = useState('');
  const [history] = useState(loadHistory);

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
  const totalCases = (data.chatsTaken || 0) + (data.messagingTaken || 0) + (data.emailProd || 0);

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-100">📊 Shift Tracker</h1>
        <p className="text-sm text-slate-500">{today}</p>
      </div>

      {/* Productivity counters */}
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Productivity</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Counter label="Chats Taken" icon="💬" value={data.chatsTaken || 0} onInc={() => inc('chatsTaken')} onDec={() => dec('chatsTaken')} />
          <Counter label="Messaging Taken" icon="📨" value={data.messagingTaken || 0} onInc={() => inc('messagingTaken')} onDec={() => dec('messagingTaken')} />
          <Counter label="Email / Web" icon="📧" value={data.emailProd || 0} onInc={() => inc('emailProd')} onDec={() => dec('emailProd')} />
          <Counter label="Closed Cases" icon="✓" value={data.closedCases || 0} onInc={() => inc('closedCases')} onDec={() => dec('closedCases')} />
        </div>
      </div>

      {/* Escalations */}
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Escalations</p>
        <div className="grid grid-cols-2 gap-3">
          <Counter label="Chat Escalations" icon="📤" value={data.chatEscalations || 0} onInc={() => inc('chatEscalations')} onDec={() => dec('chatEscalations')} />
          <Counter label="MSG Escalations" icon="📤" value={data.msgEscalations || 0} onInc={() => inc('msgEscalations')} onDec={() => dec('msgEscalations')} />
        </div>
      </div>

      {/* CSAT */}
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">CSAT Scores</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Live Chat CSAT */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-3">⭐ CSAT — Live Chat</p>
            <div className="flex items-center gap-2 mb-3">
              <input type="number" min="1" max="5" step="0.1" value={csatChatInput}
                onChange={e => setCsatChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCsat('csatLiveChat', csatChatInput, setCsatChatInput)}
                placeholder="1–5"
                className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-yellow-400/50" />
              <button onClick={() => addCsat('csatLiveChat', csatChatInput, setCsatChatInput)}
                className="flex items-center gap-1 text-xs bg-yellow-400/20 hover:bg-yellow-400/30 text-yellow-400 px-3 py-2 rounded-lg transition-colors">
                <Plus size={13} /> Add
              </button>
              <span className="ml-auto text-xl font-bold text-slate-100">{avgChatCsat} <span className="text-xs text-slate-500 font-normal">avg</span></span>
            </div>
            {data.csatLiveChat?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {data.csatLiveChat.map((s, i) => (
                  <div key={i} className="flex items-center gap-1 bg-slate-800 rounded-lg px-2 py-1 text-xs text-slate-300">
                    <span>⭐ {s}</span>
                    <button onClick={() => removeCsat('csatLiveChat', i)} className="text-slate-600 hover:text-red-400 ml-0.5">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Messaging CSAT */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-3">⭐ CSAT — Messaging</p>
            <div className="flex items-center gap-2 mb-3">
              <input type="number" min="1" max="5" step="0.1" value={csatMsgInput}
                onChange={e => setCsatMsgInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCsat('csatMessaging', csatMsgInput, setCsatMsgInput)}
                placeholder="1–5"
                className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-yellow-400/50" />
              <button onClick={() => addCsat('csatMessaging', csatMsgInput, setCsatMsgInput)}
                className="flex items-center gap-1 text-xs bg-yellow-400/20 hover:bg-yellow-400/30 text-yellow-400 px-3 py-2 rounded-lg transition-colors">
                <Plus size={13} /> Add
              </button>
              <span className="ml-auto text-xl font-bold text-slate-100">{avgMsgCsat} <span className="text-xs text-slate-500 font-normal">avg</span></span>
            </div>
            {data.csatMessaging?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {data.csatMessaging.map((s, i) => (
                  <div key={i} className="flex items-center gap-1 bg-slate-800 rounded-lg px-2 py-1 text-xs text-slate-300">
                    <span>⭐ {s}</span>
                    <button onClick={() => removeCsat('csatMessaging', i)} className="text-slate-600 hover:text-red-400 ml-0.5">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Today summary */}
      <div className="bg-yellow-400/5 border border-yellow-400/20 rounded-xl px-4 py-3 flex items-center gap-6 text-sm flex-wrap">
        <span className="text-slate-400">Total today: <strong className="text-slate-100">{totalCases}</strong></span>
        <span className="text-slate-400">Closed: <strong className="text-slate-100">{data.closedCases || 0}</strong></span>
        <span className="text-slate-400">CSAT Chat: <strong className="text-slate-100">{avgChatCsat}</strong></span>
        <span className="text-slate-400">CSAT MSG: <strong className="text-slate-100">{avgMsgCsat}</strong></span>
        <span className="text-slate-400">Escalations: <strong className="text-slate-100">{(data.chatEscalations || 0) + (data.msgEscalations || 0)}</strong></span>
      </div>

      {/* Notes */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <p className="text-xs text-slate-500 mb-2">📝 Shift notes</p>
        <textarea value={data.notes || ''} onChange={e => update('notes', e.target.value)}
          placeholder="Notable cases, issues, or things to remember..."
          rows={3}
          className="w-full bg-transparent text-sm text-slate-200 placeholder-slate-600 outline-none resize-none" />
      </div>

      {/* History */}
      {history.length > 1 && (
        <div>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">History</h2>
          <div className="space-y-2">
            {history.slice(1, 8).map(d => (
              <div key={d.date} className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex items-center gap-4 text-xs flex-wrap">
                <span className="text-slate-400 w-24 shrink-0">{d.date}</span>
                <span className="text-slate-300">💬 {d.chatsTaken || 0}</span>
                <span className="text-slate-300">📨 {d.messagingTaken || 0}</span>
                <span className="text-slate-300">📧 {d.emailProd || 0}</span>
                <span className="text-slate-300">✓ {d.closedCases || 0}</span>
                <span className="text-slate-300">⭐ {d.avgChat}</span>
                <span className="text-slate-300">📤 {(d.chatEscalations || 0) + (d.msgEscalations || 0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
