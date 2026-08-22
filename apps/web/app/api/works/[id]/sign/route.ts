import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAnonClient } from '@shoutout/db';

// POST /api/works/:id/sign — public (a contributor signing may not have a
// SHOUTOUT account at all — session players often don't). docs/05-API.md
// specifies "{ token, otp }"; this implements possession-of-link signing
// (contributorId + their unique signature_ref) instead — WhatsApp-dispatched
// OTP verification needs the BSP integration, which isn't configured yet.
// See migration 007's sign_as_contributor for the full reasoning.
const bodySchema = z.object({
  contributorId: z.string().uuid(),
  token: z.string().min(1),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await params; // work id is implied by the contributor + token pair; not otherwise used

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_FAILED', message: 'Invalid signing request' } },
      { status: 422 },
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: { code: 'CONFIG_MISSING', message: 'Supabase env vars not configured' } },
      { status: 500 },
    );
  }

  const supabase = createAnonClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await supabase.rpc('sign_as_contributor', {
    p_contributor_id: parsed.data.contributorId,
    p_signature_ref: parsed.data.token,
  });

  if (error) {
    const code = error.message.includes('WORK_LOCKED')
      ? 'INVALID_TRANSITION'
      : error.message.includes('NOT_FOUND')
        ? 'NOT_FOUND'
        : 'SIGN_FAILED';
    return NextResponse.json(
      { error: { code, message: error.message } },
      { status: code === 'NOT_FOUND' ? 404 : code === 'INVALID_TRANSITION' ? 409 : 500 },
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: { code: 'ALREADY_SIGNED', message: 'This contributor has already signed' } },
      { status: 409 },
    );
  }

  return NextResponse.json({ signed: true });
}
