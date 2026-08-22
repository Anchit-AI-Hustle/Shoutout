# 13 — Design System

`packages/ui`. Built on shadcn/ui with a deliberate position — this is not a default Tailwind theme.

## Two registers

The product spans culture surfaces and money surfaces. **They must not look the same.**

|         | Culture — Collabs, Stage, discovery | Money — Payments, Credits    |
| ------- | ----------------------------------- | ---------------------------- |
| Feel    | Warm, high contrast, confident      | Precise, quiet, numerate     |
| Density | Generous                            | Tight, tabular               |
| Type    | Display allowed                     | Data faces, tabular numerals |
| Motion  | Present, purposeful                 | Minimal                      |

## Tokens

```css
--ink: #15181b; /* primary text */
--ink-soft: #4e5259; /* secondary */
--surface: #e2ded3; /* app background */
--surface-2: #d5d0c3; /* raised */
--line: #b6b0a1;
--desk: #1a1e22; /* nav, headers, code */
--signal: #c1272d; /* action, alert */
--trust: #14456f; /* money, verified */
--accent: #e8b33a; /* active */
--ok: #3e6b47;
```

Type scale: `11 · 12 · 13 · 15 · 17 · 21 · 26 · 34 · 48`. Body 15. Never below 11.
Spacing: `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64`. Nothing off-scale.

## Components

| Component            | Note                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| `<MoneyValue />`     | Dual currency INR + USD from one config. **Tabular numerals always.** Never a bare number in a money context. |
| `<SplitBar />`       | Live running total, red until exactly 100. **The single most important control in the product.**              |
| `<CollabComposer />` | One slot by default; "add another" is secondary. **Never render an empty second slot.**                       |
| `<SlotCard />`       | Role, terms, deadline, status. Comp model always visible.                                                     |
| `<ScoreBreakdown />` | Always shown with a ranking.                                                                                  |
| `<HoldCalendar />`   | Roster-wide, colour by state, countdown on expiring holds.                                                    |
| `<RoleBadge />`      | A person's roles, each independently scored.                                                                  |
| `<DataList />`       | The mobile fallback for every dense table.                                                                    |
| `<EmptyState />`     | An invitation to act, never an apology.                                                                       |

## Mobile rules

Managers work backstage, in venues, in cars, on 3G.

- **Mobile first.** Design the 390px view, then widen.
- LCP < 2.5s on 4G. Test on throttled 3G before shipping.
- Minimum 44px tap targets — audited, not assumed.
- **Dense tables become stacked cards below 760px**, column name as a label above each value. Never horizontal scroll for primary content.
- Numeric pairs (INR/USD) sit side by side on cards, not stacked.
- Sticky nav keeping the active section reachable.
- Safe-area insets for notched devices.

## Copy

- An action keeps its name through the whole flow. "Publish" produces "Published".
- Errors say what happened and how to fix it. They do not apologise and are never vague.
- **Say the money part plainly.** "Get paid" and "on time" convert. Never soften to "streamlined settlements".
- Hinglish is encouraged in Indian in-app and social copy. Clean global English in investor and brand material.
- **Never say "AI music generator."** Studio helps you show someone the sound in your head.
- Name the session players. "Including the session players" is the most credibility-earning clause in the product.

## Accessibility floor

WCAG 2.2 AA. Visible keyboard focus everywhere. `prefers-reduced-motion` respected. Every interactive element keyboard-reachable. **Colour is never the only signal** — status carries a label too.
