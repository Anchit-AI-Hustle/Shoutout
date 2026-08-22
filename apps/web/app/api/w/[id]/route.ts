import { NextResponse } from 'next/server';
import { createAnonClient } from '@shoutout/db';

// GET /api/w/:id — PUBLIC read-only share page data (docs/05-API.md).
// Via get_work_public / get_work_contributors_public (migration 007) —
// SECURITY DEFINER functions keyed on an exact id, not an open RLS policy,
// so the anon key can't list/enumerate every work in the database.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: { code: 'CONFIG_MISSING', message: 'Supabase env vars not configured' } },
      { status: 500 },
    );
  }

  const supabase = createAnonClient(supabaseUrl, supabaseAnonKey);

  const { data: workRows, error: workError } = await supabase.rpc('get_work_public', {
    p_work_id: id,
  });
  if (workError) {
    return NextResponse.json(
      { error: { code: 'QUERY_FAILED', message: workError.message } },
      { status: 500 },
    );
  }
  const work = workRows?.[0];
  if (!work) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Work not found' } },
      { status: 404 },
    );
  }

  const { data: contributors, error: contributorsError } = await supabase.rpc(
    'get_work_contributors_public',
    { p_work_id: id },
  );
  if (contributorsError) {
    return NextResponse.json(
      { error: { code: 'QUERY_FAILED', message: contributorsError.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({ ...work, contributors: contributors ?? [] });
}
