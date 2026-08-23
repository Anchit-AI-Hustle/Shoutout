import { z } from 'zod';

// MUSIC_BRIEF — the GENERATION_INTENT schema.
//
// docs/07-STUDIO.md calls stage 3 "the seam": the point where a description
// becomes something a pipeline can render. It is deliberately not a
// generation artifact — one schema, four consumers (the Studio pipeline,
// Collabs matching, Gigs matching, and catalogue tagging), which is the
// whole reason it lives in its own package rather than inside the worker.
//
// Positioning discipline from the same doc: this is a *communication* tool.
// The hardest problem in music collaboration is describing a sound in
// words. The brief exists so you can attach a reference instead of writing
// "make it vibey".

export const SECTION_KINDS = [
  'intro',
  'verse',
  'pre_chorus',
  'chorus',
  'bridge',
  'solo',
  'breakdown',
  'outro',
] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];

export const musicBriefSchema = z.object({
  genre: z.string().min(1),
  subgenres: z.array(z.string()).default([]),
  bpm: z.number().int().min(40).max(240),
  key: z.string().min(1),
  mode: z.enum(['major', 'minor', 'modal']).default('major'),
  mood: z.array(z.string()).default([]),
  instrumentation: z.array(z.string()).default([]),
  vocals: z
    .object({
      present: z.boolean().default(true),
      style: z.string().optional(),
      language: z.string().optional(),
      // Named because the logged issues were specifically about vocals
      // sitting wrong in the mix, which is a brief-level decision.
      register: z.enum(['low', 'mid', 'high']).optional(),
    })
    .default({ present: true }),
  reference_note: z.string().max(500).optional(),
  /** Album mode: how far each successive track may drift from the brief. */
  drift: z
    .object({
      brightness: z.number().min(-1).max(1).default(0),
      energy: z.number().min(-1).max(1).default(0),
      tempo_pct: z.number().min(-0.25).max(0.25).default(0),
    })
    .default({ brightness: 0, energy: 0, tempo_pct: 0 }),
});
export type MusicBrief = z.infer<typeof musicBriefSchema>;

export const sectionSpecSchema = z.object({
  kind: z.enum(SECTION_KINDS),
  bars: z.number().int().min(1).max(64),
  density: z.enum(['sparse', 'medium', 'full']).default('medium'),
  // Transitions were one of the logged failure areas — making them an
  // explicit, approvable field rather than an emergent accident is the
  // point of surfacing the plan at all.
  transition_in: z.enum(['cut', 'riser', 'filter_sweep', 'drum_fill', 'silence']).optional(),
  notes: z.string().max(300).optional(),
});
export type SectionSpec = z.infer<typeof sectionSpecSchema>;

export const trackPlanSchema = z.object({
  title: z.string().min(1),
  sections: z.array(sectionSpecSchema).min(1).max(24),
});
export type TrackPlan = z.infer<typeof trackPlanSchema>;

export const generationPlanSchema = z.object({
  kind: z.enum(['single', 'album', 'reference']),
  title: z.string().min(1),
  brief: musicBriefSchema,
  tracks: z.array(trackPlanSchema).min(1).max(30),
});
export type GenerationPlan = z.infer<typeof generationPlanSchema>;
