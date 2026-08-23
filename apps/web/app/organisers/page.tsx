'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { StatusPill, EqualizerAccent, Waveform } from '@shoutout/ui';

// Browse organisers — the other half of the marketplace.
//
// Discovery was one-directional: organisers could find artists, but an
// artist had no way to see who books in their city, what those companies
// actually run, or how big those events are. That asymmetry is backwards
// for a supply-constrained product — the artist is the one deciding
// whether to reply. Public and unauthenticated, same as /artists.

interface Organiser {
  id: string;
  slug: string;
  display_name: string;
  home_city: string | null;
  bio: string | null;
  logo_url: string | null;
  founded_year: number | null;
  event_types: string[];
  verified: boolean;
  event_count: number;
}

const EVENT_TYPES = ['wedding', 'corporate', 'festival', 'club', 'college', 'private'] as const;

export default function OrganisersPage() {
  const [city, setCity] = useState('');
  const [eventType, setEventType] = useState('');
  const [detectedCity, setDetectedCity] = useState<string | null>(null);
  const [results, setResults] = useState<Organiser[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
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
      if (effectiveCity) params.set('city', effectiveCity);
      if (eventType) params.set('eventType', eventType);
      const res = await fetch(`/api/organisers?${params.toString()}`);
      const json = await res.json();
      if (res.ok) setResults(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <section className="relative overflow-hidden bg-desk">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 px-4 text-accent/20">
          <Waveform bars={48} />
        </div>
        <div className="motion-rise relative z-10 mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 py-14 text-center">
          <span className="rounded-full bg-surface/10 px-3 py-1 text-xs font-medium text-accent">
            For artists & managers
          </span>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-surface md:text-4xl">
              Event organisers
            </h1>
            <EqualizerAccent bars={4} />
          </div>
          <p className="max-w-xl text-lg text-surface/70">
            See <span className="text-accent">who actually books</span> in your city - what they
            run, how big it gets, and who they&apos;ve had on before.
          </p>
        </div>
      </section>

      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
        <div className="motion-rise flex flex-wrap gap-2">
          <select
            aria-label="Event type"
            className="min-h-11 rounded-md border border-line bg-surface px-3 text-base text-ink"
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
          >
            <option value="">Any event type</option>
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
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
            Showing organisers near <span className="font-medium text-ink">{detectedCity}</span>.
            Clear the city field to search everywhere.
          </p>
        ) : null}

        {results === null ? (
          <p className="text-sm text-ink-soft">Loading…</p>
        ) : results.length === 0 ? (
          <p className="text-sm text-ink-soft">No organisers match yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {results.map((o) => (
              <li key={o.id} className="motion-lift rounded-lg border border-line p-4">
                <div className="flex items-start gap-3">
                  {o.logo_url ? (
                    <img
                      src={o.logo_url}
                      alt=""
                      width={64}
                      height={64}
                      loading="lazy"
                      className="h-16 w-16 shrink-0 rounded-md object-cover"
                    />
                  ) : null}
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/o/${o.slug}`} className="font-medium text-ink">
                        {o.display_name}
                      </Link>
                      {o.verified ? <StatusPill label="Verified" tone="success" /> : null}
                    </div>
                    <p className="text-sm text-ink-soft">
                      {o.home_city ?? 'City unknown'}
                      {o.founded_year ? ` · since ${o.founded_year}` : ''}
                      {o.event_count > 0 ? ` · ${o.event_count} events listed` : ''}
                    </p>
                    {o.event_types.length > 0 ? (
                      <ul className="flex flex-wrap gap-1.5 pt-1">
                        {o.event_types.map((t) => (
                          <li key={t}>
                            <StatusPill label={t} tone="neutral" />
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {o.bio ? (
                      <p className="line-clamp-2 pt-1 text-sm text-ink-soft">{o.bio}</p>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
