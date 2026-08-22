import { describe, expect, it } from 'vitest';
import { score } from '../src/score';

describe('score — collab', () => {
  it('scores a perfect match higher than a partial match, higher than a bad match', () => {
    const results = score({
      shoutType: 'collab',
      slotRole: 'vocalist',
      slotAttributes: { genres: ['indie-pop'], languages: ['english'] },
      candidates: [
        {
          artistId: 'perfect',
          role: 'vocalist',
          attributes: { genres: ['indie-pop'], languages: ['english'] },
        },
        {
          artistId: 'right-role-wrong-genre',
          role: 'vocalist',
          attributes: { genres: ['metal'], languages: ['hindi'] },
        },
        {
          artistId: 'wrong-role-and-genre',
          role: 'mix_engineer',
          attributes: { genres: ['metal'], languages: ['hindi'] },
        },
      ],
    });

    const byId = Object.fromEntries(results.map((r) => [r.artistId, r]));

    expect(byId.perfect?.score).toBeGreaterThan(byId['right-role-wrong-genre']?.score ?? -1);
    expect(byId['right-role-wrong-genre']?.score).toBeGreaterThan(
      byId['wrong-role-and-genre']?.score ?? -1,
    );
  });

  it('returns score_components for every result — an unexplained ranking is not trusted', () => {
    const results = score({
      shoutType: 'collab',
      slotRole: 'vocalist',
      slotAttributes: { genres: ['indie-pop'] },
      candidates: [{ artistId: 'a', role: 'vocalist', attributes: { genres: ['indie-pop'] } }],
    });

    expect(results[0]?.components.roleMatch).toBeDefined();
    expect(results[0]?.components.attributeFit).toBeDefined();
  });

  it("components exactly match the configured type's nonzero matchWeights keys", () => {
    // Neither collab nor gig (the two Launch-scope types) has a zero-weight
    // factor, so this asserts the general rule rather than a specific
    // omission — the components returned always mirror what the registry
    // says matters for this type, nothing more.
    const results = score({
      shoutType: 'gig',
      slotRole: 'headliner',
      slotAttributes: { genres: ['indie-pop'], eventType: 'club' },
      candidates: [{ artistId: 'a', role: 'headliner' }],
    });

    expect(Object.keys(results[0]?.components ?? {}).sort()).toEqual(
      [
        'roleMatch',
        'attributeFit',
        'availability',
        'priceBandFit',
        'reliability',
        'responsiveness',
      ].sort(),
    );
  });

  it('throws for an unconfigured Shout type rather than silently scoring 0', () => {
    expect(() =>
      score({
        shoutType: 'sync',
        slotRole: 'anything',
        slotAttributes: {},
        candidates: [{ artistId: 'a', role: 'anything' }],
      }),
    ).toThrow('SHOUT_TYPE_NOT_CONFIGURED');
  });
});
