import { useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, Circle, ChevronDown, ChevronUp } from 'lucide-react';

const SECTIONS = [
  {
    id: 'triggers',
    title: 'What Triggers Probation',
    icon: '⚠️',
    color: 'red',
    items: [
      { label: 'CSAT score drops below 4.0 average over a 2-week period' },
      { label: 'Quality score falls below 70% in monthly QA reviews' },
      { label: 'Attendance or punctuality issues (3+ lates/absences in a month)' },
      { label: 'Repeated policy violations (incorrect resolutions, skipped SOPs)' },
      { label: 'Customer escalation rate above team threshold' },
      { label: 'Failure to meet daily case handling targets' },
    ],
  },
  {
    id: 'kpis',
    title: 'Key KPIs to Track',
    icon: '📊',
    color: 'yellow',
    metrics: [
      { metric: 'CSAT Score', target: '≥ 4.5 / 5.0', current: '', note: 'Ask for feedback after every case' },
      { metric: 'Quality Score', target: '≥ 85%', current: '', note: 'Self-review before submission' },
      { metric: 'First Response Time', target: '< 1 min (chat)', current: '', note: 'Pick up within 30 sec for live chat' },
      { metric: 'Resolution Rate', target: '≥ 80%', current: '', note: 'Avoid unnecessary escalations' },
      { metric: 'Attendance', target: '100% (no unapproved absences)', current: '', note: 'Notify TL 2h before shift if sick' },
      { metric: 'Cases per Shift', target: 'Team average +10%', current: '', note: 'Aim above average consistently' },
    ],
  },
  {
    id: 'action_plan',
    title: 'Action Plan Template',
    icon: '🎯',
    color: 'blue',
    steps: [
      { title: 'Week 1 — Identify & Understand', tasks: ['Review all QA feedback from last 30 days', 'Identify top 3 recurring mistakes', 'Re-read all relevant SOPs for problem areas', 'Shadow a senior agent for 2 shifts'] },
      { title: 'Week 2 — Practice & Improve', tasks: ['Apply SOP checklist before every case submission', 'Use Quality Check tool on every response before sending', 'Ask TL for real-time feedback on 3 cases per day', 'Log all difficult cases in Closed Cases for review'] },
      { title: 'Week 3 — Measure Progress', tasks: ['Track daily CSAT scores in Shift Tracker', 'Compare quality scores week-over-week', 'Address any remaining weak areas', 'Request mid-week 1:1 with TL for progress check-in'] },
      { title: 'Week 4 — Consolidate & Demonstrate', tasks: ['Achieve 5 consecutive days above target CSAT', 'Complete all QA reviews with score > 85%', 'Present improvement summary to TL', 'Request probation review meeting'] },
    ],
  },
  {
    id: 'tips',
    title: 'Agent Success Tips',
    icon: '💡',
    color: 'green',
    tips: [
      'Never skip identity verification — it protects you and the customer',
      'Read the full case history before responding — avoid repeating yourself',
      'If unsure, ask a senior agent or TL — escalating a query is better than a wrong answer',
      'Use templates as a starting point, personalize the tone for each customer',
      'Acknowledge the customer\'s frustration before jumping to solutions',
      'Keep responses concise — customers want answers, not essays',
      'Always close with "Is there anything else I can help you with?"',
      'Check the internal knowledge base before saying "I don\'t know"',
      'Log complex cases while they\'re fresh — don\'t rely on memory',
      'Celebrate small wins — a 5-star review is worth more than you think',
    ],
  },
  {
    id: 'recovery',
    title: 'How to Exit Probation',
    icon: '🚀',
    color: 'green',
    list: [
      'Meet ALL KPI targets consistently for minimum 3 consecutive weeks',
      'No new policy violations or customer complaints during probation period',
      'Complete any assigned training modules with score ≥ 80%',
      'Receive positive assessment from TL in weekly 1:1 reviews',
      'Submit end-of-probation self-assessment to TL',
      'Formal review meeting with TL and potentially QA lead',
      'Probation lifted in writing — confirm you receive this confirmation',
    ],
  },
];

const colorMap = {
  red: 'border-red-500/30 bg-red-500/5',
  yellow: 'border-yellow-500/30 bg-yellow-500/5',
  blue: 'border-blue-500/30 bg-blue-500/5',
  green: 'border-green-500/30 bg-green-500/5',
};

export default function ProbationPrep() {
  const [open, setOpen] = useState({ triggers: true, kpis: true });
  const [checked, setChecked] = useState({});
  const [metrics, setMetrics] = useState({});

  function toggle(id) { setOpen(p => ({ ...p, [id]: !p[id] })); }
  function tickTask(key) { setChecked(p => ({ ...p, [key]: !p[key] })); }

  const totalTasks = SECTIONS.find(s => s.id === 'action_plan')?.steps.flatMap(s => s.tasks).length || 0;
  const doneTasks = Object.values(checked).filter(Boolean).length;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-100">🎓 Probation Prep</h1>
        <p className="text-sm text-slate-500">Agent performance SOP — understand triggers, track KPIs, action plan</p>
      </div>

      {/* Action plan progress */}
      {doneTasks > 0 && (
        <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-xl px-4 py-3">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>Action plan progress</span>
            <span>{doneTasks}/{totalTasks} tasks</span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-yellow-400 rounded-full transition-all" style={{ width: `${(doneTasks / totalTasks) * 100}%` }} />
          </div>
        </div>
      )}

      {SECTIONS.map(section => (
        <div key={section.id} className={cn('border rounded-xl overflow-hidden', colorMap[section.color])}>
          <button
            onClick={() => toggle(section.id)}
            className="w-full flex items-center justify-between px-5 py-4 text-left"
          >
            <h2 className="font-semibold text-slate-100 flex items-center gap-2">
              <span>{section.icon}</span> {section.title}
            </h2>
            {open[section.id] ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
          </button>

          {open[section.id] && (
            <div className="px-5 pb-5">
              {section.items && (
                <ul className="space-y-2">
                  {section.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                      <span className="text-red-400 shrink-0 mt-0.5">•</span> {item.label}
                    </li>
                  ))}
                </ul>
              )}

              {section.metrics && (
                <div className="space-y-3">
                  {section.metrics.map((m, i) => (
                    <div key={i} className="bg-slate-900/50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-slate-200 text-sm">{m.metric}</span>
                        <span className="text-xs text-yellow-400 font-medium">{m.target}</span>
                      </div>
                      <p className="text-xs text-slate-500">{m.note}</p>
                      <input
                        value={metrics[m.metric] || ''}
                        onChange={e => setMetrics(p => ({ ...p, [m.metric]: e.target.value }))}
                        placeholder="Your current score..."
                        className="mt-2 w-full bg-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 outline-none placeholder-slate-600 border border-slate-700"
                      />
                    </div>
                  ))}
                </div>
              )}

              {section.steps && (
                <div className="space-y-4">
                  {section.steps.map((step, si) => (
                    <div key={si} className="bg-slate-900/50 rounded-lg p-4">
                      <p className="font-medium text-slate-200 text-sm mb-2">{step.title}</p>
                      <div className="space-y-2">
                        {step.tasks.map((task, ti) => {
                          const key = `${si}-${ti}`;
                          return (
                            <button key={ti} onClick={() => tickTask(key)} className="flex items-start gap-2 w-full text-left">
                              {checked[key]
                                ? <CheckCircle2 size={15} className="text-green-400 shrink-0 mt-0.5" />
                                : <Circle size={15} className="text-slate-600 shrink-0 mt-0.5" />}
                              <span className={cn('text-sm', checked[key] ? 'line-through text-slate-600' : 'text-slate-300')}>{task}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {section.tips && (
                <ul className="space-y-2">
                  {section.tips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                      <span className="text-green-400 shrink-0">💡</span> {tip}
                    </li>
                  ))}
                </ul>
              )}

              {section.list && (
                <ul className="space-y-2">
                  {section.list.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                      <span className="text-green-400 shrink-0">✓</span> {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
