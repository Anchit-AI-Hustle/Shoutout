import type { SupabaseClient } from '@supabase/supabase-js';
import { scoreByLanguageFit } from '@shoutout/discovery';
import { ModuleError } from './errors';

const DAILY_APPLY_LIMIT = 20; // docs/12-API.md: "rate limit 20/day"

export interface ApplyInput {
  orgId: string;
  slotId: string;
  artistId: string;
  pitch?: string | undefined;
  demoUrl?: string | undefined;
}

// POST /api/collabs/slots/:id/apply — docs/12-API.md. Rate-limited by a
// direct count against `applications` (no dedicated rate-limiter package
// exists in this project yet — a DB count is the honest implementation
// available, not a placeholder for a real limiter later).
export async function applyToSlot(supabase: SupabaseClient, input: ApplyInput) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await supabase
    .from('applications')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', input.orgId)
    .gte('created_at', since);
  if (countError) throw new ModuleError('QUERY_FAILED', countError.message);
  if ((count ?? 0) >= DAILY_APPLY_LIMIT) {
    throw new ModuleError(
      'RATE_LIMITED',
      `Limit of ${DAILY_APPLY_LIMIT} applications per day reached`,
    );
  }

  const { data, error } = await supabase
    .from('applications')
    .insert({
      org_id: input.orgId,
      slot_id: input.slotId,
      artist_id: input.artistId,
      pitch: input.pitch ?? null,
      demo_url: input.demoUrl ?? null,
    })
    .select('*')
    .single();

  if (error) {
    if (error.message.includes('duplicate key'))
      throw new ModuleError('VALIDATION_FAILED', 'Already applied to this slot');
    throw new ModuleError('INSERT_FAILED', error.message);
  }
  return data;
}

interface ApplicantRow {
  id: string;
  artist_id: string;
  pitch: string | null;
  demo_url: string | null;
  status: string;
  created_at: string;
}

// Re-shaped rather than re-exporting @shoutout/discovery's own result type
// directly — apps/web only depends on @shoutout/collabs (route handlers
// import a module, never a package underneath it), and TS can't emit a
// portable inferred type that structurally includes a package the
// consumer doesn't list as its own dependency (TS2742).
export interface RankedApplicant extends ApplicantRow {
  score: number;
  components: { languageFit: number };
}

// GET /api/collabs/slots/:id/applicants — "ranked, poster only". Ranked by
// language fit only — see packages/discovery/src/attribute-fit.ts for why
// the other named signals aren't computed yet.
export async function listApplicants(
  supabase: SupabaseClient,
  slotId: string,
): Promise<RankedApplicant[]> {
  const { data: slot, error: slotError } = await supabase
    .from('collab_slots')
    .select('requirements')
    .eq('id', slotId)
    .maybeSingle();
  if (slotError) throw new ModuleError('QUERY_FAILED', slotError.message);
  if (!slot) throw new ModuleError('NOT_FOUND', 'Slot not found');

  const wantedLanguages = ((slot.requirements as Record<string, unknown>)?.languages ??
    []) as string[];

  const { data: applications, error } = await supabase
    .from('applications')
    .select('id, artist_id, pitch, demo_url, status, created_at, artists(genres)')
    .eq('slot_id', slotId);
  if (error) throw new ModuleError('QUERY_FAILED', error.message);

  const artistIds = (applications ?? []).map((a) => a.artist_id as string);
  const rolesByArtist = new Map<string, string[]>();
  if (artistIds.length > 0) {
    const { data: roleRows, error: roleError } = await supabase
      .from('artist_roles')
      .select('artist_id, attributes')
      .in('artist_id', artistIds);
    if (roleError) throw new ModuleError('QUERY_FAILED', roleError.message);
    for (const row of roleRows ?? []) {
      const languages = ((row.attributes as Record<string, unknown>)?.languages ?? []) as string[];
      rolesByArtist.set(row.artist_id as string, languages);
    }
  }

  return (applications ?? [])
    .map((a) => {
      const row = a as unknown as ApplicantRow;
      const candidateLanguages = rolesByArtist.get(row.artist_id) ?? [];
      const { score, components } = scoreByLanguageFit(wantedLanguages, candidateLanguages);
      return { ...row, score, components };
    })
    .sort((a, b) => b.score - a.score);
}

// shortlist/decline both go through migration 014's poster_update_application
// RPC — a poster mutating an applicant's row, which lives in a different
// org, needs the narrow SECURITY DEFINER exception, not plain RLS.
export async function shortlistApplication(supabase: SupabaseClient, applicationId: string) {
  const { data, error } = await supabase.rpc('poster_update_application', {
    p_application_id: applicationId,
    p_status: 'shortlisted',
    p_decline_reason: null,
  });
  if (error) {
    if (error.message.includes('NOT_FOUND'))
      throw new ModuleError('NOT_FOUND', 'Application not found');
    if (error.message.includes('FORBIDDEN')) throw new ModuleError('FORBIDDEN', 'Not your request');
    throw new ModuleError('UPDATE_FAILED', error.message);
  }
  return data;
}

// { reason } — required (docs/12-API.md).
export async function declineApplication(
  supabase: SupabaseClient,
  applicationId: string,
  reason: string,
) {
  const { data, error } = await supabase.rpc('poster_update_application', {
    p_application_id: applicationId,
    p_status: 'declined',
    p_decline_reason: reason,
  });
  if (error) {
    if (error.message.includes('NOT_FOUND'))
      throw new ModuleError('NOT_FOUND', 'Application not found');
    if (error.message.includes('FORBIDDEN')) throw new ModuleError('FORBIDDEN', 'Not your request');
    if (error.message.includes('VALIDATION_FAILED'))
      throw new ModuleError('VALIDATION_FAILED', error.message);
    throw new ModuleError('UPDATE_FAILED', error.message);
  }
  return data;
}

// "→ opens a Room, drafts the split sheet" (docs/06-COLLABS.md) — the whole
// thing happens inside migration 014's accept_application RPC.
export async function acceptApplication(supabase: SupabaseClient, applicationId: string) {
  const { data, error } = await supabase.rpc('accept_application', {
    p_application_id: applicationId,
  });
  if (error) {
    if (error.message.includes('NOT_FOUND'))
      throw new ModuleError('NOT_FOUND', 'Application not found');
    if (error.message.includes('FORBIDDEN')) throw new ModuleError('FORBIDDEN', 'Not your request');
    throw new ModuleError('ACCEPT_FAILED', error.message);
  }
  return data as { roomId: string; workId: string; slotId: string };
}
