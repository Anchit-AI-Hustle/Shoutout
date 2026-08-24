import Link from 'next/link';
import { createAnonClient } from '@shoutout/db';
import { searchArtists, type ArtistSearchResult } from '@shoutout/gigs';
import { EqualizerAccent, Reveal, TiltCard, Waveform, StatusPill } from '@shoutout/ui';

// The homepage.
//
// Positioning, corrected: this product is about *booking, connecting and
// finding collaborators* — not settlements. An earlier pass led with
// payment, reasoning from published evidence that unpaid artists are the
// loudest pain in the market. That evidence is real but it described a
// different product. Settlement is plumbing that makes a booking finish
// cleanly; it is not the reason anyone opens the site.
//
// What people come for: an organiser needs an act for a date, an artist
// wants to be found, a producer needs a vocalist. All three are discovery
// and connection problems. The page leads with those.
//
// It also (a) shows real profiles rather than describing them, and (b)
// exposes browse-by-role and browse-by-city, which double as the internal
// link graph into the /book landing pages carrying the SEO strategy.
//
// ISR: live data, rendered once an hour, so the proof stays current without
// costing a query per visitor.
export const revalidate = 3600;

const MODULES = [
  {
    name: 'Gigs',
    href: '/gigs',
    tone: 'signal',
    description: 'Every enquiry in one pipeline, from first message to a confirmed date.',
  },
  {
    name: 'Collabs',
    href: '/collabs',
    tone: 'accent',
    description: 'Need a vocalist, a drummer, a mix engineer? Post the slots and get matched.',
  },
  {
    name: 'Credits',
    href: '/works/new',
    tone: 'ok',
    description: 'A verified record of who made what, signed by everyone on it.',
  },
  {
    name: 'Profiles',
    href: '/profile',
    tone: 'trust',
    description: 'One account, many roles - matched independently, scored per role.',
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
    'Reach them directly',
    'Send a request without hunting for a phone number or going through three intermediaries.',
  ],
  [
    'Agree the details',
    'Quote, hold the date, confirm the rider - timestamped by both sides so nothing is disputed later.',
  ],
] as const;

function titleCase(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface Combo {
  kind: 'role' | 'genre';
  slug_token: string;
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

  const combos = combosRes.filter((c) => c.slug_token && c.city);
  const cities = [...new Set(combos.map((c) => c.city))].slice(0, 8);
  return { artists, combos, cities };
}

export default async function HomePage() {
  const { artists, combos, cities } = await getProof();

  // Only cells that passed the >=3 guardrail (migration 033) reach here, so
  // a chip never leads to a page with one artist on it.
  const roles = [
    ...new Set(combos.filter((c) => c.kind === 'role').map((c) => c.slug_token)),
  ].slice(0, 10);
  const genres = [
    ...new Set(combos.filter((c) => c.kind === 'genre').map((c) => c.slug_token)),
  ].slice(0, 10);

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
            Find who you need. <span className="text-accent">Book them properly.</span>
          </h1>
          <EqualizerAccent />
          <p className="max-w-xl text-lg text-surface/70">
            Search by role, genre or city: a vocalist in Mumbai, a tabla player in Chennai, a mix
            engineer anywhere. Book acts for your event, or find people to make music with. Built
            for India&apos;s independent music industry.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/artists"
              className="motion-lift motion-glow-signal min-h-11 rounded-md bg-signal px-6 py-3 text-sm font-medium text-surface"
            >
              Find an artist
            </Link>
            <Link
              href="/gigs/log"
              className="motion-lift min-h-11 rounded-md border border-surface/25 px-6 py-3 text-sm font-medium text-surface"
            >
              Already got a gig? Log it free
            </Link>
          </div>
          {/* Says precisely what is free. Migration 030 gates listing and
              booking, so "free" without qualification is now untrue - and a
              price the visitor discovers only after signing up is the kind
              of thing that loses the account permanently. */}
          <p className="text-xs text-surface/50">
            Logging your own gigs is free forever. A plan is only for being found by people you do
            not know yet.
          </p>
        </div>
      </section>

      {/* Proof before pitch: real people, not descriptions of people. */}
      {artists.length > 0 ? (
        <section className="mx-auto max-w-5xl px-4 py-14">
          <div className="mb-5 flex items-baseline justify-between gap-3">
            {/* Named honestly: every profile here is currently sample data
                seeded to exercise the schema. Calling them "Artists on
                ShoutOut" implies a roster that has signed up, which is a
                claim the product cannot yet back. */}
            <h2 className="text-xl font-semibold text-ink">Sample profiles</h2>
            <Link href="/artists" className="text-sm text-trust">
              Browse all →
            </Link>
          </div>
          <p className="mb-4 -mt-3 text-sm text-ink-soft">
            Example profiles showing what a listing looks like. Real artists replace these as they
            join.
          </p>
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
              Matching happens per role - a vocalist and a mix engineer are different searches.
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

            {genres.length > 0 ? (
              <>
                <h2 className="mt-10 text-xl font-semibold text-ink">Book by genre</h2>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {genres.map((g) => (
                    <li key={g}>
                      <Link
                        href={`/artists?genre=${encodeURIComponent(g)}`}
                        className="motion-lift inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-4 text-sm text-ink"
                      >
                        {titleCase(g)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

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
          <h2 className="text-2xl font-semibold text-surface">Put your name on the list</h2>
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
