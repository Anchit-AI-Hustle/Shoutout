'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { EqualizerAccent } from '@shoutout/ui';

// The organiser's side of a logged gig.
//
// No account, no sign-in, no app. Asking the other party to register is
// exactly how a record never gets made, and the whole point of this flow is
// that it survives contact with a busy person on a phone.

interface Gig {
  artist_name: string;
  event_date: string | null;
  city: string | null;
  venue_name: string | null;
  event_type: string | null;
  fee_paise: number;
  organiser_name: string | null;
  confirmed_at: string | null;
}

export default function ConfirmGigPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [gig, setGig] = useState<Gig | null | 'missing'>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/gigs/confirm/${token}`)
      .then((r) => (r.ok ? r.json() : { data: null }))
      .then((j) => setGig(j.data ?? 'missing'))
      .catch(() => setGig('missing'));
  }, [token]);

  async function confirm() {
    setError(null);
    setConfirming(true);
    try {
      const res = await fetch(`/api/gigs/confirm/${token}`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? 'Could not confirm');
        return;
      }
      setGig((g) => (g && g !== 'missing' ? { ...g, confirmed_at: new Date().toISOString() } : g));
    } finally {
      setConfirming(false);
    }
  }

  if (gig === null) {
    return <main className="mx-auto max-w-lg px-4 py-16 text-sm text-ink-soft">Loading…</main>;
  }

  if (gig === 'missing') {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-ink">This link is not valid</h1>
        <p className="mt-2 text-sm text-ink-soft">
          It may have been mistyped. Ask the artist to send it again.
        </p>
      </main>
    );
  }

  const confirmed = Boolean(gig.confirmed_at);

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-12">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-ink">Confirm this booking</h1>
          <EqualizerAccent bars={3} />
        </div>
        {/* The goal of this page, said before anything is asked of them. */}
        <p className="mt-2 text-sm text-ink-soft">
          {gig.artist_name} has recorded the booking you agreed. Confirming puts a dated record
          against it, so neither of you has to rely on a chat thread later. It takes one tap and
          costs nothing.
        </p>
      </div>

      <dl className="grid grid-cols-1 gap-0 overflow-hidden rounded-lg border border-line">
        {[
          ['Artist', gig.artist_name],
          ['Date', gig.event_date],
          ['Where', [gig.venue_name, gig.city].filter(Boolean).join(', ') || null],
          ['Type', gig.event_type],
          ['Agreed fee', `₹${Math.round(gig.fee_paise / 100).toLocaleString('en-IN')}`],
          ['Booked by', gig.organiser_name],
        ]
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div
              key={String(k)}
              className="flex justify-between gap-4 border-b border-line px-4 py-3 last:border-b-0"
            >
              <dt className="text-sm text-ink-soft">{k}</dt>
              <dd className="text-sm font-medium text-ink">{v}</dd>
            </div>
          ))}
      </dl>

      {confirmed ? (
        <div className="rounded-lg border border-ok bg-ok/10 p-4">
          <p className="font-medium text-ink">Confirmed</p>
          <p className="mt-1 text-sm text-ink-soft">
            Both of you now have a dated record of these terms. Nothing else is needed.
          </p>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={confirm}
            disabled={confirming}
            className="motion-lift min-h-11 rounded-md bg-signal px-6 text-sm font-medium text-surface disabled:opacity-50"
          >
            {confirming ? 'Confirming…' : 'Yes, these are the terms'}
          </button>
          <p className="text-xs text-ink-soft">
            Not right? Reply to the artist directly. Nothing is recorded until you confirm.
          </p>
        </>
      )}

      {error ? (
        <p className="text-sm text-signal" role="alert">
          {error}
        </p>
      ) : null}

      <Link href="/" className="text-sm text-trust">
        What is ShoutOut? →
      </Link>
    </main>
  );
}
