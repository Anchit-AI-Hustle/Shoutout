import { z } from 'zod';

// The role vocabulary — docs/04-PROFILES.md. "Adding a role is a row in the
// vocabulary plus an attribute schema. No migration." Attribute schemas are
// defined per FAMILY (matching the doc's own table structure — it groups
// "match attributes" by family, not by individual role) rather than per
// role, since roles within a family share the same shape.

export const ROLE_FAMILIES = {
  voice: {
    label: 'Voice',
    roles: ['vocalist', 'topliner', 'rapper', 'backing_vocalist', 'harmony_singer', 'voice_over'],
    attributeSchema: z.object({
      range: z.enum(['bass', 'baritone', 'tenor', 'alto', 'mezzo', 'soprano']).optional(),
      timbre: z.array(z.string()).optional(),
      languages: z.array(z.string()).optional(),
      accent: z.string().optional(),
      keyComfort: z.array(z.string()).optional(),
      sungVsRapped: z.enum(['sung', 'rapped', 'both']).optional(),
    }),
  },
  writing: {
    label: 'Writing',
    roles: ['songwriter', 'lyricist', 'hook_writer', 'composer', 'arranger', 'translator'],
    attributeSchema: z.object({
      languages: z.array(z.string()).optional(),
      themes: z.array(z.string()).optional(),
      genres: z.array(z.string()).optional(),
      coWriteVsWorkForHire: z.enum(['co_write', 'work_for_hire', 'both']).optional(),
    }),
  },
  production: {
    label: 'Production',
    roles: ['beat_producer', 'instrumental_producer', 'sound_designer', 'programmer'],
    attributeSchema: z.object({
      genres: z.array(z.string()).optional(),
      bpmMin: z.number().int().optional(),
      bpmMax: z.number().int().optional(),
      typicalKeys: z.array(z.string()).optional(),
      daw: z.string().optional(),
      signatureTags: z.array(z.string()).optional(),
      turnaroundDays: z.number().int().optional(),
    }),
  },
  engineering: {
    label: 'Engineering',
    roles: ['mix', 'mastering', 'vocal_editor', 'tuning'],
    attributeSchema: z.object({
      genreSpecialism: z.array(z.string()).optional(),
      stemCapacity: z.number().int().optional(),
      revisionPolicy: z.string().optional(),
      loudnessTargets: z.array(z.string()).optional(),
    }),
  },
  players: {
    label: 'Players',
    roles: [
      'guitar',
      'bass',
      'drums',
      'keys',
      'tabla',
      'sitar',
      'flute',
      'strings',
      'brass',
      'percussion',
    ],
    attributeSchema: z.object({
      instrument: z.string().optional(),
      style: z.array(z.string()).optional(),
      readingVsByEar: z.enum(['reading', 'by_ear', 'both']).optional(),
      remoteVsInPerson: z.enum(['remote', 'in_person', 'both']).optional(),
      homeRig: z.boolean().optional(),
    }),
  },
  stage: {
    label: 'Stage',
    roles: ['dj', 'live_band_member', 'hype', 'md', 'backline_tech', 'foh_engineer'],
    attributeSchema: z.object({
      city: z.string().optional(),
      travelRadiusKm: z.number().int().optional(),
      rateBand: z.string().optional(),
      riderNeeds: z.array(z.string()).optional(),
    }),
  },
  visual: {
    label: 'Visual',
    roles: [
      'video_director',
      'dop',
      'editor',
      'vfx',
      'cover_artist',
      'photographer',
      'stylist',
      'choreographer',
    ],
    attributeSchema: z.object({
      styleTags: z.array(z.string()).optional(),
      budgetBand: z.string().optional(),
      turnaroundDays: z.number().int().optional(),
      showreelUrl: z.string().url().optional(),
    }),
  },
  business: {
    label: 'Business',
    roles: ['manager', 'booking_agent', 'publicist', 'label_scout', 'studio_owner'],
    attributeSchema: z.object({
      rosterSize: z.number().int().optional(),
      genres: z.array(z.string()).optional(),
      territories: z.array(z.string()).optional(),
      terms: z.string().optional(),
    }),
  },
} as const;

export type RoleFamily = keyof typeof ROLE_FAMILIES;

export const ALL_ROLES = Object.values(ROLE_FAMILIES).flatMap((f) => f.roles);

export function familyForRole(role: string): RoleFamily | undefined {
  return (Object.keys(ROLE_FAMILIES) as RoleFamily[]).find((family) =>
    (ROLE_FAMILIES[family].roles as readonly string[]).includes(role),
  );
}

export function isValidRole(role: string): boolean {
  return familyForRole(role) !== undefined;
}

export function attributeSchemaForRole(role: string) {
  const family = familyForRole(role);
  return family ? ROLE_FAMILIES[family].attributeSchema : undefined;
}
