import type { SupabaseClient } from '@supabase/supabase-js';
import { ModuleError } from './errors';

// Public, unauthenticated reads for both sides of the marketplace.
//
// docs/04-PROFILES.md treats public pages as the SEO engine and says a
// visitor should be able to judge someone before contacting them — which
// needs media, releases and past work, not just a name and a city. All of
// it goes through migration 022's SECURITY DEFINER functions rather than
// the tables: those are RLS-scoped to the owning org, so a cross-org read
// returns nothing.

export interface ArtistMedia {
  kind: 'image' | 'audio' | 'video';
  url: string;
  title: string | null;
  is_primary: boolean;
}

export interface Album {
  title: string;
  release_year: number | null;
  cover_url: string | null;
  track_count: number | null;
  label: string | null;
}

export interface Performance {
  event_name: string;
  venue: string | null;
  city: string | null;
  performed_on: string | null;
  crowd_size: number | null;
  image_url: string | null;
}

export interface OrganiserProfile {
  id: string;
  slug: string;
  display_name: string;
  home_city: string | null;
  bio: string | null;
  logo_url: string | null;
  founded_year: number | null;
  event_types: string[];
  verified: boolean;
  event_count?: number;
}

export interface OrganiserEvent {
  title: string;
  venue: string | null;
  city: string | null;
  held_on: string | null;
  attendance: number | null;
  image_url: string | null;
  headliners: string[];
}

async function rpc<T>(
  supabase: SupabaseClient,
  fn: string,
  args: Record<string, unknown>,
): Promise<T[]> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new ModuleError('QUERY_FAILED', error.message);
  return (data ?? []) as T[];
}

export function getArtistMedia(supabase: SupabaseClient, artistId: string) {
  return rpc<ArtistMedia>(supabase, 'get_artist_media_public', { p_artist_id: artistId });
}

export function getArtistAlbums(supabase: SupabaseClient, artistId: string) {
  return rpc<Album>(supabase, 'get_artist_albums_public', { p_artist_id: artistId });
}

export function getArtistPerformances(supabase: SupabaseClient, artistId: string) {
  return rpc<Performance>(supabase, 'get_artist_performances_public', { p_artist_id: artistId });
}

export interface OrganiserSearchFilter {
  city?: string | undefined;
  eventType?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

export function searchOrganisers(supabase: SupabaseClient, filter: OrganiserSearchFilter) {
  return rpc<OrganiserProfile>(supabase, 'search_organisers_public', {
    p_city: filter.city ?? null,
    p_event_type: filter.eventType ?? null,
    p_limit: filter.limit ?? 24,
    p_offset: filter.offset ?? 0,
  });
}

export async function getOrganiser(
  supabase: SupabaseClient,
  slug: string,
): Promise<OrganiserProfile | null> {
  const rows = await rpc<OrganiserProfile>(supabase, 'get_organiser_public', { p_slug: slug });
  return rows[0] ?? null;
}

export function getOrganiserEvents(supabase: SupabaseClient, organiserId: string) {
  return rpc<OrganiserEvent>(supabase, 'get_organiser_events_public', {
    p_organiser_id: organiserId,
  });
}

export interface Credit {
  work_title: string;
  role: string;
  writer_pct: number | null;
  master_pct: number | null;
  published_at: string;
}

export interface ReliabilityScore {
  role: string;
  score: number;
  completed_n: number;
  avg_rating: number | null;
}

/**
 * Verified credits — only works that are locked with every contributor
 * signed (migration 024). An unsigned claim never reaches a public page.
 */
export function getArtistCredits(supabase: SupabaseClient, artistId: string) {
  return rpc<Credit>(supabase, 'get_artist_credits_public', { p_artist_id: artistId });
}

/**
 * Reliability, held per role. Returns nothing below five completed bookings
 * for that role — a new artist has no score rather than a bad one.
 */
export function getArtistReliability(supabase: SupabaseClient, artistId: string) {
  return rpc<ReliabilityScore>(supabase, 'get_artist_reliability_public', {
    p_artist_id: artistId,
  });
}
