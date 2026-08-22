# 08 — Stage

Competition and discovery. Season shows and city leagues across all genres.

## The strategic point

Stage is not a vertical. **It is the artist-acquisition engine for the entire platform.**

A talent season pulls tens of thousands of entries and signs about fifteen. The other 99.9% are the most qualified artist leads in the country — already identified, already serious, already emotionally invested. Every existing format throws them away.

```
45,000 submissions  ×  60% rejection-to-profile conversion
= 27,000 activated artists at ≈ ₹40 CAC
vs ₹150–400 on paid social
```

**That single conversion rate is the number the company lives on.** Instrument it above everything else.

## Formats

| Format                                  | Cost    | Note                                                |
| --------------------------------------- | ------- | --------------------------------------------------- |
| Weekly open calls / cypher nights       | Lowest  | Venue-partnered, feeds everything above             |
| City league                             | Low     | Standings, playoffs, franchise-able                 |
| Improv battle (Wild 'N Out style)       | Medium  | Ensemble cast, cheap to produce, high clip velocity |
| Flagship season show (MTV Hustle style) | Highest | Broadcast or OTT, sponsor-funded                    |

**Build clip-first, not broadcast-first.** Film, publish weekly, prove clip velocity and audition volume, then approach OTT with a proven format. The audition funnel — the part that matters to the business — works at a fraction of broadcast cost.

**Season 1 budget cap: ₹18L ($21,176).** If CAC per activated artist exceeds ₹120, the format is wrong, not underfunded.

## Genre brackets

Separate brackets for hip-hop, electronic, indie, Punjabi, folk-fusion, classical crossover, devotional.

**Not decoration.** High-volume hip-hop would otherwise crowd out folk and classical entirely — and the folk, devotional and classical circuits are where government, tourism and corporate money already sits. Brackets protect the supply that leads to the highest-value bookings.

## Audition intake

- Multi-language landing pages per bracket and city
- **Phone OTP entry. No password, no app install.** The funnel cannot ask 45,000 people to create an account.
- Sub-90-second video, signed direct upload to R2 from the phone
- 90-second hard cap enforced client **and** server side
- Resumable upload — connections drop at this scale
- Never proxy video through the API

**Load requirement:** a season opens and 5,000 uploads arrive in an hour. Test for that burst.

## Scoring

Auto-score on submission: audio quality, originality flag, BPM/key/genre from `apps/workers`, engagement history. Claude Opus writes the rationale — low volume, reasoning quality matters more than cost.

Then a **human review queue**. The model rationale is shown; **the model never decides alone.** Reviewer throughput target above 250/hour.

Upload to scored in under 3 minutes. Use the Batch API — audition scoring is not time-sensitive.

## Rejection-to-onboarding — the most valuable automation in the company

On non-selection, an Inngest sequence delivers by WhatsApp:

1. **A real scorecard** with the reviewer's notes — not a form rejection
2. **An auto-generated EPK**, free, theirs to keep
3. **Open gigs in their city**, right now
4. **An invitation** to declare roles and answer collab requests

Then follow-ups at day 7 and day 21 on profile completion.

**Target: >60% of rejected entrants complete a profile.**

## Alumni

Every past entrant persists as bookable supply and as A&R signal — never a dead record.

- Alumni flag with season and placement
- Re-engagement at the next season open
- Alumni surfaced first in gig matching for their city
- Progress (bookings, collabs, earnings) feeds the A&R signal feed

Target: >25% of alumni book within 12 months.

## Public surfaces

```
/stage                       season hub
/stage/[season]/standings    ISR, shareable — drives return visits between episodes
/stage/apply/[bracket]       multi-language intake
```

## Acceptance criteria

- Phone-OTP entry with no password anywhere in the flow
- 5,000 uploads in one hour without degradation
- Upload to scored in under 3 minutes
- Every rejected entrant receives scorecard + EPK + local gigs within 24 hours
- **Rejection → profile completion tracked as the primary metric**
