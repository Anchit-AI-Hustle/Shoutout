import { describe, it, expect } from 'vitest';
import { renderPlanText, summarisePlan } from './plan-text';
import { generationPlanSchema, musicBriefSchema } from './brief';
import type { GenerationPlan } from './brief';

const brief = musicBriefSchema.parse({
  genre: 'indie-pop',
  bpm: 104,
  key: 'A',
  mode: 'minor',
  mood: ['wistful'],
  instrumentation: ['guitar', 'synth'],
  vocals: { present: true, style: 'breathy', register: 'mid' },
});

const single: GenerationPlan = {
  kind: 'single',
  title: 'Monsoon Static',
  brief,
  tracks: [
    {
      title: 'Monsoon Static',
      sections: [
        { kind: 'intro', bars: 4, density: 'sparse' },
        { kind: 'verse', bars: 16, density: 'medium', transition_in: 'drum_fill' },
        { kind: 'chorus', bars: 16, density: 'full', transition_in: 'riser', notes: 'Lift here' },
      ],
    },
  ],
};

describe('the plan you approve', () => {
  it('names every section with its length, so a wrong structure is visible', () => {
    const text = renderPlanText(single);
    expect(text).toContain('intro');
    expect(text).toContain('verse');
    expect(text).toContain('chorus');
    expect(text).toContain('4 bars');
    expect(text).toContain('16 bars');
  });

  it('surfaces transitions, which were a logged failure area', () => {
    const text = renderPlanText(single);
    expect(text).toContain('drum fill');
    expect(text).toContain('riser');
  });

  it('states that nothing renders before approval', () => {
    expect(renderPlanText(single)).toMatch(/Nothing renders until you approve/);
  });

  it('counts the sections that would be generated', () => {
    expect(renderPlanText(single)).toContain('3 sections will be generated');
  });

  it('describes vocals rather than leaving them implicit', () => {
    expect(renderPlanText(single)).toContain('Vocals: breathy, mid');
  });

  it('says Instrumental when there are no vocals', () => {
    const instrumental = {
      ...single,
      brief: musicBriefSchema.parse({ ...brief, vocals: { present: false } }),
    };
    expect(renderPlanText(instrumental)).toContain('Instrumental');
  });
});

describe('album mode', () => {
  const album: GenerationPlan = {
    kind: 'album',
    title: 'Coastal Frequency',
    brief: musicBriefSchema.parse({
      ...brief,
      bpm: 120,
      drift: { brightness: 0.2, energy: 0, tempo_pct: 0.05 },
    }),
    tracks: [1, 2, 3].map((n) => ({
      title: `Track ${n}`,
      sections: [{ kind: 'verse' as const, bars: 16, density: 'medium' as const }],
    })),
  };

  it('numbers the tracklist', () => {
    const text = renderPlanText(album);
    expect(text).toContain('1. Track 1');
    expect(text).toContain('3. Track 3');
    expect(text).toContain('3 tracks');
  });

  it('shows drift as a concrete delta, not a coefficient', () => {
    const text = renderPlanText(album);
    // Track 1 is the reference point, so it carries no drift line.
    expect(text).toContain('126 BPM'); // track 2: 120 * 1.05
    expect(text).toContain('132 BPM'); // track 3: 120 * 1.10
    expect(text).toContain('brighter');
    expect(text).not.toContain('tempo_pct');
  });

  it('summarises for a list view', () => {
    expect(summarisePlan(album)).toBe('3 tracks · 3 sections · 120 BPM A');
  });
});

describe('schema', () => {
  it('rejects an out-of-range BPM', () => {
    expect(() => musicBriefSchema.parse({ ...brief, bpm: 400 })).toThrow();
  });
  it('rejects a plan with no tracks', () => {
    expect(() => generationPlanSchema.parse({ ...single, tracks: [] })).toThrow();
  });
  it('rejects an unknown section kind', () => {
    expect(() =>
      generationPlanSchema.parse({
        ...single,
        tracks: [{ title: 'x', sections: [{ kind: 'chorus_2', bars: 4 }] }],
      }),
    ).toThrow();
  });
});
