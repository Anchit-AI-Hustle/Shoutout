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

// The full surface, so nothing shipped is invisible. Grouped rather than
// listed flat, because eleven equal cards reads as a feature dump.
const MODULES = [
  {
    name: 'Profiles',
    href: '/artists',
    tone: 'trust',
    description:
      'One account, many roles. Releases, past gigs, crowd sizes and a public page that search engines can find.',
  },
  {
    name: 'Gigs',
    href: '/gigs',
    tone: 'signal',
    description:
      'Enquiry to confirmed date in one pipeline, with quotes, date holds and riders signed by both sides.',
  },
  {
    name: 'Log a gig you already have',
    href: '/gigs/log',
    tone: 'signal',
    description:
      'Free, forever. Put a booking you made on WhatsApp in writing and start a track record from day one.',
  },
  {
    name: 'Collabs',
    href: '/collabs',
    tone: 'accent',
    description:
      'Post up to six slots on separate terms. A vocalist for a share, an engineer for a fee, matched per role.',
  },
  {
    name: 'Credits',
    href: '/works/new',
    tone: 'ok',
    description:
      'Split sheets signed before any file moves, and a permanent public record of who made what.',
  },
  {
    name: 'Organisers',
    href: '/organisers',
    tone: 'trust',
    description:
      'See who books in your city, what they run, how big it gets and who has played for them before.',
  },
  {
    name: 'Calendars',
    href: '/gigs/calendar',
    tone: 'accent',
    description:
      'A roster calendar for managers and a line-up calendar for organisers. One date cannot be confirmed twice.',
  },
  {
    name: 'Plans',
    href: '/pricing',
    tone: 'ok',
    description:
      'Browsing and logging your own gigs stay free. A plan is for being found by people you do not know yet.',
  },
] as const;

const TONE_BORDER: Record<(typeof MODULES)[number]['tone'], string> = {
  signal: 'border-t-signal',
  accent: 'border-t-accent',
  trust: 'border-t-trust',
  ok: 'border-t-ok',
};
const TONE_BORDER_L: Record<'signal' | 'accent' | 'trust', string> = {
  signal: 'border-l-signal',
  accent: 'border-l-accent',
  trust: 'border-l-trust',
};
const TONE_TEXT: Record<'signal' | 'accent' | 'trust', string> = {
  signal: 'text-signal',
  accent: 'text-accent',
  trust: 'text-trust',
};

const TONE_GLOW: Record<(typeof MODULES)[number]['tone'], string> = {
  signal: 'motion-glow-signal',
  accent: 'motion-glow-accent',
  trust: 'motion-glow-trust',
  ok: 'motion-glow-ok',
};

// Why anyone needs this. Concrete and grounded, because an abstract
// "we make booking easier" is what every marketplace says and none of them
// is memorable. Each line is a thing that is actually true of the market
// today, drawn from the published evidence rather than invented.
const PROBLEM = [
  [
    'It runs on WhatsApp chains',
    'Finding a tabla player in Chennai means asking three people who know someone. Even booking agencies call the current system unreliable and opaque.',
  ],
  [
    'Nothing is written down',
    'The fee, the date, the sound requirements, who pays for travel. All of it lives in a chat thread, so the disagreement happens after the gig.',
  ],
  [
    'The people who played are not named',
    'Session musicians on some of the biggest records in the country have no public record that they were there at all.',
  ],
] as const;

// What you can do here, by who you are. Three audiences, all shown at once
// rather than behind tabs: a visitor should never have to guess which of
// these they are before the page will tell them anything.
const AUDIENCES = [
  {
    who: 'If you make music',
    sub: 'Vocalists, players, producers, engineers, DJs',
    tone: 'signal' as const,
    can: [
      [
        'Be found for what you actually do',
        'One account, every role you play. A mix engineer and a vocalist are different searches, scored separately.',
      ],
      [
        'Log gigs you already have, free',
        'Bookings made on WhatsApp get recorded here, confirmed in writing, and become your track record.',
      ],
      [
        'Get credited on the work',
        'Split sheets signed by everyone before any file moves. Your name on the record, permanently.',
      ],
      [
        'Find people to make the next one with',
        'Post what you need, a vocalist or a drummer, and get matched per role.',
      ],
      [
        'Show the proof',
        'A public page with your releases, your past gigs, the crowds, and who you played for.',
      ],
    ],
  },
  {
    who: 'If you represent artists',
    sub: 'Managers, agencies, labels',
    tone: 'accent' as const,
    can: [
      [
        'Every enquiry in one pipeline',
        'From first message to a confirmed date, instead of five parallel chat threads.',
      ],
      [
        'A calendar that cannot double-book',
        'One date, one confirmed booking, across the whole roster. Enforced by the database, not by whoever answers first.',
      ],
      [
        'Quote without guessing',
        'What comparable acts were actually paid for the same city, date and crowd size.',
      ],
      [
        'Riders both sides signed',
        'Sound, stay, travel and payment terms, timestamped by organiser and artist.',
      ],
      [
        'Reliability held per role',
        'Because a dependable session player and an unproven producer can be the same person.',
      ],
    ],
  },
  {
    who: 'If you book artists',
    sub: 'Organisers, venues, promoters, wedding and corporate planners',
    tone: 'trust' as const,
    can: [
      [
        'Search by role, genre or city',
        'A tabla player in Chennai. A mix engineer anywhere. A wedding singer in Jaipur.',
      ],
      [
        'Judge before you commit',
        'Past gigs, crowd sizes, releases and who they have played for, on every profile.',
      ],
      [
        'Send a request without a phone number',
        'Straight from their page. No intermediary, no three phone calls.',
      ],
      [
        'Track every request in one list',
        'Sent, quoted, held, confirmed. Stop reconstructing where a conversation stands.',
      ],
      [
        'One calendar for the whole line-up',
        'Every confirmed act across every date, not one artist at a time.',
      ],
    ],
  },
] as const;

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

      {/* Why this needs to exist at all. The page previously jumped from a
          headline straight to a list of features, which assumes the visitor
          already agrees there is a problem. Most do not. */}
      <section className="border-b border-line bg-surface-2">
        <div className="mx-auto max-w-4xl px-4 py-14">
          <h2 className="text-xl font-semibold text-ink">
            Booking music in India is still done the hard way
          </h2>
          <ul className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
            {PROBLEM.map(([title, body], i) => (
              <Reveal key={title} delay={i}>
                <li className="flex flex-col gap-2 border-t-2 border-signal pt-4">
                  <h3 className="font-semibold text-ink">{title}</h3>
                  <p className="text-sm text-ink-soft">{body}</p>
                </li>
              </Reveal>
            ))}
          </ul>
          <p className="mt-8 max-w-2xl text-base text-ink">
            ShoutOut makes the market searchable and the deal recorded. You get found for the
            specific thing you do, and what you agreed exists somewhere other than a chat thread.
          </p>
        </div>
      </section>

      {/* What you can do, by who you are. All three shown at once: a visitor
          should not have to guess which persona they are before the page
          will tell them anything useful. */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <h2 className="text-xl font-semibold text-ink">What you can do here</h2>
        <p className="mt-1 max-w-2xl text-sm text-ink-soft">
          Three sides of the same market. Find yours.
        </p>

        <div className="mt-8 flex flex-col gap-6">
          {AUDIENCES.map((a, i) => (
            <Reveal key={a.who} delay={i}>
              <div
                className={`rounded-lg border border-line border-l-4 bg-surface p-6 ${TONE_BORDER_L[a.tone]}`}
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="text-lg font-semibold text-ink">{a.who}</h3>
                  <p className="text-sm text-ink-soft">{a.sub}</p>
                </div>
                <ul className="mt-5 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                  {a.can.map(([title, body]) => (
                    <li key={title} className="flex gap-2.5">
                      <span aria-hidden="true" className={`pt-0.5 ${TONE_TEXT[a.tone]}`}>
                        &#10003;
                      </span>
                      <div>
                        <p className="text-sm font-medium text-ink">{title}</p>
                        <p className="text-sm text-ink-soft">{body}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
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
              // min-w-0 on the grid item: a grid child defaults to
              // min-width:auto, so it cannot shrink below its content. The
              // square press shot inside was forcing each cell wider than
              // half the viewport, pushing the whole document to 448px on a
              // 375px screen and breaking CLAUDE.md rule 10.
              <Reveal key={a.id} delay={i} className="min-w-0">
                <TiltCard maxTiltDeg={6} className="w-full">
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
        <h2 className="mb-5 text-xl font-semibold text-ink">Everything it does</h2>
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
