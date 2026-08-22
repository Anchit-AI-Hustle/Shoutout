import Link from 'next/link';
import { createAnonClient } from '@shoutout/db';
import { EmptyState, StatusPill } from '@shoutout/ui';

export const dynamic = 'force-dynamic';

interface Shout {
  id: string;
  type: string;
  title: string;
  city: string | null;
  deadline: string | null;
  created_at: string;
}

async function getOpenShouts(): Promise<Shout[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return [];

  const supabase = createAnonClient(supabaseUrl, supabaseAnonKey);
  const { data } = await supabase
    .from('shouts')
    .select('id, type, title, city, deadline, created_at')
    .eq('status', 'open')
    .eq('visibility', 'open')
    .order('created_at', { ascending: false })
    .limit(20);

  return data ?? [];
}

const typeLabels: Record<string, string> = {
  collab: 'Collab',
  gig: 'Gig',
  band: 'Band',
  crew: 'Crew',
  venue: 'Venue',
  rehearsal: 'Rehearsal',
  open: 'Open call',
  brand: 'Brand',
  sync: 'Sync',
  label_pitch: 'Label pitch',
  mentor: 'Mentor',
  gear: 'Gear',
};

export default async function HomePage() {
  const shouts = await getOpenShouts();

  return (
    <main className="min-h-dvh">
      {/* Hero — culture register: warm, high contrast, display type allowed. */}
      <section className="flex flex-col items-center gap-6 px-4 pb-12 pt-16 text-center md:pt-24">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">SHOUTOUT</h1>
        <p className="max-w-md text-lg text-ink-soft">
          A producer needs a vocalist. A promoter needs an act. Put out a shout, and someone
          answers.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/post"
            className="flex min-h-11 items-center rounded-md bg-signal px-6 font-medium text-surface"
          >
            Put out a shout
          </Link>
          <Link
            href="/login"
            className="flex min-h-11 items-center rounded-md border border-line px-6 font-medium text-ink"
          >
            Sign in
          </Link>
        </div>
      </section>

      {/* Feed */}
      <section className="mx-auto flex max-w-2xl flex-col gap-4 px-4 pb-16">
        <h2 className="text-sm font-medium text-ink-soft">Open shouts ({shouts.length})</h2>

        {shouts.length === 0 ? (
          <EmptyState
            title="No shouts yet"
            body="Be the first — put out a shout and someone will answer."
            action={
              <Link href="/post" className="text-sm font-medium text-trust underline">
                Put out a shout
              </Link>
            }
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {shouts.map((shout) => (
              <li key={shout.id} className="rounded-lg border border-line bg-surface p-4">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <strong className="text-base text-ink">{shout.title}</strong>
                  <StatusPill label={typeLabels[shout.type] ?? shout.type} tone="active" />
                </div>
                {shout.city ? <p className="text-sm text-ink-soft">{shout.city}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
