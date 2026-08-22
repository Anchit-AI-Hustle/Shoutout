import { NextResponse } from 'next/server';
import { z } from 'zod';
import { declineApplication } from '@shoutout/collabs';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { requireSessionOrg } from '@/lib/require-session-org';
import { moduleErrorResponse } from '@/lib/module-error-response';

// POST /api/collabs/applications/:id/decline { reason } — reason required
// (docs/12-API.md).
const bodySchema = z.object({ reason: z.string().min(1) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerSupabaseClient();
  const ctx = await requireSessionOrg(supabase);
  if ('error' in ctx) return ctx.error;

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_FAILED', message: 'A decline reason is required' } },
      { status: 422 },
    );
  }

  try {
    const application = await declineApplication(supabase, id, parsed.data.reason);
    return NextResponse.json(application);
  } catch (error) {
    return moduleErrorResponse(error);
  }
}
