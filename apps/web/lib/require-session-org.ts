import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

// Shared by every authenticated Gigs route (docs/12-API.md: "Org resolved
// server-side from JWT claims. Never accept org_id from the client.") —
// Profiles' routes each inlined this; Gigs has enough routes that the
// duplication is worth cutting here instead.
export async function requireSessionOrg(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: NextResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: 'Sign in required' } },
        { status: 401 },
      ),
    } as const;
  }

  const { data: org } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (!org) {
    return {
      error: NextResponse.json(
        { error: { code: 'NO_ACTIVE_ORG', message: 'No org for this session' } },
        { status: 403 },
      ),
    } as const;
  }

  return { orgId: org.org_id as string } as const;
}
