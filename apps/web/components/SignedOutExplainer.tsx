import Link from 'next/link';
import { EqualizerAccent } from '@shoutout/ui';

// A visitor who isn't signed in should still be able to understand what a
// feature is and what they'd get from it — hard-redirecting straight to
// /login (the previous behaviour on /gigs and /collabs) meant they never
// saw any of that. This replaces the redirect with a real explainer +
// sign-in CTA, kept in apps/web (not packages/ui) since it uses next/link.
export interface SignedOutExplainerProps {
  title: string;
  description: string;
  points: string[];
}

export function SignedOutExplainer({ title, description, points }: SignedOutExplainerProps) {
  return (
    <main className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-4 py-16 text-center">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold text-ink">{title}</h1>
        <EqualizerAccent bars={3} />
      </div>
      <p className="max-w-md text-base text-ink-soft">{description}</p>
      <ul className="flex flex-col gap-2 text-left">
        {points.map((point) => (
          <li key={point} className="flex items-start gap-2 text-sm text-ink">
            <span aria-hidden="true" className="mt-1 text-trust">
              ✓
            </span>
            {point}
          </li>
        ))}
      </ul>
      <Link
        href="/login"
        className="motion-lift min-h-11 rounded-md bg-signal px-6 py-3 text-sm font-medium text-surface"
      >
        Sign in to get started
      </Link>
    </main>
  );
}
