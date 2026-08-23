'use client';

import { useEffect, useState, use as usePromise } from 'react';
import Link from 'next/link';
import { StatusPill } from '@shoutout/ui';

// A Room (docs/06-COLLABS.md): versioned uploads + the split sheet. The
// split sheet itself is a Credits work — reuses /works/:id (the existing
// signing flow) rather than rebuilding it here. What's NOT here: threaded
// chat with Realtime presence, reference tracks, deadline countdown,
// revision counter — all listed in modules/collabs/src/rooms.ts as needing
// packages/media, which doesn't exist yet.

interface RoomVersion {
  id: string;
  version: number;
  note: string | null;
  file_key: string | null;
  locked: boolean;
  created_at: string;
}

interface Room {
  id: string;
  work_id: string;
  works: { status: string };
  versions: RoomVersion[];
}

export default function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const [room, setRoom] = useState<Room | null>(null);
  const [fileKey, setFileKey] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/collabs/rooms/${id}`);
    const json = await res.json();
    if (res.ok) setRoom(json);
    else setError(json.error?.message ?? 'Could not load this room');
  }

  useEffect(() => {
    void load();
  }, [id]);

  async function addVersion() {
    setError(null);
    if (!fileKey) {
      setError('A file key is required.');
      return;
    }
    const res = await fetch(`/api/collabs/rooms/${id}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileKey, note: note || undefined }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error?.message ?? 'Could not add this version');
      return;
    }
    setFileKey('');
    setNote('');
    await load();
  }

  if (error && !room) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-sm text-signal">{error}</p>
      </main>
    );
  }

  if (!room) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-sm text-ink-soft">Loading…</p>
      </main>
    );
  }

  const locked = room.works.status === 'locked';

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12">
      <div>
        <h1 className="text-xl font-semibold text-ink">Room</h1>
        <div className="mt-2 flex items-center gap-2">
          <StatusPill
            label={locked ? 'Split sheet signed' : 'Split sheet not signed yet'}
            tone={locked ? 'success' : 'warning'}
          />
          <Link href={`/works/${room.work_id}`} className="text-sm text-trust">
            View / sign split sheet →
          </Link>
        </div>
        {!locked ? (
          <p className="mt-2 text-sm text-ink-soft">
            Full-quality files stay locked until every split is signed - watermarked previews only
            until then (watermarking itself isn&apos;t wired up yet; what IS enforced is that the
            file key below stays hidden until the split sheet locks).
          </p>
        ) : null}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-ink-soft">Versions</h2>
        {room.versions.length === 0 ? (
          <p className="text-sm text-ink-soft">No uploads yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {room.versions.map((v) => (
              <li key={v.id} className="rounded-lg border border-line p-3">
                <p className="text-sm text-ink">
                  v{v.version} - {locked ? v.file_key : 'locked until split sheet signs'}
                </p>
                {v.note ? <p className="text-xs text-ink-soft">{v.note}</p> : null}
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-2 rounded-lg border border-line p-4">
          <input
            className="min-h-11 rounded-md border border-line bg-surface px-3 text-base text-ink"
            placeholder="File key (from a manual upload - no signed-upload pipeline yet)"
            value={fileKey}
            onChange={(e) => setFileKey(e.target.value)}
          />
          <input
            className="min-h-11 rounded-md border border-line bg-surface px-3 text-base text-ink"
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button
            type="button"
            onClick={addVersion}
            className="min-h-11 self-start rounded-md bg-signal px-4 text-sm font-medium text-surface"
          >
            Add version
          </button>
        </div>
      </section>

      {error ? (
        <p className="text-sm text-signal" role="alert">
          {error}
        </p>
      ) : null}
    </main>
  );
}
