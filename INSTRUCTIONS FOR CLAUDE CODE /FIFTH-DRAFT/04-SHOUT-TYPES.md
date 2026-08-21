# 04 — Shout Type Registry

**This file is the reason the platform is one product.**

Every type-specific behaviour is configuration in `packages/shout-types/registry.ts`. The match engine, the settlement rail and the UI read this registry. **They never branch on type.**

## The contract

```ts
export interface ShoutTypeConfig {
  id: ShoutType;
  label: string;
  wave: 1 | 2 | 3 | 4;
  poster: OrgType[];              // who may post
  responder: 'artist' | 'org' | 'work';
  slotRoles: readonly string[];   // valid roles for a slot of this type
  compModels: readonly CompModel[];
  minSlots: number; maxSlots: number;
  attributeSchema: ZodSchema;     // validates slot_slots.attributes
  matchWeights: Partial<Record<MatchFactor, number>>;
  closesWith: CloseCondition;     // 'split_sheet' | 'contract' | 'scorecard' | 'licence'
  requiresVerifiedIdentity: boolean;
  requiresEscrow: boolean;
}
```

## The twelve

| id | Wave | Poster | Responder | Closes with |
|---|---|---|---|---|
| `collab` | 1 | artist, manager | artist | split_sheet |
| `gig` | 1 | organiser, venue, brand, manager | artist | contract |
| `band` | 2 | artist | artist | none (informal) |
| `crew` | 2 | artist, manager | artist | contract |
| `venue` | 2 | artist, venue | both | contract |
| `rehearsal` | 2 | artist | venue | contract |
| `open` | 3 | platform | artist | scorecard |
| `brand` | 3 | brand | artist | contract |
| `sync` | 4 | brand, organiser | **work** | licence |
| `label_pitch` | 4 | artist, manager | org | none |
| `mentor` | 4 | artist | artist | contract |
| `gear` | 4 | artist | org, artist | contract |

## Worked examples

```ts
collab: {
  id: 'collab', label: 'Collab', wave: 1,
  poster: ['manager','self','agency'],
  responder: 'artist',
  slotRoles: ['vocalist','topliner','rapper','backing_vocalist','songwriter',
              'lyricist','hook_writer','beat_producer','instrumental_producer',
              'sound_designer','mix_engineer','mastering_engineer','vocal_editor',
              'arranger','session_guitar','session_bass','session_drums','session_keys',
              'tabla','sitar','flute','strings','brass','percussion',
              'video_director','dop','editor','cover_artist','photographer'],
  compModels: ['fee','points','hybrid','credit'],
  minSlots: 1, maxSlots: 6,
  attributeSchema: z.object({
    genres: z.array(z.string()).optional(),
    bpm: z.number().int().min(40).max(220).optional(),
    key: z.string().optional(),
    languages: z.array(z.string()).optional(),
    vocalRange: z.enum(['bass','baritone','tenor','alto','mezzo','soprano']).optional(),
    timbre: z.array(z.string()).optional(),
    turnaroundDays: z.number().int().optional(),
    revisionsIncluded: z.number().int().optional(),
  }),
  matchWeights: { roleMatch: .30, attributeFit: .30, availability: .10,
                  priceBandFit: .10, reliability: .15, responsiveness: .05 },
  closesWith: 'split_sheet',
  requiresVerifiedIdentity: true,   // for paid slots
  requiresEscrow: true,
},

gig: {
  id: 'gig', label: 'Gig', wave: 1,
  poster: ['organiser','venue','brand','manager','self'],
  responder: 'artist',
  slotRoles: ['headliner','support','dj','live_band','solo','mc'],
  compModels: ['fee'],
  minSlots: 1, maxSlots: 8,          // a lineup is one Shout with many slots
  attributeSchema: z.object({
    genres: z.array(z.string()),
    eventType: z.enum(['wedding','corporate','festival','club','college','private','government']),
    crowdSize: z.number().int().optional(),
    setLengthMins: z.number().int().optional(),
    backlineProvided: z.boolean().optional(),
    travelCovered: z.boolean().optional(),
  }),
  matchWeights: { roleMatch: .20, attributeFit: .20, availability: .25,
                  priceBandFit: .15, reliability: .15, responsiveness: .05 },
  closesWith: 'contract',
  requiresVerifiedIdentity: true,
  requiresEscrow: true,
},

band: {
  id: 'band', label: 'Band', wave: 2,
  poster: ['self','manager'],
  responder: 'artist',
  slotRoles: ['guitar','bass','drums','keys','vocals','other'],
  compModels: ['credit'],            // equity in the band, not a fee
  minSlots: 1, maxSlots: 6,
  attributeSchema: z.object({
    influences: z.array(z.string()).optional(),
    commitment: z.enum(['hobby','gigging','touring']),
    originalVsCovers: z.enum(['originals','covers','both']),
    rehearsalCity: z.string(),
  }),
  matchWeights: { roleMatch: .35, attributeFit: .35, availability: .10,
                  priceBandFit: 0, reliability: .15, responsiveness: .05 },
  closesWith: 'none',
  requiresVerifiedIdentity: false,
  requiresEscrow: false,
},
```

`sync` is the interesting one: `responder: 'work'`. The answer is a catalogue row, not a person. **Same object, same engine, different responder entity resolved by the registry.**

## Adding a thirteenth type

1. Add a config object to `registry.ts`
2. Add its `slotRoles` to the role vocabulary
3. Add its `attributeSchema`
4. Add copy strings
5. Ship

**No migration. No new table. No change to `packages/match` or `packages/money`.**

If a new type cannot be expressed this way, that is a signal the registry is missing a field — add the field. It is **never** a signal to branch.

## The rule, restated

```ts
// ❌ NEVER
if (shout.type === 'gig') { checkAvailability() }

// ✅ ALWAYS
const cfg = registry[shout.type];
if (cfg.matchWeights.availability > 0) { checkAvailability() }
```

A single `if (type === ...)` in `packages/match` or `packages/money` is a failed code review.
