'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

// Site-wide nav. A client component deliberately — it fetches its own
// signed-in state in the browser (GET /api/profiles/me, 401 vs not) so the
// parent Server Components it sits above (root layout, and pages like
// /a/[slug] with ISR) aren't forced into dynamic rendering by a server-side
// cookie/auth check here. See apps/web/app/gigs/page.tsx for what happens
// when a Server Component's Supabase call isn't guarded — same class of
// bug, avoided here by keeping this off the server render path entirely.
export function SiteHeader() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/profiles/me')
      .then((res) => setSignedIn(res.status !== 401))
      .catch(() => setSignedIn(false));
  }, []);

  const linkClass = 'inline-flex min-h-11 items-center text-sm text-ink-soft';

  return (
    <header className="border-b border-line bg-surface">
      <nav className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4">
        <Link
          href="/"
          className="inline-flex min-h-11 shrink-0 items-center text-base font-semibold text-ink"
        >
          ShoutOut
        </Link>
        <div className="flex items-center gap-3 sm:gap-5">
          <Link href="/gigs" className={linkClass}>
            Gigs
          </Link>
          <Link href="/collabs" className={linkClass}>
            Collabs
          </Link>
          <Link href="/artists" className={linkClass}>
            Find artists
          </Link>
          {signedIn ? (
            <Link
              href="/profile"
              className="inline-flex min-h-11 items-center text-sm font-medium text-trust"
            >
              Profile
            </Link>
          ) : (
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center rounded-md bg-signal px-4 text-sm font-medium text-surface"
            >
              Sign in
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
