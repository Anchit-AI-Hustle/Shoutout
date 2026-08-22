# 12 — API

Route handlers in `apps/web/app/api/<module>/**`. They validate, resolve org from session, call a module, serialise. **No business logic in a handler.**

## Conventions

- Auth: Supabase session cookie. **Org resolved server-side from JWT claims. Never accept `org_id` from the client.**
- Zod at every boundary. `422` with field detail on failure.
- Errors: `{ error: { code, message, details? } }`, codes `SCREAMING_SNAKE`.
- Pagination: cursor-based, `?cursor=&limit=` → `{ data, nextCursor }`. Max limit 50.
- Money: `{ paise: number, display: "₹75,000" }`. Never a bare float.
- `Idempotency-Key` header required on every POST that moves money.

## Error codes

| Code                         | HTTP | Meaning                                           |
| ---------------------------- | ---- | ------------------------------------------------- |
| `UNAUTHENTICATED`            | 401  | No valid session                                  |
| `NO_ACTIVE_ORG`              | 403  | Session has no org claim                          |
| `FORBIDDEN`                  | 403  | RLS rejected, or role insufficient                |
| `VALIDATION_FAILED`          | 422  | Zod failure                                       |
| `INVALID_TRANSITION`         | 409  | State machine rejected the move                   |
| `SPLITS_MUST_TOTAL_100`      | 409  | Writer or master column ≠ 100                     |
| `ALL_CONTRIBUTORS_MUST_SIGN` | 409  | Lock attempted with unsigned parties              |
| `DATE_ALREADY_CONFIRMED`     | 409  | Unique index fired                                |
| `INSUFFICIENT_INDEX_DATA`    | 200  | `sample_n < 5` — **a valid answer, not an error** |
| `MEDIA_LOCKED`               | 403  | Full quality requested before splits signed       |
| `RATE_LIMITED`               | 429  | Includes `Retry-After`                            |

## Profiles

```
GET    /api/profiles/me
PATCH  /api/profiles/me
POST   /api/profiles/roles            { role, attributes, proofMediaUrl? }
DELETE /api/profiles/roles/:role
POST   /api/profiles/prefill          { trackUrl } → analysed attributes to confirm
GET    /api/profiles/:slug            public
POST   /api/profiles/:id/epk          generate → { pdfUrl, publicUrl }
```

## Gigs

```
POST   /api/gigs/briefs               { eventDate, city, eventType, genres,
                                        budgetMin?, budgetMax?, crowdSize?, source }
POST   /api/gigs/briefs/parse         { rawText | pdfUrl } → parsed brief to confirm
GET    /api/gigs/briefs/:id/shortlist  → { data: [{ artistId, score, components }] }
POST   /api/gigs/quotes               { briefId, artistId, feePaise, validUntil }
GET    /api/gigs/index?genre=&city=&eventType=&crowdBand=
                                       → { p25, p50, p75, sampleN }
                                       | { code: 'INSUFFICIENT_INDEX_DATA' }
POST   /api/gigs/holds                { artistId, eventDate, briefId? }
POST   /api/gigs/holds/:id/challenge
POST   /api/gigs/holds/:id/confirm     → 409 DATE_ALREADY_CONFIRMED if taken
POST   /api/gigs/holds/:id/release
GET    /api/gigs/calendar?from=&to=    roster-wide
POST   /api/gigs/:id/rider             { backline, travel, hospitality }
POST   /api/gigs/:id/rider/confirm
```

`shortlist` always returns `components`. An unexplained ranking is not trusted.

## Collabs

```
POST   /api/collabs                   { kind, title, body?, brief?, referenceUrl?,
                                        visibility, deadline?, slots: Slot[] }
POST   /api/collabs/:id/publish       → 202 { matchJobId }
GET    /api/collabs?kind=&role=&city=&paid=&cursor=
GET    /api/collabs/:id
POST   /api/collabs/slots/:id/apply   { pitch?, demoUrl? }   rate limit 20/day
GET    /api/collabs/slots/:id/applicants   ranked, poster only
POST   /api/collabs/applications/:id/shortlist
POST   /api/collabs/applications/:id/accept   → opens a Room, drafts the split sheet
POST   /api/collabs/applications/:id/decline  { reason }   reason required
POST   /api/collabs/demo-to-request   { audioUrl } → drafted request
GET    /api/collabs/rooms/:id
POST   /api/collabs/rooms/:id/versions  { fileKey, note }
```

## Credits

```
POST   /api/credits/works             { title, contributors: [...] }
PATCH  /api/credits/works/:id         draft only
POST   /api/credits/works/:id/send    dispatch signature requests
POST   /api/credits/works/:id/sign    { token, otp }
POST   /api/credits/works/:id/lock    → 409 unless totals=100 and all signed
GET    /api/credits/works/:id
GET    /api/w/:id                     PUBLIC read-only
GET    /api/credits/artist/:id        verified credit list
POST   /api/credits/works/:id/export  PRO registration format
```

**`/lock` is the most important endpoint in the product.** It gates media release and writes the graph.

## Studio

```
POST   /api/studio/generate           → 202 { jobId }   never synchronous
GET    /api/studio/jobs/:id           → { status, progress, outputUrls? }
POST   /api/studio/analyze            → 202 { jobId }   BPM/key/genre
POST   /api/studio/separate           → 202 { jobId }   stems
POST   /api/studio/variants           → 202 { jobId }   6s/15s/30s
```

## Stage

```
GET    /api/stage/seasons
POST   /api/stage/submissions         { seasonId, bracket, videoKey }
GET    /api/stage/submissions/queue   admin — HITL review
POST   /api/stage/submissions/:id/score  { criteria, total, notes }
GET    /api/stage/:season/standings   public
```

## Payments

```
POST   /api/payments/contracts        generate + dispatch for eSign
POST   /api/payments/settlements/:id/compute
                                       → { gross, tds, gst, splits[], net }
POST   /api/payments/settlements/:id/release
                                       → 409 unless splits reconcile to zero
GET    /api/payments/settlements/:id
GET    /api/payments/statements/:id   settlement statement PDF
```

TDS and GST are returned by `/compute` and **shown before signature.**

## Promotion

```
POST   /api/promotion/fans/capture    { qrToken, phone, consent }
GET    /api/promotion/fans?segment=
POST   /api/promotion/fans/export     full export, always available
POST   /api/promotion/campaigns       { bookingId | releaseId, channels }
```

## Media

```
POST   /api/media/upload-url          → { signedUrl, key }
  Client PUTs directly to R2. NEVER proxy media through the API.
GET    /api/media/:key
  Watermarked by default. Full quality requires the linked work to be locked
  AND (slot unpaid OR escrow funded). Otherwise 403 MEDIA_LOCKED.
```

## Webhooks

| Path                     | Source             | First action                              |
| ------------------------ | ------------------ | ----------------------------------------- |
| `/api/webhooks/pa`       | Payment aggregator | **Verify HMAC signature**                 |
| `/api/webhooks/whatsapp` | BSP                | Verify signature, 200 fast, process async |
| `/api/webhooks/esign`    | eSign provider     | Verify signature                          |

**Every webhook verifies its signature before reading the body. No exceptions.**
