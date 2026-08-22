import type { CSSProperties } from 'react';
import { notFound } from 'next/navigation';
import { createAnonClient } from '@shoutout/db';
import { EqualizerAccent, StatusPill } from '@shoutout/ui';

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
}

async function getArtist(slug: string): Promise<ArtistPublic | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return null;

  const supabase = createAnonClient(supabaseUrl, supabaseAnonKey);
  const { data: rows } = await supabase.rpc('get_artist_public', { p_slug: slug });
  const artist = rows?.[0];
  if (!artist) return null;

  const { data: roles } = await supabase.rpc('get_artist_roles_public', { p_artist_id: artist.id });
  return { ...artist, roles: roles ?? [] };
}

export default async function ArtistProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const artist = await getArtist(slug);
  if (!artist) notFound();

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
    </main>
  );
}
