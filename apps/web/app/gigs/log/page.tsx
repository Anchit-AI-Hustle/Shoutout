'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { EqualizerAccent, Waveform } from '@shoutout/ui';

// "I already have the gig. Put it on record."
//
// The wedge. Every competitor asks an artist to come and look for work;
// this asks for the work they already found. It is the only thing in the
// product that is useful on day one to a single user with nobody else on
// the platform, and every gig logged here produces the booking record that
// reliability scores, the fee benchmark index and past-gig history all
// need in order to exist at all.

const EVENT_TYPES = [
  'wedding',
  'corporate',
  'festival',
  'club',
  'college',
  'private',
  'government',
  'temple',
  'other',
] as const;

interface Artist {
  id: string;
  stage_name: string;
}

export default function LogGigPage() {
  const [artists, setArtists] = useState<Artist[] | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [artistId, setArtistId] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [city, setCity] = useState('');
  const [eventType, setEventType] = useState<string>('wedding');
  const [fee, setFee] = useState('');
  const [organiserName, setOrganiserName] = useState('');
  const [organiserPhone, setOrganiserPhone] = useState('');
  const [venue, setVenue] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmUrl, setConfirmUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/profiles/me')
      .then(async (r) => {
        if (r.status === 401) {
          setSignedIn(false);
          return;
        }
        setSignedIn(true);
        const json = await r.json().catch(() => null);
        const list: Artist[] = json?.data ? [json.data] : [];
        setArtists(list);
        if (list[0]) setArtistId(list[0].id);
      })
      .catch(() => setSignedIn(false));
  }, []);

  async function submit() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch('/api/gigs/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistId,
          eventDate,
          city,
          eventType,
          feeRupees: Number(fee),
          organiserName,
          organiserPhone: organiserPhone || undefined,
          venueName: venue || undefined,
          notes: notes || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? 'Could not log this gig');
        return;
      }
      setConfirmUrl(json.confirmUrl);
    } finally {
      setSaving(false);
    }
  }

  const input = 'min-h-11 w-full rounded-md border border-line bg-surface px-3 text-base text-ink';
  const label = 'text-sm font-medium text-ink';

  return (
    <main>
      <section className="relative overflow-hidden bg-desk">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 px-4 text-accent/20">
          <Waveform bars={48} />
        </div>
        <div className="motion-rise relative z-10 mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 py-14 text-center">
          <span className="rounded-full bg-surface/10 px-3 py-1 text-xs font-medium text-accent">
            Free, no plan needed
          </span>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-surface md:text-4xl">
              Already got the gig?
            </h1>
            <EqualizerAccent bars={4} />
          </div>
          <p className="max-w-xl text-lg text-surface/70">
            Agreed it on WhatsApp or over a call? Put it on record here. Your organiser confirms
            with one tap, and you both have{' '}
            <span className="text-accent">a timestamped agreement</span> instead of a chat thread.
          </p>
        </div>
      </section>

      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
        {/* The goal of this page, stated plainly, before the form. */}
        <div className="rounded-lg border border-line bg-surface-2 p-4">
          <p className="text-sm font-medium text-ink">Why bother, when the gig is already yours?</p>
          <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-sm text-ink-soft">
            <li>
              Written terms both sides agreed, with a date on them, if anything is disputed later
            </li>
            <li>The date is held, so you cannot be double-booked through ShoutOut for it</li>
            <li>It counts toward your track record and shows on your public profile</li>
            <li>It feeds the fee benchmark, so the next quote you give is not a guess</li>
          </ul>
        </div>

        {signedIn === false ? (
          <div className="rounded-lg border border-line p-6 text-center">
            <p className="text-base text-ink">Sign in to log a gig.</p>
            <p className="mt-1 text-sm text-ink-soft">Free, and no plan is required for this.</p>
            <Link
              href="/login"
              className="motion-lift mt-4 inline-flex min-h-11 items-center rounded-md bg-signal px-6 text-sm font-medium text-surface"
            >
              Sign in
            </Link>
          </div>
        ) : confirmUrl ? (
          <div className="rounded-lg border border-ok bg-ok/10 p-5">
            <p className="font-medium text-ink">Logged. Now get it confirmed.</p>
            <p className="mt-1 text-sm text-ink-soft">
              Send this link to {organiserName || 'the organiser'}. They confirm with one tap, no
              account needed.
            </p>
            <code className="mt-3 block overflow-x-auto rounded-md border border-line bg-surface p-3 text-sm text-ink">
              {typeof window !== 'undefined' ? window.location.origin : ''}
              {confirmUrl}
            </code>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={`https://wa.me/${organiserPhone.replace(/\D/g, '')}?text=${encodeURIComponent(
                  `Confirming our booking: ${typeof window !== 'undefined' ? window.location.origin : ''}${confirmUrl}`,
                )}`}
                className="motion-lift inline-flex min-h-11 items-center rounded-md bg-signal px-5 text-sm font-medium text-surface"
              >
                Send on WhatsApp
              </a>
              <Link
                href="/gigs"
                className="motion-lift inline-flex min-h-11 items-center rounded-md border border-line px-5 text-sm text-ink-soft"
              >
                See my gigs
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {artists && artists.length === 0 ? (
              <p className="rounded-lg border border-accent/40 bg-accent/5 p-3 text-sm text-ink-soft">
                Create your artist profile first, then come back. It takes a minute and it is free.{' '}
                <Link href="/profile" className="text-trust">
                  Go to profile
                </Link>
              </p>
            ) : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className={label} htmlFor="who">
                  Who booked you
                </label>
                <input
                  id="who"
                  className={input}
                  placeholder="Sharma Weddings"
                  value={organiserName}
                  onChange={(e) => setOrganiserName(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={label} htmlFor="phone">
                  Their WhatsApp number
                </label>
                <input
                  id="phone"
                  className={input}
                  placeholder="+91…"
                  value={organiserPhone}
                  onChange={(e) => setOrganiserPhone(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={label} htmlFor="date">
                  Date
                </label>
                <input
                  id="date"
                  type="date"
                  className={input}
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={label} htmlFor="type">
                  Type of event
                </label>
                <select
                  id="type"
                  className={input}
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                >
                  {EVENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={label} htmlFor="city">
                  City
                </label>
                <input
                  id="city"
                  className={input}
                  placeholder="Mumbai"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={label} htmlFor="venue">
                  Venue
                </label>
                <input
                  id="venue"
                  className={input}
                  placeholder="Taj Lands End"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className={label} htmlFor="fee">
                  Agreed fee (₹)
                </label>
                <input
                  id="fee"
                  type="number"
                  inputMode="numeric"
                  className={input}
                  placeholder="75000"
                  value={fee}
                  onChange={(e) => setFee(e.target.value)}
                />
              </div>
            </div>

            <textarea
              className="min-h-24 rounded-md border border-line bg-surface p-3 text-base text-ink"
              placeholder="Anything agreed: soundcheck time, travel, who provides backline"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />

            <button
              type="button"
              onClick={submit}
              disabled={saving || !organiserName || !eventDate || !city || !fee || !artistId}
              className="motion-lift min-h-11 self-start rounded-md bg-signal px-6 text-sm font-medium text-surface disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Log this gig'}
            </button>

            {error ? (
              <p className="text-sm text-signal" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}
