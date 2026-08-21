# 06 — Design System

`packages/ui`. Built on shadcn/ui with a deliberate position — this is not a default Tailwind theme.

## Two registers

The product spans culture surfaces and money surfaces. They must not look the same.

| | Culture (Collab, Stage, discovery) | Money (Settle, Advance, splits) |
|---|---|---|
| Feel | Warm, high contrast, confident | Precise, quiet, numerate |
| Density | Generous | Tight, tabular |
| Type | Display allowed | Data faces, tabular numerals |
| Motion | Present, purposeful | Minimal |

## Tokens

```css
--ink:        #15181B;   /* primary text */
--ink-soft:   #4E5259;   /* secondary */
--surface:    #E2DED3;   /* app background */
--surface-2:  #D5D0C3;   /* raised */
--line:       #B6B0A1;
--desk:       #1A1E22;   /* nav, headers, code */
--signal:     #C1272D;   /* action, alert */
--trust:      #14456F;   /* money, verified */
--accent:     #E8B33A;   /* active state */
--ok:         #3E6B47;
```

Type scale: `11 · 12 · 13 · 15 · 17 · 21 · 26 · 34 · 48`. Body 15. Never below 11.

Spacing: `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64`. Nothing off-scale.

## Components

| Component | Note |
|---|---|
| `<MoneyValue />` | Dual currency INR + USD, rate from a single config. **Tabular numerals always.** Never a bare number in a money context. |
| `<SplitBar />` | Live running total. Red until exactly 100. The single most important control in the product. |
| `<ShoutComposer />` | Type-aware, driven entirely by the registry. One slot by default; "add another" is secondary. **Never render an empty second slot.** |
| `<SlotCard />` | Role, terms, deadline, status. Comp model always visible. |
| `<ScoreBreakdown />` | Always shown with a ranking. An unexplained score is not trusted. |
| `<HoldCalendar />` | Roster-wide, colour by state, countdown on expiring holds. |
| `<DataList />` | The mobile fallback for every dense table. |
| `<StatusPill />` | One vocabulary across the whole product. |
| `<EmptyState />` | An invitation to act, never an apology. |

## Mobile rules

Managers work backstage, in venues, in cars, on 3G.

- **Mobile first.** Design the 390px view, then widen.
- LCP < 2.5s on 4G. Test on throttled 3G before shipping.
- Minimum 44px tap targets. Audited, not assumed.
- **Dense tables become stacked cards below 760px** — with the column name as a label above each value. Never horizontal scroll for primary content.
- Numeric pairs (INR/USD) sit side by side on cards, not stacked.
- Sticky nav that keeps the active section reachable.
- Safe-area insets for notched devices.

## Copy

- **The verb is the brand:** "Put out a shout." Never "create a listing", never "post a request", never "submit a brief".
- An action keeps its name through the whole flow. "Publish" produces "Published".
- Errors say what happened and how to fix it. They do not apologise and are never vague.
- Say the money part plainly. "Get paid" and "on time" convert. Do not soften to "streamlined settlements".
- Hinglish is allowed and encouraged in Indian in-app and social copy. Clean global English in investor and brand material.
- **Never say "AI music generator."** Studio is a communication tool — it helps you show someone the sound in your head.

## Accessibility floor

WCAG 2.2 AA. Visible keyboard focus everywhere. `prefers-reduced-motion` respected. Every interactive element reachable by keyboard. Colour is never the only signal — status carries a label too.
