import type { MetadataRoute } from 'next';
import { createAnonClient } from '@shoutout/db';

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

  const [{ data: artists }, { data: organisers }, { data: combos }] = await Promise.all([
    supabase.rpc('search_artists_public', { p_limit: 50 }),
    supabase.rpc('search_organisers_public', { p_limit: 50 }),
    supabase.rpc('list_book_combinations'),
  ]);

  const artistRoutes: MetadataRoute.Sitemap = ((artists ?? []) as { slug: string }[]).map((a) => ({
    url: `${SITE}/a/${a.slug}`,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  const organiserRoutes: MetadataRoute.Sitemap = ((organisers ?? []) as { slug: string }[]).map(
    (o) => ({ url: `${SITE}/o/${o.slug}`, changeFrequency: 'weekly', priority: 0.6 }),
  );

  const bookRoutes: MetadataRoute.Sitemap = (
    (combos ?? []) as { role: string; city: string }[]
  ).map((c) => ({
    url: `${SITE}/book/${c.role}-in-${c.city.toLowerCase().replace(/\s+/g, '-')}`,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  return [...staticRoutes, ...artistRoutes, ...organiserRoutes, ...bookRoutes];
}
