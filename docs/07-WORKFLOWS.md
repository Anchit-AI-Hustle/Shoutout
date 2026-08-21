# 07 — Workflows

Inngest. Every lifecycle sequence is a durable function. WhatsApp is the primary rail; email is secondary.

**Why Inngest and not cron:** these workflows are long-lived, stateful and human-in-the-loop, spanning months. `step.sleepUntil` with replay is the correct primitive.

## Function inventory

| Function | Trigger | Steps |
|---|---|---|
| `hold.expiry` | `hold.created` | `sleepUntil(expiresAt)` → if still soft, release → notify both sides |
| `hold.challenge` | `hold.challenged` | notify incumbent → `sleep(48h)` → if unconfirmed, drop to priority 2 |
| `shout.no-answers` | `shout.published` | `sleep(48h)` → if 0 answers, coach the poster (widen brief, add reference, adjust terms) |
| `answer.poster-silent` | `answer.created` | `sleep(72h)` → if unactioned, nudge poster. **Silence is the top churn cause on both sides.** |
| `splits.unsigned` | `work.sent` | `sleep(24h)` → remind each unsigned party individually, then at 72h |
| `audition.rejected` | `submission.rejected` | scorecard → free EPK → open gigs in their city → `sleep(7d)` → nudge → `sleep(14d)` → final |
| `payout.sla` | `settlement.released` | `sleep(2 business days)` → if unpaid, escalate to ops + alert |
| `booking.rebook` | `settlement.closed` | `sleepUntil(+11 months)` → both sides: "this time last year you booked X" |
| `trial.convert` | `org.trial_started` | day 3 activation nudge → day 11 usage summary → day 14 convert or downgrade |
| `roster.stuck` | `org.created` | `sleep(14d)` → if roster still 1, CSV import prompt |
| `index.refresh` | cron nightly | refresh matview → anomaly review via Opus → alert on outliers |
| `dunning` | `payment.failed` | day 0, 3, 7 → **downgrade, never delete** |

## Business-day arithmetic

`payout.sla` must use business days, not calendar days, and must respect Indian public holidays. Put the holiday calendar in config, not in code.

## WhatsApp templates

**Submit these for approval on day one. Approval takes 2–3 weeks and blocks week 5.**

```
shout_answered            shout_slot_filled        shout_no_answers_48h
hold_expiring_48h         hold_challenged          hold_released
quote_sent                contract_ready           contract_signed
advance_received          rider_confirm_t7         rider_confirm_t2
payout_sent               payout_delayed
split_sheet_ready         split_sheet_reminder     split_sheet_locked
audition_received         audition_result
rebook_anniversary
```

## Cost rules

Meta charges by category, and marketing is 7–8× utility.

- **Everything that can legitimately be a utility template must be one.** Only genuine promotion is marketing.
- Handle support and follow-ups inside the free 24-hour service window where possible.
- **From 1 Oct 2026, utility and service messages inside the service window become chargeable.** Any flow relying on "the customer messaged first so it's free" needs re-costing before that date.
- **From 1 Aug 2026, AI-generated replies carry a separate per-token charge.** Account for it if you auto-reply.
- Track template delivery rate. **Alert below 97%.**

## Idempotency

Every function is keyed on the entity id plus step name. Inngest replays on failure; a step must be safe to run twice. Never send a notification outside a `step.run` — a retry would send it again.

## Events

```ts
'shout.published'      { shoutId, orgId, type }
'answer.created'       { answerId, slotId, responderOrgId }
'hold.created'         { holdId, artistId, eventDate, expiresAt }
'hold.challenged'      { holdId, challengerOrgId }
'work.sent'            { workId, contributorIds }
'work.locked'          { workId }
'settlement.released'  { settlementId, payeeCount }
'submission.rejected'  { submissionId, artistId, scorecard }
'payment.failed'       { orgId, attempt }
```

Every state transition emits an event carrying the actor and both states. Those events drive notifications **and** the immutable audit log.
