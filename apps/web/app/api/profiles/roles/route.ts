import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ModuleError, addRole, getMyProfile } from '@shoutout/profiles';
import { getServerSupabaseClient } from '@/lib/supabase-server';

// POST /api/profiles/roles — { role, attributes, proofMediaUrl? } (docs/12-API.md).
const bodySchema = z.object({
  role: z.string().min(1),
  attributes: z.record(z.unknown()).default({}),
  proofMediaUrl: z.string().url().optional(),
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
          message: 'Invalid role',
          details: parsed.error.flatten(),
        },
      },
      { status: 422 },
    );
  }

  const { data: org } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();
  if (!org) {
    return NextResponse.json(
      { error: { code: 'NO_ACTIVE_ORG', message: 'No org for this session' } },
      { status: 403 },
    );
  }

  try {
    const profile = await getMyProfile(supabase, org.org_id);
    if (!profile) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Create a profile before declaring a role' } },
        { status: 404 },
      );
    }

    const role = await addRole(supabase, {
      artistId: profile.id,
      orgId: org.org_id,
      role: parsed.data.role,
      attributes: parsed.data.attributes,
      proofMediaUrl: parsed.data.proofMediaUrl,
    });
    return NextResponse.json(role, { status: 201 });
  } catch (error) {
    if (error instanceof ModuleError) {
      const status =
        error.code === 'NOT_FOUND' ? 404 : error.code === 'VALIDATION_FAILED' ? 422 : 500;
      return NextResponse.json(
        { error: { code: error.code, message: error.message, details: error.details } },
        { status },
      );
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Something went wrong' } },
      { status: 500 },
    );
  }
}
