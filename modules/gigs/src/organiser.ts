import type { SupabaseClient } from '@supabase/supabase-js';
import { ModuleError } from './errors';

// The organiser side of Gigs — search for artists, book one as a signed-in
// organiser, track what you've requested, and see a calendar of what's
// actually confirmed. Everything here relies on migration 019's
// requesting_org_id link and the two-sided RLS it added to
// briefs/quotes/bookings; these functions don't add any authorization
// logic of their own beyond what RLS + the RPCs already enforce.

export interface SearchArtistsFilter {
  genre?: string | undefined;
  city?: string | undefined;
  role?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

export interface ArtistSearchResult {
  id: string;
  stage_name: string;
  slug: string;
  home_city: string | null;
  genres: string[];
  bio: string | null;
  verified: boolean;
  /** docs/04-PROFILES.md: fee band is hidden unless the artist opts in. */
  fee_band_visible: boolean;
  /** Active roles only. Per-role matching is the point (migration 021). */
  roles: string[];
  /** Primary press shot, if the artist has uploaded one. */
  image_url: string | null;
  album_count: number;
  performance_count: number;
  track_count: number;
}

export async function searchArtists(
  supabase: SupabaseClient,
  filter: SearchArtistsFilter,
): Promise<ArtistSearchResult[]> {
  const { data, error } = await supabase.rpc('search_artists_public', {
    p_genre: filter.genre ?? null,
    p_city: filter.city ?? null,
    p_role: filter.role ?? null,
    p_limit: filter.limit ?? 24,
    p_offset: filter.offset ?? 0,
  });
  if (error) throw new ModuleError('QUERY_FAILED', error.message);
  return (data ?? []) as ArtistSearchResult[];
}

export interface BookAsOrganiserInput {
  artistId: string;
  eventDate?: string | undefined;
  city: string;
  eventType: string;
  genres?: string[] | undefined;
  budgetMinPaise?: number | undefined;
  budgetMaxPaise?: number | undefined;
  crowdSize?: number | undefined;
  notes?: string | undefined;
}

// The signed-in equivalent of createPublicBrief (briefs.ts) — same target
// artist, same brief shape, but the caller's own org_id and account
// identity (auth.users.phone) are attached instead of client-supplied
// free-text name/phone.
export async function bookAsOrganiser(supabase: SupabaseClient, input: BookAsOrganiserInput) {
  const { data, error } = await supabase.rpc('create_authenticated_brief_for_artist', {
    p_artist_id: input.artistId,
    p_event_date: input.eventDate ?? null,
    p_city: input.city,
    p_event_type: input.eventType,
    p_genres: input.genres ?? [],
    p_budget_min_paise: input.budgetMinPaise ?? null,
    p_budget_max_paise: input.budgetMaxPaise ?? null,
    p_crowd_size: input.crowdSize ?? null,
    p_notes: input.notes ?? null,
  });

  if (error) {
    if (error.message.includes('NOT_FOUND')) throw new ModuleError('NOT_FOUND', 'Artist not found');
    if (error.message.includes('UNAUTHENTICATED'))
      throw new ModuleError('UNAUTHENTICATED', 'Sign in required');
    throw new ModuleError('INSERT_FAILED', error.message);
  }
  return data as string; // brief id
}

// "My requests" — every brief this org has submitted, regardless of which
// artist's org ends up handling it. Explicitly filtered on
// requesting_org_id rather than relying on RLS alone to select the right
// rows — this function's whole point is "the organiser's own list," not
// "everything RLS happens to allow."
export async function listMyRequests(supabase: SupabaseClient, orgId: string) {
  const { data, error } = await supabase
    .from('briefs')
    .select('*')
    .eq('requesting_org_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw new ModuleError('QUERY_FAILED', error.message);
  return data ?? [];
}

export interface OrganiserCalendarEntry {
  id: string;
  artist_id: string;
  artist_name: string;
  event_date: string;
  status: string;
  fee_paise: number;
}

// The organiser's own calendar — confirmed bookings only (not soft holds;
// those are the artist side's internal pipeline state, not something an
// organiser plans around yet), across every artist they've booked through
// ShoutOut, in one place — "plan their schedule completely," not one
// artist at a time.
export async function listMyCalendar(
  supabase: SupabaseClient,
  orgId: string,
  from: string,
  to: string,
): Promise<OrganiserCalendarEntry[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select(
      'id, artist_id, event_date, status, fee_paise, briefs!inner(requesting_org_id), artists(stage_name)',
    )
    .eq('briefs.requesting_org_id', orgId)
    .gte('event_date', from)
    .lte('event_date', to)
    .order('event_date', { ascending: true });

  if (error) throw new ModuleError('QUERY_FAILED', error.message);

  return (data ?? []).map((row) => {
    const artist = row.artists as unknown as { stage_name: string } | null;
    return {
      id: row.id as string,
      artist_id: row.artist_id as string,
      artist_name: artist?.stage_name ?? 'Unknown',
      event_date: row.event_date as string,
      status: row.status as string,
      fee_paise: row.fee_paise as number,
    };
  });
}
