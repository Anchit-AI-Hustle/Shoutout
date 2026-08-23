'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { StatusPill, Waveform, EqualizerAccent } from '@shoutout/ui';

// Pricing. Public by design — the plans endpoint doesn't require a session,
// because a paywall whose terms you can't read until you sign up is a dark
// pattern and also converts badly.

interface Plan {
  tier: string;
  name: string;
  price_paise: number;
  annual_price_paise: number;
  blurb: string;
  max_artist_profiles: number | null;
  max_booking_requests_per_month: number | null;
  max_team_members: number | null;
}

interface Current {
  tier: string;
  status: string;
  current_period_end: string;
}

const LABELS: Record<string, string> = {
  list_artist_profile: 'List your profile publicly',
  send_booking_requests: 'Send booking requests',
  organiser_profile: 'Public organiser page',
  price_benchmarks: 'Price benchmarks',
  reliability_scores: 'Reliability scores',
  roster_calendar: 'Roster calendar',
  collabs: 'Collabs & split sheets',
  credits_registry: 'Verified credits registry',
  settlements: 'Settlements & invoicing',
  api_access: 'API access',
  multi_team: 'Multiple teams',
  priority_support: 'Priority support',
};

const ORDER = Object.keys(LABELS);

function rupees(paise: number) {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

export default function PricingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [byTier, setByTier] = useState<Record<string, Set<string>>>({});
  const [current, setCurrent] = useState<Current | null>(null);
  const [annual, setAnnual] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ number: string; url: string; totalPaise: number } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/subscriptions')
      .then((r) => r.json())
      .then((j) => {
        setPlans(j.plans ?? []);
        const map: Record<string, Set<string>> = {};
        for (const e of (j.entitlements ?? []) as { tier: string; entitlement: string }[]) {
          (map[e.tier] ??= new Set()).add(e.entitlement);
        }
        setByTier(map);
        setCurrent(j.current ?? null);
      })
      .catch(() => setError('Could not load plans'));
  }, []);

  async function choose(tier: string) {
    setError(null);
    setBusy(tier);
    try {
      const res = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, billingPeriod: annual ? 'annual' : 'monthly' }),
      });
      const json = await res.json();
      if (res.status === 401 || res.status === 403) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        setError(json.error?.message ?? 'Could not start this plan');
        return;
      }
      setResult(json.invoice);
    } finally {
      setBusy(null);
    }
  }

  return (
    <main>
      <section className="relative overflow-hidden bg-desk">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 px-4 text-accent/20">
          <Waveform bars={48} />
        </div>
        <div className="motion-rise relative z-10 mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 py-14 text-center">
          <span className="rounded-full bg-surface/10 px-3 py-1 text-xs font-medium text-accent">
            Plans
          </span>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-surface md:text-4xl">
              Pick a plan
            </h1>
            <EqualizerAccent bars={4} />
          </div>
          <p className="max-w-xl text-lg text-surface/70">
            Browsing is always free. You need a plan to{' '}
            <span className="text-accent">list yourself</span> or to{' '}
            <span className="text-accent">book artists</span>.
          </p>
          <div className="mt-2 flex rounded-md border border-surface/25 p-1">
            {[
              [false, 'Monthly'],
              [true, 'Annual — 2 months free'],
            ].map(([v, label]) => (
              <button
                key={String(v)}
                type="button"
                onClick={() => setAnnual(v as boolean)}
                className={`min-h-11 rounded px-4 text-sm font-medium ${
                  annual === v ? 'bg-surface text-ink' : 'text-surface/70'
                }`}
              >
                {label as string}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-12">
        {current ? (
          <div className="rounded-lg border border-line bg-surface-2 p-4">
            <p className="text-sm text-ink">
              You&apos;re on <strong>{current.tier}</strong>{' '}
              <StatusPill
                label={current.status}
                tone={current.status === 'active' ? 'success' : 'warning'}
              />
            </p>
            {current.status === 'pending' ? (
              <p className="mt-1 text-sm text-ink-soft">
                Your invoice is raised — the plan activates once it&apos;s paid.
              </p>
            ) : null}
          </div>
        ) : null}

        {result ? (
          <div className="rounded-lg border border-ok bg-ok/10 p-4">
            <p className="font-medium text-ink">Invoice {result.number} raised</p>
            <p className="mt-1 text-sm text-ink-soft">
              {rupees(result.totalPaise)} including GST. Your plan activates once it&apos;s paid.
            </p>
            <Link href={result.url} className="mt-2 inline-block text-sm text-trust">
              View invoice →
            </Link>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((p) => {
            const isCurrent = current?.tier === p.tier;
            const price = annual ? p.annual_price_paise : p.price_paise;
            const has = byTier[p.tier] ?? new Set<string>();
            return (
              <div
                key={p.tier}
                className={`flex flex-col gap-4 rounded-lg border bg-surface p-5 ${
                  p.tier === 'pro' ? 'border-signal border-t-4 border-t-signal' : 'border-line'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-lg font-semibold text-ink">{p.name}</h2>
                    {p.tier === 'pro' ? <StatusPill label="Popular" tone="active" /> : null}
                  </div>
                  <p className="mt-2 text-2xl font-semibold tabular-nums text-ink">
                    {rupees(price)}
                    <span className="text-sm font-normal text-ink-soft">
                      /{annual ? 'year' : 'month'}
                    </span>
                  </p>
                  <p className="mt-2 text-sm text-ink-soft">{p.blurb}</p>
                </div>

                <ul className="flex flex-col gap-1.5 text-sm">
                  <li className="text-ink-soft">
                    <span className="text-ink">{p.max_artist_profiles ?? 'Unlimited'}</span> listed{' '}
                    {p.max_artist_profiles === 1 ? 'profile' : 'profiles'}
                  </li>
                  <li className="text-ink-soft">
                    <span className="text-ink">
                      {p.max_booking_requests_per_month ?? 'Unlimited'}
                    </span>{' '}
                    booking requests/month
                  </li>
                  {ORDER.filter((k) => has.has(k)).map((k) => (
                    <li key={k} className="flex items-start gap-1.5 text-ink-soft">
                      <span aria-hidden="true" className="text-ok">
                        ✓
                      </span>
                      {LABELS[k]}
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  disabled={busy !== null || isCurrent}
                  onClick={() => choose(p.tier)}
                  className={`motion-lift mt-auto min-h-11 rounded-md px-4 text-sm font-medium disabled:opacity-50 ${
                    p.tier === 'pro' ? 'bg-signal text-surface' : 'border border-line text-ink'
                  }`}
                >
                  {isCurrent ? 'Current plan' : busy === p.tier ? 'Starting…' : `Choose ${p.name}`}
                </button>
              </div>
            );
          })}
        </div>

        {error ? (
          <p className="text-sm text-signal" role="alert">
            {error}
          </p>
        ) : null}

        <p className="text-xs text-ink-soft">
          Prices exclude 18% GST, added on the invoice. Payment is by bank transfer against an
          invoice while card checkout is being set up — your plan activates as soon as it clears.
        </p>
      </div>
    </main>
  );
}
