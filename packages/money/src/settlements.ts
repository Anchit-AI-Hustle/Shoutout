import type { SupabaseClient } from '@supabase/supabase-js';
import { buildSettlement, isBalanced, type BuildSettlementInput, type LedgerLine } from './ledger';

// Persistence for the settlement rail. Thin on purpose: the balance rule is
// enforced by a database trigger (migration 023), not here, so this module
// cannot be the thing that lets an unbalanced settlement through — even if
// it has a bug.

export class MoneyError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export const DEFAULT_TAKE_RATE_BPS = 600; // 6%, per the PRD's revenue model.

export interface CreateSettlementInput extends Omit<BuildSettlementInput, 'grossPaise'> {
  orgId: string;
  bookingId: string;
  grossPaise: bigint;
}

/**
 * Creates a draft settlement and its balanced ledger in one call.
 *
 * Stays in `draft`: nothing is instructed to a provider and no money moves
 * until instructSettlement() is called explicitly. Amounts cross the wire
 * to Postgres as strings — bigint is not JSON-serialisable, and a silent
 * Number() coercion would start losing precision above 2^53 paise.
 */
export async function createSettlement(
  supabase: SupabaseClient,
  input: CreateSettlementInput,
): Promise<{ settlementId: string; lines: LedgerLine[] }> {
  const lines = buildSettlement(input);

  /* c8 ignore next 3 -- buildSettlement already guarantees this */
  if (!isBalanced(lines)) {
    throw new MoneyError('LEDGER_UNBALANCED', 'Refusing to persist an unbalanced ledger');
  }

  const { data: settlement, error } = await supabase
    .from('settlements')
    .insert({
      org_id: input.orgId,
      booking_id: input.bookingId,
      gross_paise: input.grossPaise.toString(),
      status: 'draft',
    })
    .select('id')
    .single();

  if (error) throw new MoneyError('INSERT_FAILED', error.message);

  const { error: linesError } = await supabase.from('settlement_lines').insert(
    lines.map((line) => ({
      org_id: input.orgId,
      settlement_id: settlement.id,
      amount_paise: line.amountPaise.toString(),
      kind: line.kind,
      payee_org_id: line.payeeOrgId ?? null,
      payee_artist_id: line.payeeArtistId ?? null,
      payee_name: line.payeeName ?? null,
      note: line.note ?? null,
    })),
  );

  if (linesError) throw new MoneyError('INSERT_FAILED', linesError.message);

  return { settlementId: settlement.id, lines };
}

export interface SettlementRow {
  id: string;
  booking_id: string;
  gross_paise: string;
  status: string;
  provider: string | null;
  provider_ref: string | null;
  closed_at: string | null;
}

export async function getSettlement(
  supabase: SupabaseClient,
  settlementId: string,
): Promise<SettlementRow | null> {
  const { data, error } = await supabase
    .from('settlements')
    .select('id, booking_id, gross_paise, status, provider, provider_ref, closed_at')
    .eq('id', settlementId)
    .maybeSingle();
  if (error) throw new MoneyError('QUERY_FAILED', error.message);
  return (data as SettlementRow) ?? null;
}

export async function listSettlementLines(supabase: SupabaseClient, settlementId: string) {
  const { data, error } = await supabase
    .from('settlement_lines')
    .select('id, amount_paise, kind, payee_org_id, payee_artist_id, payee_name, note')
    .eq('settlement_id', settlementId)
    .order('created_at');
  if (error) throw new MoneyError('QUERY_FAILED', error.message);
  return data ?? [];
}

/**
 * Moves a draft to `instructed`.
 *
 * The database trigger re-checks the ledger balance and every payee's KYC
 * on this transition, so a settlement that shouldn't move cannot — the
 * failure surfaces here as SETTLEMENT_UNBALANCED or PAYEE_NOT_VERIFIED
 * rather than as a silent partial payout.
 */
export async function instructSettlement(
  supabase: SupabaseClient,
  settlementId: string,
  provider: string,
  providerRef: string,
): Promise<void> {
  const { error } = await supabase
    .from('settlements')
    .update({
      status: 'instructed',
      provider,
      provider_ref: providerRef,
      instructed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', settlementId)
    .eq('status', 'draft');

  if (error) {
    if (error.message.includes('SETTLEMENT_UNBALANCED')) {
      throw new MoneyError('SETTLEMENT_UNBALANCED', error.message);
    }
    if (error.message.includes('PAYEE_NOT_VERIFIED')) {
      throw new MoneyError('PAYEE_NOT_VERIFIED', error.message);
    }
    throw new MoneyError('UPDATE_FAILED', error.message);
  }
}
