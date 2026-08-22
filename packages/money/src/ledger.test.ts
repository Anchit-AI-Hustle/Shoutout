import { describe, it, expect } from 'vitest';
import { buildSettlement, bpsOf, sumLines, isBalanced } from './ledger';

// The invariant that matters: whatever the inputs, the ledger sums to zero.
// Migration 023's trigger refuses to close a settlement that doesn't, so a
// bug here is a settlement that can never be paid out.

describe('bpsOf', () => {
  it('truncates rather than rounding', () => {
    expect(bpsOf(10_001n, 600)).toBe(600n); // 600.06 -> 600
  });
  it('rejects out-of-range basis points', () => {
    expect(() => bpsOf(100n, 10_001)).toThrow(RangeError);
    expect(() => bpsOf(100n, -1)).toThrow(RangeError);
  });
});

const base = {
  artistOrgId: 'org-a',
  artistId: 'artist-a',
  artistName: 'Test Artist',
};

describe('buildSettlement', () => {
  it('balances a simple 6% booking', () => {
    const lines = buildSettlement({ ...base, grossPaise: 10_000_000n, takeRateBps: 600 });
    expect(isBalanced(lines)).toBe(true);
    expect(lines.find((l) => l.kind === 'platform_fee')?.amountPaise).toBe(-600_000n);
    expect(lines.find((l) => l.kind === 'artist')?.amountPaise).toBe(-9_400_000n);
  });

  it('pays the artist a negative (outgoing) amount, never positive', () => {
    const lines = buildSettlement({ ...base, grossPaise: 10_000_000n, takeRateBps: 600 });
    const artist = lines.find((l) => l.kind === 'artist')!;
    expect(artist.amountPaise).toBeLessThan(0n);
  });

  it('balances with sidemen, TDS and a provider fee together', () => {
    const lines = buildSettlement({
      ...base,
      grossPaise: 12_345_678n,
      takeRateBps: 600,
      providerFeeBps: 200,
      tdsBps: 1000,
      sidemen: [
        { shareBps: 1500, payeeName: 'Drummer', payeeOrgId: 'org-d' },
        { shareBps: 1000, payeeName: 'Bassist', payeeOrgId: 'org-b' },
      ],
    });
    expect(sumLines(lines)).toBe(0n);
    expect(lines.filter((l) => l.kind === 'sideman')).toHaveLength(2);
  });

  it('stays balanced across awkward amounts that force truncation', () => {
    for (const gross of [1n, 7n, 99n, 101n, 999_999n, 1_000_003n, 87_654_321n]) {
      const lines = buildSettlement({
        ...base,
        grossPaise: gross,
        takeRateBps: 617,
        providerFeeBps: 213,
        tdsBps: 1000,
        sidemen: [{ shareBps: 3333, payeeName: 'Session', payeeOrgId: 'org-s' }],
      });
      expect(sumLines(lines)).toBe(0n);
    }
  });

  it('refuses a gross of zero or less', () => {
    expect(() => buildSettlement({ ...base, grossPaise: 0n, takeRateBps: 600 })).toThrow(
      RangeError,
    );
  });

  it('refuses fees that exceed gross', () => {
    expect(() =>
      buildSettlement({ ...base, grossPaise: 1000n, takeRateBps: 9000, providerFeeBps: 2000 }),
    ).toThrow(RangeError);
  });

  it('refuses sideman shares that exceed the distributable amount', () => {
    expect(() =>
      buildSettlement({
        ...base,
        grossPaise: 1_000_000n,
        takeRateBps: 600,
        sidemen: [{ shareBps: 10_000, payeeName: 'Greedy', payeeOrgId: 'org-g' }],
      }),
    ).toThrow(RangeError);
  });
});
