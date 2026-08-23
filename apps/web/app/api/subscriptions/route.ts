import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { requireSessionOrg } from '@/lib/require-session-org';

// Subscription purchase.
//
// No payment aggregator is configured yet, so rather than fake a checkout
// this uses the same direct-invoice model the settlement rail already uses
// (migration 026): starting a plan creates a `pending` subscription and a
// real invoice the buyer can pay by transfer. An operator marks it paid and
// the subscription activates.
//
// That is deliberately not a stub — it is how the launch plan says to
// collect money before PA onboarding completes, and it means the paywall is
// enforceable today. Swapping in a hosted checkout later changes this file
// and nothing else, because entitlement is read from `subscriptions`.
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await getServerSupabaseClient();

  // The price list is public — a paywall whose terms you cannot read before
  // signing in is a dark pattern.
  const { data: plans, error } = await supabase
    .from('plans')
    .select(
      'tier, name, price_paise, annual_price_paise, blurb, sort_order, max_artist_profiles, max_booking_requests_per_month, max_team_members',
    )
    .order('sort_order');

  if (error) {
    return NextResponse.json(
      { error: { code: 'QUERY_FAILED', message: error.message } },
      { status: 500 },
    );
  }

  const { data: entitlements } = await supabase
    .from('plan_entitlements')
    .select('tier, entitlement');

  // Current plan, when signed in. Absence is a valid answer, not an error.
  const session = await requireSessionOrg(supabase);
  let current = null;
  if (!('error' in session)) {
    const { data } = await supabase
      .from('subscriptions')
      .select('tier, status, billing_period, current_period_end, cancel_at_period_end')
      .maybeSingle();
    current = data;
  }

  return NextResponse.json({ plans: plans ?? [], entitlements: entitlements ?? [], current });
}

const bodySchema = z.object({
  tier: z.enum(['basic', 'plus', 'pro', 'max']),
  billingPeriod: z.enum(['monthly', 'annual']).default('monthly'),
});

export async function POST(request: Request) {
  const supabase = await getServerSupabaseClient();
  const session = await requireSessionOrg(supabase);
  if ('error' in session) return session.error;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_FAILED', message: 'Pick a valid plan' } },
      { status: 422 },
    );
  }

  const { data: plan } = await supabase
    .from('plans')
    .select('tier, name, price_paise, annual_price_paise')
    .eq('tier', parsed.data.tier)
    .maybeSingle();

  if (!plan) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Plan not found' } },
      { status: 404 },
    );
  }

  const annual = parsed.data.billingPeriod === 'annual';
  const amount = annual ? plan.annual_price_paise : plan.price_paise;

  // Upsert: one live subscription per org, so an upgrade mutates rather
  // than stacking and "which plan am I on" stays unambiguous.
  const { error: subError } = await supabase.from('subscriptions').upsert(
    {
      org_id: session.orgId,
      tier: plan.tier,
      status: 'pending',
      billing_period: parsed.data.billingPeriod,
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(
        Date.now() + (annual ? 365 : 30) * 24 * 60 * 60 * 1000,
      ).toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'org_id' },
  );

  if (subError) {
    return NextResponse.json(
      { error: { code: 'UPSERT_FAILED', message: subError.message } },
      { status: 500 },
    );
  }

  const { data: org } = await supabase
    .from('orgs')
    .select('name')
    .eq('id', session.orgId)
    .maybeSingle();
  const { data: invoiceNumber } = await supabase.rpc('next_invoice_number', {
    p_org_id: session.orgId,
  });

  // 18% GST on SaaS in India. Stored separately so the invoice can show it.
  const tax = Math.round(amount * 0.18);

  const { data: invoice, error: invError } = await supabase
    .from('invoices')
    .insert({
      org_id: session.orgId,
      invoice_number: invoiceNumber ?? `SO-${Date.now()}`,
      bill_to_name: org?.name ?? 'Customer',
      bill_to_org_id: session.orgId,
      amount_paise: amount,
      tax_paise: tax,
      total_paise: amount + tax,
      status: 'sent',
      due_on: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      sent_at: new Date().toISOString(),
      notes: `ShoutOut ${plan.name} — ${parsed.data.billingPeriod}`,
    })
    .select('id, invoice_number, public_token, total_paise')
    .single();

  if (invError || !invoice) {
    return NextResponse.json(
      {
        error: { code: 'INVOICE_FAILED', message: invError?.message ?? 'Could not raise invoice' },
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    tier: plan.tier,
    status: 'pending',
    invoice: {
      number: invoice.invoice_number,
      totalPaise: invoice.total_paise,
      url: `/i/${invoice.public_token}`,
    },
  });
}
