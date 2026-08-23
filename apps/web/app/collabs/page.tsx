import type { CSSProperties } from 'react';
import Link from 'next/link';
import { listRequests } from '@shoutout/collabs';
import { EqualizerAccent, StatusPill } from '@shoutout/ui';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { SignedOutExplainer, PreviewFrame } from '@/components/SignedOutExplainer';

// The Collabs feed (docs/06-COLLABS.md: "a producer opens the app on a
// Tuesday afternoon with no gig in sight"). A Server Component, same
// direct-module-call pattern as /gigs.

// See apps/web/app/gigs/page.tsx for the full reasoning — same fix, same
// root cause (getServerSupabaseClient() throws before Next can infer this
// route is dynamic from its cookies() call).
export const dynamic = 'force-dynamic';

function rise(step: number): CSSProperties {
  return { '--motion-delay': step } as CSSProperties;
}

interface RequestRow {
  id: string;
  title: string;
  kind: string;
  city: string | null;
  status: string;
  deadline: string | null;
  collab_slots: { role: string; comp_model: string; status: string }[];
}

const STATUS_TONE: Record<string, 'neutral' | 'active' | 'success' | 'warning'> = {
  open: 'active',
  partially_filled: 'warning',
  filled: 'success',
  closed: 'neutral',
  expired: 'neutral',
};

export default async function CollabsFeedPage() {
  const supabase = await getServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return (
      <SignedOutExplainer
        eyebrow="For anyone making music with anyone else"
        title="Collabs"
        tagline="Find people to make music with - no gig, no date, no budget required."
        highlight="no gig, no date, no budget required"
        features={[
          {
            tone: 'accent',
            title: 'Up to six slots, each on its own terms',
            description:
              'A vocalist for a share of the master, a mixing engineer for a flat fee, a session drummer for credit. One post, six separate deals.',
          },
          {
            tone: 'trust',
            title: 'Ranked by fit, not by who refreshed first',
            description:
              'Applications are scored on genre, role, city and how reliably you’ve delivered before - the same engine that ranks gig matches.',
          },
          {
            tone: 'ok',
            title: 'Split sheets drafted automatically',
            description:
              'Accept a slot and the split sheet drafts itself from the terms you already agreed. Nobody re-types anything.',
          },
          {
            tone: 'signal',
            title: 'Nothing releases until everyone signs',
            description:
              'Stems and masters stay watermarked until every split on the work is signed. No override, no admin bypass.',
          },
        ]}
        previewCaption="An open collab, once you’re in"
        preview={
          <PreviewFrame>
            <div className="rounded-md border border-line px-3 py-2">
              <p className="text-sm font-medium text-ink">Indie-pop EP · Mumbai</p>
              <p className="text-xs text-ink-soft">Posted 2 days ago · 3 slots open</p>
            </div>
            {[
              { role: 'Vocalist', terms: '15% of master', applied: '7 applied' },
              { role: 'Mixing engineer', terms: '₹40,000 flat', applied: '2 applied' },
              { role: 'Session drummer', terms: 'Credit only', applied: '4 applied' },
            ].map((slot) => (
              <div
                key={slot.role}
                className="flex items-center justify-between rounded-md border border-line px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium text-ink">{slot.role}</p>
                  <p className="text-xs text-ink-soft">{slot.terms}</p>
                </div>
                <StatusPill label={slot.applied} tone="active" />
              </div>
            ))}
          </PreviewFrame>
        }
      />
    );
  }

  const requests = (await listRequests(supabase, {}).catch(() => [])) as unknown as RequestRow[];

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-12">
      <div className="motion-rise">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-ink">Collabs</h1>
          <EqualizerAccent bars={3} />
        </div>
        <p className="text-sm text-ink-soft">Find people to make music with. No date needed.</p>
      </div>

      <div className="motion-rise" style={rise(1)}>
        <Link
          href="/collabs/new"
          className="motion-lift inline-block min-h-11 rounded-md bg-signal px-4 py-2 text-sm font-medium text-surface"
        >
          + Post a request
        </Link>
      </div>

      {requests.length === 0 ? (
        <div className="motion-rise rounded-lg border border-line p-6 text-center" style={rise(2)}>
          <p className="text-base text-ink">No open requests yet.</p>
          <p className="mt-1 text-sm text-ink-soft">Be the first - post what you need.</p>
        </div>
      ) : (
        <ul className="motion-rise flex flex-col gap-3" style={rise(2)}>
          {requests.map((r) => (
            <li key={r.id}>
              <Link
                href={`/collabs/${r.id}`}
                className="motion-lift flex flex-col gap-2 rounded-lg border border-line p-4"
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium text-ink">{r.title}</p>
                  <StatusPill
                    label={r.status.replace(/_/g, ' ')}
                    tone={STATUS_TONE[r.status] ?? 'neutral'}
                  />
                </div>
                <p className="text-sm text-ink-soft">
                  {r.kind}
                  {r.city ? ` · ${r.city}` : ''} · {r.collab_slots.map((s) => s.role).join(', ')}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
