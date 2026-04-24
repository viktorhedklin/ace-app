# Ace — Design System v1.0

**Status**: Active
**Owner**: Viktor
**Aesthetic direction**: Modern AI co-pilot · futuristic but restrained · Perplexity-editorial-meets-terminal · warm dark teal · precise cyan

This document is the source of truth for Ace's visual system. Every UI change must honor these rules. When in doubt, re-read this file.

---

## Design principles

1. **Calm under pressure.** Viktor uses Ace during high-stakes customer support. Nothing in the UI should add cognitive load. Motion and glow are rare, meaningful, and never purely decorative.
2. **Glow is precious.** ~80% of the UI has no glow at all. The 20% that does earns it by being live, active, or critical.
3. **Typography carries the personality.** Chakra Petch gives Ace its futuristic voice. Don't undermine it with generic system fonts.
4. **Data has its own voice.** Monospace for transaction hashes, timestamps, labels. Sans for human content. Never mix.
5. **Every animation is 180–260ms.** Faster feels janky, slower feels laggy.
6. **Red is sacred.** Red means ESCALATE. Never use red decoratively. Never use red in hover states for normal actions.

---

## Color tokens

All colors live as CSS variables at `:root`. Never hardcode hex in components.

### Surfaces — warm dark teal, never pure black

```css
--bg-0: #0E1519;   /* page background, the darkest layer */
--bg-1: #131E23;   /* primary surface (cards, main panels) */
--bg-2: #1A282F;   /* elevated surface (KPIs, secondary cards) */
--bg-3: #22343C;   /* hover states, highest layer */
```

### Text — neutral off-white, never pure white

```css
--fg-0: #EAECEE;   /* primary text, headings */
--fg-1: #B4C0C5;   /* secondary text, body */
--fg-2: #7E8F95;   /* muted text, captions, labels */
--fg-3: #4F5F66;   /* disabled, dividers */
```

### Hero — cyan (the only UI accent color)

```css
--hero: #22D3EE;              /* the hero */
--hero-soft: #0E7490;         /* gradient middle */
--hero-deep: #164E63;         /* gradient base */
--hero-glow-a: rgba(34, 211, 238, 0.12);  /* tier 1 glow */
--hero-glow-b: rgba(34, 211, 238, 0.24);  /* tier 2 glow */
--hero-glow-c: rgba(34, 211, 238, 0.42);  /* tier 2 hover */
```

### Brand — amber (LOGO ONLY, never UI accent)

```css
--brand-amber: #F5B544;   /* the Ace wordmark in the sidebar. nowhere else. */
```

### Semantic states

```css
--ok: #34D399;        /* success, within SLA, credited */
--warn: #FBBF24;      /* pending, needs attention but not urgent */
--crit: #F87171;      /* ESCALATE, missed SLA, error */
--info: #60A5FA;      /* neutral info, email tags */
--crit-glow: rgba(248, 113, 113, 0.32);
```

### Borders — almost invisible, suggest rather than frame

```css
--border-0: rgba(234, 236, 238, 0.06);    /* default card border */
--border-1: rgba(234, 236, 238, 0.10);    /* hover state border */
--border-hero: rgba(34, 211, 238, 0.22);  /* hero-state border */
```

---

## Typography

### Font stack

```css
--font-display: 'Chakra Petch', system-ui, sans-serif;   /* headings, CTAs, KPI numbers, nav */
--font-body: 'Chakra Petch', system-ui, sans-serif;      /* body copy, form labels — yes, same font */
--font-mono: 'JetBrains Mono', 'SF Mono', Consolas, monospace;  /* TXN hashes, timestamps, labels, KPI captions */
```

Load from Google Fonts:
```html
<link href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

### Type scale

| Use case | Family | Size | Weight | Letter-spacing | Line-height |
|----------|--------|------|--------|----------------|-------------|
| Display (greetings, page heroes) | Chakra Petch | 34px | 600 | 0.005em | 1.1 |
| H1 (page titles) | Chakra Petch | 24px | 600 | 0.005em | 1.2 |
| H2 (section headings) | Chakra Petch | 18px | 600 | 0.005em | 1.3 |
| H3 (panel titles) | Chakra Petch | 13px | 600 | -0.005em | 1.4 |
| Body | Chakra Petch | 14px | 500 | 0 | 1.55 |
| Body-small | Chakra Petch | 13px | 500 | 0 | 1.5 |
| Caption | Chakra Petch | 12px | 500 | 0 | 1.4 |
| KPI number (hero) | Chakra Petch | 36px | 600 | 0 | 1 |
| KPI label | JetBrains Mono | 10px | 500 | 0.18em | 1.4 (uppercase) |
| Data (TXN, timestamps) | JetBrains Mono | 11-13px | 500 | 0.04em | 1.5 |
| Nav section labels | JetBrains Mono | 9px | 500 | 0.22em | 1.4 (uppercase) |
| Tags / badges | JetBrains Mono | 9px | 600 | 0.12em | 1.2 (uppercase) |

### Typography rules

- Hero/display moments use `color: var(--hero)` on the *emphasized word*, never the whole phrase. Example: "Good evening, <span>Viktor</span>." — Viktor is cyan, the rest is `--fg-0`.
- Uppercase labels (KPI labels, nav sections, badges) MUST use JetBrains Mono. Chakra Petch at uppercase looks stencil-y.
- Never letter-space Chakra Petch past 0.02em in titles — it breaks the font's character.
- Always letter-space JetBrains Mono labels 0.14-0.22em — monospace needs room to breathe.

---

## Glow tier system

Four tiers. Every glowable element belongs to exactly one tier. No exceptions.

### Tier 0 — None (default, ~80% of UI)

No glow. No shadow beyond `--shadow-sm`. This is most cards, most content. Calm, readable, quiet. Glow is precious because it's rare.

```css
box-shadow: 0 1px 2px rgba(0,0,0,0.3);
```

### Tier 1 — Ambient (live data)

Cards containing data that updates in real time. Soft outer glow, plus a pulsing dot in the corner.

```css
border-color: var(--border-hero);
box-shadow: var(--glow-1);

/* Pulsing dot */
.live-indicator {
  position: absolute;
  top: 14px; right: 14px;
  width: 7px; height: 7px;
  border-radius: 50%;
  background: var(--hero);
  box-shadow: 0 0 10px var(--hero);
  animation: live-pulse 1.8s ease-in-out infinite;
}

@keyframes live-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.4); }
}
```

Use sparingly — 1 to 2 per screen maximum.

### Tier 2 — Active (hero CTAs, selected states, focused inputs)

Medium glow. Intensifies on hover. This is where the hero color earns its keep.

```css
background: linear-gradient(135deg, var(--hero-deep) 0%, var(--hero-soft) 50%, var(--hero) 100%);
box-shadow: var(--glow-2);

/* Hover */
box-shadow: 0 0 52px var(--hero-glow-c), 0 0 1px var(--hero-glow-c) inset;
transform: translateY(-1px);
```

CTAs also get a sheen-sweep animation on hover:

```css
.cta::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.2) 50%, transparent 70%);
  transform: translateX(-100%);
  transition: transform 700ms cubic-bezier(0.2, 0, 0.2, 1);
}
.cta:hover::before { transform: translateX(100%); }
```

### Tier 3 — Critical (ESCALATE, errors, missed SLAs)

Animated RED glow. Pulses. Demands eyes. **Red regardless of hero color** — critical is critical.

```css
background: linear-gradient(135deg, rgba(248, 113, 113, 0.08), rgba(248, 113, 113, 0.03));
border: 1px solid rgba(248, 113, 113, 0.32);
animation: crit-pulse 2.4s ease-in-out infinite;

@keyframes crit-pulse {
  0%, 100% { box-shadow: 0 0 28px var(--crit-glow), 0 0 1px var(--crit-glow) inset; }
  50%      { box-shadow: 0 0 44px rgba(248,113,113,0.5), 0 0 1px rgba(248,113,113,0.5) inset; }
}
```

Rules for Tier 3:
- **Never** use Tier 3 for non-critical things (e.g. filter chips, decorative borders)
- **Always** include a visible red text label and a destructive action or escalate button
- **One Tier 3 element per screen at a time.** If two things need attention, queue them

---

## Spacing scale

Use a 4px base unit. Valid values only: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96`.

Common patterns:
- Card padding: `16-20px`
- Section gaps: `20-24px`
- Page-level padding: `32-40px`
- Tight inline gaps (icon + text): `8-10px`
- KPI row gap: `12px`

---

## Border radius

| Element | Radius |
|---------|--------|
| Tiny (tags, badges) | 4px |
| Small (inputs, small buttons) | 6-8px |
| Medium (cards, panels) | 10-12px |
| Large (top-level containers) | 16-20px |
| Fully round (pulse dots, pills) | 9999px |

Never mix radii randomly within a component. Keep it consistent per tier.

---

## Motion

**Every transition is 180-260ms with `cubic-bezier(0.2, 0, 0.2, 1)`.** This easing is snappy at the start, smooth at the end.

```css
transition: all 220ms cubic-bezier(0.2, 0, 0.2, 1);
```

Never use `transition: all` in production CSS — always list the specific properties (follows `CLAUDE.md`):

```css
transition:
  background-color 220ms cubic-bezier(0.2, 0, 0.2, 1),
  border-color 220ms cubic-bezier(0.2, 0, 0.2, 1),
  transform 220ms cubic-bezier(0.2, 0, 0.2, 1),
  box-shadow 220ms cubic-bezier(0.2, 0, 0.2, 1);
```

Respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Shadows (non-glow depth)

```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
--shadow-md: 0 4px 16px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.3);
--shadow-lg: 0 12px 40px rgba(0, 0, 0, 0.5), 0 2px 8px rgba(0, 0, 0, 0.3);
```

Use shadows for layered depth, glows for signal. Don't combine them on the same element.

---

## Atmospheric background

The app body gets a fixed gradient atmosphere that never scrolls. Subtle, not decorative.

```css
body::before {
  content: '';
  position: fixed;
  inset: 0;
  background:
    radial-gradient(ellipse 1000px 600px at 85% -10%, var(--hero-glow-a) 0%, transparent 60%),
    radial-gradient(ellipse 700px 400px at 10% 110%, rgba(14, 116, 144, 0.10) 0%, transparent 60%);
  pointer-events: none;
  z-index: 0;
}
```

---

## Component patterns

### KPI card

```
[bg-2 card, 12px radius, border-0]
  [label — Mono, 10px, uppercase, 0.18em, --fg-2]
  [value — Chakra Petch, 36px, 600, --fg-0]
  [delta — Mono, 11px, --fg-2 or --ok for positive]

if .live:
  border-color: --border-hero
  box-shadow: --glow-1
  + pulsing dot top-right
```

### Primary CTA

```
[gradient background: hero-deep → hero-soft → hero]
[border: 1px --border-hero]
[color: #021418 (very dark, for contrast on cyan)]
[font: Chakra Petch, 15px, 700]
[padding: 18px]
[border-radius: 12px]
[box-shadow: --glow-2]
[sheen-sweep on hover]
[translateY(-1px) on hover]
```

### Alert (Tier 3 critical)

```
[red-tinted background gradient]
[red border 32% opacity]
[animated crit-pulse shadow]
Structure:
  [alert-head: red dot + title + ESCALATE badge]
  [alert-body: --fg-1, 13px, line-height 1.5]
  [alert-meta: mono row with TXN, SLA, priority]
```

### Nav item (sidebar)

```
Default:
  [padding: 9px 10px]
  [radius: 8px]
  [color: --fg-1]
  [hover: bg --bg-2, color --fg-0]

Active:
  [background: linear-gradient(90deg, --hero-glow-a, transparent)]
  [color: --hero]
  [left-edge indicator: 2px --hero bar, box-shadow glow]
```

### Channel card

```
[bg-2, 10px radius, --border-0]
[padding: 14px]
[hover: --border-hero, translateY(-1px), ambient cyan gradient in top-right corner]
```

---

## Accessibility reminders

These override aesthetic decisions:

- **Contrast**: 4.5:1 for body, 3:1 for large text (18px+)
- **Focus rings** must be visible. Use `--hero` as the focus ring color: `box-shadow: 0 0 0 2px var(--hero)`
- **Touch targets**: 44×44px minimum
- **Every input has `<label htmlFor>`**
- **`aria-label`** on all icon-only buttons (but keep emoji buttons — the emoji is the label)
- Respect `prefers-reduced-motion`

---

## What NOT to do

- ❌ Don't use amber anywhere except the "Ace" wordmark
- ❌ Don't use red for non-critical UI (filter pills, hovers, decorative borders)
- ❌ Don't add glow to elements that aren't Tier 1/2/3
- ❌ Don't use pure black (`#000`) or pure white (`#FFF`) — use the tokens
- ❌ Don't use `transition: all`
- ❌ Don't use Chakra Petch for tiny uppercase labels — use JetBrains Mono
- ❌ Don't use `scale()` transforms on interactive elements — shifts layout
- ❌ Don't replace the emoji icons in the sidebar — they're part of Ace's personality
- ❌ Don't introduce a third font family without a very good reason

---

## Questions not yet decided

- Do we want a light mode? (currently no — Ace is dark-only until proven otherwise)
- Quick-action keyboard shortcuts — should they use `⌘` symbol or spell out "Cmd"? (lean toward `⌘`)
- Does the live-pulse indicator need to pause on hover or stay active? (lean toward pause)