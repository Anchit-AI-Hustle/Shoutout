import { NextResponse } from 'next/server';
import { z } from 'zod';
import { addRoomVersion } from '@shoutout/collabs';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { requireSessionOrg } from '@/lib/require-session-org';
import { moduleErrorResponse } from '@/lib/module-error-response';

// POST /api/collabs/rooms/:id/versions { fileKey, note } — docs/12-API.md.
// fileKey comes from a client PUT to R2 via a signed upload URL in the
// intended design (docs/12-API.md's Media section: "NEVER proxy media
// through the API") — packages/media doesn't exist yet, so there is no
// POST /api/media/upload-url to call first. This route accepts fileKey as
// an opaque string the caller already has (e.g. a manually-uploaded
// storage path), same honest gap as Credits' WhatsApp dispatch.
const bodySchema = z.object({
  fileKey: z.string().min(1),
  note: z.string().max(2000).optional(),
  uploadedByArtistId: z.string().uuid().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerSupabaseClient();
  const ctx = await requireSessionOrg(supabase);
  if ('error' in ctx) return ctx.error;

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Invalid version',
          details: parsed.error.flatten(),
        },
      },
      { status: 422 },
    );
  }

  try {
    const version = await addRoomVersion(supabase, {
      orgId: ctx.orgId,
      roomId: id,
      fileKey: parsed.data.fileKey,
      note: parsed.data.note,
      uploadedByArtistId: parsed.data.uploadedByArtistId,
    });
    return NextResponse.json(version, { status: 201 });
  } catch (error) {
    return moduleErrorResponse(error);
  }
}
