# 05 — Gigs

Get booked, and book acts. All circuits, all genres.

## The circuits

Different money, different behaviour, different buyer. The product must serve all of them.

| Circuit              | Who books                         | How money moves                                         | Typical fee |
| -------------------- | --------------------------------- | ------------------------------------------------------- | ----------- |
| Wedding / sangeet    | Planners and brokers              | Cash-heavy, fastest payment                             | ₹50k–5cr    |
| Corporate / MICE     | Agency, procurement               | PO + invoice, 60–90 day terms                           | ₹1L–50L     |
| Clubs / DJs          | Promoter                          | Guarantee vs door split                                 | ₹15k–5L     |
| Festivals            | Booker / curator                  | 6–9 month lead, contracts exist                         | ₹50k–40L    |
| College fests        | Student committee                 | Sponsor-funded, worst delays, zero institutional memory | ₹50k–25L    |
| Folk / devotional    | Local organisers                  | Seasonal, cash, most exploited                          | ₹5k–1L      |
| Classical            | Sabhas, trusts, government bodies | Honorarium, grant-funded, slow                          | ₹15k–5L     |
| Government / tourism | Tender or department              | Largest volume, slowest payment                         | ₹50k–20L    |

**Sequencing note:** enter through the circuits where money is already digital — corporate, festivals, clubs, government. The wedding circuit is the biggest pool and resists digitisation hardest; approach it later with verification and recourse as the pitch, not price transparency.

## The flow

```
brief intake → shortlist → quote → hold → contract → advance → rider → performed → settled → index → re-book
```

### 1. Brief intake

Three paths, because this is how briefs actually arrive:

- Web form
- **Forwarded WhatsApp message, auto-parsed**
- **PDF upload, auto-parsed**

Parsed by Claude into structured fields, Zod-validated. Target: >90% accuracy on date, city, budget, genre, crowd size — measured against human review on a rolling sample.

Edge cases: absent budget → infer band from crowd size and city, flag as `budget_inferred`. Date range → multi-date brief, availability checked across all. Lineup → child briefs.

### 2. Shortlist

Calls `packages/discovery` with gig weights: genre fit, city fan density, fee band, **live availability from `packages/calendar`**, organiser settlement reliability.

Never surface an artist already held on that date. Always return `score_components` — an unexplained ranking is not trusted.

### 3. Quote

Pulls p25/p50/p75 from `benchmark_index`. Attaches the EPK. Manager edits or sends in one tap.

**Critical rule: the system never invents a price.** If the cell has `sample_n < 5`, show "insufficient data" and let the manager price manually. That manual price then feeds the index.

### 4. Hold

See `packages/calendar`. Every soft hold has a mandatory expiry. Hold 1 has right of first refusal; when challenged it has 48 hours to confirm or drop. Auto-release fires from a scheduled job, never a user action.

**A missed release causes a double-booking — a reputational event for the manager, not merely a bug.** 99.99% reliability required.

### 5. Rider

Backline, travel, hotel, soundcheck time, hospitality. Travels with the booking. Both sides tick off. Reminders at T-7 and T-2. Reusable templates per artist.

Day-of disputes are routine and the artist absorbs the cost. A timestamped, confirmed checklist ends that.

### 6. Settlement

See `docs/09-PAYMENTS.md`.

### 7. Re-book

Most gigs are annual — weddings, college fests, corporate offsites, festival editions. An Inngest function fires at **T+11 months** to both sides. Cheapest revenue in the model, and a disintermediation defence — it only fires for on-rail bookings.

## Manager OS

The paying product. On Monday morning, one screen answers three questions: **who is booked, who owes me money, who do I call next.**

- Multi-artist roster with per-artist commission and exclusivity
- Pipeline board: enquiry → quoted → held → confirmed → performed → settled
- Shared holds calendar across the whole roster, colour-coded by state
- Quote generator with live index comps
- Commission auto-split across manager, agency, sidemen, artist
- Artist read-only portals — they see their own dates and money, nothing else

**Acceptance: inbound WhatsApp message to sent quote in under 90 seconds, on a phone, at 3G.**

## Acceptance criteria

- A forwarded WhatsApp brief parses to structured fields at >90% accuracy
- A date cannot be double-confirmed across a roster — proven by test
- Auto-release fires within tolerance of `expires_at`
- A quote below `sample_n` 5 returns `insufficient_data`, never a guess
- Rider confirmations are timestamped by both parties
