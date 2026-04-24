import { useState } from 'react';
import { Plus, Trash2, Search, ChevronDown, ChevronUp, Tag, X } from 'lucide-react';
import { scrubForStorage } from '@/lib/SecurityModule';
import { cn } from '@/lib/utils';

function load() {
  try { return JSON.parse(localStorage.getItem('closed_cases')) || []; } catch { return []; }
}
function save(cases) {
  const scrubbed = cases.map(c => ({
    ...c,
    caseId: scrubForStorage(c.caseId),
    summary: scrubForStorage(c.summary),
    resolution: scrubForStorage(c.resolution),
    notes: scrubForStorage(c.notes),
    tags: c.tags || [],
  }));
  localStorage.setItem('closed_cases', JSON.stringify(scrubbed));
}

const CATEGORIES = ['All', 'P2P', 'Deposit', 'Withdrawal', 'Account', 'Card', 'Trading', 'Security', 'Other'];
const STATUSES = ['Closed', 'Reopened', 'Escalated'];

const TAGS = [
  { id: 'kyc', label: 'KYC', color: 'bg-info/20 text-info border-info/30' },
  { id: 'deposit', label: 'Deposit', color: 'bg-ok/20 text-ok border-ok/30' },
  { id: 'withdrawal', label: 'Withdrawal', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  { id: 'p2p', label: 'P2P', color: 'bg-warn/20 text-warn border-warn/30' },
  { id: 'card', label: 'Card', color: 'bg-pink-500/20 text-pink-400 border-pink-500/30' },
  { id: 'trading', label: 'Trading', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  { id: 'vip', label: 'VIP', color: 'bg-hero-soft/20 text-hero border-hero/30' },
  { id: 'escalation', label: 'Escalation', color: 'bg-crit/20 text-crit border-crit/30' },
  { id: 'sepa', label: 'SEPA', color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' },
  { id: 'bug', label: 'Bug', color: 'bg-rose-500/20 text-rose-400 border-rose-500/30' },
  { id: 'travel-rule', label: 'Travel Rule', color: 'bg-teal-500/20 text-teal-400 border-teal-500/30' },
  { id: 'complaint', label: 'Complaint', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
];

function TagBadge({ tagId, removable, onRemove }) {
  const tag = TAGS.find(t => t.id === tagId);
  if (!tag) return null;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border', tag.color)}>
      {tag.label}
      {removable && (
        <button onClick={onRemove} className="hover:opacity-70 cursor-pointer" aria-label={`Remove ${tag.label} tag`}>
          <X size={9} />
        </button>
      )}
    </span>
  );
}

function TagPicker({ selected, onChange }) {
  function toggle(id) {
    onChange(selected.includes(id) ? selected.filter(t => t !== id) : [...selected, id]);
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {TAGS.map(t => (
        <button
          key={t.id}
          onClick={() => toggle(t.id)}
          className={cn(
            'text-xs px-2 py-1 rounded-lg border transition-colors duration-150 cursor-pointer',
            selected.includes(t.id) ? t.color : 'bg-bg-2 border-border-0 text-fg-2 hover:text-fg-1'
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export default function ClosedCases() {
  const [cases, setCases] = useState(load);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('All');
  const [showAdd, setShowAdd] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [filterTag, setFilterTag] = useState(null);
  const [form, setForm] = useState({ caseId: '', category: 'P2P', summary: '', resolution: '', status: 'Closed', notes: '', tags: [] });

  function addCase() {
    if (!form.caseId.trim() || !form.summary.trim()) return;
    const updated = [{ ...form, id: Date.now(), date: new Date().toISOString() }, ...cases];
    setCases(updated);
    save(updated);
    setForm({ caseId: '', category: 'P2P', summary: '', resolution: '', status: 'Closed', notes: '', tags: [] });
    setShowAdd(false);
  }

  function updateTags(id, tags) {
    const updated = cases.map(c => c.id === id ? { ...c, tags } : c);
    setCases(updated);
    save(updated);
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
    const matchTag = !filterTag || (c.tags || []).includes(filterTag);
    return matchSearch && matchCat && matchTag;
  });

  const statusColor = { Closed: 'bg-ok/20 text-ok', Reopened: 'bg-warn/20 text-warn', Escalated: 'bg-crit/20 text-crit' };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-fg-0">📋 Closed Cases</h1>
          <p className="text-sm text-fg-2">Review, reopen or escalate previous cases</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 bg-hero/20 hover:bg-hero/30 text-hero text-sm px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={15} /> Log case
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="bg-bg-1 border border-border-0 rounded-xl p-5 space-y-3">
          <p className="text-sm font-medium text-fg-1">Log closed case</p>
          <div className="grid grid-cols-2 gap-3">
            <input value={form.caseId} onChange={e => setForm(p => ({ ...p, caseId: e.target.value }))} placeholder="Case ID / Ticket #" className="bg-bg-2 border border-border-0 rounded-lg px-3 py-2 text-sm text-fg-0 outline-none col-span-1" />
            <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className="bg-bg-2 border border-border-0 rounded-lg px-3 py-2 text-sm text-fg-1 outline-none">
              {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <input value={form.summary} onChange={e => setForm(p => ({ ...p, summary: e.target.value }))} placeholder="Case summary" className="w-full bg-bg-2 border border-border-0 rounded-lg px-3 py-2 text-sm text-fg-0 outline-none" />
          <input value={form.resolution} onChange={e => setForm(p => ({ ...p, resolution: e.target.value }))} placeholder="Resolution / what was done" className="w-full bg-bg-2 border border-border-0 rounded-lg px-3 py-2 text-sm text-fg-0 outline-none" />
          <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Notes (optional)" rows={2} className="w-full bg-bg-2 border border-border-0 rounded-lg px-3 py-2 text-sm text-fg-0 outline-none resize-none" />
          <div>
            <p className="text-xs text-fg-2 mb-1.5 flex items-center gap-1"><Tag size={11} /> Tags</p>
            <TagPicker selected={form.tags} onChange={tags => setForm(p => ({ ...p, tags }))} />
          </div>
          <div className="flex gap-2">
            <button onClick={addCase} className="bg-hero text-[#021418] font-medium text-sm px-5 py-2 rounded-lg hover:bg-hero transition-colors cursor-pointer">Save</button>
            <button onClick={() => setShowAdd(false)} className="text-fg-2 text-sm px-4 py-2">Cancel</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 flex items-center gap-2 bg-bg-1 border border-border-0 focus-within:border-hero/50 rounded-xl px-4 py-3">
          <Search size={15} className="text-fg-2 shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by case ID or summary..." className="flex-1 bg-transparent text-sm text-fg-0 placeholder-fg-2 outline-none" />
        </div>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="bg-bg-1 border border-border-0 text-fg-1 text-sm rounded-xl px-4 py-3 outline-none">
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      {/* Tag filter */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setFilterTag(null)}
          className={cn(
            'text-xs px-2 py-1 rounded-lg border transition-colors duration-150 cursor-pointer',
            !filterTag ? 'bg-hero/15 border-hero/30 text-hero' : 'bg-bg-2 border-border-0 text-fg-2 hover:text-fg-1'
          )}
        >
          All tags
        </button>
        {TAGS.map(t => (
          <button
            key={t.id}
            onClick={() => setFilterTag(filterTag === t.id ? null : t.id)}
            className={cn(
              'text-xs px-2 py-1 rounded-lg border transition-colors duration-150 cursor-pointer',
              filterTag === t.id ? t.color : 'bg-bg-2 border-border-0 text-fg-2 hover:text-fg-1'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Cases list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-fg-2">
          <p className="text-4xl mb-3">📋</p>
          <p>No cases logged yet</p>
          <p className="text-sm">Use "Log case" to add closed cases for review</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <div key={c.id} className="bg-bg-1 border border-border-0 rounded-xl overflow-hidden">
              <button
                onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-bg-2/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono text-sm font-medium text-hero">{c.caseId}</span>
                    <span className="text-xs bg-bg-2 text-fg-1 px-2 py-0.5 rounded">{c.category}</span>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${statusColor[c.status]}`}>{c.status}</span>
                    {(c.tags || []).slice(0, 3).map(t => <TagBadge key={t} tagId={t} />)}
                  </div>
                  <p className="text-sm text-fg-1 truncate">{c.summary}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-fg-2">{new Date(c.date).toLocaleDateString()}</span>
                  {expanded === c.id ? <ChevronUp size={14} className="text-fg-2" /> : <ChevronDown size={14} className="text-fg-2" />}
                </div>
              </button>

              {expanded === c.id && (
                <div className="px-5 pb-5 border-t border-border-0 space-y-3">
                  {c.resolution && (
                    <div className="mt-3">
                      <p className="text-xs text-fg-2 mb-1">Resolution</p>
                      <p className="text-sm text-fg-1">{c.resolution}</p>
                    </div>
                  )}
                  {c.notes && (
                    <div>
                      <p className="text-xs text-fg-2 mb-1">Notes</p>
                      <p className="text-sm text-fg-1">{c.notes}</p>
                    </div>
                  )}
                  <div className="pt-1">
                    <p className="text-xs text-fg-2 mb-1.5 flex items-center gap-1"><Tag size={11} /> Tags</p>
                    <TagPicker selected={c.tags || []} onChange={tags => updateTags(c.id, tags)} />
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <p className="text-xs text-fg-2 mr-2">Status:</p>
                    {STATUSES.map(s => (
                      <button
                        key={s}
                        onClick={() => updateStatus(c.id, s)}
                        className={`text-xs px-3 py-1 rounded-lg transition-colors border ${c.status === s ? statusColor[s] + ' border-current' : 'border-border-0 text-fg-2 hover:text-fg-1'}`}
                      >
                        {s}
                      </button>
                    ))}
                    <button onClick={() => deleteCase(c.id)} className="ml-auto text-fg-2 hover:text-crit transition-colors">
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
