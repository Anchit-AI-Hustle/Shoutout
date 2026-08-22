'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ROLE_FAMILIES } from '@shoutout/identity';
import { StatusPill, EqualizerAccent, Waveform } from '@shoutout/ui';

// Roles the spec writes as acronyms (docs/04-PROFILES.md's role table).
// Naive capitalisation turns these into "Dj", "Md", "Foh engineer".
const ACRONYMS: Record<string, string> = {
  dj: 'DJ',
  md: 'MD',
  dop: 'DOP',
  vfx: 'VFX',
  foh: 'FOH',
};

/** 'backing_vocalist' -> 'Backing vocalist'. The vocabulary is stored snake_case. */
function roleLabel(role: string): string {
  const words = role.split('_').map((w, i) => {
    const acronym = ACRONYMS[w];
    if (acronym) return acronym;
    return i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w;
  });
  return words.join(' ');
}

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
  fee_band_visible: boolean;
  roles: string[];
  image_url: string | null;
  album_count: number;
  performance_count: number;
  track_count: number;
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
  const [role, setRole] = useState('');
  const [detectedCity, setDetectedCity] = useState<string | null>(null);
  const [results, setResults] = useState<ArtistResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [bookingArtistId, setBookingArtistId] = useState<string | null>(null);
  const [eventDate, setEventDate] = useState('');
  const [eventType, setEventType] = useState<(typeof eventTypes)[number]>('wedding');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState<string | null>(null);

  // Default the region to wherever the visitor actually is. Vercel's edge
  // headers give a city; locally (and outside the cities we cover) it comes
  // back null and we show everyone rather than guessing wrong. The field
  // stays editable either way — detection is a default, never a lock.
  useEffect(() => {
    fetch('/api/profiles/me')
      .then((r) => setSignedIn(r.status !== 401))
      .catch(() => setSignedIn(false));

    fetch('/api/geo')
      .then((r) => r.json())
      .then((geo: { city: string | null }) => {
        if (geo.city) {
          setCity(geo.city);
          setDetectedCity(geo.city);
          void search({ city: geo.city });
        } else {
          void search({});
        }
      })
      .catch(() => void search({}));
  }, []);

  async function search(override: { city?: string } = {}) {
    setLoading(true);
    try {
      const effectiveCity = override.city ?? city;
      const params = new URLSearchParams();
      if (genre) params.set('genre', genre);
      if (effectiveCity) params.set('city', effectiveCity);
      if (role) params.set('role', role);
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
            Search by <span className="text-accent">role</span>, genre or city — a vocalist, a mix
            engineer, a tabla player — then book them without chasing a phone number.
          </p>
        </div>
      </section>

      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
        <div className="motion-rise flex flex-wrap gap-2">
          {/* Role is the primary filter, not an afterthought:
              docs/04-PROFILES.md — "Matching happens per role, never per
              person." Grouped by the same families the spec defines,
              read straight from packages/identity so the vocabulary has
              exactly one source. */}
          <select
            aria-label="Role"
            className="min-h-11 rounded-md border border-line bg-surface px-3 text-base text-ink"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="">Any role</option>
            {Object.entries(ROLE_FAMILIES).map(([family, def]) => (
              <optgroup key={family} label={def.label}>
                {def.roles.map((r) => (
                  <option key={r} value={r}>
                    {roleLabel(r)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
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
            onClick={() => void search()}
            disabled={loading}
            className="motion-lift min-h-11 rounded-md bg-signal px-4 text-sm font-medium text-surface disabled:opacity-50"
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>

        {detectedCity ? (
          <p className="-mt-3 text-xs text-ink-soft">
            Showing artists near <span className="font-medium text-ink">{detectedCity}</span>, based
            on where you&apos;re browsing from. Clear the city field to search everywhere.
          </p>
        ) : null}

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
                <div className="flex items-start gap-3">
                  {/* Plain <img>, not next/image: these are remote URLs and
                      next/image would need every host allowlisted in
                      next.config for a picture that is already the right
                      size. */}
                  {artist.image_url ? (
                    <img
                      src={artist.image_url}
                      alt=""
                      width={64}
                      height={64}
                      loading="lazy"
                      className="h-16 w-16 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-surface-2 text-lg font-semibold text-ink-soft"
                    >
                      {artist.stage_name.charAt(0)}
                    </div>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/a/${artist.slug}`} className="font-medium text-ink">
                        {artist.stage_name}
                      </Link>
                      {artist.verified ? <StatusPill label="Verified" tone="success" /> : null}
                    </div>
                    {/* What they've actually got behind them — the reason to
                        click through rather than scroll past. */}
                    <p className="text-xs text-ink-soft">
                      {[
                        artist.album_count > 0
                          ? `${artist.album_count} release${artist.album_count === 1 ? '' : 's'}`
                          : null,
                        artist.track_count > 0 ? `${artist.track_count} tracks` : null,
                        artist.performance_count > 0
                          ? `${artist.performance_count} gigs listed`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ') || 'Profile in progress'}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-ink-soft">
                  {artist.home_city ?? 'City unknown'}
                  {artist.genres.length > 0 ? ` · ${artist.genres.join(', ')}` : ''}
                </p>

                {/* The roles this person is actually bookable for. Without
                    these the card can't answer "can they do the job", which
                    is the only question an organiser is asking. */}
                {artist.roles.length > 0 ? (
                  <ul className="flex flex-wrap gap-1.5">
                    {artist.roles.map((r) => (
                      <li key={r}>
                        <StatusPill label={roleLabel(r)} tone={r === role ? 'active' : 'neutral'} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-ink-soft">No roles declared yet.</p>
                )}

                {artist.bio ? (
                  <p className="line-clamp-2 text-sm text-ink-soft">{artist.bio}</p>
                ) : null}

                {/* Fee band is opt-in (docs/04-PROFILES.md: "Fee band shown
                    only if the artist opts in — forcing it costs supply").
                    Say which it is rather than showing nothing. */}
                <p className="text-xs text-ink-soft">
                  {artist.fee_band_visible ? 'Fee band shown on their profile' : 'Fee on request'}
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
