import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSupabaseClient } from '@/lib/supabase-server';

// POST /api/auth/org { type, name? } — provisions the first-time caller's
// org (migration 018's create_org_for_new_user). Only reachable for a
// brand-new user; the RPC itself refuses if the caller already has one
// (ORG_ALREADY_EXISTS), so this can't be used to sneak a second org onto
// an existing account.
//
// The JWT issued at verifyOtp() predates the org's existence, so it won't
// carry the org_id claim yet (injected by custom_access_token_hook at
// token-issuance time) — refreshSession() forces a new token afterwards so
// the claim is actually present for the rest of this session.
const DEFAULT_NAMES: Record<string, string> = {
  self: 'My Workspace',
  organiser: 'My Organisation',
};

const bodySchema = z.object({
  type: z.enum(['self', 'organiser']),
  name: z.string().min(1).max(200).optional(),
});

export async function POST(request: Request) {
  const supabase = await getServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Sign in required' } },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Invalid org setup request',
          details: parsed.error.flatten(),
        },
      },
      { status: 422 },
    );
  }

  const { data: orgId, error } = await supabase.rpc('create_org_for_new_user', {
    org_name: parsed.data.name ?? DEFAULT_NAMES[parsed.data.type],
    org_type: parsed.data.type,
  });

  if (error) {
    const code = error.message.includes('ORG_ALREADY_EXISTS')
      ? 'ORG_ALREADY_EXISTS'
      : 'ORG_PROVISIONING_FAILED';
    return NextResponse.json(
      { error: { code, message: error.message } },
      { status: code === 'ORG_ALREADY_EXISTS' ? 409 : 500 },
    );
  }

  await supabase.auth.refreshSession();

  return NextResponse.json({ orgId, type: parsed.data.type });
}
