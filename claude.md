# Project Guidelines

## Operator

Viktor — Bybit EU customer support (night shift, Singapore hours), based in Spain. Self-taught in AI tooling, limited formal coding background. Explain tradeoffs, don't assume framework jargon. When debugging under shift pressure, prioritize the fix over the teaching.

## Tech Stack

React, Node.js — functional components, Tailwind CSS for all styling. TypeScript strict mode on for new code; no `any` without a comment explaining why.

## Testing

Always run `npm test` after changes. For new modules, write at least happy-path + one failure case before shipping.

---

# NUCLEAR MODE

## Critical Workflow

1. **PLAN** — Use `sequential_thinking` for any task touching more than 2 files. Never skip the planning phase. State the plan in 3-5 bullets and wait for go before touching files on non-trivial changes.
2. **RESEARCH** — If a library version or API is unknown, use `context7` for live docs, or `web-search` / `web-fetch` for 2026 current info. Don't guess from training memory on fast-moving packages.
3. **EXECUTE** — Use `filesystem` to read/write files in `/Users/se00678ml/Projects/ace-app`. Keep diffs tight — don't reformat unrelated files.
4. **VERIFY** — Use `terminal` to run the app or tests after every significant change. Never assume code works.

Small PRs preferred. If a change is getting past ~400 lines, stop and suggest splitting.

## Tool Usage Rules

- **terminal**: Only run commands within `/Users/se00678ml/Projects/ace-app`. Never use `sudo`. Never run destructive commands (`rm -rf`, `git push --force`, DB migrations, `chmod -R`) without explicit confirmation.
- **filesystem**: Scoped to `/Users/se00678ml/Projects/ace-app` and `/Users/se00678ml/Downloads`.
- **sequential_thinking**: Required for any task involving more than 2 files. Also required for audits, refactors, and multi-file debugging.
- **memory**: Store durable architectural facts, decisions, and project conventions. Do NOT store secrets, PII from Bybit tickets, or ephemeral debugging details. Before starting a complex task, search memory for prior context.
- **context7**: Preferred over web-search when the question is "how does library X work" — pulls live docs directly.
- **web-search / web-fetch**: Use when library docs or syntax are uncertain, or for 2026 current info.
- **firecrawl**: For structured scrapes and multi-page research. Prefer over puppeteer when the task is "extract info from the web" rather than "drive a browser".
- **chrome-devtools**: For UI bugs, performance traces, network inspection. Always runs with `--isolated` — doesn't touch the real browsing profile.
- **playwright**: For scripted UI tests and repeatable flows.

---

# ACE (Bybit Co-Pilot) — Project Invariants

These are non-negotiable for the `ace-app` project:

- **No backend services.** All AI calls go directly from the local app to `api.anthropic.com`. Do not re-introduce Base44 or any external orchestration layer.
- **PII scrubbing is the security boundary.** Every outbound API call carrying user/customer content must pass through the scrubber (UID, email, phone, user-specific TX hashes, customer-owned wallet addresses). Treat it like auth.
- **Modules stay independently testable**: quick-lookup, escalation-builder, chain-lookup (80+ chains), response-drafter, tone-QA, PII-scrubber, probation-prep.
- **Audit after every security-relevant change.** If a change touches the API client, auth, or the scrubber, run a full audit with `sequential_thinking` enabled. Report as critical / high / medium / low.

---

# Security Reflexes

- **Hardcoded API keys** in any file → stop, flag immediately, suggest rotation, rewrite using env vars or `${input:...}` prompts. Never pass through.
- **Silent catches** (`catch (e) {}`) → always either rethrow or log with context.
- **Code reading chat history, clipboard, or auth tokens** → treat as sensitive path, route through PII scrubber even for "just logging".
- **New dependencies** → check publisher, download counts, recent activity before accepting. Pin the lockfile.
- **Error messages** → sanitize before they leave the app or hit disk. No raw stack traces in user-facing output.
- **When reviewing**: always ask — what if the input is malicious? What if the network drops mid-write?

---

## UI/UX & Accessibility Rules

### Accessibility (Critical)

- Contrast: 4.5:1 (normal text), 3:1 (large text).
- Visible focus rings: never remove `outline` without a `focus-visible` replacement.
- `aria-label` on all icon-only buttons; descriptive `alt` on images.
- Every input must have a `<label>` with `htmlFor`.

### Interaction & Performance

- Touch targets: min 44×44px. Use `cursor-pointer` on all clickables.
- Transitions: 150–300ms. List properties explicitly — never use `transition: all`.
- CLS prevention: explicit `width`/`height` on `<img>`.
- Async states: show skeleton screens or spinners; disable submit buttons during load.
- Animation: `transform`/`opacity` only. Respect `prefers-reduced-motion`.

### Layout & Styling (Tailwind)

- Mobile: min 16px text. No horizontal scroll.
- Z-index scale: 10 (dropdown), 20 (sticky), 30 (modal), 50 (toast).
- Text: `text-wrap: balance` for headings, `text-pretty` for body.
- Colors: body `text-slate-900`, muted `text-slate-600`, borders `border-gray-200`, hovers `hover:bg-slate-50`.
- No `scale` transforms that shift layout.

### Copy

- Active voice: "Save changes" not "Changes will be saved".
- Numeric: "8 projects" not "eight projects".
- Specific CTAs: "Save API Key" not "Submit".
- Errors: always include a suggested fix or next step.

---

# Communication

- Be direct. Skip the "Great question!" preamble.
- If I'm asking a question that suggests a misunderstanding, correct me — don't just answer the literal question.
- Say when you don't know. Prefer "I'd need to check X" over confident guessing.
- Paraphrase, don't parrot, when summarizing search results. Short quotes only when exact wording matters (error messages, spec text, contract addresses).

---

# MEMORY
<!-- Claude records lessons learned here to avoid repeating mistakes -->