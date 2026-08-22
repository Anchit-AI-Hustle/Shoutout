import type { ReactNode } from 'react';
import Link from 'next/link';
import { EqualizerAccent, Reveal, TiltCard, Waveform } from '@shoutout/ui';

// A visitor who isn't signed in should still be able to understand what a
// feature is and what they'd get from it — hard-redirecting straight to
// /login (the original behaviour on /gigs and /collabs) meant they never
// saw any of that. Kept in apps/web (not packages/ui) since it uses
// next/link.
//
// Pass 2, after direct feedback that pass 1 — a heading, a line of body
// copy and a bare checklist centred in a page of empty cream — read as a
// dead end rather than a landing page. A signed-out feature page is the
// only pitch the product gets to make, so it now carries the same three
// beats the homepage does: a dark hero band with the waveform behind it,
// tone-coloured cards for what you actually get, and — the part that was
// missing entirely — a *picture of the screen*, so the value is shown
// rather than asserted. Same motion rules as everywhere else (culture
// surface, opt-in per element, inert under prefers-reduced-motion).

type Tone = 'signal' | 'trust' | 'accent' | 'ok';

const TONE_BORDER: Record<Tone, string> = {
  signal: 'border-t-signal',
  trust: 'border-t-trust',
  accent: 'border-t-accent',
  ok: 'border-t-ok',
};

const TONE_GLOW: Record<Tone, string> = {
  signal: 'motion-glow-signal',
  trust: 'motion-glow-trust',
  accent: 'motion-glow-accent',
  ok: 'motion-glow-ok',
};

const TONE_TEXT: Record<Tone, string> = {
  signal: 'text-signal',
  trust: 'text-trust',
  accent: 'text-accent',
  ok: 'text-ok',
};

export interface ExplainerFeature {
  title: string;
  description: string;
  tone: Tone;
}

export interface SignedOutExplainerProps {
  /** Who this page is for — the pill above the headline. */
  eyebrow: string;
  title: string;
  /** The one line that has to land before anyone scrolls. */
  tagline: string;
  /** Highlighted fragment of the tagline, rendered in the accent colour. */
  highlight?: string;
  features: ExplainerFeature[];
  /** A mock of the real screen. Shown framed, captioned, tilting on hover. */
  preview?: ReactNode;
  previewCaption?: string;
}

/** Frames a mock screen so it reads as a screenshot, not as live UI. */
export function PreviewFrame({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
      <div className="flex items-center gap-1.5 border-b border-line bg-surface-2 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-signal/60" />
        <span className="h-2.5 w-2.5 rounded-full bg-accent/60" />
        <span className="h-2.5 w-2.5 rounded-full bg-ok/60" />
      </div>
      <div className="flex flex-col gap-2 p-4">{children}</div>
    </div>
  );
}

export function SignedOutExplainer({
  eyebrow,
  title,
  tagline,
  highlight,
  features,
  preview,
  previewCaption,
}: SignedOutExplainerProps) {
  const [before, after] = highlight ? tagline.split(highlight) : [tagline, ''];

  return (
    <main>
      <section className="relative overflow-hidden bg-desk">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 px-4 text-accent/20">
          <Waveform bars={48} />
        </div>
        <div className="motion-rise relative z-10 mx-auto flex max-w-4xl flex-col items-center gap-5 px-4 py-16 text-center">
          <span className="rounded-full bg-surface/10 px-3 py-1 text-xs font-medium text-accent">
            {eyebrow}
          </span>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-surface md:text-4xl">
              {title}
            </h1>
            <EqualizerAccent bars={4} />
          </div>
          <p className="max-w-xl text-lg text-surface/70">
            {before}
            {highlight ? <span className="text-accent">{highlight}</span> : null}
            {after}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/login"
              className="motion-lift motion-glow-signal min-h-11 rounded-md bg-signal px-6 py-3 text-sm font-medium text-surface"
            >
              Sign in to get started
            </Link>
            <Link
              href="/"
              className="motion-lift min-h-11 rounded-md border border-surface/25 px-6 py-3 text-sm font-medium text-surface"
            >
              See everything else
            </Link>
          </div>
          <p className="text-xs text-surface/50">
            Free to sign up. A code to your email or phone — no password to forget.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-14">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {features.map((feature, i) => (
            <Reveal key={feature.title} delay={i}>
              <TiltCard>
                <div
                  className={`motion-lift ${TONE_GLOW[feature.tone]} flex h-full flex-col gap-2 rounded-lg border border-line border-t-4 bg-surface p-5 ${TONE_BORDER[feature.tone]}`}
                >
                  <span
                    className={`text-xs font-semibold tracking-wide ${TONE_TEXT[feature.tone]}`}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h2 className="text-lg font-semibold text-ink">{feature.title}</h2>
                  <p className="text-sm text-ink-soft">{feature.description}</p>
                </div>
              </TiltCard>
            </Reveal>
          ))}
        </div>
      </section>

      {preview ? (
        <section className="mx-auto max-w-3xl px-4 pb-16">
          <Reveal>
            <p className="mb-3 text-center text-sm text-ink-soft">
              {previewCaption ?? 'What it looks like once you’re in'}
            </p>
            <TiltCard maxTiltDeg={4}>{preview}</TiltCard>
          </Reveal>
        </section>
      ) : null}

      <section className="bg-surface-2">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 py-14 text-center">
          <h2 className="text-xl font-semibold text-ink">Ready when you are</h2>
          <p className="max-w-md text-sm text-ink-soft">
            Get a code, pick whether you&apos;re an artist or an organiser, and you&apos;re in.
            Everything on this page is free to use.
          </p>
          <Link
            href="/login"
            className="motion-lift motion-glow-signal min-h-11 rounded-md bg-signal px-6 py-3 text-sm font-medium text-surface"
          >
            Get started
          </Link>
        </div>
      </section>
    </main>
  );
}
