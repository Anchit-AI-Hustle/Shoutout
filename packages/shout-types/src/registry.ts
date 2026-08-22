import { z } from 'zod';
import type { ShoutType, ShoutTypeConfig } from './types';

// Every type-specific behaviour lives here. The match engine (packages/match)
// and settlement rail (packages/money) read this registry and never branch on
// `shout.type`. Adding a 13th type is a config object plus copy strings —
// see docs/04-SHOUT-TYPES.md.
//
// Launch scope (docs/09-BUILD-SEQUENCE.md) configures only `collab` and `gig`.
// Waves 2-4 are added as config objects later, never as new tables or engine
// branches.
export const registry: Partial<Record<ShoutType, ShoutTypeConfig>> = {
  collab: {
    id: 'collab',
    label: 'Collab',
    wave: 1,
    poster: ['manager', 'self', 'agency'],
    responder: 'artist',
    slotRoles: [
      'vocalist',
      'topliner',
      'rapper',
      'backing_vocalist',
      'songwriter',
      'lyricist',
      'hook_writer',
      'beat_producer',
      'instrumental_producer',
      'sound_designer',
      'mix_engineer',
      'mastering_engineer',
      'vocal_editor',
      'arranger',
      'session_guitar',
      'session_bass',
      'session_drums',
      'session_keys',
      'tabla',
      'sitar',
      'flute',
      'strings',
      'brass',
      'percussion',
      'video_director',
      'dop',
      'editor',
      'cover_artist',
      'photographer',
    ],
    compModels: ['fee', 'points', 'hybrid', 'credit'],
    minSlots: 1,
    maxSlots: 6,
    attributeSchema: z.object({
      genres: z.array(z.string()).optional(),
      bpm: z.number().int().min(40).max(220).optional(),
      key: z.string().optional(),
      languages: z.array(z.string()).optional(),
      vocalRange: z.enum(['bass', 'baritone', 'tenor', 'alto', 'mezzo', 'soprano']).optional(),
      timbre: z.array(z.string()).optional(),
      turnaroundDays: z.number().int().optional(),
      revisionsIncluded: z.number().int().optional(),
    }),
    matchWeights: {
      roleMatch: 0.3,
      attributeFit: 0.3,
      availability: 0.1,
      priceBandFit: 0.1,
      reliability: 0.15,
      responsiveness: 0.05,
    },
    closesWith: 'split_sheet',
    requiresVerifiedIdentity: true, // for paid slots
    requiresEscrow: true,
  },

  gig: {
    id: 'gig',
    label: 'Gig',
    wave: 1,
    poster: ['organiser', 'venue', 'brand', 'manager', 'self'],
    responder: 'artist',
    slotRoles: ['headliner', 'support', 'dj', 'live_band', 'solo', 'mc'],
    compModels: ['fee'],
    minSlots: 1,
    maxSlots: 8, // a lineup is one Shout with many slots
    attributeSchema: z.object({
      genres: z.array(z.string()),
      eventType: z.enum([
        'wedding',
        'corporate',
        'festival',
        'club',
        'college',
        'private',
        'government',
      ]),
      crowdSize: z.number().int().optional(),
      setLengthMins: z.number().int().optional(),
      backlineProvided: z.boolean().optional(),
      travelCovered: z.boolean().optional(),
    }),
    matchWeights: {
      roleMatch: 0.2,
      attributeFit: 0.2,
      availability: 0.25,
      priceBandFit: 0.15,
      reliability: 0.15,
      responsiveness: 0.05,
    },
    closesWith: 'contract',
    requiresVerifiedIdentity: true,
    requiresEscrow: true,
  },
};

export function getShoutTypeConfig(type: ShoutType): ShoutTypeConfig {
  const config = registry[type];
  if (!config) {
    throw new Error(`SHOUT_TYPE_NOT_CONFIGURED: ${type}`);
  }
  return config;
}

export function isShoutTypeConfigured(type: ShoutType): boolean {
  return registry[type] !== undefined;
}
