import { z } from 'zod';

// GENERATION_INTENT — the "universal sonic brief object" docs/02-ARCHITECTURE.md
// and docs/09-BUILD-SEQUENCE.md M5 describe as shared by Studio, the match
// engine, the sync catalog, and gig matching.
//
// This is NOT the ported semantic engine. packages/intent (M5,
// docs/09-BUILD-SEQUENCE.md) is meant to port MusicGenAI's actual 19-field
// intent system, its AI-suggest layer, and the album-mode semantic-drift
// logic — that requires the MusicGenAI source, which isn't available here.
// This is a minimal, honest schema for the JSON shape shouts.intent already
// stores (migration 003), just enough for packages/match to read structured
// fields out of it rather than treating it as opaque jsonb. Expect this to
// be superseded, not extended, when the real port happens.
export const generationIntentSchema = z.object({
  genres: z.array(z.string()).optional(),
  bpm: z.number().int().min(40).max(220).optional(),
  key: z.string().optional(),
  languages: z.array(z.string()).optional(),
  mood: z.array(z.string()).optional(),
  energy: z.number().min(0).max(1).optional(),
});

export type GenerationIntent = z.infer<typeof generationIntentSchema>;
