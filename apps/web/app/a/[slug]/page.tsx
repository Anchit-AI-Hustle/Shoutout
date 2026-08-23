import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createAnonClient } from '@shoutout/db';
import {
  getArtistMedia,
  getArtistAlbums,
  getArtistPerformances,
  getArtistCredits,
  getArtistReliability,
  type Credit,
  type ReliabilityScore,
  type ArtistMedia,
  type Album,
  type Performance,
} from '@shoutout/profiles';
import { EqualizerAccent, StatusPill } from '@shoutout/ui';
import { BookArtistForm } from './BookArtistForm';

// Culture surface, public + shareable (docs/13-DESIGN-SYSTEM.md: "present,
// purposeful" motion) — a staggered rise-in per block, delay driven by
// --motion-delay so it reads top-to-bottom rather than all at once.
function rise(step: number): CSSProperties {
  return { '--motion-delay': step } as CSSProperties;
}

// /a/[slug] — public artist profile, ISR: "the SEO engine" (docs/04-PROFILES.md).
export const revalidate = 3600;

interface ArtistPublic {
  id: string;
  stage_name: string;
  slug: string;
  home_city: string | null;
  genres: string[];
  bio: string | null;
  verified: boolean;
  fee_band_visible: boolean;
  roles: { role: string; attributes: Record<string, unknown> }[];
  media: ArtistMedia[];
  albums: Album[];
  performances: Performance[];
  credits: Credit[];
  reliability: ReliabilityScore[];
}

function anonClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return createAnonClient(supabaseUrl, supabaseAnonKey);
}

async function getArtist(slug: string): Promise<ArtistPublic | null> {
  const supabase = anonClient();
  if (!supabase) return null;
  const { data: rows } = await supabase.rpc('get_artist_public', { p_slug: slug });
  const artist = rows?.[0];
  if (!artist) return null;

  // Everything that makes the page worth landing on: press shots, tracks,
  // releases and past gigs (migration 022). Fetched in parallel — they're
  // independent reads and this page is ISR'd, so the cost is paid once per
  // revalidate window, not per visitor.
  const [roles, media, albums, performances, credits, reliability] = await Promise.all([
    supabase.rpc('get_artist_roles_public', { p_artist_id: artist.id }).then((r) => r.data),
    getArtistMedia(supabase, artist.id).catch(() => []),
    getArtistAlbums(supabase, artist.id).catch(() => []),
    getArtistPerformances(supabase, artist.id).catch(() => []),
    getArtistCredits(supabase, artist.id).catch(() => []),
    getArtistReliability(supabase, artist.id).catch(() => []),
  ]);

  return { ...artist, roles: roles ?? [], media, albums, performances, credits, reliability };
}

/**
 * Pre-render the artists we know about.
 *
 * docs/04-PROFILES.md calls this page "the SEO engine": a competitor with
 * 30,000 artists and no SEO strategy has 30,000 wasted pages. Rendering
 * them on demand only is most of the way to that — the first crawl of a
 * cold page pays full latency, which is exactly when it matters.
 */
export async function generateStaticParams() {
  const supabase = anonClient();
  if (!supabase) return [];
  const { data } = await supabase.rpc('search_artists_public', { p_limit: 50 });
  return ((data ?? []) as { slug: string }[]).map((a) => ({ slug: a.slug }));
}

/**
 * Title, description and share preview.
 *
 * This page had none, so every artist's tab read "ShoutOut" and every
 * shared link previewed as nothing — on the one page whose whole job is to
 * be found and forwarded.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const artist = await getArtist(slug);
  if (!artist) return { title: 'Artist · ShoutOut' };

  const roles = artist.roles.map((r) => r.role.replace(/_/g, ' ')).join(', ');
  const where = artist.home_city ? ` in ${artist.home_city}` : '';
  const description =
    artist.bio ??
    `${artist.stage_name}${where}${roles ? ` — ${roles}` : ''}. Listen, see past gigs, and send a booking request.`;

  const photo = artist.media.find((m) => m.kind === 'image')?.url;

  return {
    title: `${artist.stage_name} · ShoutOut`,
    description: description.slice(0, 200),
    alternates: { canonical: `/a/${slug}` },
    openGraph: {
      title: artist.stage_name,
      description: description.slice(0, 200),
      type: 'profile',
      ...(photo ? { images: [{ url: photo }] } : {}),
    },
    twitter: {
      card: photo ? 'summary_large_image' : 'summary',
      title: artist.stage_name,
      description: description.slice(0, 200),
    },
  };
}

export default async function ArtistProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const artist = await getArtist(slug);
  if (!artist) notFound();

  const photos = artist.media.filter((m) => m.kind === 'image');
  const tracks = artist.media.filter((m) => m.kind === 'audio');

  // schema.org MusicGroup. docs/04-PROFILES.md specifies MusicGroup +
  // Person markup on this page and it was never added — so the richest
  // page in the product was being read by crawlers as undifferentiated
  // text. Releases map to MusicAlbum and past gigs to MusicEvent, which is
  // what lets a profile surface as a rich result rather than a blue link.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'MusicGroup',
    name: artist.stage_name,
    url: `/a/${slug}`,
    ...(artist.bio ? { description: artist.bio } : {}),
    ...(photos.length > 0 ? { image: photos.map((p) => p.url) } : {}),
    ...(artist.genres.length > 0 ? { genre: artist.genres } : {}),
    ...(artist.home_city ? { location: { '@type': 'Place', name: artist.home_city } } : {}),
    ...(artist.roles.length > 0
      ? { knowsAbout: artist.roles.map((r) => r.role.replace(/_/g, ' ')) }
      : {}),
    ...(artist.albums.length > 0
      ? {
          album: artist.albums.map((a) => ({
            '@type': 'MusicAlbum',
            name: a.title,
            ...(a.release_year ? { datePublished: String(a.release_year) } : {}),
            ...(a.track_count ? { numTracks: a.track_count } : {}),
            ...(a.label ? { recordLabel: { '@type': 'Organization', name: a.label } } : {}),
          })),
        }
      : {}),
    ...(artist.performances.length > 0
      ? {
          performerIn: artist.performances.map((p) => ({
            '@type': 'MusicEvent',
            name: p.event_name,
            ...(p.performed_on ? { startDate: p.performed_on } : {}),
            ...(p.venue || p.city
              ? { location: { '@type': 'Place', name: p.venue ?? p.city } }
              : {}),
          })),
        }
      : {}),
  };

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12">
      <script
        type="application/ld+json"
        // Built from our own rows; no user-supplied markup reaches it.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="motion-rise" style={rise(0)}>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold text-ink">{artist.stage_name}</h1>
          {artist.verified ? <StatusPill label="Verified" tone="success" /> : null}
          <EqualizerAccent bars={3} />
        </div>
        {artist.home_city ? <p className="text-sm text-ink-soft">{artist.home_city}</p> : null}
      </div>

      {artist.genres.length > 0 ? (
        <div className="motion-rise flex flex-wrap gap-2" style={rise(1)}>
          {artist.genres.map((g) => (
            <StatusPill key={g} label={g} tone="neutral" />
          ))}
        </div>
      ) : null}

      {artist.bio ? (
        <p className="motion-rise text-base text-ink" style={rise(2)}>
          {artist.bio}
        </p>
      ) : null}

      {artist.roles.length > 0 ? (
        <div className="motion-rise flex flex-col gap-2" style={rise(3)}>
          <h2 className="text-sm font-medium text-ink-soft">Roles</h2>
          <ul className="flex flex-wrap gap-2">
            {artist.roles.map((r) => (
              <li key={r.role} className="motion-lift rounded-full">
                <StatusPill label={r.role.replace(/_/g, ' ')} tone="active" />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {photos.length > 0 ? (
        <section className="motion-rise flex flex-col gap-2" style={rise(4)}>
          <h2 className="text-lg font-semibold text-ink">Photos</h2>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {photos.map((m) => (
              <li key={m.url}>
                <img
                  src={m.url}
                  alt={m.title ?? ''}
                  width={400}
                  height={400}
                  loading="lazy"
                  className="aspect-square w-full rounded-md object-cover"
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tracks.length > 0 ? (
        <section className="motion-rise flex flex-col gap-2" style={rise(5)}>
          <h2 className="text-lg font-semibold text-ink">Listen</h2>
          <ul className="flex flex-col gap-3">
            {tracks.map((t) => (
              <li key={t.url} className="rounded-lg border border-line p-3">
                <p className="mb-2 text-sm font-medium text-ink">{t.title ?? 'Untitled'}</p>
                {/* Native audio element: no player library, no autoplay,
                    metadata-only preload so a profile with several tracks
                    doesn't blow the 4G budget docs/13-DESIGN-SYSTEM.md sets. */}
                <audio controls preload="metadata" className="w-full">
                  <source src={t.url} />
                </audio>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {artist.albums.length > 0 ? (
        <section className="motion-rise flex flex-col gap-2" style={rise(6)}>
          <h2 className="text-lg font-semibold text-ink">Releases</h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {artist.albums.map((a) => (
              <li key={`${a.title}-${a.release_year}`} className="flex flex-col gap-1">
                {a.cover_url ? (
                  <img
                    src={a.cover_url}
                    alt=""
                    width={300}
                    height={300}
                    loading="lazy"
                    className="aspect-square w-full rounded-md object-cover"
                  />
                ) : null}
                <p className="text-sm font-medium text-ink">{a.title}</p>
                <p className="text-xs text-ink-soft">
                  {[a.release_year, a.track_count ? `${a.track_count} tracks` : null, a.label]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {artist.performances.length > 0 ? (
        <section className="motion-rise flex flex-col gap-2" style={rise(7)}>
          <h2 className="text-lg font-semibold text-ink">Gigs performed</h2>
          <ul className="flex flex-col gap-2">
            {artist.performances.map((p) => (
              <li
                key={`${p.event_name}-${p.performed_on}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-line p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-ink">{p.event_name}</p>
                  <p className="text-sm text-ink-soft">
                    {[p.venue, p.city].filter(Boolean).join(', ')}
                    {p.performed_on ? ` · ${p.performed_on}` : ''}
                  </p>
                </div>
                {p.crowd_size ? (
                  <span className="shrink-0 text-xs text-ink-soft">
                    {p.crowd_size.toLocaleString('en-IN')} crowd
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {artist.reliability.length > 0 ? (
        <section className="motion-rise flex flex-col gap-2" style={rise(3)}>
          <h2 className="text-lg font-semibold text-ink">Reliability</h2>
          {/* Held per role, never averaged into one number, and absent
              entirely below five completed bookings for that role. */}
          <ul className="flex flex-col gap-2">
            {artist.reliability.map((r) => (
              <li
                key={r.role}
                className="flex items-center justify-between gap-3 rounded-lg border border-line p-3"
              >
                <div>
                  <p className="font-medium text-ink">{r.role.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-ink-soft">
                    {r.completed_n} completed
                    {r.avg_rating ? ` · ${r.avg_rating}/5 average` : ''}
                  </p>
                </div>
                <span className="text-lg font-semibold tabular-nums text-ok">
                  {Math.round(r.score)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {artist.credits.length > 0 ? (
        <section className="motion-rise flex flex-col gap-2" style={rise(8)}>
          <h2 className="text-lg font-semibold text-ink">Verified credits</h2>
          <p className="text-xs text-ink-soft">
            Published only from split sheets that are locked and signed by everyone on them.
          </p>
          <ul className="flex flex-col gap-2">
            {artist.credits.map((c) => (
              <li
                key={`${c.work_title}-${c.role}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-line p-3"
              >
                <div>
                  <p className="font-medium text-ink">{c.work_title}</p>
                  <p className="text-sm text-ink-soft">{c.role}</p>
                </div>
                {c.writer_pct ? (
                  <span className="text-xs tabular-nums text-ink-soft">{c.writer_pct}% writer</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <BookArtistForm artistId={artist.id} />
    </main>
  );
}
