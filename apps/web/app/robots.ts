import type { MetadataRoute } from 'next';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://shoutout.anchit-tandon.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Authenticated surfaces and one-time links have no business in an
        // index — /r/ and /w/ in particular are token-bearing URLs.
        disallow: [
          '/api/',
          '/login',
          '/profile',
          '/organiser',
          '/gigs/',
          '/collabs/',
          '/r/',
          '/w/',
        ],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
