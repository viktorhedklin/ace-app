import { useState } from 'react';
import { Plus, Trash2, Search, ChevronDown, ChevronUp } from 'lucide-react';

function load() {
  try { return JSON.parse(localStorage.getItem('closed_cases')) || []; } catch { return []; }
}
function save(cases) {
  localStorage.setItem('closed_cases', JSON.stringify(cases));
}

const CATEGORIES = ['All', 'P2P', 'Deposit', 'Withdrawal', 'Account', 'Card', 'Trading', 'Security', 'Other'];
const STATUSES = ['Closed', 'Reopened', 'Escalated'];

export default function ClosedCases() {
  const [cases, setCases] = useState(load);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('All');
  const [showAdd, setShowAdd] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [form, setForm] = useState({ caseId: '', category: 'P2P', summary: '', resolution: '', status: 'Closed', notes: '' });

  function addCase() {
    if (!form.caseId.trim() || !form.summary.trim()) return;
    const updated = [{ ...form, id: Date.now(), date: new Date().toISOString() }, ...cases];
    setCases(updated);
    save(updated);
    setForm({ caseId: '', category: 'P2P', summary: '', resolution: '', status: 'Closed', notes: '' });
    setShowAdd(false);
  }

  function updateStatus(id, status) {
    const updated = cases.map(c => c.id === id ? { ...c, status } : c);
    setCases(updated);
    save(updated);
  }

  function deleteCase(id) {
    if (!confirm('Delete this case?')) return;
    const updated = cases.filter(c => c.id !== id);
    setCases(updated);
    save(updated);
  }

  const filtered = cases.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.caseId.toLowerCase().includes(q) || c.summary.toLowerCase().includes(q);
    const matchCat = filterCat === 'All' || c.category === filterCat;
    return matchSearch && matchCat;
  });

  const statusColor = { Closed: 'bg-green-500/20 text-green-400', Reopened: 'bg-orange-500/20 text-orange-400', Escalated: 'bg-red-500/20 text-red-400' };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">📋 Closed Cases</h1>
          <p className="text-sm text-slate-500">Review, reopen or escalate previous cases</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 bg-yellow-400/20 hover:bg-yellow-400/30 text-yellow-400 text-sm px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={15} /> Log case
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <p className="text-sm font-medium text-slate-300">Log closed case</p>
          <div className="grid grid-cols-2 gap-3">
            <input value={form.caseId} onChange={e => setForm(p => ({ ...p, caseId: e.target.value }))} placeholder="Case ID / Ticket #" className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none col-span-1" />
            <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 outline-none">
              {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <input value={form.summary} onChange={e => setForm(p => ({ ...p, summary: e.target.value }))} placeholder="Case summary" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none" />
          <input value={form.resolution} onChange={e => setForm(p => ({ ...p, resolution: e.target.value }))} placeholder="Resolution / what was done" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none" />
          <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Notes (optional)" rows={2} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none resize-none" />
          <div className="flex gap-2">
            <button onClick={addCase} className="bg-yellow-400 text-slate-900 font-medium text-sm px-5 py-2 rounded-lg hover:bg-yellow-300 transition-colors">Save</button>
            <button onClick={() => setShowAdd(false)} className="text-slate-500 text-sm px-4 py-2">Cancel</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 flex items-center gap-2 bg-slate-900 border border-slate-700 focus-within:border-yellow-400/50 rounded-xl px-4 py-3">
          <Search size={15} className="text-slate-500 shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by case ID or summary..." className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 outline-none" />
        </div>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="bg-slate-900 border border-slate-700 text-slate-300 text-sm rounded-xl px-4 py-3 outline-none">
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      {/* Cases list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-600">
          <p className="text-4xl mb-3">📋</p>
          <p>No cases logged yet</p>
          <p className="text-sm">Use "Log case" to add closed cases for review</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <div key={c.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <button
                onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono text-sm font-medium text-yellow-400">{c.caseId}</span>
                    <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded">{c.category}</span>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${statusColor[c.status]}`}>{c.status}</span>
                  </div>
                  <p className="text-sm text-slate-300 truncate">{c.summary}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-slate-600">{new Date(c.date).toLocaleDateString()}</span>
                  {expanded === c.id ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
                </div>
              </button>

              {expanded === c.id && (
                <div className="px-5 pb-5 border-t border-slate-800 space-y-3">
                  {c.resolution && (
                    <div className="mt-3">
                      <p className="text-xs text-slate-500 mb-1">Resolution</p>
                      <p className="text-sm text-slate-300">{c.resolution}</p>
                    </div>
                  )}
                  {c.notes && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Notes</p>
                      <p className="text-sm text-slate-400">{c.notes}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-2">
                    <p className="text-xs text-slate-500 mr-2">Status:</p>
                    {STATUSES.map(s => (
                      <button
                        key={s}
                        onClick={() => updateStatus(c.id, s)}
                        className={`text-xs px-3 py-1 rounded-lg transition-colors border ${c.status === s ? statusColor[s] + ' border-current' : 'border-slate-700 text-slate-500 hover:text-slate-300'}`}
                      >
                        {s}
                      </button>
                    ))}
                    <button onClick={() => deleteCase(c.id)} className="ml-auto text-slate-600 hover:text-red-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
