import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createAnonClient } from '@shoutout/db';
import { searchArtists } from '@shoutout/gigs';
import { StatusPill, Waveform, EqualizerAccent } from '@shoutout/ui';

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
  return ((data ?? []) as { role: string; city: string }[]).map((c) => ({
    slug: `${c.role}-in-${c.city.toLowerCase().replace(/\s+/g, '-')}`,
  }));
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

  const cityQuery = parsed.city.replace(/-/g, ' ');
  const artists = await searchArtists(supabase, {
    role: parsed.role,
    city: cityQuery,
    limit: 24,
  }).catch(() => []);

  if (artists.length === 0) notFound();

  const role = titleCase(parsed.role);
  const city = titleCase(cityQuery);

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
              Book a {role.toLowerCase()} in {city}
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
            Search every role — vocalists, producers, session players, DJs.
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
