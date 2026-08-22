import type { MatchFactor, ShoutType } from '@shoutout/shout-types';

export interface MatchCandidate {
  artistId: string;
  role: string;
  attributes?: Record<string, unknown>;
}

export interface MatchInput {
  shoutType: ShoutType;
  slotRole: string;
  slotAttributes: Record<string, unknown>;
  candidates: MatchCandidate[];
}

export interface MatchResult {
  artistId: string;
  score: number;
  components: Partial<Record<MatchFactor, number>>;
}
