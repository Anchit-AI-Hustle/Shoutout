'use client';

import { useEffect } from 'react';
import Link from 'next/link';

// Route-level error boundary.
//
// There was no error.tsx in the app at all, which is why the current database
// outage is invisible from the outside: a page whose data call throws either
// degrades to an empty shell (the homepage catches and returns []) or shows
// nothing at all, and the visitor is given no reason and no retry. A product
// that fails silently teaches people it is broken rather than that it is
// briefly down.
//
// reset() re-renders the segment without a full page load, which is the right
// affordance for a transient failure - a database waking up, a dropped
// connection - because those succeed on the second attempt.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Digest only. The message can carry connection strings and row contents,
    // and CLAUDE.md forbids logging PII - the digest is the safe handle that
    // still correlates with the server-side trace.
    console.error('Route error', error.digest ?? '(no digest)');
  }, [error]);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-20">
      <div className="flex flex-col gap-3">
        <p className="font-mono text-sm font-semibold text-signal">Something broke</p>
        <h1 className="text-2xl font-semibold text-ink md:text-3xl">This page could not load</h1>
        <p className="text-base text-ink-soft">
          This is usually temporary. Try again - if it keeps happening, the problem is on our side
          and we are already looking at it.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="motion-lift inline-flex min-h-11 items-center rounded-md bg-signal px-6 text-sm font-medium text-surface"
        >
          Try again
        </button>
        <Link
          href="/"
          className="motion-lift inline-flex min-h-11 items-center rounded-md border border-line px-6 text-sm text-ink-soft"
        >
          Back to the homepage
        </Link>
      </div>

      {error.digest ? (
        <p className="text-xs text-ink-soft">
          Reference: <span className="font-mono">{error.digest}</span>
        </p>
      ) : null}
    </main>
  );
}
