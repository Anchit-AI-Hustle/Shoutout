import type { CSSProperties } from 'react';
import { notFound } from 'next/navigation';
import { createAnonClient } from '@shoutout/db';
import {
  getArtistMedia,
  getArtistAlbums,
  getArtistPerformances,
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
}

async function getArtist(slug: string): Promise<ArtistPublic | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return null;

  const supabase = createAnonClient(supabaseUrl, supabaseAnonKey);
  const { data: rows } = await supabase.rpc('get_artist_public', { p_slug: slug });
  const artist = rows?.[0];
  if (!artist) return null;

  // Everything that makes the page worth landing on: press shots, tracks,
  // releases and past gigs (migration 022). Fetched in parallel — they're
  // independent reads and this page is ISR'd, so the cost is paid once per
  // revalidate window, not per visitor.
  const [roles, media, albums, performances] = await Promise.all([
    supabase.rpc('get_artist_roles_public', { p_artist_id: artist.id }).then((r) => r.data),
    getArtistMedia(supabase, artist.id).catch(() => []),
    getArtistAlbums(supabase, artist.id).catch(() => []),
    getArtistPerformances(supabase, artist.id).catch(() => []),
  ]);

  return { ...artist, roles: roles ?? [], media, albums, performances };
}

export default async function ArtistProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const artist = await getArtist(slug);
  if (!artist) notFound();

  const photos = artist.media.filter((m) => m.kind === 'image');
  const tracks = artist.media.filter((m) => m.kind === 'audio');

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12">
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

      <BookArtistForm artistId={artist.id} />
    </main>
  );
}
