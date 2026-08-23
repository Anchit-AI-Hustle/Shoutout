import { createHash } from 'node:crypto';

// The content address for one generated unit.
//
// This MUST agree byte-for-byte with compute_section_hash() in migration
// 031. If the two ever disagree, the client predicts a cache hit the
// database does not honour (or vice versa) and "revise one unit" silently
// becomes "re-render everything" — the exact failure the pattern exists to
// prevent. There is a test that pins the format.
//
// Postgres renders jsonb with sorted keys and no insignificant whitespace,
// so the JS side has to do the same or identical specs would hash
// differently depending on which side built them.

/** Serialises like Postgres jsonb: keys sorted, no gratuitous whitespace. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(', ')}]`;

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}: ${canonicalJson(v)}`).join(', ')}}`;
}

export interface SectionAddress {
  spec: Record<string, unknown>;
  seed: number | bigint;
  pipelineVersion: string;
  modelVersion: string;
}

export function computeSectionHash(address: SectionAddress): string {
  const payload = [
    canonicalJson(address.spec ?? {}),
    String(address.seed),
    address.pipelineVersion,
    address.modelVersion,
  ].join('|');
  return createHash('sha256').update(payload).digest('hex');
}

export interface SectionLike {
  id: string;
  contentHash: string;
  state: 'planned' | 'rendering' | 'rendered' | 'failed' | 'reused';
}

/**
 * What a render would actually cost.
 *
 * Shown before compute is spent and again after a revision, so "regenerate
 * the chorus" can be quoted honestly as one section rather than implying a
 * whole re-run.
 */
export function renderCost(sections: SectionLike[]): {
  toRender: number;
  reused: number;
  total: number;
} {
  const toRender = sections.filter((s) => s.state === 'planned' || s.state === 'failed').length;
  return { toRender, reused: sections.length - toRender, total: sections.length };
}
