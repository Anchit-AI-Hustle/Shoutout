# 04 — Profiles

Be findable and bookable. The identity layer every other module reads.

## The core idea

**One account holds many roles at once.** A person is an artist _and_ a producer _and_ a mix engineer _and_ someone's manager — not one of those, chosen at signup. Matching happens **per role**, never per person.

This is why `artist_roles` is a separate table with `unique (artist_id, role)`, and why `packages/trust` scores reliability per role. A brilliant producer can be an unreliable mix engineer, and the product has to be able to say so.

## Role vocabulary

| Family          | Roles                                                                                | Match attributes                                                    |
| --------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| **Voice**       | vocalist, topliner, rapper, backing vocalist, harmony singer, voice-over             | range, timbre tags, languages, accent, key comfort, sung vs rapped  |
| **Writing**     | songwriter, lyricist, hook writer, composer, arranger, translator                    | languages, themes, genres, co-write vs work-for-hire                |
| **Production**  | beat producer, instrumental producer, sound designer, programmer                     | genres, BPM range, typical keys, DAW, signature tags, turnaround    |
| **Engineering** | mix, mastering, vocal editor, tuning                                                 | genre specialism, stem capacity, revision policy, loudness targets  |
| **Players**     | guitar, bass, drums, keys, tabla, sitar, flute, strings, brass, percussion           | instrument, style, reading vs by-ear, remote vs in-person, home rig |
| **Stage**       | DJ, live band member, hype, MD, backline tech, FOH engineer                          | city, travel radius, rate band, rider needs                         |
| **Visual**      | video director, DOP, editor, VFX, cover artist, photographer, stylist, choreographer | style tags, budget band, turnaround, showreel                       |
| **Business**    | manager, booking agent, publicist, label scout, studio owner                         | roster size, genres, territories, terms                             |

Adding a role is a row in the vocabulary plus an attribute schema. No migration.

## Profile completion

The single most important funnel in the product, because supply is the constraint.

| Step                | Trigger                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------- |
| Account created     | Phone OTP. No password, ever.                                                                     |
| First role declared | Onboarding, one question                                                                          |
| Attributes filled   | Pre-filled from an uploaded track via Studio analysis — **the user confirms rather than authors** |
| Proof media added   | One track or clip per role                                                                        |
| EPK generated       | Automatic once the above exist                                                                    |

**Pre-filling from audio is the highest-leverage feature here.** An empty form converts badly; a form that already knows the BPM, key and genre of the track they just uploaded converts well.

## EPK

Auto-generated from the profile plus best media. Public, indexable, downloadable as PDF.

- Bio drafted by Claude from the artist's own material — **human-editable, never auto-published**
- Best three tracks, photos, verified credits pulled from the Credits module
- Past venues from settled bookings
- Fee band shown **only if the artist opts in** — forcing it costs supply
- Contact routed through ShoutOut, never a raw phone number
- Schema.org `MusicGroup` + `Person`, ISR-rendered

**Give the EPK away free to every rejected auditionee.** It is the single strongest reason they complete a profile.

## Verification

| Level        | Requires                    | Unlocks                         |
| ------------ | --------------------------- | ------------------------------- |
| Basic        | Phone OTP                   | Browse, apply to unpaid collabs |
| Verified     | PAN or equivalent           | Paid collabs, gig applications  |
| KYC complete | Penny-drop bank + PAN check | Receiving payouts               |

## Public pages

```
/a/[slug]              artist profile, ISR — the SEO engine
/a/[slug]/epk          downloadable PDF
/m/[slug]              manager or agency page
/v/[slug]              venue page
```

One page per artist, server-rendered. A competitor with 30,000 artists and no SEO strategy has 30,000 wasted pages.

## Acceptance criteria

- One user can hold five roles and be matched independently on each
- Profile attributes pre-fill from an uploaded track in under 60 seconds
- EPK generates with no manual authoring required
- A public profile is indexable and passes Core Web Vitals on 4G
- Fee band is hidden by default
