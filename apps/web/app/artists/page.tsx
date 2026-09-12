import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { createAnonClient } from '@shoutout/db';
import { searchArtists, type ArtistSearchResult } from '@shoutout/gigs';
import { ROLE_FAMILIES } from '@shoutout/identity';
import { EqualizerAccent, StatusPill, Waveform } from '@shoutout/ui';
import { Paywall } from '@/components/Paywall';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { resolveGeo } from '@/lib/geo';
import { roleLabel, roleNounPlural } from '@/lib/role-label';
import { BookArtist } from './BookArtist';

// Find artists - the organiser's discovery surface, and the page the whole
// acquisition model rests on.
//
// It used to be a Client Component that fetched everything in useEffect. That
// meant the server sent a shell and the words "Loading...", and nothing else.
// Verified against production: the rendered HTML of /artists contained zero
// artist links and zero artist names. Every crawler, and every visitor on a
// slow connection, got an empty page - on the one route that is supposed to
// bring in organic traffic. Three separate costs:
//
//   1. Nothing to index. Google cannot rank a spinner, so the page that is
//      meant to capture "book a tabla player in Chennai" ranked for nothing.
//   2. LCP measured from the fetch waterfall, not the response - three
//      round trips (session, entitlements, geo) before the first result,
//      against CLAUDE.md rule 10's 2.5s-on-4G budget.
//   3. The wrong call-to-action rendered until the session fetch resolved.
//
// Now: the server resolves geo from the edge headers, reads the session and
// entitlements it already has a client for, queries, and returns finished
// HTML. The filter form is a plain GET form, so filtering works with
// JavaScript disabled and every filtered view is a real, shareable,
// indexable URL. Only the booking form stays client-side, because it posts.
export const dynamic = 'force-dynamic';

interface SearchParams {
  role?: string;
  genre?: string;
  city?: string;
  /** Set by the filter form, so a deliberately cleared city is not re-guessed. */
  q?: string;
}

/**
 * The filters actually in effect. A submitted form always carries `q`, which
 * is how "the visitor cleared the city" is told apart from "the visitor has
 * not searched yet" - only the second should fall back to their location.
 */
function effectiveFilters(params: SearchParams, geoCity: string | null) {
  const submitted = params.q !== undefined;
  return {
    role: params.role?.trim() || '',
    genre: params.genre?.trim() || '',
    city: submitted ? (params.city?.trim() ?? '') : params.city?.trim() || geoCity || '',
    usedGeoDefault: !submitted && !params.city && Boolean(geoCity),
  };
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const params = await searchParams;
  const role = params.role?.trim();
  const city = params.city?.trim();
  const genre = params.genre?.trim();

  // A filtered view is a different page with a different intent, and saying
  // so is most of the value of making this route server-rendered at all.
  const subject = role ? roleNounPlural(role) : genre ? `${genre} artists` : 'Artists';
  const place = city ? ` in ${city}` : ' in India';

  return {
    title: `${subject}${place} to book`,
    description: `Find and book ${subject.toLowerCase()}${place}. See past gigs, crowd sizes and releases before you send a request.`,
    // Every filtered permutation canonicalises to the unfiltered page. The
    // combinations are near-duplicates of each other, and the pages built to
    // rank for "tabla player in chennai" are the /book/[slug] landing pages
    // with their >=3-artist guardrail (migration 033). Letting an unbounded
    // query-string space compete with those would split the signal and index
    // a lot of one-result pages. The filtered view stays fully useful to a
    // human with the link - it just is not the one in the index.
    alternates: { canonical: '/artists' },
  };
}

async function findArtists(filters: {
  role: string;
  genre: string;
  city: string;
}): Promise<{ results: ArtistSearchResult[]; failed: boolean }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // CI builds without credentials. Degrade to an empty page rather than
  // failing the build, same as the homepage does.
  if (!url || !key) return { results: [], failed: false };

  try {
    const supabase = createAnonClient(url, key);
    const results = await searchArtists(supabase, {
      role: filters.role || undefined,
      genre: filters.genre || undefined,
      city: filters.city || undefined,
      limit: 24,
    });
    return { results, failed: false };
  } catch {
    // Distinguished from "no matches" on purpose: an outage and an empty
    // result set need completely different copy, and telling someone there
    // are no tabla players in Chennai when the database is down is a lie
    // that costs a visit.
    return { results: [], failed: true };
  }
}

/** Session and entitlement, read server-side so the card renders the right CTA first time. */
async function readViewer(): Promise<{ signedIn: boolean; canBook: boolean }> {
  try {
    const supabase = await getServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { signedIn: false, canBook: false };

    const { data } = await supabase.rpc('my_entitlements');
    const rows = (data ?? []) as { entitlement: string }[];
    return {
      signedIn: true,
      canBook: rows.some((r) => r.entitlement === 'send_booking_requests'),
    };
  } catch {
    return { signedIn: false, canBook: false };
  }
}

const fieldClass = 'min-h-11 rounded-md border border-line bg-surface px-3 text-base text-ink';

export default async function ArtistSearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const geo = resolveGeo(await headers());
  const filters = effectiveFilters(params, geo.city);

  const [{ results, failed }, viewer] = await Promise.all([findArtists(filters), readViewer()]);

  return (
    <main>
      <section className="relative overflow-hidden bg-desk">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 px-4 text-accent/20">
          <Waveform bars={48} />
        </div>
        <div className="motion-rise relative z-10 mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 py-14 text-center">
          <span className="rounded-full bg-surface/10 px-3 py-1 text-xs font-medium text-accent">
            For event organisers &amp; venues
          </span>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-surface md:text-4xl">
              Find artists
            </h1>
            <EqualizerAccent bars={4} />
          </div>
          <p className="max-w-xl text-lg text-surface/70">
            Search by <span className="text-accent">role</span>, genre or city - a vocalist, a mix
            engineer, a tabla player - then book them without chasing a phone number.
          </p>
        </div>
      </section>

      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
        {/* A plain GET form. No JavaScript required to filter, every result
            set has its own URL, and the browser restores the controls from
            the query string on back-navigation for free. */}
        <form method="GET" action="/artists" className="motion-rise flex flex-wrap gap-2">
          <input type="hidden" name="q" value="1" />
          {/* Role is the primary filter, not an afterthought:
              docs/04-PROFILES.md - "Matching happens per role, never per
              person." Grouped by the families packages/identity defines, so
              the vocabulary has exactly one source. */}
          <select name="role" aria-label="Role" defaultValue={filters.role} className={fieldClass}>
            <option value="">Any role</option>
            {Object.entries(ROLE_FAMILIES).map(([family, def]) => (
              <optgroup key={family} label={def.label}>
                {def.roles.map((r) => (
                  <option key={r} value={r}>
                    {roleLabel(r)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <input
            name="genre"
            aria-label="Genre"
            placeholder="Genre"
            defaultValue={filters.genre}
            className={fieldClass}
          />
          <input
            name="city"
            aria-label="City"
            placeholder="City"
            defaultValue={filters.city}
            className={fieldClass}
          />
          <button
            type="submit"
            className="motion-lift min-h-11 rounded-md bg-signal px-4 text-sm font-medium text-surface"
          >
            Search
          </button>
        </form>

        {filters.usedGeoDefault ? (
          <p className="-mt-3 text-xs text-ink-soft">
            Showing artists near <span className="font-medium text-ink">{filters.city}</span>, based
            on where you are browsing from. Clear the city field to search everywhere.
          </p>
        ) : null}

        {viewer.signedIn && !viewer.canBook ? (
          <Paywall
            title="Booking requests need a plan"
            description="Browsing artists is free. Sending a booking request - and everything that follows it: quotes, holds, riders, settlement - needs an active plan."
            requiredTier="basic"
          />
        ) : null}

        {failed ? (
          <div className="rounded-lg border border-signal/40 bg-signal/5 p-5">
            <p className="font-medium text-ink">Artist search is temporarily unavailable</p>
            <p className="mt-1 text-sm text-ink-soft">
              This is on our side, not yours, and it is not a sign that nobody matches. Try again in
              a moment.
            </p>
          </div>
        ) : results.length === 0 ? (
          <div className="rounded-lg border border-line p-5">
            <p className="font-medium text-ink">No artists match that search yet.</p>
            <p className="mt-1 text-sm text-ink-soft">
              Try a wider search - drop the city, or pick a broader role.
            </p>
            <Link href="/artists" className="mt-3 inline-block text-sm text-trust">
              Clear all filters →
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {results.map((artist) => (
              <li
                key={artist.id}
                className="motion-lift flex flex-col gap-2 rounded-lg border border-line p-4"
              >
                <div className="flex items-start gap-3">
                  {/* Plain <img>, not next/image: these are remote URLs and
                      next/image would need every host allowlisted in
                      next.config for a picture that is already the right
                      size. */}
                  {artist.image_url ? (
                    <img
                      src={artist.image_url}
                      alt={`${artist.stage_name}, press photo`}
                      width={64}
                      height={64}
                      loading="lazy"
                      className="h-16 w-16 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-surface-2 text-lg font-semibold text-ink-soft"
                    >
                      {artist.stage_name.charAt(0)}
                    </div>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/a/${artist.slug}`} className="font-medium text-ink">
                        {artist.stage_name}
                      </Link>
                      {artist.verified ? <StatusPill label="Verified" tone="success" /> : null}
                    </div>
                    {/* What they have actually got behind them - the reason to
                        click through rather than scroll past. */}
                    <p className="text-xs text-ink-soft">
                      {[
                        artist.album_count > 0
                          ? `${artist.album_count} release${artist.album_count === 1 ? '' : 's'}`
                          : null,
                        artist.track_count > 0 ? `${artist.track_count} tracks` : null,
                        artist.performance_count > 0
                          ? `${artist.performance_count} gigs listed`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ') || 'Profile in progress'}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-ink-soft">
                  {artist.home_city ?? 'City unknown'}
                  {artist.genres.length > 0 ? ` · ${artist.genres.join(', ')}` : ''}
                </p>

                {/* The roles this person is actually bookable for. Without
                    these the card cannot answer "can they do the job", which
                    is the only question an organiser is asking. */}
                {artist.roles.length > 0 ? (
                  <ul className="flex flex-wrap gap-1.5">
                    {artist.roles.map((r) => (
                      <li key={r}>
                        <StatusPill
                          label={roleLabel(r)}
                          tone={r === filters.role ? 'active' : 'neutral'}
                        />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-ink-soft">No roles declared yet.</p>
                )}

                {artist.bio ? (
                  <p className="line-clamp-2 text-sm text-ink-soft">{artist.bio}</p>
                ) : null}

                {/* Fee band is opt-in (docs/04-PROFILES.md: "Fee band shown
                    only if the artist opts in - forcing it costs supply").
                    Say which it is rather than showing nothing. */}
                <p className="text-xs text-ink-soft">
                  {artist.fee_band_visible ? 'Fee band shown on their profile' : 'Fee on request'}
                </p>

                <BookArtist
                  artistId={artist.id}
                  defaultCity={filters.city}
                  signedIn={viewer.signedIn}
                  canBook={viewer.canBook}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
