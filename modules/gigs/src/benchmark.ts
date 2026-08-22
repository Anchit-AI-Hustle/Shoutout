import type { SupabaseClient } from '@supabase/supabase-js';
import { ModuleError } from './errors';

// The price index (docs/03-DATA-MODEL.md §010, docs/12-API.md: "GET
// /api/gigs/index?genre=&city=&eventType=&crowdBand= → { p25, p50, p75,
// sampleN } | { code: 'INSUFFICIENT_INDEX_DATA' }"). "The system never
// invents a price" — this is a direct read of migration 012's
// benchmark_index matview, never a fallback estimate.
//
// The API doc's query string has no `season` param, but the matview is
// grouped by season (migration 012: calendar quarter). Simplification,
// flagged: this queries the CURRENT quarter only, not "all time" or a
// caller-chosen quarter — a real limitation once there's enough settled
// data to actually see a seasonal split, worth revisiting then.
export type CrowdBand = 'under_100' | '100_to_500' | '500_to_2000' | 'over_2000' | 'unknown';

export interface IndexQuery {
  genre: string;
  city: string;
  eventType: string;
  crowdBand: CrowdBand;
}

export interface IndexResult {
  p25: number;
  p50: number;
  p75: number;
  sampleN: number;
}

export async function getIndex(
  supabase: SupabaseClient,
  query: IndexQuery,
): Promise<IndexResult | { code: 'INSUFFICIENT_INDEX_DATA' }> {
  const season = `Q${Math.floor(new Date().getUTCMonth() / 3) + 1}`;

  const { data, error } = await supabase
    .from('benchmark_index')
    .select('p25, p50, p75, sample_n')
    .eq('genre', query.genre)
    .eq('city', query.city)
    .eq('event_type', query.eventType)
    .eq('crowd_band', query.crowdBand)
    .eq('season', season)
    .maybeSingle();

  if (error) throw new ModuleError('QUERY_FAILED', error.message);
  if (!data) return { code: 'INSUFFICIENT_INDEX_DATA' };

  return {
    p25: Number(data.p25),
    p50: Number(data.p50),
    p75: Number(data.p75),
    sampleN: Number(data.sample_n),
  };
}
