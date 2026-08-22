import type { SupabaseClient } from '@supabase/supabase-js';
import { ModuleError } from './errors';

// Requests + independent slots (docs/06-COLLABS.md's defining feature).
// Creation is atomic via migration 017's create_collab_request_with_slots
// — same reasoning as Gigs' brief/hold split, applied here to
// request/slots instead.

export interface SlotInput {
  role: string;
  requirements?: Record<string, unknown> | undefined;
  compModel: 'fee' | 'points' | 'hybrid' | 'credit';
  feePaise?: number | undefined;
  writerPct?: number | undefined;
  masterPct?: number | undefined;
  revisionsIncluded?: number | undefined;
}

export interface CreateRequestInput {
  orgId: string;
  artistId: string;
  kind: string;
  title: string;
  body?: string | undefined;
  briefJson?: Record<string, unknown> | undefined;
  referenceUrl?: string | undefined;
  city?: string | undefined;
  visibility?: string | undefined;
  deadline?: string | undefined;
  slots: SlotInput[];
}

export async function createRequest(supabase: SupabaseClient, input: CreateRequestInput) {
  const { data, error } = await supabase.rpc('create_collab_request_with_slots', {
    p_org_id: input.orgId,
    p_artist_id: input.artistId,
    p_kind: input.kind,
    p_title: input.title,
    p_body: input.body ?? null,
    p_brief_json: input.briefJson ?? null,
    p_reference_url: input.referenceUrl ?? null,
    p_city: input.city ?? null,
    p_visibility: input.visibility ?? 'open',
    p_deadline: input.deadline ?? null,
    p_slots: input.slots.map((s) => ({
      role: s.role,
      requirements: s.requirements ?? {},
      comp_model: s.compModel,
      fee_paise: s.feePaise ?? null,
      writer_pct: s.writerPct ?? null,
      master_pct: s.masterPct ?? null,
      revisions_included: s.revisionsIncluded ?? null,
    })),
  });

  if (error) {
    if (error.message.includes('VALIDATION_FAILED'))
      throw new ModuleError('VALIDATION_FAILED', error.message);
    throw new ModuleError('INSERT_FAILED', error.message);
  }
  return data as string; // request id
}

export interface ListRequestsFilter {
  kind?: string | undefined;
  role?: string | undefined;
  city?: string | undefined;
  paid?: boolean | undefined;
}

// GET /api/collabs?kind=&role=&city=&paid=&cursor= — docs/12-API.md. Role
// and paid filter through the slots relationship (role lives on the slot,
// not the request; paid means "at least one slot with comp_model != credit").
export async function listRequests(supabase: SupabaseClient, filter: ListRequestsFilter) {
  let query = supabase
    .from('collab_requests')
    .select('*, collab_slots(role, comp_model, status)')
    .order('created_at', { ascending: false })
    .limit(50);

  if (filter.kind) query = query.eq('kind', filter.kind);
  if (filter.city) query = query.eq('city', filter.city);

  const { data, error } = await query;
  if (error) throw new ModuleError('QUERY_FAILED', error.message);

  let rows = data ?? [];
  if (filter.role) {
    rows = rows.filter((r) =>
      (r.collab_slots as { role: string }[]).some((s) => s.role === filter.role),
    );
  }
  if (filter.paid !== undefined) {
    rows = rows.filter((r) =>
      (r.collab_slots as { comp_model: string }[]).some((s) =>
        filter.paid ? s.comp_model !== 'credit' : s.comp_model === 'credit',
      ),
    );
  }
  return rows;
}

export async function getRequest(supabase: SupabaseClient, requestId: string) {
  const { data: request, error } = await supabase
    .from('collab_requests')
    .select('*')
    .eq('id', requestId)
    .maybeSingle();
  if (error) throw new ModuleError('QUERY_FAILED', error.message);
  if (!request) throw new ModuleError('NOT_FOUND', 'Request not found');

  const { data: slots, error: slotsError } = await supabase
    .from('collab_slots')
    .select('*')
    .eq('request_id', requestId);
  if (slotsError) throw new ModuleError('QUERY_FAILED', slotsError.message);

  return { ...request, slots: slots ?? [] };
}
