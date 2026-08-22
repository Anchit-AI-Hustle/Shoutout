import { NextResponse } from 'next/server';
import { ModuleError, getMyProfile, removeRole } from '@shoutout/profiles';
import { getServerSupabaseClient } from '@/lib/supabase-server';

// DELETE /api/profiles/roles/:role — docs/12-API.md.
export async function DELETE(_request: Request, { params }: { params: Promise<{ role: string }> }) {
  const { role } = await params;
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
        { error: { code: 'NOT_FOUND', message: 'No profile' } },
        { status: 404 },
      );
    }
    await removeRole(supabase, profile.id, role);
    return NextResponse.json({ removed: true });
  } catch (error) {
    if (error instanceof ModuleError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Something went wrong' } },
      { status: 500 },
    );
  }
}
