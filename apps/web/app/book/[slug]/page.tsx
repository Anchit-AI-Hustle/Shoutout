import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createAnonClient } from '@shoutout/db';
import { searchArtists, type ArtistSearchResult } from '@shoutout/gigs';
import { StatusPill, Waveform, EqualizerAccent } from '@shoutout/ui';
import { bookSlug, slugifyToken } from '@/lib/book-slug';

// /book/<role>-in-<city> — the programmatic acquisition surface
// (docs/10-PROMOTION.md).
//
// This is the only distribution channel that can be built rather than
// negotiated, which is why it matters disproportionately: someone searching
// "book a tabla player in Mumbai" is expressing exactly the intent this
// product serves, and there is currently nothing of ours for them to find.
//
// Statically generated at build time from combinations that actually have
// supply (list_book_combinations refuses empty ones — thin pages get a site
// penalised, not ranked), then revalidated hourly as supply changes.
export const revalidate = 3600;
export const dynamicParams = true;

function anon() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? createAnonClient(url, key) : null;
}

function titleCase(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** "vocalist-in-mumbai" -> { role: "vocalist", city: "mumbai" } */
function parseSlug(slug: string): { role: string; city: string } | null {
  const marker = '-in-';
  const at = slug.lastIndexOf(marker);
  if (at <= 0) return null;
  const role = slug.slice(0, at);
  const city = slug.slice(at + marker.length);
  if (!role || !city) return null;
  return { role, city };
}

export async function generateStaticParams() {
  const supabase = anon();
  if (!supabase) return [];
  const { data } = await supabase.rpc('list_book_combinations');
  return ((data ?? []) as { slug_token: string; city: string }[]).map((c) => ({
    slug: bookSlug(c.slug_token, c.city),
  }));
}

/**
 * Resolve the token against the cells that passed the guardrail.
 *
 * Roles are checked before genres because the two vocabularies can collide
 * ("brass" is both). Returning null means the cell is either unknown or too
 * thin to publish, and the page 404s rather than rendering a stub.
 */
async function resolveCell(
  supabase: NonNullable<ReturnType<typeof anon>>,
  token: string,
  city: string,
): Promise<{ kind: 'role' | 'genre'; count: number; token: string; city: string } | null> {
  const { data } = await supabase.rpc('list_book_combinations');
  const rows = (data ?? []) as {
    kind: 'role' | 'genre';
    slug_token: string;
    city: string;
    artist_count: number;
  }[];
  const norm = slugifyToken;
  const matches = rows.filter((r) => norm(r.slug_token) === token && norm(r.city) === city);
  const role = matches.find((r) => r.kind === 'role');
  const chosen = role ?? matches[0];
  // Return the ORIGINAL token and city, not the slug. Slugification is
  // lossy ("r&b" -> "r-b", "live_band_member" -> "live-band-member"), so
  // querying with the slug finds nothing and the page 404s despite being
  // listed in the sitemap. Ask me how I know.
  return chosen
    ? {
        kind: chosen.kind,
        count: Number(chosen.artist_count),
        token: chosen.slug_token,
        city: chosen.city,
      }
    : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const parsed = parseSlug(slug);
  if (!parsed) return { title: 'Book artists · ShoutOut' };
  const role = titleCase(parsed.role);
  const city = titleCase(parsed.city);
  return {
    title: `Book a ${role} in ${city} · ShoutOut`,
    description: `Find and book a ${role.toLowerCase()} in ${city}. Verified profiles, past gigs, and a booking request that doesn't need a phone number.`,
    alternates: { canonical: `/book/${slug}` },
  };
}

export default async function BookLandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const parsed = parseSlug(slug);
  if (!parsed) notFound();

  const supabase = anon();
  if (!supabase) notFound();

  // The guardrail decides whether this page may exist at all
  // (00-PRD.md: never publish a cell with fewer than 3 live artists).
  const cell = await resolveCell(supabase, parsed.role, parsed.city).catch(() => null);
  if (!cell) notFound();

  // Genre cells use their own RPC; role cells reuse the shared search.
  // Both return the same shape so the card markup below is unchanged.
  const artists: ArtistSearchResult[] =
    cell.kind === 'role'
      ? await searchArtists(supabase, { role: cell.token, city: cell.city, limit: 24 }).catch(
          () => [] as ArtistSearchResult[],
        )
      : await (async () => {
          try {
            const { data } = await supabase.rpc('search_artists_by_genre_city', {
              p_genre: cell.token,
              p_city: cell.city,
              p_limit: 24,
            });
            return (data ?? []) as ArtistSearchResult[];
          } catch {
            return [] as ArtistSearchResult[];
          }
        })();

  if (artists.length < 3) notFound();

  // Percentile band only, and only at sample_n >= 5 (00-PRD.md 5.1). Absent
  // is the correct answer below that, not an estimate.
  const { data: bandRows } = await supabase.rpc('get_book_fee_band', {
    p_city: cell.city,
    p_genre: cell.kind === 'genre' ? cell.token : null,
  });
  const band = ((bandRows ?? []) as { p25: number; p50: number; p75: number }[])[0] ?? null;

  const role = titleCase(cell.token);
  const city = titleCase(cell.city);

  // schema.org so the page can win a rich result rather than a blue link.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${role}s available in ${city}`,
    numberOfItems: artists.length,
    itemListElement: artists.map((a, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'MusicGroup',
        name: a.stage_name,
        url: `/a/${a.slug}`,
        ...(a.home_city ? { location: { '@type': 'Place', name: a.home_city } } : {}),
        ...(a.genres.length > 0 ? { genre: a.genres } : {}),
      },
    })),
  };

  return (
    <main>
      <script
        type="application/ld+json"
        // Server-rendered from our own data; no user input reaches it.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="relative overflow-hidden bg-desk">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 px-4 text-accent/20">
          <Waveform bars={48} />
        </div>
        <div className="motion-rise relative z-10 mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 py-14 text-center">
          <span className="rounded-full bg-surface/10 px-3 py-1 text-xs font-medium text-accent">
            {artists.length} available in {city}
          </span>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-surface md:text-4xl">
              {cell.kind === 'role'
                ? `Book a ${role.toLowerCase()} in ${city}`
                : `Book ${role} artists in ${city}`}
            </h1>
            <EqualizerAccent bars={4} />
          </div>
          <p className="max-w-xl text-lg text-surface/70">
            Verified profiles with past gigs and releases. Send a request{' '}
            <span className="text-accent">without chasing a phone number</span>.
          </p>
        </div>
      </section>

      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
        {band ? (
          <div className="rounded-lg border border-line bg-surface-2 p-4">
            <p className="text-xs uppercase tracking-wide text-ink-faint">Typical fee</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-ink">
              ₹{Math.round(band.p25 / 100).toLocaleString('en-IN')} to ₹
              {Math.round(band.p75 / 100).toLocaleString('en-IN')}
            </p>
            <p className="mt-1 text-xs text-ink-soft">
              Middle band from settled bookings. Percentiles only, never individual deals.
            </p>
          </div>
        ) : null}

        <ul className="flex flex-col gap-3">
          {artists.map((a) => (
            <li key={a.id} className="motion-lift rounded-lg border border-line p-4">
              <div className="flex items-start gap-3">
                {a.image_url ? (
                  <img
                    src={a.image_url}
                    alt=""
                    width={64}
                    height={64}
                    loading="lazy"
                    className="h-16 w-16 shrink-0 rounded-md object-cover"
                  />
                ) : null}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/a/${a.slug}`} className="font-medium text-ink">
                      {a.stage_name}
                    </Link>
                    {a.verified ? <StatusPill label="Verified" tone="success" /> : null}
                  </div>
                  <p className="text-sm text-ink-soft">
                    {a.home_city}
                    {a.genres.length > 0 ? ` · ${a.genres.join(', ')}` : ''}
                  </p>
                  <p className="text-xs text-ink-soft">
                    {[
                      a.album_count > 0 ? `${a.album_count} releases` : null,
                      a.performance_count > 0 ? `${a.performance_count} gigs listed` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Profile in progress'}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="rounded-lg border border-line bg-surface-2 p-6 text-center">
          <h2 className="text-lg font-semibold text-ink">Looking for something else in {city}?</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Search every role - vocalists, producers, session players, DJs.
          </p>
          <Link
            href={`/artists?city=${encodeURIComponent(city)}`}
            className="motion-lift mt-4 inline-flex min-h-11 items-center rounded-md bg-signal px-6 text-sm font-medium text-surface"
          >
            Browse all artists
          </Link>
        </div>
      </div>
    </main>
  );
}
