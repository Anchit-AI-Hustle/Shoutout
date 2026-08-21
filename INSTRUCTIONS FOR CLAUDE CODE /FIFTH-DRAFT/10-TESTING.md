# 10 — Testing

Three suites block deployment. Everything else is ordinary hygiene.

## Gate 1 — RLS cross-tenant isolation

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

| Invariant | Assertion |
|---|---|
| Ledger balances | Every settlement's entries sum to exactly zero |
| No premature close | A settlement cannot enter `settled` with an unreconciled split |
| Tax consistency | TDS and GST at quote = at contract = at settlement |
| No double-confirm | Two confirmed holds on one artist + date is rejected by the index |
| Hold release fires | Auto-release runs within tolerance of `expires_at` |
| Failed payout | A failed payout never marks a split `paid` |
| Media gate | Full-quality media cannot be fetched before splits are signed |
| Splits total | A work cannot lock unless writer and master each total exactly 100 |

## Gate 3 — The critical flow

```bash
pnpm test:e2e -- --grep @critical
```

**Collab path**
```
post a Shout with two slots on different terms
  → two different people answer
  → poster accepts both
  → Room opens
  → split sheet signed by all three
  → stems release at full quality
  → escrow funds and releases
  → credits registered in the graph
  → ledger sums to zero
```

**Gig path**
```
brief parsed from a forwarded WhatsApp message
  → shortlist → quote → hold → challenge → confirm
  → contract → advance → rider → performed → settled
  → index row written
```

Playwright, run in CI, screenshot on failure.

## Registry conformance

```bash
pnpm test:registry
```

Asserts the one-product architecture holds:

- Every `ShoutType` has a complete config
- Every `slotRoles` entry exists in the role vocabulary
- Every `attributeSchema` parses its own fixtures
- **Static check: zero occurrences of `type === '` inside `packages/match` and `packages/money`**

That last assertion is the architecture, enforced by a test. If it fails, someone has started building a suite.

## Load

- Audition intake burst: 5,000 uploads in one hour when a season opens
- Match engine: p95 under 800ms at 10,000 active Shouts
- Never let a model call sit in a user-facing request path — assert it in a test

## Security

- Webhook signature verification on all three inbound webhooks
- JWT claim tampering rejected
- Privilege escalation via `org_members` rejected
- Rate limits enforced on Shout posting and answering
- No PII, tokens or full phone numbers in logs — masked to last 4

## CI pipeline

```
lint → typecheck → unit → test:registry → test:rls → test:money
     → build → test:e2e @critical → deploy
```

Migrations run **before** code deploys, never after.
