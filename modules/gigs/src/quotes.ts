import type { SupabaseClient } from '@supabase/supabase-js';
import { ModuleError } from './errors';

// Quote generator (docs/05-GIGS.md §3). "Pulls p25/p50/p75 from
// benchmark_index. Attaches the EPK. Manager edits or sends in one tap" —
// the index-pulling and EPK-attaching are the caller's job (the route reads
// getIndex + Profiles' getPublicProfile and shows both alongside this
// form); this module only owns the quote record itself.

export interface CreateQuoteInput {
  orgId: string;
  briefId: string;
  artistId: string;
  feePaise: number;
  validUntil?: string | undefined;
}

export async function createQuote(supabase: SupabaseClient, input: CreateQuoteInput) {
  const { data, error } = await supabase
    .from('quotes')
    .insert({
      org_id: input.orgId,
      brief_id: input.briefId,
      artist_id: input.artistId,
      fee_paise: input.feePaise,
      valid_until: input.validUntil ?? null,
    })
    .select('*')
    .single();

  if (error) throw new ModuleError('INSERT_FAILED', error.message);

  // Best-effort pipeline-stage bump — a brief that's had a quote sent
  // shouldn't still read "open" on the board. Not failing the request if
  // this update loses a race with something else touching the brief.
  await supabase
    .from('briefs')
    .update({ status: 'quoted', updated_at: new Date().toISOString() })
    .eq('id', input.briefId)
    .eq('status', 'open');

  return data;
}

export async function listQuotesForBrief(supabase: SupabaseClient, briefId: string) {
  const { data, error } = await supabase
    .from('quotes')
    .select('*')
    .eq('brief_id', briefId)
    .order('created_at', { ascending: false });
  if (error) throw new ModuleError('QUERY_FAILED', error.message);
  return data ?? [];
}
