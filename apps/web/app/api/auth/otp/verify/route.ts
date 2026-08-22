import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSupabaseClient } from '@/lib/supabase-server';

// POST /api/auth/otp/verify — verify a phone OTP and establish a session.
//
// Org provisioning is a separate step now (POST /api/auth/org) — a
// brand-new user needs to pick a role (artist/manager vs event organiser,
// migration 018) before their org exists, so this route just reports
// whether that's needed rather than auto-provisioning with a hardcoded
// type. An existing user (membership found) skips straight through.
const bodySchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/),
  token: z.string().min(6).max(6),
});

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

  return NextResponse.json({ verified: true, needsOrgSetup: !membership });
}
