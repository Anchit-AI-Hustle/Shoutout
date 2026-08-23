import type { MetadataRoute } from 'next';
import { createAnonClient } from '@shoutout/db';
import { bookSlug } from '@/lib/book-slug';

// A programmatic landing page nothing links to is a page nothing finds.
// This enumerates every public surface — artist profiles, organiser pages,
// and the role x city combinations that actually have supply.
export const revalidate = 3600;

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://shoutout.anchit-tandon.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE}/artists`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE}/organisers`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE}/gigs`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE}/collabs`, changeFrequency: 'monthly', priority: 0.5 },
  ];

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // The build runs without Supabase credentials in CI, so a missing client
  // must degrade to the static routes rather than fail the build.
  if (!url || !key) return staticRoutes;

  const supabase = createAnonClient(url, key);

  const [{ data: artists }, { data: organisers }, { data: combos }, { data: events }] =
    await Promise.all([
      supabase.rpc('search_artists_public', { p_limit: 50 }),
      supabase.rpc('search_organisers_public', { p_limit: 50 }),
      supabase.rpc('list_book_combinations'),
      supabase.rpc('list_event_slugs'),
    ]);

  const artistRoutes: MetadataRoute.Sitemap = ((artists ?? []) as { slug: string }[]).map((a) => ({
    url: `${SITE}/a/${a.slug}`,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  const organiserRoutes: MetadataRoute.Sitemap = ((organisers ?? []) as { slug: string }[]).map(
    (o) => ({ url: `${SITE}/o/${o.slug}`, changeFrequency: 'weekly', priority: 0.6 }),
  );

  // Only cells that cleared the >=3-artist guardrail (migration 033) are
  // returned, so the sitemap cannot advertise a thin page.
  const bookRoutes: MetadataRoute.Sitemap = (
    (combos ?? []) as { slug_token: string; city: string }[]
  ).map((c) => ({
    url: `${SITE}/book/${bookSlug(c.slug_token, c.city)}`,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  // Event pages carry real content — venue, date, attendance, line-up —
  // rather than being generated permutations, so they get a priority
  // between profiles and the /book combinations.
  const eventRoutes: MetadataRoute.Sitemap = (
    (events ?? []) as { slug: string; held_on: string | null }[]
  ).map((e) => ({
    url: `${SITE}/e/${e.slug}`,
    changeFrequency: 'monthly',
    priority: 0.6,
    ...(e.held_on ? { lastModified: new Date(e.held_on) } : {}),
  }));

  return [...staticRoutes, ...artistRoutes, ...organiserRoutes, ...eventRoutes, ...bookRoutes];
}
