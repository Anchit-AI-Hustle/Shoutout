import Link from 'next/link';
import { createAnonClient } from '@shoutout/db';
import { searchArtists, type ArtistSearchResult } from '@shoutout/gigs';
import { EqualizerAccent, Reveal, TiltCard, Waveform, StatusPill } from '@shoutout/ui';

// The homepage, rebuilt around what the product can actually prove.
//
// The previous version was six abstract module cards and a headline about
// running "the music business part on one account" — true, but it showed
// nothing, named nobody, and led with an abstraction. Meanwhile the
// published evidence on this market is overwhelmingly about one thing:
// artists not getting paid. 1,800 unpaid in Karnataka against a 15-day
// rule; a DJ who had to shame a venue on Facebook to collect. That is the
// headline, not "one account".
//
// So this page now (a) leads with payment, (b) shows real artists from the
// database rather than describing them, and (c) exposes browse-by-role and
// browse-by-city, which double as internal links into the /book landing
// pages that carry the SEO strategy.
//
// ISR: live data, rendered once an hour, so the proof stays current without
// costing a query per visitor.
export const revalidate = 3600;

const MODULES = [
  {
    name: 'Gigs',
    href: '/gigs',
    tone: 'signal',
    description: 'Enquiry to payment in one pipeline. Holds that cannot double-book.',
  },
  {
    name: 'Collabs',
    href: '/collabs',
    tone: 'accent',
    description: 'Up to six slots, each on its own terms. Split sheets draft themselves.',
  },
  {
    name: 'Credits',
    href: '/works/new',
    tone: 'ok',
    description: 'Signed before files move. A verified record of who made what.',
  },
  {
    name: 'Profiles',
    href: '/profile',
    tone: 'trust',
    description: 'One account, many roles — matched independently, scored per role.',
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

const STEPS = [
  [
    'Find them',
    'Search by role, genre or city. Every profile shows releases, past gigs and who they played for.',
  ],
  [
    'Agree it in writing',
    'Send a request, get a quote, hold the date. Riders confirmed and timestamped by both sides.',
  ],
  [
    'Get paid',
    'Every rupee accounted for before a settlement can close. The database refuses an unbalanced one.',
  ],
] as const;

function titleCase(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface Combo {
  role: string;
  city: string;
  artist_count: number;
}

interface Proof {
  artists: ArtistSearchResult[];
  combos: Combo[];
  cities: string[];
}

async function getProof(): Promise<Proof> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // CI builds without credentials — degrade to a page with no live proof
  // rather than failing the build.
  if (!url || !key) return { artists: [], combos: [], cities: [] };

  const supabase = createAnonClient(url, key);
  const [artists, combosRes] = await Promise.all([
    searchArtists(supabase, { limit: 6 }).catch(() => [] as ArtistSearchResult[]),
    // Supabase's builder is a PromiseLike, so .catch() isn't available on
    // it directly — await it inside a wrapper instead.
    (async () => {
      try {
        const { data } = await supabase.rpc('list_book_combinations');
        return (data ?? []) as Combo[];
      } catch {
        return [] as Combo[];
      }
    })(),
  ]);

  const combos = combosRes.filter((c) => c.role && c.city);
  const cities = [...new Set(combos.map((c) => c.city))].slice(0, 8);
  return { artists, combos, cities };
}

export default async function HomePage() {
  const { artists, combos, cities } = await getProof();

  // Distinct roles, most supply first — these become the browse chips.
  const roles = [...new Set(combos.map((c) => c.role))].slice(0, 10);
  const artistCount = new Set(artists.map((a) => a.id)).size;

  return (
    <main>
      <section className="relative overflow-hidden bg-desk">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 px-4 text-accent/20">
          <Waveform bars={48} />
        </div>
        <div className="motion-rise relative z-10 mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 py-20 text-center">
          <span className="rounded-full bg-surface/10 px-3 py-1 text-xs font-medium text-accent">
            For artists, managers &amp; event organisers
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-surface md:text-5xl">
            Get paid for the gig <span className="text-accent">you already played</span>
          </h1>
          <EqualizerAccent />
          <p className="max-w-xl text-lg text-surface/70">
            Booking, contracts and settlement for India&apos;s independent music industry. Every
            rupee accounted for before a payment can close — enforced by the database, not by
            whoever answers the phone.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/artists"
              className="motion-lift motion-glow-signal min-h-11 rounded-md bg-signal px-6 py-3 text-sm font-medium text-surface"
            >
              Find an artist
            </Link>
            <Link
              href="/login"
              className="motion-lift min-h-11 rounded-md border border-surface/25 px-6 py-3 text-sm font-medium text-surface"
            >
              List yourself — free
            </Link>
          </div>
          <p className="text-xs text-surface/50">No password. Free to join. Nothing to install.</p>
        </div>
      </section>

      {/* Proof before pitch: real people, not descriptions of people. */}
      {artists.length > 0 ? (
        <section className="mx-auto max-w-5xl px-4 py-14">
          <div className="mb-5 flex items-baseline justify-between gap-3">
            <h2 className="text-xl font-semibold text-ink">Artists on ShoutOut</h2>
            <Link href="/artists" className="text-sm text-trust">
              Browse all →
            </Link>
          </div>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {artists.map((a, i) => (
              <Reveal key={a.id} delay={i}>
                <TiltCard maxTiltDeg={6}>
                  <Link
                    href={`/a/${a.slug}`}
                    className="motion-lift flex h-full flex-col overflow-hidden rounded-lg border border-line bg-surface"
                  >
                    {a.image_url ? (
                      <img
                        src={a.image_url}
                        alt=""
                        width={400}
                        height={400}
                        loading="lazy"
                        className="aspect-square w-full object-cover"
                      />
                    ) : (
                      <div className="flex aspect-square w-full items-center justify-center bg-surface-2 text-2xl font-semibold text-ink-soft">
                        {a.stage_name.charAt(0)}
                      </div>
                    )}
                    <div className="flex flex-1 flex-col gap-1 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-ink">{a.stage_name}</p>
                        {a.verified ? <StatusPill label="Verified" tone="success" /> : null}
                      </div>
                      <p className="text-xs text-ink-soft">
                        {a.home_city}
                        {a.roles.length > 0 ? ` · ${titleCase(a.roles[0]!)}` : ''}
                      </p>
                    </div>
                  </Link>
                </TiltCard>
              </Reveal>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Browse chips double as internal links into the /book landing pages. */}
      {roles.length > 0 ? (
        <section className="bg-surface-2">
          <div className="mx-auto max-w-5xl px-4 py-14">
            <h2 className="text-xl font-semibold text-ink">Book by role</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Matching happens per role — a vocalist and a mix engineer are different searches.
            </p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {roles.map((r) => (
                <li key={r}>
                  <Link
                    href={`/artists?role=${encodeURIComponent(r)}`}
                    className="motion-lift inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-4 text-sm text-ink"
                  >
                    {titleCase(r)}
                  </Link>
                </li>
              ))}
            </ul>

            {cities.length > 0 ? (
              <>
                <h2 className="mt-10 text-xl font-semibold text-ink">Book by city</h2>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {cities.map((c) => (
                    <li key={c}>
                      <Link
                        href={`/artists?city=${encodeURIComponent(c)}`}
                        className="motion-lift inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-4 text-sm text-ink"
                      >
                        {c}
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-4xl px-4 py-16">
        <h2 className="text-xl font-semibold text-ink">How a booking works</h2>
        <ol className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {STEPS.map(([title, body], i) => (
            <Reveal key={title} delay={i}>
              <li className="flex h-full flex-col gap-2 rounded-lg border border-line bg-surface p-5">
                <span className="font-mono text-xs font-semibold text-signal">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="font-semibold text-ink">{title}</h3>
                <p className="text-sm text-ink-soft">{body}</p>
              </li>
            </Reveal>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-4xl px-4 pb-16">
        <h2 className="mb-5 text-xl font-semibold text-ink">Everything else it does</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {MODULES.map((m, i) => (
            <Reveal key={m.name} delay={i}>
              <TiltCard>
                <Link
                  href={m.href}
                  className={`motion-lift ${TONE_GLOW[m.tone]} flex flex-col gap-2 rounded-lg border border-line border-t-4 bg-surface p-5 ${TONE_BORDER[m.tone]}`}
                >
                  <h3 className="text-lg font-semibold text-ink">{m.name}</h3>
                  <p className="text-sm text-ink-soft">{m.description}</p>
                </Link>
              </TiltCard>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="bg-desk">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 py-16 text-center">
          <h2 className="text-2xl font-semibold text-surface">
            {artistCount > 0 ? `Join the artists already listed` : 'Put your name on the list'}
          </h2>
          <p className="max-w-md text-sm text-surface/70">
            A profile takes five minutes: your roles, your releases, the gigs you&apos;ve played.
            Organisers find you from it.
          </p>
          <Link
            href="/login"
            className="motion-lift motion-glow-signal min-h-11 rounded-md bg-signal px-6 py-3 text-sm font-medium text-surface"
          >
            Create your profile
          </Link>
        </div>
      </section>
    </main>
  );
}
