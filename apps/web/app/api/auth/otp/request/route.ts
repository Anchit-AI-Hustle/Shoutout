import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSupabaseClient } from '@/lib/supabase-server';

// POST /api/auth/otp/request — send a one-time code.
//
// ADR-004 originally made phone OTP the only auth path. That is unshippable
// on its own: SMS to Indian numbers is gated by TRAI's DLT regime, which
// requires a registered business entity behind the sender ID before a
// single message can be delivered. No provider — Twilio, MSG91, Gupshup —
// can bypass it, so phone sign-in cannot work until those credentials
// exist, and until then the product has no way in at all.
//
// So the channel is now either/or: email or phone, same 6-digit code, still
// no passwords anywhere (which is the part of ADR-004 that actually
// mattered). Email needs no DLT registration and works the moment any SMTP
// is configured; phone lights up unchanged once the MSG91 hook in
// supabase/functions/send-sms-hook has its credentials.
const bodySchema = z.union([
  z.object({ email: z.string().email('Enter a valid email address') }),
  z.object({
    phone: z.string().regex(/^\+[1-9]\d{7,14}$/, 'Phone must be E.164, e.g. +919876543210'),
  }),
]);

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Enter a valid email address or phone number',
          details: parsed.error.flatten(),
        },
      },
      { status: 422 },
    );
  }

  const supabase = await getServerSupabaseClient();
  const { error } =
    'email' in parsed.data
      ? await supabase.auth.signInWithOtp({
          email: parsed.data.email,
          options: { shouldCreateUser: true },
        })
      : await supabase.auth.signInWithOtp({ phone: parsed.data.phone });

  if (error) {
    return NextResponse.json(
      { error: { code: 'OTP_SEND_FAILED', message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({ sent: true, channel: 'email' in parsed.data ? 'email' : 'phone' });
}
