# 06 — Collabs

Find people to make music with. **This is the module that makes ShoutOut a network rather than a booking tool.**

## Why it matters more than it looks

Gig booking is transactional — a manager comes back when there is a date to fill. **Collaboration is daily.** A producer opens the app on a Tuesday afternoon with no gig in sight, looking for a topliner.

It also needs no cold start. Two producers and one vocalist is already a working network. No organisers to acquire, no season to produce, no sales team.

And every closed collab writes a split sheet, which populates the Credits registry for free.

## The seven kinds

| Kind       | Example                                                   | Terms usually        |
| ---------- | --------------------------------------------------------- | -------------------- |
| `track`    | Producer needs a vocalist and a songwriter, independently | Fee, points, or both |
| `band`     | Guitarist needs a drummer and a bassist to form a band    | Equity in the band   |
| `crew`     | Artist needs a tour manager and FOH for a five-date run   | Day rate or run rate |
| `engineer` | Rapper needs a mix and master                             | Fee per track        |
| `visual`   | Artist needs a video director and a cover artist          | Project fee          |
| `session`  | Band needs a tabla player for one track, remote           | Session fee          |
| `mentor`   | Emerging producer wants a mix teardown                    | Session fee          |

Adding a kind is a value in the check constraint plus a requirements schema. No new table.

## Independent slots — the defining feature

One request carries up to six slots. **Each fills independently, with its own role, requirements, terms and deadline.** A request can be half-closed.

```
REQUEST  "Hindi R&B — need topline + vocal"
  by @kalmi_beats   ·   92 BPM · A minor · nocturnal, restrained
  attached: beat_v3.mp3 + reference generated in Studio

  SLOT 1   songwriter · Hindi · R&B        terms: 15% writer split
  SLOT 2   vocalist   · female · Hindi     terms: ₹12,000 flat + 5% master

  deadline 14 days      visibility: open

→ each slot matched separately against its own role pool
→ applicants attach a 30-second demo recorded against the actual beat
→ producer picks per slot → split sheet auto-drafted from both slots
→ all three sign → escrow funds slot 2 → stems release
→ splits register to Credits
```

Cash for one, points for the other, on the same request, closed at different times.

## Split sheet before file transfer — the non-negotiable rule

**No full-quality stems are released until every slot's split is agreed and signed.** Watermarked previews only before that. There is no override path and no admin bypass.

Captured: writer share and master share **declared separately**; work-for-hire vs co-write per contributor; PRO affiliation if known; territory and term if non-standard.

The industry's oldest and most corrosive problem is undocumented splits discovered years later when money finally arrives. **Making the split a precondition of the file transfer, rather than an afterthought, is the single most valuable design decision in the product.**

On signature it writes straight into Credits — no data entry, ever.

## Rooms

Opens automatically when a slot is accepted.

- Versioned stem uploads, immutable, full history
- Reference tracks
- Threaded chat with presence via Supabase Realtime
- The split sheet
- Deadline countdown, escrow state, revision counter against the agreed policy

**Version discipline:** every upload is versioned and immutable. Disputes are resolved from version history, which makes the Room the evidence log.

Mobile first — people record vocals on a phone.

## Matching

Calls `packages/discovery` with collab weights. **Attribute fit is what wins here**, not genre tags:

- Vocal range against the song's key
- Language against the lyric language
- Timbre tags against mood
- BPM comfort against the track
- Turnaround against the deadline

Semantic layer: embeddings over `MUSIC_BRIEF` so _"nocturnal, restrained, late-night"_ matches a vocalist tagged _"smoky, low-register, R&B"_ without either party using the same words.

## Demo-to-request

Upload a hum, a phone voice note, or a rough loop:

1. `apps/workers` extracts BPM, key and mood
2. `packages/intent` drafts a `MUSIC_BRIEF`
3. The composer opens pre-filled
4. User confirms and posts

**Lowest-friction entry path in the product**, and it converts the least articulate users — often the most talented ones.

Target: voice note to published request in under 60 seconds.

## Trust and safety

- Verified identity (phone + PAN) required before any **paid** slot. Free collabs stay lighter-weight.
- Work-for-hire vs co-write declared up front on every slot — ambiguity here is where relationships die
- Watermarked previews both directions: beats going out **and** vocal takes coming back
- Reliability score per role, decaying with inactivity. New users get a provisional band, never a zero — a cold-start penalty kills supply.
- Dispute path freezes escrow and surfaces version history
- Rate limits on posting and applying

## Acceptance criteria

- A request with a songwriter slot on points and a vocalist slot on a fee closes each independently
- Full-quality stems are unreachable until every split is signed — proven by test
- Voice note to published request in under 60 seconds
- 100% of closed collabs have a signed split sheet in Credits
