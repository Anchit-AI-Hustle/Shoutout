# 15 — Testing

Three suites block deployment. Everything else is ordinary hygiene.

## Gate 1 — Cross-tenant isolation

```bash
pnpm test:rls
```

Seed orgs A and B. For **every table in `information_schema`**, assert that a session authenticated as A:

- cannot `SELECT` any row of B
- cannot `INSERT` a row with `org_id = B`
- cannot `UPDATE` or `DELETE` any row of B
- cannot escalate by setting `org_id` in a payload
- cannot reach B's rows via PostgREST, Realtime, or a storage object path

**The suite enumerates tables from `information_schema`, so a new table with no policy fails automatically** rather than passing silently.

A failure here is a launch blocker, not a bug ticket. Competing managers share this database and it holds payout data.

## Gate 2 — Money invariants

```bash
pnpm test:money
```

| Invariant          | Assertion                                                          |
| ------------------ | ------------------------------------------------------------------ |
| Ledger balances    | Every settlement's entries sum to exactly zero                     |
| No premature close | Cannot enter `settled` with an unreconciled split                  |
| Tax consistency    | TDS and GST at quote = at contract = at settlement                 |
| No double-confirm  | Two confirmed holds on one artist + date rejected by the index     |
| Hold release fires | Auto-release runs within tolerance of `expires_at`                 |
| Failed payout      | Never marks a split `paid`                                         |
| Media gate         | Full-quality media unreachable before the linked work is locked    |
| Splits total       | A work cannot lock unless writer and master each total exactly 100 |
| Sidemen paid       | Session players settle on the same day as the headline artist      |

## Gate 3 — Critical flows

```bash
pnpm test:e2e -- --grep @critical
```

**Collab → Credits → Payments**

```
post a request with two slots on different terms
  → two people apply
  → poster accepts both
  → Room opens, split sheet auto-drafted
  → all three sign → work locks
  → stems release at full quality
  → escrow funds and releases
  → credits written to the graph
  → ledger sums to zero
```

**Gig → Payments**

```
brief parsed from a forwarded WhatsApp message
  → shortlist → quote → hold → challenge → confirm
  → contract → advance → rider → performed → settled
  → index row written
```

Playwright, in CI, screenshot on failure.

## Module boundary conformance

```bash
pnpm test:boundaries
```

Asserts the architecture holds:

- **No module imports another module directly.** Cross-module work goes through `packages/*`.
- **No second implementation of a shared service.** Static check: only `packages/discovery` contains ranking logic; only `packages/money` contains settlement logic.
- Every module's public surface is its `index.ts`

That second assertion is the architecture, enforced by a test. If Gigs grows its own search, CI catches it.

## Load

- Audition intake burst: 5,000 uploads in one hour when a season opens
- Discovery: p95 under 800ms at 10,000 active requests
- **Assert no model call sits in a user-facing request path**

## Security

- Webhook signature verification on all three inbound webhooks
- JWT claim tampering rejected
- Privilege escalation via `org_members` rejected
- Rate limits on posting and applying
- No PII, tokens or full phone numbers in logs — masked to last 4

## CI pipeline

```
lint → typecheck → unit → test:boundaries → test:rls → test:money
     → build → test:e2e @critical → deploy
```

**Migrations run before code deploys, never after.**
