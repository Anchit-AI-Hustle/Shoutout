import Link from 'next/link';
import { EqualizerAccent, Reveal, TiltCard, Waveform } from '@shoutout/ui';

// docs/10-PROMOTION.md: "/" is a static page that explains in eight seconds
// and routes to one of three funnels (Manager / Artist / Organiser). Full
// funnel routing (programmatic /book/[genre]-in-[city] pages, lifecycle
// automation) is Promotion (M8) — genuinely blocked on Inngest, not built
// here. The hero alone still has to say what this is and who it's for
// without scrolling, and the page has to actually point at the modules
// that exist (Gigs, Collabs, Profiles, Credits).
//
// Motion pass 2, after direct feedback that pass 1 ("present, purposeful"
// per docs/13-DESIGN-SYSTEM.md, but a fixed page-load fade) still read as
// static and didn't feel musical: a real animated waveform behind the
// hero (packages/ui's <Waveform>, not just the small inline
// <EqualizerAccent> badge), scroll-triggered reveals on the module cards
// instead of a fixed delay (<Reveal>), and a genuine 3D tilt-on-hover
// (<TiltCard> — CSS perspective/rotateX/rotateY driven by pointer
// position, not a WebGL/Three.js scene, so it costs nothing on the 4G LCP
// budget the design system is explicit about). Still a culture surface,
// still opt-in per element, still inert under prefers-reduced-motion —
// same rules as pass 1, just used with more conviction.
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
    name: 'Find artists',
    href: '/artists',
    tone: 'signal',
    description: 'Organising an event? Search by genre or city and send a booking request.',
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

const TONE_BORDER: Record<(typeof MODULES)[number]['tone'], string> = {
  signal: 'border-t-signal',
  accent: 'border-t-accent',
  trust: 'border-t-trust',
  ok: 'border-t-ok',
};

const TONE_GLOW: Record<(typeof MODULES)[number]['tone'], string> = {
  signal: 'motion-glow-signal',
  accent: 'motion-glow-accent',
  trust: 'motion-glow-trust',
  ok: 'motion-glow-ok',
};

export default function HomePage() {
  return (
    <main>
      <section className="relative overflow-hidden bg-desk">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 px-4 text-accent/20">
          <Waveform bars={48} />
        </div>
        <div className="motion-rise relative z-10 mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 py-20 text-center">
          <span className="rounded-full bg-surface/10 px-3 py-1 text-xs font-medium text-accent">
            For managers, artists & organisers
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-surface md:text-4xl">
            Run the music business part <span className="text-accent">on one account</span>
          </h1>
          <EqualizerAccent />
          <p className="max-w-xl text-lg text-surface/70">
            Book gigs, find collaborators, and get paid — with split sheets signed before a single
            file moves. Built for the independent music industry in India.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/login"
              className="motion-lift motion-glow-signal min-h-11 rounded-md bg-signal px-6 py-3 text-sm font-medium text-surface"
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {MODULES.map((m, i) => (
            <Reveal key={m.name} delay={i}>
              <TiltCard>
                <Link
                  href={m.href}
                  className={`motion-lift ${TONE_GLOW[m.tone]} flex flex-col gap-2 rounded-lg border border-line border-t-4 bg-surface p-5 ${TONE_BORDER[m.tone]}`}
                >
                  <h2 className="text-lg font-semibold text-ink">{m.name}</h2>
                  <p className="text-sm text-ink-soft">{m.description}</p>
                </Link>
              </TiltCard>
            </Reveal>
          ))}
        </div>
      </section>
    </main>
  );
}
