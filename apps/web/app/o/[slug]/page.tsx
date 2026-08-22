import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createAnonClient } from '@shoutout/db';
import { getOrganiser, getOrganiserEvents } from '@shoutout/profiles';
import { StatusPill, EqualizerAccent } from '@shoutout/ui';

// Public organiser page — the counterpart to /a/[slug].
//
// An artist deciding whether to reply to a booking request needs to know
// who is asking: what they run, at what scale, and who has played for them
// before. Read through the anon client and the public RPCs (migration 022),
// never the tables, which are RLS-scoped to the owning org.
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const supabase = anonClient();
  if (!supabase) return { title: 'Organiser · ShoutOut' };
  const organiser = await getOrganiser(supabase, slug).catch(() => null);
  if (!organiser) return { title: 'Organiser · ShoutOut' };
  return {
    title: `${organiser.display_name} · ShoutOut`,
    description: organiser.bio ?? `Events by ${organiser.display_name}.`,
  };
}

function anonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createAnonClient(url, key);
}

export default async function OrganiserPublicPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = anonClient();
  if (!supabase) notFound();

  const organiser = await getOrganiser(supabase, slug).catch(() => null);
  if (!organiser) notFound();

  const events = await getOrganiserEvents(supabase, organiser.id).catch(() => []);
  const totalAttendance = events.reduce((sum, e) => sum + (e.attendance ?? 0), 0);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-12">
      <div className="motion-rise flex items-start gap-4">
        {organiser.logo_url ? (
          <img
            src={organiser.logo_url}
            alt=""
            width={96}
            height={96}
            className="h-24 w-24 shrink-0 rounded-lg object-cover"
          />
        ) : null}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-ink">{organiser.display_name}</h1>
            <EqualizerAccent bars={3} />
            {organiser.verified ? <StatusPill label="Verified" tone="success" /> : null}
          </div>
          <p className="text-sm text-ink-soft">
            {organiser.home_city ?? 'City unknown'}
            {organiser.founded_year ? ` · organising since ${organiser.founded_year}` : ''}
          </p>
          {organiser.event_types.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5">
              {organiser.event_types.map((t) => (
                <li key={t}>
                  <StatusPill label={t} tone="neutral" />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      {organiser.bio ? <p className="text-base text-ink">{organiser.bio}</p> : null}

      {events.length > 0 ? (
        <>
          {/* The number an artist actually cares about before replying. */}
          <div className="flex gap-6 rounded-lg border border-line p-4">
            <div>
              <p className="text-xl font-semibold text-ink">{events.length}</p>
              <p className="text-xs text-ink-soft">events listed</p>
            </div>
            <div>
              <p className="text-xl font-semibold text-ink">
                {totalAttendance.toLocaleString('en-IN')}
              </p>
              <p className="text-xs text-ink-soft">total attendance</p>
            </div>
          </div>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-ink">Past events</h2>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {events.map((e) => (
                <li
                  key={`${e.title}-${e.held_on}`}
                  className="motion-lift overflow-hidden rounded-lg border border-line"
                >
                  {e.image_url ? (
                    <img
                      src={e.image_url}
                      alt=""
                      width={800}
                      height={500}
                      loading="lazy"
                      className="h-36 w-full object-cover"
                    />
                  ) : null}
                  <div className="flex flex-col gap-1 p-3">
                    <p className="font-medium text-ink">{e.title}</p>
                    <p className="text-sm text-ink-soft">
                      {[e.venue, e.city].filter(Boolean).join(', ')}
                      {e.held_on ? ` · ${e.held_on}` : ''}
                    </p>
                    {e.attendance ? (
                      <p className="text-xs text-ink-soft">
                        {e.attendance.toLocaleString('en-IN')} attended
                      </p>
                    ) : null}
                    {e.headliners.length > 0 ? (
                      <p className="text-xs text-ink-soft">Headliners: {e.headliners.join(', ')}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : (
        <p className="text-sm text-ink-soft">No past events listed yet.</p>
      )}

      <Link href="/organisers" className="text-sm text-trust">
        ← All organisers
      </Link>
    </main>
  );
}
