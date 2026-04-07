# Project Guidelines

## Tech Stack
React, Node.js — functional components, Tailwind CSS for all styling.

## Testing
Always run `npm test` after changes.

---

# NUCLEAR MODE

## Critical Workflow
1. **PLAN** — Use `sequential_thinking` for any task touching more than 2 files. Never skip the planning phase.
2. **RESEARCH** — If a library version or API is unknown, use `web-search` or `web-fetch` to get current 2026 docs.
3. **EXECUTE** — Use `filesystem` to read/write files in `/Users/se00678ml/Projects/ace-app`.
4. **VERIFY** — Use `terminal` to run the app or tests after every significant change. Never assume code works.

## Tool Usage Rules
- **terminal**: Only run commands within `/Users/se00678ml/Projects/ace-app`. Never use `sudo`.
- **filesystem**: Scoped to `/Users/se00678ml/Projects/ace-app` and `/Users/se00678ml/Downloads`.
- **sequential_thinking**: Required for any task involving more than 2 files.
- **web-search / web-fetch**: Use when library docs or syntax are uncertain.

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

# MEMORY
<!-- Claude records lessons learned here to avoid repeating mistakes -->
