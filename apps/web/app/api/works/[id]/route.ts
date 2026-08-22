import { NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase-server';

// GET /api/works/:id — detail, org-scoped (RLS is the actual boundary;
// this route just serialises). docs/05-API.md.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const { data: work, error } = await supabase.from('works').select('*').eq('id', id).maybeSingle();
  if (error) {
    return NextResponse.json(
      { error: { code: 'QUERY_FAILED', message: error.message } },
      { status: 500 },
    );
  }
  if (!work) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Work not found' } },
      { status: 404 },
    );
  }

  const { data: contributors, error: contributorsError } = await supabase
    .from('contributors')
    .select(
      'id, name, role, writer_pct, master_pct, work_for_hire, pro_affiliation, signed_at, signature_ref',
    )
    .eq('work_id', id);

  if (contributorsError) {
    return NextResponse.json(
      { error: { code: 'QUERY_FAILED', message: contributorsError.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({ ...work, contributors: contributors ?? [] });
}
