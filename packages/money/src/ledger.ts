// The settlement ledger — pure arithmetic, no I/O, no provider.
//
// Money is bigint paise everywhere (CLAUDE.md conventions). Percentages are
// only ever an input; every intermediate and every output is integer paise,
// because a take rate of 6% on ₹1,00,000 must not depend on float rounding.
//
// The ledger is double-entry and signed: the gross received is one positive
// line, every allocation out is negative, and a valid settlement sums to
// exactly zero. Migration 023 enforces that same rule with a database
// trigger — this module exists so the application can build a balanced
// ledger in the first place, not so it can be trusted to.

export type LineKind =
  'gross' | 'artist' | 'sideman' | 'platform_fee' | 'tds' | 'provider_fee' | 'adjustment';

export interface LedgerLine {
  amountPaise: bigint;
  kind: LineKind;
  payeeOrgId?: string | undefined;
  payeeArtistId?: string | undefined;
  payeeName?: string | undefined;
  note?: string | undefined;
}

export interface SidemanShare {
  /** Basis points of the artist's net, not of gross. 2500 = 25%. */
  shareBps: number;
  payeeOrgId?: string | undefined;
  payeeArtistId?: string | undefined;
  payeeName: string;
}

export interface BuildSettlementInput {
  grossPaise: bigint;
  /** Platform take, in basis points. 600 = 6%. */
  takeRateBps: number;
  /** Payment aggregator's own fee, in basis points. */
  providerFeeBps?: number | undefined;
  /**
   * TDS under s.194J/194C, basis points of the artist's gross share.
   * Deducted and remitted by the payer, so it leaves the ledger as its own
   * line rather than reducing what the artist is owed on paper.
   */
  tdsBps?: number | undefined;
  artistOrgId: string;
  artistId: string;
  artistName: string;
  sidemen?: SidemanShare[] | undefined;
}

const BPS = 10_000n;

/**
 * Basis-point share of an amount, truncated toward zero.
 * Truncation is deliberate: every rounding loss is collected and assigned
 * explicitly by buildSettlement rather than silently vanishing.
 */
export function bpsOf(amountPaise: bigint, bps: number): bigint {
  if (!Number.isInteger(bps) || bps < 0 || bps > 10_000) {
    throw new RangeError(`bps must be an integer 0..10000, got ${bps}`);
  }
  return (amountPaise * BigInt(bps)) / BPS;
}

export function sumLines(lines: LedgerLine[]): bigint {
  return lines.reduce((total, line) => total + line.amountPaise, 0n);
}

export function isBalanced(lines: LedgerLine[]): boolean {
  return sumLines(lines) === 0n;
}

/**
 * Builds a balanced ledger for one booking.
 *
 * Order of operations matters and is fixed here so it is auditable:
 *   1. platform take and provider fee come off gross
 *   2. sidemen are paid from what remains
 *   3. TDS is computed on the artist's share
 *   4. the artist receives the remainder — which absorbs every truncation
 *      loss, guaranteeing the ledger sums to zero exactly
 *
 * Step 4 is why the artist line is computed by subtraction rather than by
 * its own percentage. Percentages that each round independently do not sum
 * back to the whole; a remainder always does.
 */
export function buildSettlement(input: BuildSettlementInput): LedgerLine[] {
  const { grossPaise, takeRateBps, artistOrgId, artistId, artistName } = input;

  if (grossPaise <= 0n) {
    throw new RangeError('grossPaise must be positive');
  }

  const platformFee = bpsOf(grossPaise, takeRateBps);
  const providerFee = bpsOf(grossPaise, input.providerFeeBps ?? 0);

  const distributable = grossPaise - platformFee - providerFee;
  if (distributable <= 0n) {
    throw new RangeError('fees exceed gross; nothing left to distribute');
  }

  const lines: LedgerLine[] = [
    { amountPaise: grossPaise, kind: 'gross', note: 'Received from organiser' },
  ];

  if (platformFee > 0n) {
    lines.push({ amountPaise: -platformFee, kind: 'platform_fee', note: 'ShoutOut fee' });
  }
  if (providerFee > 0n) {
    lines.push({ amountPaise: -providerFee, kind: 'provider_fee', note: 'Aggregator fee' });
  }

  let sidemanTotal = 0n;
  for (const sideman of input.sidemen ?? []) {
    const amount = bpsOf(distributable, sideman.shareBps);
    if (amount <= 0n) continue;
    sidemanTotal += amount;
    lines.push({
      amountPaise: -amount,
      kind: 'sideman',
      payeeOrgId: sideman.payeeOrgId,
      payeeArtistId: sideman.payeeArtistId,
      payeeName: sideman.payeeName,
    });
  }

  const artistGross = distributable - sidemanTotal;
  if (artistGross <= 0n) {
    throw new RangeError('sideman shares exceed the distributable amount');
  }

  const tds = bpsOf(artistGross, input.tdsBps ?? 0);
  if (tds > 0n) {
    lines.push({ amountPaise: -tds, kind: 'tds', note: 'TDS withheld and remitted' });
  }

  // Remainder, not a percentage — absorbs all truncation so the ledger
  // closes at exactly zero. sumLines() at this point is everything not yet
  // allocated, i.e. exactly what the artist is owed, so the line is its
  // negation.
  const artistNet = sumLines(lines);
  lines.push({
    amountPaise: -artistNet,
    kind: 'artist',
    payeeOrgId: artistOrgId,
    payeeArtistId: artistId,
    payeeName: artistName,
  });

  /* c8 ignore next 3 -- unreachable by construction; kept as a tripwire */
  if (!isBalanced(lines)) {
    throw new Error(`ledger did not balance: ${sumLines(lines)} paise`);
  }

  return lines;
}
