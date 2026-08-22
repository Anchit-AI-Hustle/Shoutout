import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { requireSessionOrg } from '@/lib/require-session-org';

// Media upload for artist profiles.
//
// Profiles could display photos and tracks but nobody could add one — the
// only rows in artist_media were seeded directly, which made the whole
// profile-completion funnel (docs/04-PROFILES.md: "the single most
// important funnel in the product") impossible to actually walk.
//
// The file itself never passes through this route. POST returns a signed
// upload URL and the browser PUTs straight to storage, per CLAUDE.md:
// "signed direct upload, never proxy media through the API". Object paths
// are prefixed with the org id and a storage policy pins that prefix to
// the caller's org, so the path is an authorisation boundary rather than a
// naming convention.
export const dynamic = 'force-dynamic';

const BUCKET = 'artist-media';

const signSchema = z.object({
  artistId: z.string().uuid(),
  kind: z.enum(['image', 'audio', 'video']),
  // Extension only — the client never chooses the full path.
  extension: z.string().regex(/^[a-z0-9]{2,5}$/, 'Extension must be 2-5 lowercase alphanumerics'),
});

export async function POST(request: Request) {
  const supabase = await getServerSupabaseClient();
  const session = await requireSessionOrg(supabase);
  if ('error' in session) return session.error;

  const parsed = signSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Invalid upload request',
          details: parsed.error.flatten(),
        },
      },
      { status: 422 },
    );
  }

  // Confirm the artist belongs to the caller's org before minting a URL.
  // RLS would stop the eventual insert, but failing here means the client
  // never receives a credential it had no right to.
  const { data: artist } = await supabase
    .from('artists')
    .select('id')
    .eq('id', parsed.data.artistId)
    .eq('org_id', session.orgId)
    .maybeSingle();

  if (!artist) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Artist not found in your account' } },
      { status: 404 },
    );
  }

  const path = `${session.orgId}/${parsed.data.artistId}/${crypto.randomUUID()}.${parsed.data.extension}`;

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error) {
    return NextResponse.json(
      { error: { code: 'SIGN_FAILED', message: error.message } },
      { status: 500 },
    );
  }

  const { data: publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return NextResponse.json({
    uploadUrl: data.signedUrl,
    token: data.token,
    path,
    publicUrl: publicUrl.publicUrl,
  });
}

const attachSchema = z.object({
  artistId: z.string().uuid(),
  kind: z.enum(['image', 'audio', 'video']),
  url: z.string().url(),
  title: z.string().max(200).optional(),
  isPrimary: z.boolean().optional(),
});

/** Records an uploaded object against the artist once the PUT succeeds. */
export async function PUT(request: Request) {
  const supabase = await getServerSupabaseClient();
  const session = await requireSessionOrg(supabase);
  if ('error' in session) return session.error;

  const parsed = attachSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_FAILED', message: 'Invalid media record' } },
      { status: 422 },
    );
  }

  // One primary per kind: promoting a new one demotes the old rather than
  // leaving two rows both claiming to be the profile photo.
  if (parsed.data.isPrimary) {
    await supabase
      .from('artist_media')
      .update({ is_primary: false })
      .eq('artist_id', parsed.data.artistId)
      .eq('kind', parsed.data.kind);
  }

  const { error } = await supabase.from('artist_media').insert({
    org_id: session.orgId,
    artist_id: parsed.data.artistId,
    kind: parsed.data.kind,
    url: parsed.data.url,
    title: parsed.data.title ?? null,
    is_primary: parsed.data.isPrimary ?? false,
  });

  if (error) {
    return NextResponse.json(
      { error: { code: 'INSERT_FAILED', message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({ attached: true });
}
