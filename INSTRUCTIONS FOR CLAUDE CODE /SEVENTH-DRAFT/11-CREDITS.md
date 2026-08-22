# 11 — Credits

Own your work. A verified record of who made what.

## Why this is the most valuable module

It is the only asset here that **compounds from user one**. Every other module needs liquidity before it is worth anything — the price index needs settled bookings, the fan graph needs gigs, matching needs supply. Credits is valuable the moment two people sign one split sheet.

It also builds itself. **Every collab that closes writes here automatically.** No separate data entry, ever.

And it is the entry point into recorded music and publishing — the parts of the industry ShoutOut does not touch at launch.

## The problem

Two people make a song. They never write down who owns what. Two years later there is money, and there is a fight.

Every working musician has this story. It is the most universally recognised problem in the entire industry and nobody has built the obvious fix.

## The rule

**Splits are agreed before files move.** Full-quality stems stay locked until every contributor has signed. Watermarked previews only before that. No override, no admin bypass.

This is not a feature toggle. It is the product.

## What gets captured

| Field                                                  | Why it matters                                                                                               |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| **Writer share and master share, declared separately** | They are different rights with different money. Conflating them is the most common error in informal splits. |
| Work-for-hire vs co-write, per contributor             | Ambiguity here is where relationships die                                                                    |
| Role                                                   | Producer, writer, vocalist, session player, engineer                                                         |
| PRO affiliation, if known                              | Enables PRO registration export later                                                                        |
| Territory and term, if non-standard                    | Most are standard; the exceptions matter enormously                                                          |
| Signature, timestamp, masked phone                     | The evidence                                                                                                 |

## The lock

```
draft  →  sent  →  locked
```

- `draft` — editable, splits may total anything
- `sent` — signature requests dispatched over WhatsApp, still editable by the owner
- `locked` — **immutable forever**

`locked` requires, enforced by a Postgres trigger:

1. Writer % totals exactly 100
2. Master % totals exactly 100
3. Every contributor has `signed_at`

Amendments create a **new version**. They never mutate the original.

**The lock is the product. Make it feel final.**

## Signing

Each contributor gets a WhatsApp link with a token. They open it, **see the full split — everyone's shares, not just their own** — enter a phone OTP, and sign.

Seeing everyone's share is deliberate. Half the disputes in this industry come from people discovering later what someone else got.

## Public work page

```
/w/[id]     read-only, no account needed
```

Shows the split, the signatures, timestamps, and a verification hash. Artists send this to labels and distributors, so **it has to look like a real document.**

Also earns backlinks for free, which is why it is ISR-rendered.

## The graph

Every locked work writes credits against each contributor's profile.

- Public verified credit page per person
- Dispute and correction flow with an audit trail
- Export in a standard format for PRO registration
- Feeds the A&R signal feed and sync catalogue eligibility

**Cold-start protocol:** once a producer's catalogue lives here, they never re-key it anywhere else.

## Sync eligibility

A work can only enter the sync catalogue if:

1. Its splits are locked
2. Human authorship is recorded — **generated audio alone is never licensable**
3. Territory and term are declared

Splits already being registered means licence payment distributes automatically on purchase. That is the whole reason sync works later.

## Acceptance criteria

- A work cannot lock unless both percentage columns total exactly 100 and every party has signed
- A locked work cannot be edited by any path, including admin
- Full-quality media is unreachable until the linked work is locked — proven by test
- Three people sign from three different phones and the work locks correctly
- The PDF and public page render without an account
- 100% of closed collabs produce a locked work
