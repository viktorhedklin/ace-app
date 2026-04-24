// ─── Trajectory — Personal coach storage + LLM plan generation ────────────────
// User enters goals once. Ace generates a milestone plan. Coach chat gets
// rich context (plan + live shift/QA data + memory queue) on every ask.
//
// Storage routes through the cloud-mirrored adapter (src/lib/storage.js).
// Reads stay synchronous (localStorage mirror). Writes are fire-and-forget
// from the caller's perspective — they don't need to await.

import { InvokeLLM } from '@/api/claude';
import { get, set, remove, NAMESPACES } from './storage';

const LEGACY_KEY = 'ace_trajectory';

export function loadTrajectory() {
  // Prefer adapter mirror; fall back to the legacy key for pre-migration data.
  const fromAdapter = get(NAMESPACES.TRAJECTORY, 'plan');
  if (fromAdapter) return fromAdapter;
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveTrajectory(data) {
  await set(NAMESPACES.TRAJECTORY, 'plan', data);
  // Drop the legacy key so we don't end up with two sources of truth.
  localStorage.removeItem(LEGACY_KEY);
}

export async function clearTrajectory() {
  await remove(NAMESPACES.TRAJECTORY, 'plan');
  localStorage.removeItem(LEGACY_KEY);
}

export function isOnboarded() {
  const t = loadTrajectory();
  return !!(t && t.onboarded && t.plan);
}

/* ─── Plan generation ─────────────────────────────────────────────────────── */

const PLAN_SYSTEM_PROMPT = `You are Ace — a senior Bybit support operator who's been a coach to dozens of agents. You speak like a direct, experienced mentor. No corporate fluff. Encourage but don't patronize.

Your job: given an agent's goals and context, produce a structured trajectory plan.

Return ONLY valid JSON, no markdown fences, in this exact shape:

{
  "summary": "2-sentence direct read of where they are and where they're going",
  "thisWeekFocus": {
    "title": "6-word focus area",
    "why": "one sentence why this matters most right now",
    "action": "one concrete action they can take this week"
  },
  "milestones": [
    {"title": "concrete checkpoint", "target": "measurable outcome", "eta": "week 2 | month 1 | month 3 | etc"},
    ...3-5 total
  ],
  "skillGaps": ["specific, actionable — not 'improve empathy' but 'open every chat with a named-customer acknowledgement within 20s'"],
  "recommendedFocus": ["which SOP / page / topic from Ace to revisit"],
  "metrics": {
    "qaTarget": 90,
    "csatTarget": 4.7,
    "reviewCadence": "weekly"
  }
}

Rules:
- Be concrete. Every milestone must be measurable.
- Skill gaps should reference specific behaviours, not abstract traits.
- Use their own words where possible.
- If their goal is vague, infer from context but flag it in the summary.
- Don't invent data — if QA data is unavailable, acknowledge it.`;

export async function generatePlan({ goal, horizon, skillGap, experience, successMetric, qaContext, shiftContext }) {
  const userPrompt = `## Agent inputs

Primary goal: ${goal}
Time horizon: ${horizon}
Biggest current skill gap (self-reported): ${skillGap || '(none given)'}
Prior experience: ${experience || '(none given)'}
How they'll know they hit the goal: ${successMetric || '(none given)'}

## Live context

${qaContext || 'QA context: no reviews logged yet.'}

${shiftContext || 'Shift context: no shift history yet.'}

Generate the trajectory plan.`;

  const raw = await InvokeLLM({
    prompt: userPrompt,
    system_prompt: PLAN_SYSTEM_PROMPT,
  });

  // Strip any fences, parse JSON
  const jsonText = raw.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
  return JSON.parse(jsonText);
}

/* ─── Coach context builder ───────────────────────────────────────────────── */

// Reads shift + QA state from localStorage and builds a compact context block
// that gets injected into every coach chat turn.
export function buildCoachContext() {
  const trajectory = loadTrajectory();
  if (!trajectory) return 'No trajectory plan set yet.';

  // Recent shift metrics (last 7 days)
  const shiftKeys = Object.keys(localStorage).filter(k => k.startsWith('shift_')).sort().reverse().slice(0, 7);
  const days = shiftKeys.map(k => {
    try { return { date: k.replace('shift_', ''), ...JSON.parse(localStorage.getItem(k)) }; }
    catch { return null; }
  }).filter(Boolean);

  const cases = days.reduce((s, d) => s + (d.chatsTaken || 0) + (d.messagingTaken || 0) + (d.emailProd || 0), 0);
  const csatAll = days.flatMap(d => [...(d.csatLiveChat || []), ...(d.csatMessaging || [])]);
  const avgCsat = csatAll.length ? (csatAll.reduce((a, b) => a + b, 0) / csatAll.length).toFixed(2) : 'n/a';
  const qaAll = days.flatMap(d => [...(d.qaChat || []), ...(d.qaEmail || [])]);
  const avgQa = qaAll.length ? (qaAll.reduce((a, b) => a + b, 0) / qaAll.length).toFixed(0) : 'n/a';
  const escalations = days.reduce((s, d) => s + (d.chatEscalations || 0) + (d.msgEscalations || 0), 0);

  // Recent QA issues from memory queue
  const qaMemory = (() => {
    try { return JSON.parse(localStorage.getItem('ace_qa_memory_queue') || '[]'); }
    catch { return []; }
  })().slice(-10);

  const recurringIssues = findRecurring(qaMemory);

  return `## Agent's trajectory
Goal: ${trajectory.goal}
Horizon: ${trajectory.horizon}
Success metric: ${trajectory.successMetric || '—'}

## Current plan
${trajectory.plan?.summary || ''}

This week's focus: ${trajectory.plan?.thisWeekFocus?.title || '—'}
Why: ${trajectory.plan?.thisWeekFocus?.why || '—'}
Action: ${trajectory.plan?.thisWeekFocus?.action || '—'}

Milestones:
${(trajectory.plan?.milestones || []).map(m => `- [${m.eta}] ${m.title} — ${m.target}`).join('\n') || '—'}

## Last 7 days performance
Cases handled: ${cases}
Avg CSAT: ${avgCsat}
Avg QA: ${avgQa}
Escalations: ${escalations}

## Recurring QA issues (from recent reviews)
${recurringIssues.length ? recurringIssues.map(i => `- ${i.issue} (flagged ${i.count}x)`).join('\n') : 'No recurring issues detected.'}

---

When the agent asks for coaching, respond as Ace — direct, experienced, tactical. Reference specifics from above. Don't be generic. Never invent data you don't have.`;
}

// Simple recurrence finder — naive substring matching across memory entries.
function findRecurring(queue) {
  if (!queue.length) return [];
  const issueStrings = queue.flatMap(q => q.sourceEntry?.issues || []);
  const counts = {};
  for (const raw of issueStrings) {
    // Normalize: lowercase, strip punctuation, take first 6 words as the "signature"
    const signature = raw.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).slice(0, 6).join(' ');
    counts[signature] = (counts[signature] || 0) + 1;
  }
  return Object.entries(counts)
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([issue, count]) => ({ issue, count }));
}

export function getRecurringQAIssues() {
  const queue = (() => {
    try { return JSON.parse(localStorage.getItem('ace_qa_memory_queue') || '[]'); }
    catch { return []; }
  })();
  return findRecurring(queue);
}
