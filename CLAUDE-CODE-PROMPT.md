We're going to redesign Ace's UI. Major visual overhaul — not a tweak. Read everything in this prompt before starting.
 
## Context
 
- I'm Viktor. You have `CLAUDE.md` already loaded. Re-read it if you need to — its UI/a11y rules still apply as hard constraints.
- Ace is my Bybit support co-pilot. It's working and I don't want to break functionality, I want to rebuild the LOOK while leaving the logic untouched.
## Step 1 — Read the design system first
 
Before writing a single line of code, read `ACE-DESIGN-SYSTEM.md` in the project root. This is the source of truth for colors, typography, glow tiers, spacing, and component patterns. Do not improvise on these. If something isn't specified in the design system, ask me before inventing it.
 
Also read the current `tailwind.config.js` and the main CSS / global stylesheet so you understand the existing setup.
 
## Step 2 — Plan
 
Use `sequential-thinking` to produce a redesign plan. Cover:
 
1. A list of every file you'll need to touch, grouped by: (a) global tokens/config, (b) shared layout components (sidebar, nav, app shell), (c) the Dashboard page specifically, (d) any shared UI primitives (button, card, badge, alert).
2. A proposed order of work. I want Dashboard to be the pattern-setter — nail it before touching anything else.
3. Any risks: places where the new design system clashes with existing component APIs, or where a rebuild might inadvertently break state/logic.
4. A list of "design decisions not specified in the system" that you want me to confirm before you proceed.
Show me the plan. Wait for my go-ahead. Do not touch files yet.
 
## Step 3 — Implement Dashboard first
 
Once I approve the plan, build ONLY the Dashboard page. That's:
 
- The app shell (sidebar, nav, atmospheric background) redesigned per the system
- The greeting + subgreeting row
- The 4-KPI row (Cases Today is Tier 1 live, others are Tier 0)
- The primary CTA ("Start a case") with Tier 2 glow, gradient, and sheen-sweep on hover
- The two-column panel row: Efficiency Heatmap (left) + Needs-Attention alert (right, Tier 3)
- The Chat Channels grid below
Use the existing component file structure as much as possible — I don't want a 100-file diff. Prefer editing in place over renaming files. Keep existing component names where reasonable.
 
**Typography setup**: Add the Chakra Petch + JetBrains Mono Google Fonts link to the app's root HTML (likely `index.html`). Then wire these into `tailwind.config.js` as `font-display` and `font-mono`, and update the CSS variables / Tailwind theme to match the tokens in the design system. If the project uses a tokens file, update that instead.
 
**Colors**: Expose every color token from the design system as a CSS custom property on `:root` (in the global stylesheet) AND as a Tailwind color. This gives us runtime flexibility and authoring convenience. Use the exact hex values from the design system — do NOT round or "improve" them.
 
**Glow tiers**: Implement as utility classes OR design tokens — whichever fits the existing codebase better. Each tier gets its own named box-shadow, not `shadow-cyan-500/20` Tailwind defaults. The live-pulse and crit-pulse keyframes should go in the global stylesheet.
 
## Step 4 — Screenshot and self-critique
 
After Dashboard is built, use `chrome-devtools` MCP to:
 
1. Navigate to the running dev server (likely `http://localhost:5173` or whatever Vite outputs — run `npm run dev` first if not already running, and wait for it to boot).
2. Take a full-page screenshot of the Dashboard.
3. Take zoomed screenshots of: (a) the KPI row focused, (b) the CTA mid-hover, (c) the alert panel.
4. Critique your own output against the design system. Specifically check:
   - Are the colors using the exact tokens (verify computed styles via chrome-devtools)?
   - Is Chakra Petch actually loading and rendering? (Check computed `font-family` on a greeting — if it says "sans-serif" as fallback, the font didn't load)
   - Is the live-pulse animation running on the Cases Today card?
   - Is the CTA sheen-sweep working on hover?
   - Is the alert crit-pulse animating?
   - Is the atmospheric background gradient visible behind the dashboard?
5. If anything is off, fix it. Re-screenshot. Iterate until it matches the design system. Don't ask me for feedback until you're satisfied with your own output.
## Step 5 — Show me
 
Once you're done iterating, show me the screenshots and summarize:
 
- What changed (at a file level, brief)
- What you verified via chrome-devtools (which tokens, which animations, which contrast ratios)
- Anything you're unsure about or where you deviated from the design system (with reasoning)
- What isn't done yet (we're only doing Dashboard in this pass)
I'll review and send you feedback. Then we tackle the next screen.
 
## Hard rules, regardless of anything else
 
- **Do NOT touch application logic, state management, API calls, or business logic.** This is pure visual/styling work.
- **Do NOT remove the emoji icons** in the sidebar. They're part of Ace's personality.
- **Do NOT replace the amber "Ace" wordmark** with something cyan — amber stays as the brand logo. Cyan is the UI accent.
- **Do NOT introduce new dependencies** without asking me first.
- **Do NOT skip the `sequential-thinking` planning step** — I want to see the plan before you build.
- **Do NOT ship anything that breaks the existing build.** Run `npm run build` before declaring done.
- **If you're unsure about a design decision, ask me.** Don't invent.
Go.