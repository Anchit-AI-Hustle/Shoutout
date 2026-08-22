import type { SupabaseClient } from '@supabase/supabase-js';
import { ModuleError } from './errors';

// Brief intake (docs/05-GIGS.md §1). Three paths in the doc: web form,
// forwarded WhatsApp (auto-parsed), PDF upload (auto-parsed). Only the web
// form is implemented — WhatsApp/PDF parsing needs Claude wired into an
// inbound-message pipeline that doesn't exist yet (same category of gap as
// Profiles' prefill/EPK). POST /api/gigs/briefs/parse is intentionally not
// built, not stubbed.

export interface CreateBriefInput {
  orgId: string;
  eventDate?: string | undefined;
  dateFlexibleUntil?: string | undefined;
  city: string;
  eventType: string;
  genres?: string[] | undefined;
  budgetMinPaise?: number | undefined;
  budgetMaxPaise?: number | undefined;
  crowdSize?: number | undefined;
  notes?: string | undefined;
  organiserId?: string | undefined;
  venueId?: string | undefined;
}

// Authenticated path — a manager logging an inbound enquiry themselves
// (phone call, in-person, anything that isn't the public web form).
export async function createBrief(supabase: SupabaseClient, input: CreateBriefInput) {
  const { data, error } = await supabase
    .from('briefs')
    .insert({
      org_id: input.orgId,
      organiser_id: input.organiserId ?? null,
      venue_id: input.venueId ?? null,
      event_date: input.eventDate ?? null,
      date_flexible_until: input.dateFlexibleUntil ?? null,
      city: input.city,
      event_type: input.eventType,
      genres: input.genres ?? [],
      budget_min_paise: input.budgetMinPaise ?? null,
      budget_max_paise: input.budgetMaxPaise ?? null,
      crowd_size: input.crowdSize ?? null,
      notes: input.notes ?? null,
      source: 'web',
    })
    .select('*')
    .single();

  if (error) throw new ModuleError('INSERT_FAILED', error.message);
  return data;
}

export interface CreatePublicBriefInput {
  artistId: string;
  eventDate?: string | undefined;
  city: string;
  eventType: string;
  genres?: string[] | undefined;
  budgetMinPaise?: number | undefined;
  budgetMaxPaise?: number | undefined;
  crowdSize?: number | undefined;
  notes?: string | undefined;
  organiserName: string;
  organiserPhone: string;
}

// The public "Book this artist" path — see migration 012's
// create_public_brief for why this is routed through a specific artist
// rather than a generic inbound inbox.
export async function createPublicBrief(supabase: SupabaseClient, input: CreatePublicBriefInput) {
  const { data, error } = await supabase.rpc('create_public_brief', {
    p_artist_id: input.artistId,
    p_event_date: input.eventDate ?? null,
    p_city: input.city,
    p_event_type: input.eventType,
    p_genres: input.genres ?? [],
    p_budget_min_paise: input.budgetMinPaise ?? null,
    p_budget_max_paise: input.budgetMaxPaise ?? null,
    p_crowd_size: input.crowdSize ?? null,
    p_notes: input.notes ?? null,
    p_organiser_name: input.organiserName,
    p_organiser_phone: input.organiserPhone,
  });

  if (error) {
    if (error.message.includes('NOT_FOUND')) throw new ModuleError('NOT_FOUND', 'Artist not found');
    throw new ModuleError('INSERT_FAILED', error.message);
  }
  return data as string; // brief id
}

export async function getBrief(supabase: SupabaseClient, briefId: string) {
  const { data, error } = await supabase.from('briefs').select('*').eq('id', briefId).maybeSingle();
  if (error) throw new ModuleError('QUERY_FAILED', error.message);
  if (!data) throw new ModuleError('NOT_FOUND', 'Brief not found');
  return data;
}

// The Manager OS pipeline board (docs/05-GIGS.md: "Pipeline board: enquiry
// → quoted → held → confirmed → performed → settled"). RLS already scopes
// this to the caller's org.
export async function listBriefs(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('briefs')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new ModuleError('QUERY_FAILED', error.message);
  return data ?? [];
}
