import type { CSSProperties } from 'react';
import Link from 'next/link';
import { EqualizerAccent } from '@shoutout/ui';

// docs/10-PROMOTION.md: "/" is a static page that explains in eight seconds
// and routes to one of three funnels (Manager / Artist / Organiser). Full
// funnel routing (programmatic /book/[genre]-in-[city] pages, lifecycle
// automation) is Promotion (M8) — genuinely blocked on Inngest, not built
// here. What IS in scope, and wasn't done before this pass: the hero alone
// must say what this is and who it's for without scrolling, and the page
// must actually point at the modules that exist (Gigs, Collabs, Profiles,
// Credits) instead of ending after one paragraph.
//
// A culture surface (docs/13-DESIGN-SYSTEM.md): "warm, high contrast,
// confident" — the hero uses --color-desk as a real background band, not
// just text-on-cream, which is what read as flat before.
function rise(step: number): CSSProperties {
  return { '--motion-delay': step } as CSSProperties;
}

const MODULES = [
  {
    name: 'Gigs',
    href: '/gigs',
    tone: 'signal',
    description: 'Get booked and book acts — from weddings to festivals, one pipeline.',
  },
  {
    name: 'Collabs',
    href: '/collabs',
    tone: 'accent',
    description: 'Find people to make music with. Independent slots, closed independently.',
  },
  {
    name: 'Profiles',
    href: '/profile',
    tone: 'trust',
    description: 'One account, many roles — matched independently, not as a single label.',
  },
  {
    name: 'Credits',
    href: '/works/new',
    tone: 'ok',
    description: 'Split sheets signed before files move. A verified record of who made what.',
  },
] as const;

const TONE_CLASSES: Record<(typeof MODULES)[number]['tone'], string> = {
  signal: 'border-t-signal',
  accent: 'border-t-accent',
  trust: 'border-t-trust',
  ok: 'border-t-ok',
};

export default function HomePage() {
  return (
    <main>
      <section className="bg-desk">
        <div className="motion-rise mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 py-20 text-center">
          <span className="rounded-full bg-surface/10 px-3 py-1 text-xs font-medium text-accent">
            For managers, artists & organisers
          </span>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-surface md:text-4xl">
              Run the music business part <span className="text-accent">on one account</span>
            </h1>
          </div>
          <EqualizerAccent />
          <p className="max-w-xl text-lg text-surface/70">
            Book gigs, find collaborators, and get paid — with split sheets signed before a single
            file moves. Built for the independent music industry in India.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/login"
              className="motion-lift min-h-11 rounded-md bg-signal px-6 py-3 text-sm font-medium text-surface"
            >
              Get started
            </Link>
            <Link
              href="/gigs"
              className="motion-lift min-h-11 rounded-md border border-surface/25 px-6 py-3 text-sm font-medium text-surface"
            >
              See what&apos;s built ↓
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-16">
        <div className="motion-rise grid grid-cols-1 gap-4 sm:grid-cols-2" style={rise(1)}>
          {MODULES.map((m) => (
            <Link
              key={m.name}
              href={m.href}
              className={`motion-lift flex flex-col gap-2 rounded-lg border border-line border-t-4 bg-surface p-5 ${TONE_CLASSES[m.tone]}`}
            >
              <h2 className="text-lg font-semibold text-ink">{m.name}</h2>
              <p className="text-sm text-ink-soft">{m.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
