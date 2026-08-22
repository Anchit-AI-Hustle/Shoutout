import { getShoutTypeConfig } from '@shoutout/shout-types';
import type { MatchFactor } from '@shoutout/shout-types';
import * as factors from './factors';
import type { MatchInput, MatchResult } from './types';

// One scorer, all Shout types. Reads registry[type].matchWeights and never
// branches on the Shout's own type field (docs/10-TESTING.md
// registry-conformance gate — see check-registry.mjs). Weights sum to ~1
// per type (docs/04-SHOUT-TYPES.md), so this is a weighted sum, not a
// product — scoreComponents is always returned alongside the total, per
// docs/05-API.md: "an unexplained ranking is not trusted."
export function score(input: MatchInput): MatchResult[] {
  const config = getShoutTypeConfig(input.shoutType);
  const weights = config.matchWeights;

  return input.candidates.map((candidate) => {
    const rawComponents: Record<MatchFactor, number> = {
      roleMatch: factors.roleMatch(candidate, input.slotRole),
      attributeFit: factors.attributeFit(candidate.attributes, input.slotAttributes),
      availability: factors.availability(),
      priceBandFit: factors.priceBandFit(),
      reliability: factors.reliability(),
      responsiveness: factors.responsiveness(),
    };

    const components: Partial<Record<MatchFactor, number>> = {};
    let total = 0;

    for (const [factor, weight] of Object.entries(weights) as [MatchFactor, number][]) {
      if (weight === undefined || weight === 0) continue;
      const factorScore = rawComponents[factor];
      components[factor] = factorScore;
      total += weight * factorScore;
    }

    return { artistId: candidate.artistId, score: total, components };
  });
}
