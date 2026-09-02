import type { Metadata } from 'next';
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
export const metadata: Metadata = {
  // The homepage is the one page whose title should not carry the "| ShoutOut"
  // suffix the layout template adds, so it sets an absolute title.
  title: {
    absolute: 'ShoutOut - book musicians and find collaborators in India',
  },
  description:
    'Find who you need and book them properly. Search by role, genre or city, book acts for your event, or find people to make music with.',
  alternates: { canonical: '/' },
};

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
// Colour now means "which of the three problems", not "which audience" -
// so a problem, its fix, and every capability derived from it are the same
// colour wherever they appear on the page.
const TONE_DOT: Record<'signal' | 'accent' | 'trust', string> = {
  signal: 'bg-signal',
  accent: 'bg-accent',
  trust: 'bg-trust',
};
const TONE_BORDER_T: Record<'signal' | 'accent' | 'trust', string> = {
  signal: 'border-t-signal',
  accent: 'border-t-accent',
  trust: 'border-t-trust',
};

const TONE_GLOW: Record<(typeof MODULES)[number]['tone'], string> = {
  signal: 'motion-glow-signal',
  accent: 'motion-glow-accent',
  trust: 'motion-glow-trust',
  ok: 'motion-glow-ok',
};

// Why anyone needs this, and what each problem turns into.
//
// The page's whole job is to make one chain visible: here is what is broken,
// here is the fix, here is what that fix looks like for you specifically.
// Previously the problem section and the audience section were two unrelated
// lists sitting next to each other - a visitor read three complaints, then
// read fifteen features, and had to do the joining themselves. Most will not.
//
// So the three problems are now the spine. Each carries a tag, each names the
// fix it turns into, and every single capability further down the page is
// stamped with the tag of the problem it solves. There are exactly three
// answers in this product; the rest is those three answers in different
// shapes.
//
// The tag is a word, not just a colour: #e8b33a on the light surface is far
// below a readable contrast ratio at 11px, so the colour is a dot that
// reinforces and the word is what actually carries the mapping.
const PROBLEMS = [
  {
    id: 'find',
    tag: 'Findable',
    tone: 'signal',
    title: 'It runs on WhatsApp chains',
    body: 'Finding a tabla player in Chennai means asking three people who know someone. Even booking agencies call the current system unreliable and opaque.',
    answer:
      'So the market becomes searchable. Every role, genre and city, and a public page for every person in it.',
  },
  {
    id: 'record',
    tag: 'In writing',
    tone: 'accent',
    title: 'Nothing is written down',
    body: 'The fee, the date, the sound requirements, who pays for travel. All of it lives in a chat thread, so the disagreement happens after the gig.',
    answer:
      'So every deal is recorded. Quote, date hold and rider, timestamped by both sides before anyone travels.',
  },
  {
    id: 'credit',
    tag: 'Credited',
    tone: 'trust',
    title: 'The people who played are not named',
    body: 'Session musicians on some of the biggest records in the country have no public record that they were there at all.',
    answer:
      'So credits are permanent and public. Everyone who was in the room is named on the work, and can prove it.',
  },
] as const;

type ProblemId = (typeof PROBLEMS)[number]['id'];

const PROBLEM_BY_ID: Record<ProblemId, (typeof PROBLEMS)[number]> = {
  find: PROBLEMS[0],
  record: PROBLEMS[1],
  credit: PROBLEMS[2],
};

// What you can do here, by who you are. Three audiences, all shown at once
// rather than behind tabs: a visitor should never have to guess which of
// these they are before the page will tell them anything.
//
// Every entry carries `fix`, which is not decoration. It is the assertion
// that this capability exists because of one of the three problems above,
// and each audience block ends up showing all three tags - which is the
// point. The same three fixes, read three different ways.
//
// Ordered by fix within each block so the tags cluster as you scan.
const AUDIENCES = [
  {
    who: 'If you make music',
    sub: 'Vocalists, players, producers, engineers, DJs',
    can: [
      {
        fix: 'find' as ProblemId,
        title: 'Be found for what you actually do',
        body: 'One account, every role you play. A mix engineer and a vocalist are different searches, scored separately.',
      },
      {
        fix: 'find' as ProblemId,
        title: 'Find people to make the next one with',
        body: 'Post what you need, a vocalist or a drummer, and get matched per role.',
      },
      {
        fix: 'record' as ProblemId,
        title: 'Log gigs you already have, free',
        body: 'Bookings made on WhatsApp get recorded here, confirmed in writing, and become your track record.',
      },
      {
        fix: 'credit' as ProblemId,
        title: 'Get credited on the work',
        body: 'Split sheets signed by everyone before any file moves. Your name on the record, permanently.',
      },
      {
        fix: 'credit' as ProblemId,
        title: 'Show the proof',
        body: 'A public page with your releases, your past gigs, the crowds, and who you played for.',
      },
    ],
  },
  {
    who: 'If you represent artists',
    sub: 'Managers, agencies, labels',
    can: [
      {
        fix: 'find' as ProblemId,
        title: 'Your whole roster, findable',
        body: 'Each artist gets a public page, and requests from it land in your pipeline instead of on their personal phone.',
      },
      {
        fix: 'record' as ProblemId,
        title: 'Every enquiry in one pipeline',
        body: 'From first message to a confirmed date, instead of five parallel chat threads.',
      },
      {
        fix: 'record' as ProblemId,
        title: 'A calendar that cannot double-book',
        body: 'One date, one confirmed booking, across the whole roster. Enforced by the database, not by whoever answers first.',
      },
      {
        fix: 'record' as ProblemId,
        title: 'Riders both sides signed',
        body: 'Sound, stay, travel and payment terms, timestamped by organiser and artist.',
      },
      {
        fix: 'credit' as ProblemId,
        title: 'Quote without guessing',
        body: 'What comparable acts were actually paid for the same city, date and crowd size, because those gigs are on record.',
      },
      {
        fix: 'credit' as ProblemId,
        title: 'Reliability held per role',
        body: 'Because a dependable session player and an unproven producer can be the same person.',
      },
    ],
  },
  {
    who: 'If you book artists',
    sub: 'Organisers, venues, promoters, wedding and corporate planners',
    can: [
      {
        fix: 'find' as ProblemId,
        title: 'Search by role, genre or city',
        body: 'A tabla player in Chennai. A mix engineer anywhere. A wedding singer in Jaipur.',
      },
      {
        fix: 'find' as ProblemId,
        title: 'Send a request without a phone number',
        body: 'Straight from their page. No intermediary, no three phone calls.',
      },
      {
        fix: 'record' as ProblemId,
        title: 'Track every request in one list',
        body: 'Sent, quoted, held, confirmed. Stop reconstructing where a conversation stands.',
      },
      {
        fix: 'record' as ProblemId,
        title: 'One calendar for the whole line-up',
        body: 'Every confirmed act across every date, not one artist at a time.',
      },
      {
        fix: 'credit' as ProblemId,
        title: 'Judge before you commit',
        body: 'Past gigs, crowd sizes, releases and who they have played for, on every profile.',
      },
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

// The crosswalk itself. The same chip renders on a problem card and on
// every capability derived from that problem, so the connection is a thing
// you can see rather than a thing you have to infer.
function FixTag({ id }: { id: ProblemId }) {
  const problem = PROBLEM_BY_ID[id];
  return (
    <span className="mr-2 inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line px-2 py-0.5 align-[0.1em] text-[11px] font-medium text-ink-soft">
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[problem.tone]}`} />
      {problem.tag}
    </span>
  );
}

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

      {/* Why this needs to exist at all, and what each problem becomes.
          The page previously jumped from a headline straight to a list of
          features, which assumes the visitor already agrees there is a
          problem. Most do not. Each card now names the problem and the fix
          it turns into, and the tag on it reappears on every capability
          below that exists because of it. */}
      <section className="border-b border-line bg-surface-2">
        <div className="mx-auto max-w-5xl px-4 py-14">
          <h2 className="text-xl font-semibold text-ink">
            Booking music in India is still done the hard way
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-ink-soft">
            Three things are broken. Everything ShoutOut does is a fix for one of them.
          </p>
          <ul className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
            {PROBLEMS.map((problem, i) => (
              <Reveal key={problem.id} delay={i} className="min-w-0">
                <li
                  className={`flex h-full flex-col gap-2 border-t-2 pt-4 ${TONE_BORDER_T[problem.tone]}`}
                >
                  <h3 className="font-semibold text-ink">{problem.title}</h3>
                  <p className="text-sm text-ink-soft">{problem.body}</p>
                  {/* mt-auto so the fix pins to the bottom of the card: the
                      three problem bodies are different lengths, and the
                      answers only read as a matched set when they line up. */}
                  <div className="mt-auto flex flex-col items-start gap-2 border-t border-line pt-3">
                    <FixTag id={problem.id} />
                    <p className="text-sm text-ink">{problem.answer}</p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* The same three fixes, read three different ways. All three
          audiences shown at once: a visitor should not have to guess which
          persona they are before the page will tell them anything useful.
          Every line is tagged with the problem it came from, so nothing
          here is a feature that arrived from nowhere. */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <h2 className="text-xl font-semibold text-ink">What that looks like for you</h2>
        <p className="mt-1 max-w-2xl text-sm text-ink-soft">
          Same three fixes, three sides of the same market. The tag on each line tells you which
          problem it came from.
        </p>

        <div className="mt-8 flex flex-col gap-6">
          {AUDIENCES.map((a, i) => (
            <Reveal key={a.who} delay={i} className="min-w-0">
              <div className="rounded-lg border border-line bg-surface p-6">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="text-lg font-semibold text-ink">{a.who}</h3>
                  <p className="text-sm text-ink-soft">{a.sub}</p>
                </div>
                <ul className="mt-5 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
                  {a.can.map((item) => (
                    // The tag sits inline at the head of the title rather than
                    // on a row of its own: a short title then keeps the tag on
                    // the same line, and a long one wraps under it, so every
                    // item starts at the same place instead of alternating
                    // between one-line and two-line headers.
                    <li key={item.title} className="min-w-0">
                      <p className="text-sm font-medium text-ink">
                        <FixTag id={item.fix} />
                        {item.title}
                      </p>
                      <p className="mt-1 text-sm text-ink-soft">{item.body}</p>
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
