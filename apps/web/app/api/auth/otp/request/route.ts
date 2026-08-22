import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSupabaseClient } from '@/lib/supabase-server';

// POST /api/auth/otp/request — send a phone OTP. Phone OTP only (ADR-004).
const bodySchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/, 'Phone must be E.164, e.g. +919876543210'),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Invalid phone number',
          details: parsed.error.flatten(),
        },
      },
      { status: 422 },
    );
  }

  const supabase = await getServerSupabaseClient();
  const { error } = await supabase.auth.signInWithOtp({ phone: parsed.data.phone });

  if (error) {
    return NextResponse.json(
      { error: { code: 'OTP_SEND_FAILED', message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({ sent: true });
}
