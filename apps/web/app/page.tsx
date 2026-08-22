import type { CSSProperties } from 'react';
import { EqualizerAccent } from '@shoutout/ui';

// docs/10-PROMOTION.md: "/" is a static page that explains in eight seconds
// and routes to one of three funnels (Manager / Artist / Organiser). Full
// funnel routing is Promotion (M8) — out of scope right now. This replaces
// the old shouts-feed homepage, which broke when migration 008 dropped the
// polymorphic Shout tables the fifth-draft architecture used. ShoutOut is
// the brand name, not a data model (docs/CLAUDE.md).
//
// A culture surface (docs/13-DESIGN-SYSTEM.md): "present, purposeful"
// motion is in scope here — a staggered rise-in plus the equalizer accent —
// unlike the money surfaces (Credits' /works, /w pages), which stay
// deliberately still.
export default function HomePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="motion-rise flex items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">ShoutOut</h1>
        <EqualizerAccent />
      </div>
      <p
        className="motion-rise max-w-md text-lg text-ink-soft"
        style={{ '--motion-delay': 1 } as CSSProperties}
      >
        An all-in-one platform for the independent music industry in India — Credits, Gigs, Collabs,
        Payments, and more, on one account.
      </p>
    </main>
  );
}
