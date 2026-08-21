# 05 — API

Route handlers live in `apps/web/app/api/**`. They validate, resolve org from session, call a package, serialise. **No business logic in a handler.**

## Conventions

- Auth: Supabase session cookie. Org resolved server-side from JWT claims. **Never accept `org_id` from the client.**
- Every body and query validated with Zod. `422` on failure with field detail.
- Errors: `{ error: { code, message, details? } }`, `code` in `SCREAMING_SNAKE`.
- Pagination: cursor-based. `?cursor=&limit=` → `{ data, nextCursor }`. Max limit 50.
- Money in responses is `{ paise: number, display: "₹75,000" }`. Never a bare float.
- Idempotency: `Idempotency-Key` header required on every POST that moves money.

## Error codes

| Code | HTTP | Meaning |
|---|---|---|
| `UNAUTHENTICATED` | 401 | No valid session |
| `NO_ACTIVE_ORG` | 403 | Session has no org claim |
| `FORBIDDEN` | 403 | RLS rejected, or role insufficient |
| `VALIDATION_FAILED` | 422 | Zod failure, `details` carries field errors |
| `INVALID_TRANSITION` | 409 | State machine rejected the move |
| `SPLITS_MUST_TOTAL_100` | 409 | Writer or master column ≠ 100 |
| `ALL_CONTRIBUTORS_MUST_SIGN` | 409 | Lock attempted with unsigned parties |
| `DATE_ALREADY_CONFIRMED` | 409 | Unique index on artist+date fired |
| `INSUFFICIENT_INDEX_DATA` | 200 | Benchmark cell has `sample_n < 5` — **not an error, a valid answer** |
| `MEDIA_LOCKED` | 403 | Full-quality requested before splits signed |
| `RATE_LIMITED` | 429 | Includes `Retry-After` |

## Shouts

```
POST   /api/shouts                      create (draft)
  body: { type, title, body?, city?, deadline?, visibility, intent?, slots: Slot[] }
  → 201 { id, status: 'draft' }
  validation: type must exist in registry; slots.length within registry min/max;
              each slot.role in registry.slotRoles; attributes match registry schema

PATCH  /api/shouts/:id                  update draft
POST   /api/shouts/:id/publish          draft → open, queues match job
  → 202 { matchJobId }

GET    /api/shouts/:id                  detail incl. slots + answer counts
GET    /api/shouts?type=&city=&role=&cursor=   discovery feed
DELETE /api/shouts/:id                  soft delete, draft only
```

## Slots and answers

```
POST   /api/slots/:id/answers           answer a slot
  body: { pitch?, mediaUrl? }
  → 201 { id }
  rate limit: 20/day/responder

GET    /api/slots/:id/answers           ranked, poster only
  → { data: [{ id, responder, score, scoreComponents, pitch, mediaUrl }] }
  scoreComponents is ALWAYS returned — an unexplained ranking is not trusted

POST   /api/answers/:id/shortlist
POST   /api/answers/:id/accept          → opens a Room (collab) or a hold (gig)
POST   /api/answers/:id/decline         body: { reason }   reason is required
```

## Matching

```
POST   /api/match/preview               score without persisting
  body: { shoutId } | { slot: SlotDraft }
  → { candidates: [{ artistId, score, components }] }
```

The engine reads `registry[type].matchWeights`. It does not know what a gig is.

## Works and splits

```
POST   /api/works                       { title, contributors: [...] }
PATCH  /api/works/:id/contributors      draft only
POST   /api/works/:id/send              dispatch signature requests via WhatsApp
POST   /api/works/:id/sign              { token, otp } → records one signature
POST   /api/works/:id/lock              → 409 unless totals = 100 and all signed
GET    /api/works/:id                   detail
GET    /api/w/:id                       PUBLIC read-only share page data
```

**`/api/works/:id/lock` is the most important endpoint in the product.** It is the gate that releases media and writes the credits graph.

## Holds

```
POST   /api/holds                       { artistId, eventDate, shoutId? }
  → 201 { id, state: 'soft_hold_1', expiresAt, priority }
POST   /api/holds/:id/challenge         starts the 48h window on the incumbent
POST   /api/holds/:id/confirm           → 409 DATE_ALREADY_CONFIRMED if taken
POST   /api/holds/:id/release
GET    /api/holds?from=&to=             roster calendar
```

## Quotes and the index

```
GET    /api/index/band?genre=&city=&slotType=&crowdBand=&season=
  → { p25, p50, p75, sampleN }  |  { code: 'INSUFFICIENT_INDEX_DATA' }

POST   /api/quotes                      { shoutId, slotId, feePaise, validUntil }
```

**The quote endpoint never invents a price.** If the index returns insufficient data, the UI asks the manager to price manually — and that manual price later feeds the index.

## Money

```
POST   /api/contracts                   generate + dispatch for eSign
POST   /api/contracts/:id/sign          eSign provider callback
POST   /api/settlements/:id/compute     → { gross, tds, gst, splits[], net }
POST   /api/settlements/:id/release     → 409 unless splits reconcile to zero
GET    /api/settlements/:id
POST   /api/webhooks/pa                 PA callback — verify signature FIRST
```

TDS and GST are returned by `/compute` and **shown before signature**, never after.

## Studio

```
POST   /api/studio/generate             → 202 { jobId }   never synchronous
GET    /api/studio/jobs/:id             → { status, progress, outputUrl? }
POST   /api/studio/analyze              → 202 { jobId }   BPM/key/genre
POST   /api/studio/demo-to-shout        voice note → draft Shout
```

## Media

```
POST   /api/media/upload-url            → { signedUrl, key }
  Client PUTs directly to R2. NEVER proxy media through the API.
GET    /api/media/:key                  → watermarked stream, or full quality
  Full quality requires: splits signed AND (slot unpaid OR escrow funded).
  Otherwise 403 MEDIA_LOCKED.
```

## Webhooks in

| Path | Source | First action |
|---|---|---|
| `/api/webhooks/pa` | Payment aggregator | Verify HMAC signature |
| `/api/webhooks/whatsapp` | BSP | Verify signature, then 200 fast — process async |
| `/api/webhooks/esign` | eSign provider | Verify signature |

**Every webhook verifies its signature before reading the body. No exceptions.**
