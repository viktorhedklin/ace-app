# ACE App Changelog

## 2026-04-09 — Session 2: KB Local + Probation Coach

### Sentinel / Remote Sync Removed
- Removed GitHub API sync plumbing from `claude.js` (parseGitHubUrl, fetchFromGitHub, GH token storage, ACE_SENTINEL_KB_URL)
- Removed GitHub token input field and "Connect to ace-sentinel" preset from `KnowledgeManager.jsx`
- Removed auto-sync on startup from `AceContext.jsx`
- Added one-time cleanup of leftover `ace_gh_token` from localStorage
- Kept Base44 URL purge (cleanup only) and basic manual sync URL field for generic JSON endpoints
- **Result:** ACE is now 100% local. 47 KB articles live in `bybitKB.js`. No remote dependencies.

### Probation Prep — Full Rebuild
Rebuilt `ProbationPrep.jsx` from a generic probation recovery guide into an AI-powered 3-month presentation coach:

- **Readiness Score** — Circular progress meter (0-100%) weighted across checklist, notes, topics, Q&A prep
- **Daily Focus Banner** — Dynamic coaching based on days remaining until April 18 deadline
- **Pre-Presentation Checklist** — 10 items (7 critical) with persistent progress tracking
- **Attendees Panel** — All 6 required attendees with roles listed
- **Self Introduction Section** — 8 structured talking points with note fields + AI "Coach Me" review
- **Department Introduction Section** — 5 talking points with notes + AI coaching
- **Product Walkthrough Section** — Topic selector (pick 2), notes per topic, KB auto-reference from bybitKB.js, AI coaching
- **Q&A Drill Mode** — Random question picker, answer input, AI evaluation with score (1-10) and improvement tips
- **12 practice Q&A questions** — Bybit-specific, with tips per question and persistent answer notes
- **Generate Full Script** — Compiles all notes into a complete presentation script via Claude API
- **Rehearsal Timer** — 30-min countdown with color-coded section markers (Self Intro → Dept → Product)
- **All state persists in localStorage** (`ace_probation_prep` key)

### Files Changed
- `src/api/claude.js` — Removed GH token/API code, simplified syncKnowledgeFromRemote
- `src/components/KnowledgeManager.jsx` — Removed GH token UI, sentinel preset, unused imports
- `src/context/AceContext.jsx` — Replaced auto-sync with one-time cleanup, removed unused ref
- `src/pages/ProbationPrep.jsx` — Complete rewrite (static checklist → AI-powered coach)

---

## 2026-04-08 — Session 1: Brain Transplant + Base44 Removal

### Initial Setup
- ACE app created as standalone React + Vite + Tailwind project
- Full brain transplanted from Base44 V1 (ace-app-old-copy)
- Claude Opus API integration (direct Anthropic API, streaming SSE)
- 47 Bybit KB articles embedded in `bybitKB.js` (KYC, Account, Crypto, Fiat, P2P, EU-specific)
- Error code map (25+ codes), regional policies (EU/Dubai/HK/Global), escalation table
- SecurityModule for PII scrubbing (GDPR compliant)
- Magic Paste, VIP system, Ghost Mode, Snippets, Command Palette, NBA engine
- Plan/Deep reasoning modes, auto-memory tagging
- Base44 permanently excluded
