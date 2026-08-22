import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSupabaseClient } from '@/lib/supabase-server';

// POST /api/auth/otp/verify — verify a phone OTP and establish a session.
//
// A brand-new user has no org yet, so this also provisions one on first
// login (docs/01-PRODUCT.md: "a self-managed artist is an org with a roster
// of one and commission zero... served as first-class, never as a degraded
// case"). Real onboarding (naming the org, picking a role) is a later UI
// concern — this defaults the name so the account is immediately usable.
//
// The JWT issued at verifyOtp() predates the org's existence, so it won't
// carry the org_id claim yet (that's injected by custom_access_token_hook
// at token-issuance time). refreshSession() forces a new token after
// provisioning so the claim is actually present.
const bodySchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/),
  token: z.string().min(6).max(6),
});

const DEFAULT_ORG_NAME = 'My Workspace';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Invalid phone or OTP',
          details: parsed.error.flatten(),
        },
      },
      { status: 422 },
    );
  }

  const supabase = await getServerSupabaseClient();
  const { phone, token } = parsed.data;

  const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });

  if (error || !data.user) {
    return NextResponse.json(
      { error: { code: 'OTP_VERIFY_FAILED', message: error?.message ?? 'Verification failed' } },
      { status: 401 },
    );
  }

  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', data.user.id)
    .limit(1)
    .maybeSingle();

  let provisioned = false;
  if (!membership) {
    const { error: rpcError } = await supabase.rpc('create_org_for_new_user', {
      org_name: DEFAULT_ORG_NAME,
    });
    if (rpcError) {
      return NextResponse.json(
        { error: { code: 'ORG_PROVISIONING_FAILED', message: rpcError.message } },
        { status: 500 },
      );
    }
    provisioned = true;
    await supabase.auth.refreshSession();
  }

  return NextResponse.json({ verified: true, orgProvisioned: provisioned });
}
