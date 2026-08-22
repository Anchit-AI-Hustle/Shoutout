import type { MatchCandidate } from './types';

// Each factor returns 0-1. The registry decides which factors matter and how
// much (registry[type].matchWeights) — this file never branches on type.

export function roleMatch(candidate: MatchCandidate, slotRole: string): number {
  return candidate.role === slotRole ? 1 : 0;
}

// Jaccard overlap across whichever array-valued attribute keys exist on both
// sides (genres, languages, mood, ...). No shared keys -> neutral 0.5,
// not 0 — absence of comparable data isn't evidence of a bad match.
export function attributeFit(
  candidateAttributes: Record<string, unknown> | undefined,
  slotAttributes: Record<string, unknown>,
): number {
  if (!candidateAttributes) return 0.5;

  const comparableKeys = Object.keys(slotAttributes).filter((key) => {
    const slotValue = slotAttributes[key];
    const candidateValue = candidateAttributes[key];
    return Array.isArray(slotValue) && Array.isArray(candidateValue);
  });

  if (comparableKeys.length === 0) return 0.5;

  const scores = comparableKeys.map((key) => {
    const slotSet = new Set(slotAttributes[key] as unknown[]);
    const candidateSet = new Set(candidateAttributes[key] as unknown[]);
    if (slotSet.size === 0 && candidateSet.size === 0) return 1;
    const intersection = [...slotSet].filter((v) => candidateSet.has(v)).length;
    const union = new Set([...slotSet, ...candidateSet]).size;
    return union === 0 ? 1 : intersection / union;
  });

  return scores.reduce((sum, s) => sum + s, 0) / scores.length;
}

// STUBBED — docs/09-BUILD-SEQUENCE.md B4 says "check availability live
// against the holds ledger," but the holds table (migration 005 in
// docs/03-DATA-MODEL.md, built in B7/M3) doesn't exist yet. Returns neutral
// 1.0 (doesn't penalize) until that dependency exists — this is a stated
// gap, not a judgment that everyone is always available.
export function availability(): number {
  return 1;
}

// STUBBED — needs docs/03-DATA-MODEL.md's benchmark_index materialized
// view (M3+), which requires 25 hand-brokered bookings first per
// docs/09-BUILD-SEQUENCE.md M3's own prerequisite. No index exists yet.
export function priceBandFit(): number {
  return 1;
}

// STUBBED — needs reliability_scores (migration 010, M3+ per
// docs/03-DATA-MODEL.md), held per role per docs/01-PRODUCT.md. No scoring
// history exists yet — every candidate is unproven, not unreliable.
export function reliability(): number {
  return 1;
}

// STUBBED — no response-time tracking exists yet (would need answer/message
// timestamps analyzed over time, not built).
export function responsiveness(): number {
  return 1;
}
