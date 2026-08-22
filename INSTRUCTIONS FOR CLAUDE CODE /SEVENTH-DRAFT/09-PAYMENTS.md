# 09 — Payments

The highest-risk module. Read this completely before touching anything here.

## The legal constraint

**ShoutOut cannot hold customer funds.** Under RBI payment-aggregator rules, only a licensed PA may. We use a PA's split-settlement product with hold periods — functionally escrow, legally theirs. The nodal account is the PA's.

`packages/money` is **provider-agnostic behind an interface**, because international expansion means one PA per market.

```ts
export interface SettlementProvider {
  createHold(o: { amountPaise: bigint; ref: string }): Promise<HoldRef>;
  fundHold(h: HoldRef): Promise<void>;
  releaseToSplits(h: HoldRef, splits: Split[]): Promise<PayoutRef[]>;
  refund(h: HoldRef, amountPaise: bigint): Promise<void>;
  reconcile(from: Date, to: Date): Promise<ProviderLedgerRow[]>;
}
```

**Before writing code:** verify hold-period mechanics, refund and chargeback flow, settlement report format and webhook signature verification **against the live API, not the docs.**

## One rail, every module

Gig fees, collab fees, sponsorship, sync licences, rehearsal bookings — all settle through the same path with the same reconciliation. **Never build a second payment path for a module.**

## Double-entry ledger

We keep our own ledger regardless of what the PA reports. **The ledger is the source of truth; the PA is a counterparty we reconcile against.**

```sql
create table ledger_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  account text not null,      -- org:<id> | artist:<id> | payee:<id> | platform:revenue | pa:float
  direction text not null check (direction in ('debit','credit')),
  amount_paise bigint not null check (amount_paise > 0),
  ref_type text not null, ref_id uuid not null,
  occurred_at timestamptz not null default now()
);

create function assert_settlement_balances() returns trigger
language plpgsql as $$
declare bal bigint;
begin
  if new.state = 'settled' then
    select coalesce(sum(case when direction='credit' then amount_paise
                             else -amount_paise end),0)
      into bal from ledger_entries where ref_type='settlement' and ref_id=new.id;
    if bal <> 0 then
      raise exception 'SETTLEMENT_DOES_NOT_BALANCE (net=%)', bal;
    end if;
  end if;
  return new;
end $$;
```

## Splits and payouts

**Rules that do not bend:**

1. A settlement cannot enter `settled` until every split reconciles to zero.
2. **Session players are paid on the same rail, at the same time, as everyone else.** This is the most important design decision in the product — commercially and morally. Sidemen currently get paid last, least, and sometimes not at all.
3. Penny-drop bank verification and PAN check on every payee before first payout.
4. Retry with backoff on failure. Alert on second failure. **A failed payout never marks a split as paid.**

**SLA: T+2 business days from performance confirm, above 97%.** Business days, with an Indian public-holiday calendar in config.

## Indian tax

| Item                         | Rate | Applied                           |
| ---------------------------- | ---- | --------------------------------- |
| TDS 194J — professional fees | 10%  | At settlement                     |
| TDS 194C — contract work     | 1–2% | Where applicable by payee type    |
| GST on platform service fee  | 18%  | On our take, not the artist's fee |

**Computed and displayed before contract signature, never after.** The quote, the contract and the settlement must show the same net figure. Surprising an artist with deductions after the fact destroys trust in one transaction.

Generate a settlement statement PDF per payout: gross, each deduction, each split, net. This is what artists forward to their accountant.

## Economics — verified August 2026

```
average booking            ₹75,000     ($882)
take rate                  6%                    ← NOT 10%
revenue                    ₹4,500      ($53)
  − PA fee  2% of gross    ₹1,500
  − messaging + infra      ₹120
  − ops (semi-manual)      ₹1,000
contribution               ₹1,880      ($22)
margin                     41.8%
```

**Benchmark:** GigSalad published 25,235 music bookings generating $12,843,000 in 2025 — an average of **$509 (₹43,257)**, up 12% YoY. Their take rate is 5% for free members, 2.5% for paid. The Bash charges **no commission at all** — roughly $400/year membership.

**Nobody in this category charges 10%.** `PLATFORM_TAKE_RATE_BPS` defaults to 600 and is configurable per org. Expect it to fall toward 400.

## PA costs

| Provider       | Rate           | Note                                                  |
| -------------- | -------------- | ----------------------------------------------------- |
| Razorpay       | 2% + 18% GST   | No setup fee. T+2 standard.                           |
| Cashfree       | 1.95% standard | Lower rack rate                                       |
| Cashfree promo | 1.6%           | New merchants, 12 months, requires UPI ≥40% of volume |
| Negotiated     | 1.7–1.9%       | Past ~₹5–10 lakh/month processed                      |

**UPI has zero mandated MDR but the gateway still charges its platform fee.** If most volume is UPI, the UPI-weighted promo is materially cheaper.

## Contracts

Aadhaar eSign with per-state stamping. **Both parties countersign** — no more one-sided PDFs and voice notes. Rider annexure attached by reference. Immutable once signed; amendments create a new version. PDF hash stored so tampering is detectable.

## Reconciliation and disputes

Daily reconciliation: internal ledger against PA settlement reports. Any mismatch alerts and blocks nothing automatically — a human resolves it, but it is visible within a day, never a month. **Zero tolerance, tested in CI.**

Disputes: either party may raise within 48 hours of a state change. Raising freezes the settlement, preserves evidence (version history, audit log, rider confirmations) and opens an admin queue item. There is a resolution SLA — it does not block indefinitely.

## Financing — later, not now

Advances against signed, escrowed contracts. **NBFC co-lending partner required. Never lend off the balance sheet.** Begin partner conversations six months before build. Prerequisite: the benchmark index covering 8 genres × 12 cities at `sample_n ≥ 5`.

## Acceptance criteria

- A three-way split settles to zero automatically, every payee's UTR tracked
- TDS and GST at quote = at contract = at settlement
- A failed payout never marks a split paid
- Daily reconciliation runs and alerts on any mismatch
- Sidemen receive payout on the same day as the headline artist
