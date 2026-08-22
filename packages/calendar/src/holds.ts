import type { SupabaseClient } from '@supabase/supabase-js';
import { ModuleError } from './errors';

// Holds — availability + calendar-blocking for Gigs (docs/03-DATA-MODEL.md
// §004, docs/05-GIGS.md §4). Shared with Rehearsal/Crew per
// docs/02-ARCHITECTURE.md, though only Gigs calls it today.
//
// NOT implemented here: auto-release on expiry. docs/05-GIGS.md — "Auto-
// release fires from a scheduled job, never a user action" — that's an
// Inngest step.sleepUntil (docs/02-ARCHITECTURE.md), and Inngest isn't
// wired into this project yet (same category of gap as WhatsApp/PDF brief
// parsing). What IS implemented: confirmHold refuses a hold whose
// expires_at has already passed (migration 012's confirm_hold, HOLD_EXPIRED)
// — a stale hold can't be confirmed, it just doesn't get proactively swept
// and marked 'expired' until that job exists.

const MAX_SOFT_PRIORITY = 3; // enquiry/soft_1/soft_2/soft_3 — docs/03-DATA-MODEL.md's state enum

export interface CreateHoldInput {
  orgId: string;
  artistId: string;
  eventDate: string; // YYYY-MM-DD
  briefId?: string | undefined;
  holdDurationHours?: number | undefined;
}

// Priority reflects "Hold 1 has right of first refusal" (docs/05-GIGS.md):
// counted from other still-active holds on this artist+date, not assigned
// by the caller.
export async function createHold(supabase: SupabaseClient, input: CreateHoldInput) {
  const { count, error: countError } = await supabase
    .from('holds')
    .select('id', { count: 'exact', head: true })
    .eq('artist_id', input.artistId)
    .eq('event_date', input.eventDate)
    .in('state', ['enquiry', 'soft_1', 'soft_2', 'soft_3']);

  if (countError) throw new ModuleError('QUERY_FAILED', countError.message);

  const priority = (count ?? 0) + 1;
  if (priority > MAX_SOFT_PRIORITY) {
    throw new ModuleError(
      'VALIDATION_FAILED',
      `This date already has ${MAX_SOFT_PRIORITY} active holds for this artist — the queue is full`,
    );
  }

  const durationHours = input.holdDurationHours ?? 72;
  const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('holds')
    .insert({
      org_id: input.orgId,
      artist_id: input.artistId,
      brief_id: input.briefId ?? null,
      event_date: input.eventDate,
      state: `soft_${priority}`,
      priority,
      expires_at: expiresAt,
    })
    .select('*')
    .single();

  if (error) throw new ModuleError('INSERT_FAILED', error.message);
  return data;
}

// "When challenged it has 48 hours to confirm or drop" (docs/05-GIGS.md) —
// tightens expires_at to 48h out if it was further away; never extends it.
export async function challengeHold(supabase: SupabaseClient, holdId: string) {
  const { data: hold, error: fetchError } = await supabase
    .from('holds')
    .select('expires_at')
    .eq('id', holdId)
    .maybeSingle();
  if (fetchError) throw new ModuleError('QUERY_FAILED', fetchError.message);
  if (!hold) throw new ModuleError('NOT_FOUND', 'Hold not found');

  const fortyEightHoursOut = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const nextExpiry =
    hold.expires_at && hold.expires_at < fortyEightHoursOut ? hold.expires_at : fortyEightHoursOut;

  const { data, error } = await supabase
    .from('holds')
    .update({ challenged_at: new Date().toISOString(), expires_at: nextExpiry })
    .eq('id', holdId)
    .select('*')
    .maybeSingle();

  if (error) throw new ModuleError('UPDATE_FAILED', error.message);
  if (!data) throw new ModuleError('NOT_FOUND', 'Hold not found');
  return data;
}

// The one multi-table transition — delegates to migration 012's
// confirm_hold RPC so the state flip and the booking insert are atomic.
// Translates the partial unique index's 23505 into the documented
// DATE_ALREADY_CONFIRMED (docs/12-API.md).
export async function confirmHold(
  supabase: SupabaseClient,
  holdId: string,
  feePaise?: number | undefined,
) {
  const { data, error } = await supabase.rpc('confirm_hold', {
    p_hold_id: holdId,
    p_fee_paise: feePaise ?? null,
  });

  if (error) {
    if (error.code === '23505') {
      throw new ModuleError('DATE_ALREADY_CONFIRMED', 'This artist already has a confirmed date');
    }
    if (error.message.includes('NOT_FOUND')) throw new ModuleError('NOT_FOUND', 'Hold not found');
    if (error.message.includes('HOLD_EXPIRED'))
      throw new ModuleError('HOLD_EXPIRED', 'This hold has expired');
    if (error.message.includes('INVALID_TRANSITION'))
      throw new ModuleError('INVALID_TRANSITION', error.message);
    if (error.message.includes('VALIDATION_FAILED'))
      throw new ModuleError('VALIDATION_FAILED', error.message);
    throw new ModuleError('CONFIRM_FAILED', error.message);
  }

  return data;
}

export async function releaseHold(supabase: SupabaseClient, holdId: string) {
  const { data, error } = await supabase
    .from('holds')
    .update({ state: 'released', released_at: new Date().toISOString() })
    .eq('id', holdId)
    .not(
      'state',
      'in',
      '(confirmed,contracted,advance_paid,performed,settled,closed,released,cancelled,expired)',
    )
    .select('*')
    .maybeSingle();

  if (error) throw new ModuleError('UPDATE_FAILED', error.message);
  if (!data) {
    throw new ModuleError('INVALID_TRANSITION', 'Hold not found, or already in a terminal state');
  }
  return data;
}

export interface CalendarEntry {
  id: string;
  artist_id: string;
  artist_name: string;
  event_date: string;
  state: string;
  priority: number;
  expires_at: string;
}

// Roster-wide calendar (docs/12-API.md: "GET /api/gigs/calendar?from=&to=
// roster-wide"). RLS already scopes this to the caller's org — the date
// range is the only filter this needs to add.
export async function listCalendar(
  supabase: SupabaseClient,
  from: string,
  to: string,
): Promise<CalendarEntry[]> {
  const { data, error } = await supabase
    .from('holds')
    .select('id, artist_id, event_date, state, priority, expires_at, artists(stage_name)')
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
      state: row.state as string,
      priority: row.priority as number,
      expires_at: row.expires_at as string,
    };
  });
}
