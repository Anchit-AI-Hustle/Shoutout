import Link from 'next/link';

// The 404 page.
//
// There was no not-found.tsx anywhere in the app, so every miss fell through
// to Next's built-in default: a bare "404: This page could not be found" in
// system fonts, centred on a white page, with no header, no footer and no way
// back into the product. It was visible in the RSC payload of every route.
//
// That matters more here than in most apps. The growth strategy is a large
// public URL surface - /a/[slug], /e/[slug], /o/[slug], /book/[slug] - which
// means the common 404 is not a typo, it is someone arriving from a stale
// search result or a shared link to a profile that moved. Dead-ending them on
// an unstyled page loses the visit outright. Every route below is a real
// second chance at the thing they were probably looking for.
const WAYS_BACK = [
  { href: '/artists', title: 'Find an artist', body: 'Search by role, genre or city.' },
  { href: '/organisers', title: 'Browse organisers', body: 'See who books in your city.' },
  {
    href: '/collabs',
    title: 'Find collaborators',
    body: 'Open calls for vocalists, players and producers.',
  },
  {
    href: '/gigs/log',
    title: 'Log a gig you already have',
    body: 'Free, and it starts your track record.',
  },
] as const;

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-20">
      <div className="flex flex-col gap-3">
        <p className="font-mono text-sm font-semibold text-signal">404</p>
        <h1 className="text-2xl font-semibold text-ink md:text-3xl">
          That page is not here any more
        </h1>
        <p className="text-base text-ink-soft">
          The link may be out of date, or the profile may have moved. Nothing is lost - here is the
          way back in.
        </p>
      </div>

      <ul className="flex flex-col gap-3">
        {WAYS_BACK.map((way) => (
          <li key={way.href}>
            <Link
              href={way.href}
              className="motion-lift flex flex-col gap-1 rounded-lg border border-line bg-surface p-4"
            >
              <span className="font-medium text-ink">{way.title}</span>
              <span className="text-sm text-ink-soft">{way.body}</span>
            </Link>
          </li>
        ))}
      </ul>

      <Link
        href="/"
        className="motion-lift inline-flex min-h-11 items-center self-start rounded-md bg-signal px-6 text-sm font-medium text-surface"
      >
        Back to the homepage
      </Link>
    </main>
  );
}
