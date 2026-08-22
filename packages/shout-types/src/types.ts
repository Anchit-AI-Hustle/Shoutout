import type { ZodType } from 'zod';

// The full twelve, per docs/04-SHOUT-TYPES.md. Only `collab` and `gig` are
// configured in the registry at launch — see docs/09-BUILD-SEQUENCE.md.
export const SHOUT_TYPES = [
  'collab',
  'gig',
  'band',
  'crew',
  'venue',
  'rehearsal',
  'open',
  'brand',
  'sync',
  'label_pitch',
  'mentor',
  'gear',
] as const;

export type ShoutType = (typeof SHOUT_TYPES)[number];

// Matches the orgs.type check constraint in supabase/migrations/001.
export type OrgType = 'manager' | 'agency' | 'self' | 'organiser' | 'venue' | 'brand';

export type Responder = 'artist' | 'org' | 'work';

// Matches the shout_slots.comp_model check constraint in supabase/migrations/003.
export type CompModel = 'fee' | 'points' | 'hybrid' | 'credit';

export type MatchFactor =
  'roleMatch' | 'attributeFit' | 'availability' | 'priceBandFit' | 'reliability' | 'responsiveness';

export type CloseCondition = 'split_sheet' | 'contract' | 'scorecard' | 'licence' | 'none';

export interface ShoutTypeConfig {
  id: ShoutType;
  label: string;
  wave: 1 | 2 | 3 | 4;
  poster: readonly OrgType[];
  responder: Responder;
  slotRoles: readonly string[];
  compModels: readonly CompModel[];
  minSlots: number;
  maxSlots: number;
  attributeSchema: ZodType;
  matchWeights: Partial<Record<MatchFactor, number>>;
  closesWith: CloseCondition;
  requiresVerifiedIdentity: boolean;
  requiresEscrow: boolean;
}
