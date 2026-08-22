'use client';

import { useEffect, useState, use as usePromise } from 'react';
import { useSearchParams } from 'next/navigation';

// Public rider view for the organiser — no account, possession of the
// link (id + token) is the credential. Same shape as Credits' /w/[id]
// public share page.

interface RiderPublic {
  id: string;
  backline: { text?: string };
  travel: { text?: string };
  hospitality: { text?: string };
  artist_confirmed_at: string | null;
  organiser_confirmed_at: string | null;
  event_date: string;
}

export default function PublicRiderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [rider, setRider] = useState<RiderPublic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function load() {
    if (!token) {
      setError('This link is missing its token.');
      return;
    }
    const res = await fetch(`/api/riders/${id}?token=${encodeURIComponent(token)}`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error?.message ?? 'This rider could not be found');
      return;
    }
    setRider(json);
  }

  useEffect(() => {
    void load();
  }, [id, token]);

  async function confirm() {
    if (!token) return;
    setError(null);
    setConfirming(true);
    try {
      const res = await fetch(`/api/riders/${id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? 'Could not confirm');
        return;
      }
      await load();
    } finally {
      setConfirming(false);
    }
  }

  if (error && !rider) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-sm text-signal">{error}</p>
      </main>
    );
  }

  if (!rider) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-sm text-ink-soft">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12">
      <div>
        <h1 className="text-xl font-semibold text-ink">Rider — {rider.event_date}</h1>
        <p className="text-sm text-ink-soft">Please confirm what&apos;s below is agreed.</p>
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <p className="text-sm text-ink-soft">Backline</p>
          <p className="text-base text-ink">{rider.backline?.text || '—'}</p>
        </div>
        <div>
          <p className="text-sm text-ink-soft">Travel</p>
          <p className="text-base text-ink">{rider.travel?.text || '—'}</p>
        </div>
        <div>
          <p className="text-sm text-ink-soft">Hospitality</p>
          <p className="text-base text-ink">{rider.hospitality?.text || '—'}</p>
        </div>
      </div>

      {rider.organiser_confirmed_at ? (
        <p className="text-sm text-ok">
          Confirmed {new Date(rider.organiser_confirmed_at).toLocaleString()}
        </p>
      ) : (
        <button
          type="button"
          onClick={confirm}
          disabled={confirming}
          className="min-h-11 self-start rounded-md bg-signal px-4 font-medium text-surface disabled:opacity-50"
        >
          {confirming ? 'Confirming…' : 'Confirm this rider'}
        </button>
      )}

      {error ? (
        <p className="text-sm text-signal" role="alert">
          {error}
        </p>
      ) : null}
    </main>
  );
}
