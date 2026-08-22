import type { SupabaseClient } from '@supabase/supabase-js';
import { scoreByGenreAndCity } from '@shoutout/discovery';
import { ModuleError } from './errors';

export interface ShortlistEntry {
  artistId: string;
  artistName: string;
  score: number;
  components: { genreFit: number; cityFit: number };
}

interface RosterArtistRow {
  id: string;
  stage_name: string;
  genres: string[] | null;
  home_city: string | null;
}

// GET /api/gigs/briefs/:id/shortlist (docs/12-API.md). A GET that also
// writes is a small REST-purity compromise, deliberate: the shortlist
// should always reflect the roster and calendar as they stand right now,
// and docs/12-API.md's "score_components... an unexplained ranking is not
// trusted" implies each run should be auditable after the fact — so every
// call both recomputes AND persists to `shortlists` (upsert, so re-running
// updates the same rows rather than accumulating duplicates).
export async function shortlistForBrief(
  supabase: SupabaseClient,
  orgId: string,
  briefId: string,
): Promise<ShortlistEntry[]> {
  const { data: brief, error: briefError } = await supabase
    .from('briefs')
    .select('genres, city, event_date')
    .eq('id', briefId)
    .maybeSingle();
  if (briefError) throw new ModuleError('QUERY_FAILED', briefError.message);
  if (!brief) throw new ModuleError('NOT_FOUND', 'Brief not found');

  const { data: rosterRows, error: rosterError } = await supabase
    .from('roster')
    .select('artist_id, artists(id, stage_name, genres, home_city)')
    .eq('org_id', orgId);
  if (rosterError) throw new ModuleError('QUERY_FAILED', rosterError.message);

  const artists = (rosterRows ?? [])
    .map((r) => r.artists as unknown as RosterArtistRow | null)
    .filter((a): a is RosterArtistRow => a !== null);

  if (artists.length === 0) return [];

  // "Never surface an artist already held on that date" (docs/05-GIGS.md)
  // — a hard exclusion, not a score penalty.
  let heldArtistIds = new Set<string>();
  if (brief.event_date) {
    const { data: heldRows, error: heldError } = await supabase
      .from('holds')
      .select('artist_id')
      .eq('event_date', brief.event_date)
      .in('state', ['confirmed', 'contracted', 'advance_paid', 'performed', 'settled']);
    if (heldError) throw new ModuleError('QUERY_FAILED', heldError.message);
    heldArtistIds = new Set((heldRows ?? []).map((r) => r.artist_id as string));
  }

  const entries: ShortlistEntry[] = artists
    .filter((a) => !heldArtistIds.has(a.id))
    .map((a) => {
      const { score, components } = scoreByGenreAndCity(
        { genres: brief.genres ?? [], city: brief.city },
        { genres: a.genres ?? [], city: a.home_city },
      );
      return { artistId: a.id, artistName: a.stage_name, score, components };
    })
    .sort((x, y) => y.score - x.score);

  if (entries.length > 0) {
    const { error: upsertError } = await supabase.from('shortlists').upsert(
      entries.map((e) => ({
        org_id: orgId,
        brief_id: briefId,
        artist_id: e.artistId,
        score: e.score,
        components: e.components,
      })),
      { onConflict: 'brief_id,artist_id' },
    );
    if (upsertError) throw new ModuleError('INSERT_FAILED', upsertError.message);

    await supabase
      .from('briefs')
      .update({ status: 'shortlisted', updated_at: new Date().toISOString() })
      .eq('id', briefId)
      .eq('status', 'open');
  }

  return entries;
}
