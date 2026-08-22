import type { SupabaseClient } from '@supabase/supabase-js';
import { ModuleError } from './errors';

// Riders (docs/05-GIGS.md §5): backline, travel, hospitality, both sides
// tick off, timestamped. Reusable templates per artist are NOT modelled
// (flagged in migration 012's comment) — every rider starts blank. T-7/T-2
// reminders are the deferred Inngest piece, same category as hold
// auto-release (docs/02-ARCHITECTURE.md).

export interface RiderContent {
  backline?: Record<string, unknown> | undefined;
  travel?: Record<string, unknown> | undefined;
  hospitality?: Record<string, unknown> | undefined;
}

// One rider per booking (migration 012: unique(booking_id)) — upsert on
// that constraint so repeated saves from the edit form update in place.
export async function upsertRider(
  supabase: SupabaseClient,
  orgId: string,
  bookingId: string,
  content: RiderContent,
) {
  const { data, error } = await supabase
    .from('riders')
    .upsert(
      {
        org_id: orgId,
        booking_id: bookingId,
        backline: content.backline ?? {},
        travel: content.travel ?? {},
        hospitality: content.hospitality ?? {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'booking_id' },
    )
    .select('*')
    .single();

  if (error) throw new ModuleError('UPSERT_FAILED', error.message);
  return data;
}

export async function getRider(supabase: SupabaseClient, bookingId: string) {
  const { data, error } = await supabase
    .from('riders')
    .select('*')
    .eq('booking_id', bookingId)
    .maybeSingle();
  if (error) throw new ModuleError('QUERY_FAILED', error.message);
  if (!data) throw new ModuleError('NOT_FOUND', 'No rider for this booking yet');
  return data;
}

// The manager confirms on the artist's behalf — the artist doesn't have a
// separate confirmation surface in this build (same simplification as
// "manager is the account", consistent with the rest of Gigs' authenticated
// side being manager-only).
export async function confirmArtistSide(supabase: SupabaseClient, bookingId: string) {
  const { data, error } = await supabase
    .from('riders')
    .update({ artist_confirmed_at: new Date().toISOString() })
    .eq('booking_id', bookingId)
    .select('*')
    .maybeSingle();
  if (error) throw new ModuleError('UPDATE_FAILED', error.message);
  if (!data) throw new ModuleError('NOT_FOUND', 'No rider for this booking yet');
  return data;
}

// Organiser side has no account — possession-of-link, same pattern as
// Credits' contributor signing (migration 007's sign_as_contributor).
export async function getRiderPublic(supabase: SupabaseClient, bookingId: string, token: string) {
  const { data, error } = await supabase.rpc('get_rider_public', {
    p_booking_id: bookingId,
    p_token: token,
  });
  if (error) throw new ModuleError('QUERY_FAILED', error.message);
  const rider = data?.[0];
  if (!rider) throw new ModuleError('NOT_FOUND', 'Rider not found');
  return rider;
}

export async function confirmRiderPublic(
  supabase: SupabaseClient,
  bookingId: string,
  token: string,
) {
  const { data, error } = await supabase.rpc('confirm_rider_public', {
    p_booking_id: bookingId,
    p_token: token,
  });
  if (error) throw new ModuleError('CONFIRM_FAILED', error.message);
  if (!data)
    throw new ModuleError(
      'ALREADY_CONFIRMED',
      'This rider is already confirmed, or the link is invalid',
    );
  return true;
}
