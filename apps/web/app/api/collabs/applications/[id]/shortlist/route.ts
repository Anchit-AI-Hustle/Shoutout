import { NextResponse } from 'next/server';
import { shortlistApplication } from '@shoutout/collabs';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { requireSessionOrg } from '@/lib/require-session-org';
import { moduleErrorResponse } from '@/lib/module-error-response';

// POST /api/collabs/applications/:id/shortlist — docs/12-API.md.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerSupabaseClient();
  const ctx = await requireSessionOrg(supabase);
  if ('error' in ctx) return ctx.error;

  try {
    const application = await shortlistApplication(supabase, id);
    return NextResponse.json(application);
  } catch (error) {
    return moduleErrorResponse(error);
  }
}
