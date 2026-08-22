import type { CSSProperties } from 'react';
import Link from 'next/link';
import { listBriefs } from '@shoutout/gigs';
import { StatusPill, EqualizerAccent } from '@shoutout/ui';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { SignedOutExplainer } from '@/components/SignedOutExplainer';

function rise(step: number): CSSProperties {
  return { '--motion-delay': step } as CSSProperties;
}

// Forces this route to render per-request rather than being attempted as a
// static page at build time. Without this, Next's "Generating static pages"
// pass invokes the page during `pnpm build` before it ever reaches
// cookies() (the call that would otherwise make Next infer this route is
// dynamic on its own) — getServerSupabaseClient() throws synchronously on
// missing config before that point, and CI's build step intentionally
// doesn't set NEXT_PUBLIC_SUPABASE_URL/ANON_KEY (they're Vercel deploy-time
// config, not something docs/15-TESTING.md's `pnpm build` gate injects),
// so the uncaught throw crashed the whole build. Confirmed by reproducing
// locally with .env.local removed. This page also cannot be static anyway
// — it reads the caller's session on every request.
export const dynamic = 'force-dynamic';

// The Manager OS pipeline board (docs/05-GIGS.md: "Pipeline board: enquiry
// → quoted → held → confirmed → performed → settled"). A Server Component
// calling the module directly, same pattern as /a/[slug] calling Supabase
// directly rather than round-tripping through its own API route.

const STATUS_TONE: Record<string, 'neutral' | 'active' | 'success' | 'warning'> = {
  open: 'neutral',
  shortlisted: 'active',
  quoted: 'active',
  held: 'warning',
  confirmed: 'success',
  closed: 'neutral',
  cancelled: 'neutral',
};

interface Brief {
  id: string;
  city: string;
  event_type: string;
  event_date: string | null;
  genres: string[];
  status: string;
  budget_inferred: boolean;
  created_at: string;
}

export default async function GigsPipelinePage() {
  const supabase = await getServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return (
      <SignedOutExplainer
        title="Gigs"
        description="Your booking pipeline — one screen that answers who's booked, who owes you money, and who to call next."
        points={[
          'Brief intake, shortlisting, and quotes in one place',
          'A shared holds calendar across your whole roster',
          'Riders confirmed and timestamped by both sides',
        ]}
      />
    );
  }

  const briefs = (await listBriefs(supabase).catch(() => [])) as Brief[];

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-12">
      <div className="motion-rise">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-ink">Gigs</h1>
          <EqualizerAccent bars={3} />
        </div>
        <p className="text-sm text-ink-soft">
          Who&apos;s booked, who owes money, who to call next.
        </p>
      </div>

      <div className="motion-rise flex gap-3" style={rise(1)}>
        <Link
          href="/gigs/calendar"
          className="motion-lift rounded-md border border-line px-4 py-2 text-sm text-ink-soft"
        >
          Roster calendar
        </Link>
      </div>

      {briefs.length === 0 ? (
        <div className="motion-rise rounded-lg border border-line p-6 text-center" style={rise(2)}>
          <p className="text-base text-ink">Nothing in the pipeline yet.</p>
          <p className="mt-1 text-sm text-ink-soft">
            Briefs land here from an artist&apos;s public page, or you can log one by hand once
            that&apos;s wired into this view.
          </p>
        </div>
      ) : (
        <ul className="motion-rise flex flex-col gap-3" style={rise(2)}>
          {briefs.map((brief) => (
            <li key={brief.id}>
              <Link
                href={`/gigs/${brief.id}`}
                className="motion-lift flex flex-col gap-2 rounded-lg border border-line p-4"
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium text-ink">
                    {brief.event_type} · {brief.city}
                  </p>
                  <StatusPill label={brief.status} tone={STATUS_TONE[brief.status] ?? 'neutral'} />
                </div>
                <p className="text-sm text-ink-soft">
                  {brief.event_date ?? 'Date flexible'}
                  {brief.genres.length > 0 ? ` · ${brief.genres.join(', ')}` : ''}
                  {brief.budget_inferred ? ' · budget inferred' : ''}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
