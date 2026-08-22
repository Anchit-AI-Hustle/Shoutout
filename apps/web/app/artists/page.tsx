'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { StatusPill, EqualizerAccent, Waveform } from '@shoutout/ui';

// Find artists for your event (the organiser's discovery surface —
// docs/05-GIGS.md never specified how an organiser finds someone without
// already knowing their public page, so this is new). Browsing is public
// (GET /api/artists, no session required) — booking needs an account, same
// "understand it before you sign in, act after" pattern as the rest of
// this pass. Signed-in visitors book via POST /api/gigs/book-as-org
// (identity resolved from their session); signed-out visitors are pointed
// at sign-in rather than silently falling back to the anonymous flow —
// the whole point of this page is the organiser dashboard experience.

interface ArtistResult {
  id: string;
  stage_name: string;
  slug: string;
  home_city: string | null;
  genres: string[];
  bio: string | null;
  verified: boolean;
}

const eventTypes = [
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

export default function ArtistSearchPage() {
  const [genre, setGenre] = useState('');
  const [city, setCity] = useState('');
  const [results, setResults] = useState<ArtistResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [bookingArtistId, setBookingArtistId] = useState<string | null>(null);
  const [eventDate, setEventDate] = useState('');
  const [eventType, setEventType] = useState<(typeof eventTypes)[number]>('wedding');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/profiles/me')
      .then((r) => setSignedIn(r.status !== 401))
      .catch(() => setSignedIn(false));
    void search();
  }, []);

  async function search() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (genre) params.set('genre', genre);
      if (city) params.set('city', city);
      const res = await fetch(`/api/artists?${params.toString()}`);
      const json = await res.json();
      if (res.ok) setResults(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function submitBooking(artistId: string) {
    setError(null);
    if (!city) {
      setError('City is required.');
      return;
    }
    const res = await fetch('/api/gigs/book-as-org', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        artistId,
        eventDate: eventDate || undefined,
        city,
        eventType,
        notes: notes || undefined,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error?.message ?? 'Could not send this request');
      return;
    }
    setBooked(artistId);
    setBookingArtistId(null);
  }

  return (
    <main>
      <section className="relative overflow-hidden bg-desk">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 px-4 text-accent/20">
          <Waveform bars={48} />
        </div>
        <div className="motion-rise relative z-10 mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 py-14 text-center">
          <span className="rounded-full bg-surface/10 px-3 py-1 text-xs font-medium text-accent">
            For event organisers & venues
          </span>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-surface md:text-4xl">
              Find artists
            </h1>
            <EqualizerAccent bars={4} />
          </div>
          <p className="max-w-xl text-lg text-surface/70">
            Search by genre or city, then send a booking request{' '}
            <span className="text-accent">without chasing a phone number</span>.
          </p>
        </div>
      </section>

      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
        <div className="motion-rise flex flex-wrap gap-2">
          <input
            className="min-h-11 rounded-md border border-line bg-surface px-3 text-base text-ink"
            placeholder="Genre"
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
          />
          <input
            className="min-h-11 rounded-md border border-line bg-surface px-3 text-base text-ink"
            placeholder="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
          <button
            type="button"
            onClick={search}
            disabled={loading}
            className="motion-lift min-h-11 rounded-md bg-signal px-4 text-sm font-medium text-surface disabled:opacity-50"
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>

        {results === null ? (
          <p className="text-sm text-ink-soft">Loading…</p>
        ) : results.length === 0 ? (
          <p className="text-sm text-ink-soft">No artists match yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {results.map((artist) => (
              <li
                key={artist.id}
                className="motion-lift flex flex-col gap-2 rounded-lg border border-line p-4"
              >
                <div className="flex items-center justify-between">
                  <Link href={`/a/${artist.slug}`} className="font-medium text-ink">
                    {artist.stage_name}
                  </Link>
                  {artist.verified ? <StatusPill label="Verified" tone="success" /> : null}
                </div>
                <p className="text-sm text-ink-soft">
                  {artist.home_city ?? 'City unknown'}
                  {artist.genres.length > 0 ? ` · ${artist.genres.join(', ')}` : ''}
                </p>

                {signedIn === false ? (
                  <Link href="/login" className="text-sm text-trust">
                    Sign in to book →
                  </Link>
                ) : booked === artist.id ? (
                  <p className="text-sm text-ok">Request sent.</p>
                ) : bookingArtistId === artist.id ? (
                  <div className="flex flex-col gap-2 rounded-md border border-line p-3">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        className="min-h-11 rounded-md border border-line bg-surface px-3 text-base text-ink"
                        value={eventDate}
                        onChange={(e) => setEventDate(e.target.value)}
                      />
                      <select
                        className="min-h-11 rounded-md border border-line bg-surface px-3 text-base text-ink"
                        value={eventType}
                        onChange={(e) =>
                          setEventType(e.target.value as (typeof eventTypes)[number])
                        }
                      >
                        {eventTypes.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                    <textarea
                      className="min-h-11 rounded-md border border-line bg-surface px-3 text-base text-ink"
                      placeholder="Notes (optional)"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => submitBooking(artist.id)}
                      className="motion-lift min-h-11 self-start rounded-md bg-signal px-4 text-sm font-medium text-surface"
                    >
                      Send request
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setBookingArtistId(artist.id)}
                    className="motion-lift min-h-11 self-start rounded-md border border-line px-4 text-sm text-ink-soft"
                  >
                    Book
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {error ? (
          <p className="text-sm text-signal" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </main>
  );
}
