import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createAnonClient } from '@shoutout/db';
import { getEvent, getEventLineup, getRelatedEvents } from '@shoutout/profiles';
import { StatusPill, EqualizerAccent } from '@shoutout/ui';

// /e/[slug] — one page per event.
//
// Events previously existed only as cards inside an organiser's profile, so
// there was nothing to link to and nothing to index. An event page is also
// the natural join between the two sides of the marketplace: it names the
// organiser who ran it and the artists who played it, and links to both.
//
// ISR like the other public pages — these are read far more often than they
// change.
export const revalidate = 3600;

function anon() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? createAnonClient(url, key) : null;
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export async function generateStaticParams() {
  const supabase = anon();
  if (!supabase) return [];
  const { data } = await supabase.rpc('list_event_slugs');
  return ((data ?? []) as { slug: string }[]).map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = anon();
  if (!supabase) return { title: 'Event · ShoutOut' };
  const event = await getEvent(supabase, slug).catch(() => null);
  if (!event) return { title: 'Event · ShoutOut' };

  const where = [event.venue, event.city].filter(Boolean).join(', ');
  return {
    title: `${event.title} · ShoutOut`,
    description: `${event.title}${where ? ` at ${where}` : ''}${
      event.held_on ? `, ${formatDate(event.held_on)}` : ''
    }. Presented by ${event.organiser_name}.`,
    alternates: { canonical: `/e/${slug}` },
  };
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = anon();
  if (!supabase) notFound();

  const event = await getEvent(supabase, slug).catch(() => null);
  if (!event) notFound();

  const [lineup, related] = await Promise.all([
    getEventLineup(supabase, slug).catch(() => []),
    getRelatedEvents(supabase, slug).catch(() => []),
  ]);

  const where = [event.venue, event.city].filter(Boolean).join(', ');

  // schema.org Event — this is the page type search engines have the richest
  // handling for, so it is worth marking up properly.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'MusicEvent',
    name: event.title,
    ...(event.held_on ? { startDate: event.held_on } : {}),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    ...(event.venue || event.city
      ? {
          location: {
            '@type': 'Place',
            name: event.venue ?? event.city,
            ...(event.city
              ? { address: { '@type': 'PostalAddress', addressLocality: event.city } }
              : {}),
          },
        }
      : {}),
    organizer: { '@type': 'Organization', name: event.organiser_name },
    ...(lineup.length > 0
      ? { performer: lineup.map((l) => ({ '@type': 'MusicGroup', name: l.headliner })) }
      : {}),
    ...(event.image_url ? { image: event.image_url } : {}),
  };

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {event.image_url ? (
        <div className="relative h-56 w-full overflow-hidden bg-desk sm:h-72">
          <img src={event.image_url} alt="" className="h-full w-full object-cover opacity-80" />
        </div>
      ) : null}

      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10">
        <header className="motion-rise flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-ink md:text-3xl">{event.title}</h1>
            <EqualizerAccent bars={3} />
          </div>
          <p className="text-base text-ink-soft">
            {[where, formatDate(event.held_on)].filter(Boolean).join(' · ')}
          </p>
          {event.attendance ? (
            <p className="text-sm text-ink-soft">
              <span className="font-medium tabular-nums text-ink">
                {event.attendance.toLocaleString('en-IN')}
              </span>{' '}
              attended
            </p>
          ) : null}
        </header>

        <section className="flex items-center gap-3 rounded-lg border border-line p-4">
          {event.organiser_logo_url ? (
            <img
              src={event.organiser_logo_url}
              alt=""
              width={56}
              height={56}
              className="h-14 w-14 shrink-0 rounded-md object-cover"
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wide text-ink-faint">Presented by</p>
            <div className="flex items-center gap-2">
              <Link href={`/o/${event.organiser_slug}`} className="font-medium text-ink">
                {event.organiser_name}
              </Link>
              {event.organiser_verified ? <StatusPill label="Verified" tone="success" /> : null}
            </div>
            {event.organiser_city ? (
              <p className="text-sm text-ink-soft">{event.organiser_city}</p>
            ) : null}
          </div>
        </section>

        {lineup.length > 0 ? (
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-ink">Line-up</h2>
            <ul className="flex flex-col gap-2">
              {lineup.map((l) => (
                <li
                  key={l.headliner}
                  className="flex items-center gap-3 rounded-lg border border-line p-3"
                >
                  {l.image_url ? (
                    <img
                      src={l.image_url}
                      alt=""
                      width={48}
                      height={48}
                      loading="lazy"
                      className="h-12 w-12 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-surface-2 text-base font-semibold text-ink-soft">
                      {l.headliner.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    {/* Name matching is best-effort, so an unmatched
                        headliner stays plain text rather than linking to
                        a profile that may not be the same act. */}
                    {l.artist_slug ? (
                      <Link href={`/a/${l.artist_slug}`} className="font-medium text-ink">
                        {l.headliner}
                      </Link>
                    ) : (
                      <span className="font-medium text-ink">{l.headliner}</span>
                    )}
                    {l.artist_slug ? (
                      <p className="text-xs text-trust">View profile →</p>
                    ) : (
                      <p className="text-xs text-ink-soft">Not on ShoutOut yet</p>
                    )}
                  </div>
                  {l.verified ? <StatusPill label="Verified" tone="success" /> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {related.length > 0 ? (
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-ink">More from {event.organiser_name}</h2>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {related.map((r) => (
                <li key={r.slug}>
                  <Link
                    href={`/e/${r.slug}`}
                    className="motion-lift flex h-full flex-col overflow-hidden rounded-lg border border-line"
                  >
                    {r.image_url ? (
                      <img
                        src={r.image_url}
                        alt=""
                        width={400}
                        height={200}
                        loading="lazy"
                        className="h-28 w-full object-cover"
                      />
                    ) : null}
                    <div className="flex flex-col gap-1 p-3">
                      <p className="font-medium text-ink">{r.title}</p>
                      <p className="text-sm text-ink-soft">
                        {[r.venue, r.city].filter(Boolean).join(', ')}
                        {r.held_on ? ` · ${formatDate(r.held_on)}` : ''}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <Link href={`/o/${event.organiser_slug}`} className="text-sm text-trust">
          ← All events by {event.organiser_name}
        </Link>
      </div>
    </main>
  );
}
