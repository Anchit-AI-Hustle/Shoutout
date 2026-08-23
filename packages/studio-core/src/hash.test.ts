import { describe, it, expect } from 'vitest';
import { canonicalJson, computeSectionHash, renderCost } from './hash';

describe('canonicalJson', () => {
  it('sorts keys so key order cannot change the address', () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe(canonicalJson({ a: 2, b: 1 }));
  });
  it('matches Postgres jsonb text formatting', () => {
    // Postgres renders: {"a": 1, "b": [1, 2]}
    expect(canonicalJson({ b: [1, 2], a: 1 })).toBe('{"a": 1, "b": [1, 2]}');
  });
});

describe('computeSectionHash', () => {
  const base = {
    spec: { density: 'full' },
    seed: 33,
    pipelineVersion: 'v1',
    modelVersion: 'v1',
  };

  it('is stable for identical input', () => {
    expect(computeSectionHash(base)).toBe(computeSectionHash({ ...base }));
  });

  it('changes when the seed changes — this is how one unit is revised', () => {
    expect(computeSectionHash({ ...base, seed: 34 })).not.toBe(computeSectionHash(base));
  });

  it('changes when the spec changes', () => {
    expect(computeSectionHash({ ...base, spec: { density: 'sparse' } })).not.toBe(
      computeSectionHash(base),
    );
  });

  it('changes when the pipeline version changes, invalidating old audio', () => {
    expect(computeSectionHash({ ...base, pipelineVersion: 'v2' })).not.toBe(
      computeSectionHash(base),
    );
  });

  it('agrees with the value migration 031 produces for the same input', () => {
    // Pinned from compute_section_hash('{"density": "full"}'::jsonb, 33, 'v1', 'v1')
    // run against production. If this fails, the client and the database
    // disagree about what has already been rendered.
    expect(computeSectionHash(base)).toBe(
      'e01e133ba6ba7d94b073ac84d896a641e440d8a011c1d2b3fb8384ff6a6a3f2a',
    );
  });
});

describe('renderCost', () => {
  it('quotes a one-section revision as one section', () => {
    const cost = renderCost([
      { id: '1', contentHash: 'a', state: 'rendered' },
      { id: '2', contentHash: 'b', state: 'rendered' },
      { id: '3', contentHash: 'c', state: 'planned' },
      { id: '4', contentHash: 'd', state: 'rendered' },
    ]);
    expect(cost).toEqual({ toRender: 1, reused: 3, total: 4 });
  });
  it('counts a failed section as needing a render', () => {
    expect(renderCost([{ id: '1', contentHash: 'a', state: 'failed' }]).toRender).toBe(1);
  });
});
