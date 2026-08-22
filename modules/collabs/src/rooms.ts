import type { SupabaseClient } from '@supabase/supabase-js';
import { ModuleError } from './errors';

// Rooms — opens automatically when a slot is accepted (docs/06-COLLABS.md).
// "Every upload is versioned and immutable" — versions are insert-only at
// the RLS layer (migration 014 has no update/delete policy on
// room_versions), and version numbers are assigned server-side here, never
// accepted from the client, so two concurrent uploads can't collide.
//
// NOT implemented: threaded chat with Realtime presence, reference-track
// handling, deadline countdown, revision counter, actual watermarking on
// preview media. All of those need packages/media (upload/watermark/gate),
// which doesn't exist yet — same category of gap as Gigs' WhatsApp
// parsing. What IS implemented, and is the acceptance-critical half of
// "no full-quality stems until every split is signed": getRoomVersions
// below gates file_key itself on the room's linked work being locked.

export async function getRoom(supabase: SupabaseClient, requestId: string) {
  const { data, error } = await supabase
    .from('rooms')
    .select('*, works(status)')
    .eq('request_id', requestId)
    .maybeSingle();
  if (error) throw new ModuleError('QUERY_FAILED', error.message);
  if (!data)
    throw new ModuleError('NOT_FOUND', 'No room for this request yet — accept a slot first');
  return data;
}

export async function getRoomById(supabase: SupabaseClient, roomId: string) {
  const { data, error } = await supabase
    .from('rooms')
    .select('*, works(status)')
    .eq('id', roomId)
    .maybeSingle();
  if (error) throw new ModuleError('QUERY_FAILED', error.message);
  if (!data) throw new ModuleError('NOT_FOUND', 'Room not found');
  return data;
}

export interface RoomVersionSummary {
  id: string;
  version: number;
  note: string | null;
  uploaded_by_artist_id: string | null;
  created_at: string;
  file_key: string | null; // null unless the split sheet is locked
  locked: boolean;
}

// Split sheet before file transfer — the non-negotiable rule
// (docs/06-COLLABS.md). Media is real Credits data here: a room's split
// sheet IS a `works` row (migration 007's lock invariant), so "signed" is
// exactly `works.status = 'locked'` — nothing new to invent.
export async function getRoomVersions(
  supabase: SupabaseClient,
  roomId: string,
): Promise<RoomVersionSummary[]> {
  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('works(status)')
    .eq('id', roomId)
    .maybeSingle();
  if (roomError) throw new ModuleError('QUERY_FAILED', roomError.message);
  if (!room) throw new ModuleError('NOT_FOUND', 'Room not found');

  const locked = (room.works as unknown as { status: string } | null)?.status === 'locked';

  const { data: versions, error } = await supabase
    .from('room_versions')
    .select('id, version, note, uploaded_by_artist_id, created_at, file_key')
    .eq('room_id', roomId)
    .order('version', { ascending: false });
  if (error) throw new ModuleError('QUERY_FAILED', error.message);

  return (versions ?? []).map((v) => ({
    id: v.id as string,
    version: v.version as number,
    note: v.note as string | null,
    uploaded_by_artist_id: v.uploaded_by_artist_id as string | null,
    created_at: v.created_at as string,
    file_key: locked ? (v.file_key as string) : null,
    locked,
  }));
}

export interface AddVersionInput {
  orgId: string;
  roomId: string;
  fileKey: string;
  note?: string | undefined;
  uploadedByArtistId?: string | undefined;
}

export async function addRoomVersion(supabase: SupabaseClient, input: AddVersionInput) {
  const { data: existing, error: countError } = await supabase
    .from('room_versions')
    .select('version')
    .eq('room_id', input.roomId)
    .order('version', { ascending: false })
    .limit(1);
  if (countError) throw new ModuleError('QUERY_FAILED', countError.message);

  const nextVersion = ((existing?.[0]?.version as number | undefined) ?? 0) + 1;

  const { data, error } = await supabase
    .from('room_versions')
    .insert({
      org_id: input.orgId,
      room_id: input.roomId,
      file_key: input.fileKey,
      note: input.note ?? null,
      version: nextVersion,
      uploaded_by_artist_id: input.uploadedByArtistId ?? null,
    })
    .select('*')
    .single();

  if (error) throw new ModuleError('INSERT_FAILED', error.message);
  return data;
}
