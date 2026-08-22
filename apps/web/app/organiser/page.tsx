import type { CSSProperties } from 'react';
import Link from 'next/link';
import { listMyRequests } from '@shoutout/gigs';
import { StatusPill, EqualizerAccent } from '@shoutout/ui';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { SignedOutExplainer, PreviewFrame } from '@/components/SignedOutExplainer';

// See apps/web/app/gigs/page.tsx for the full reasoning — same fix, same
// root cause (getServerSupabaseClient() throws before Next can infer this
// route is dynamic from its cookies() call).
export const dynamic = 'force-dynamic';

function rise(step: number): CSSProperties {
  return { '--motion-delay': step } as CSSProperties;
}

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
  status: string;
  requested_artist_id: string | null;
}

export default async function OrganiserRequestsPage() {
  const supabase = await getServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <SignedOutExplainer
        eyebrow="For event organisers & venues"
        title="Book the line-up"
        tagline="Every artist you've approached, every quote you're waiting on, one screen."
        highlight="one screen"
        features={[
          {
            tone: 'signal',
            title: 'Search artists who actually fit',
            description:
              'Filter by genre, city and role. Send a booking request without hunting for a phone number or a manager’s email.',
          },
          {
            tone: 'accent',
            title: 'Every request in one status list',
            description:
              'Sent, quoted, held, confirmed. Stop reconstructing where each conversation stands from a scrolled-back WhatsApp thread.',
          },
          {
            tone: 'trust',
            title: 'One calendar for the whole line-up',
            description:
              'Every confirmed act across every date, together — not one artist’s availability at a time.',
          },
          {
            tone: 'ok',
            title: 'Your account is your identity',
            description:
              'Artists see who you are and what you’ve run before. You stop re-introducing yourself to every new manager.',
          },
        ]}
        previewCaption="Your requests, once you’re in"
        preview={
          <PreviewFrame>
            {[
              { name: 'Wedding · Udaipur', date: '11 Dec', status: 'confirmed' },
              { name: 'Club night · Bengaluru', date: '20 Dec', status: 'quoted' },
              { name: 'College fest · Pune', date: '04 Feb', status: 'open' },
            ].map((row) => (
              <div
                key={row.name}
                className="flex items-center justify-between rounded-md border border-line px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium text-ink">{row.name}</p>
                  <p className="text-xs text-ink-soft">{row.date}</p>
                </div>
                <StatusPill label={row.status} tone={STATUS_TONE[row.status] ?? 'neutral'} />
              </div>
            ))}
          </PreviewFrame>
        }
      />
    );
  }

  const { data: org } = await supabase
    .from('org_members')
    .select('org_id, orgs(type)')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  const orgType = (org?.orgs as unknown as { type: string } | null)?.type;
  const requests = (await listMyRequests(supabase, org?.org_id ?? '').catch(() => [])) as Brief[];

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-12">
      <div className="motion-rise">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-ink">My requests</h1>
          <EqualizerAccent bars={3} />
        </div>
        <p className="text-sm text-ink-soft">
          {orgType === 'organiser'
            ? "Every booking request you've sent, across every artist."
            : 'Requests sent from your account, if any.'}
        </p>
      </div>

      <div className="motion-rise flex gap-3" style={rise(1)}>
        <Link
          href="/artists"
          className="motion-lift rounded-md border border-line px-4 py-2 text-sm text-ink-soft"
        >
          Find artists
        </Link>
        <Link
          href="/organiser/calendar"
          className="motion-lift rounded-md border border-line px-4 py-2 text-sm text-ink-soft"
        >
          My calendar
        </Link>
      </div>

      {requests.length === 0 ? (
        <div className="motion-rise rounded-lg border border-line p-6 text-center" style={rise(2)}>
          <p className="text-base text-ink">No requests sent yet.</p>
          <p className="mt-1 text-sm text-ink-soft">Find an artist and send a booking request.</p>
        </div>
      ) : (
        <ul className="motion-rise flex flex-col gap-3" style={rise(2)}>
          {requests.map((r) => (
            <li key={r.id} className="flex flex-col gap-2 rounded-lg border border-line p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium text-ink">
                  {r.event_type} · {r.city}
                </p>
                <StatusPill label={r.status} tone={STATUS_TONE[r.status] ?? 'neutral'} />
              </div>
              <p className="text-sm text-ink-soft">{r.event_date ?? 'Date flexible'}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
