import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ModuleError, createArtist, getMyProfile, updateArtist } from '@shoutout/profiles';
import { getServerSupabaseClient } from '@/lib/supabase-server';

// GET/PATCH /api/profiles/me — docs/12-API.md. PATCH acts as create-or-
// update: the doc gives no separate "create artist" endpoint, and a
// profile is naturally upserted the first time someone fills it in.
// org_id resolved server-side from the session, never from the client.

async function requireSessionOrg(supabase: Awaited<ReturnType<typeof getServerSupabaseClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: NextResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: 'Sign in required' } },
        { status: 401 },
      ),
    };
  }

  const { data: org } = await supabase
    .from('org_members')
    .select('org_id, orgs(type)')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (!org) {
    return {
      error: NextResponse.json(
        { error: { code: 'NO_ACTIVE_ORG', message: 'No org for this session' } },
        { status: 403 },
      ),
    };
  }

  return { orgId: org.org_id as string, orgType: (org.orgs as unknown as { type: string }).type };
}

function errorResponse(error: unknown) {
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

export async function GET() {
  const supabase = await getServerSupabaseClient();
  const ctx = await requireSessionOrg(supabase);
  if ('error' in ctx) return ctx.error;

  try {
    const profile = await getMyProfile(supabase, ctx.orgId);
    if (!profile) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'No profile yet' } },
        { status: 404 },
      );
    }
    return NextResponse.json(profile);
  } catch (error) {
    return errorResponse(error);
  }
}

const patchSchema = z.object({
  stageName: z.string().min(1),
  homeCity: z.string().optional(),
  genres: z.array(z.string()).optional(),
  bio: z.string().optional(),
  feeBandVisible: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  const supabase = await getServerSupabaseClient();
  const ctx = await requireSessionOrg(supabase);
  if ('error' in ctx) return ctx.error;

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Invalid profile',
          details: parsed.error.flatten(),
        },
      },
      { status: 422 },
    );
  }

  try {
    const existing = await getMyProfile(supabase, ctx.orgId);
    const profile = existing
      ? await updateArtist(supabase, { artistId: existing.id, ...parsed.data })
      : await createArtist(supabase, { orgId: ctx.orgId, orgType: ctx.orgType, ...parsed.data });
    return NextResponse.json(profile);
  } catch (error) {
    return errorResponse(error);
  }
}
