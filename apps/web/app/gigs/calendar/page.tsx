'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { StatusPill } from '@shoutout/ui';

// Roster-wide holds calendar (docs/05-GIGS.md "Manager OS": "Shared holds
// calendar across the whole roster, colour-coded by state"). A stacked
// list grouped by date rather than a grid widget — the design system's own
// mobile rule ("dense tables become stacked cards below 760px, never
// horizontal scroll") makes a list the natural shape here, not a
// compromise from a "real" calendar.

interface CalendarEntry {
  id: string;
  artist_id: string;
  artist_name: string;
  event_date: string;
  state: string;
  priority: number;
  expires_at: string;
}

const STATE_TONE: Record<string, 'neutral' | 'active' | 'success' | 'warning' | 'danger'> = {
  enquiry: 'neutral',
  soft_1: 'active',
  soft_2: 'warning',
  soft_3: 'warning',
  confirmed: 'success',
  contracted: 'success',
  advance_paid: 'success',
  performed: 'success',
  settled: 'success',
  released: 'neutral',
  cancelled: 'neutral',
  expired: 'danger',
  disputed: 'danger',
};

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function GigsCalendarPage() {
  const [entries, setEntries] = useState<CalendarEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const from = todayPlus(0);
      const to = todayPlus(120);
      const res = await fetch(`/api/gigs/calendar?from=${from}&to=${to}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? 'Could not load the calendar');
        return;
      }
      setEntries(json.data ?? []);
    }
    void load();
  }, []);

  const byDate = new Map<string, CalendarEntry[]>();
  for (const entry of entries ?? []) {
    const list = byDate.get(entry.event_date) ?? [];
    list.push(entry);
    byDate.set(entry.event_date, list);
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12">
      <div>
        <Link href="/gigs" className="text-sm text-ink-soft">
          ← Pipeline
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-ink">Roster calendar</h1>
        <p className="text-sm text-ink-soft">Next 120 days, every artist on the roster.</p>
      </div>

      {error ? (
        <p className="text-sm text-signal" role="alert">
          {error}
        </p>
      ) : null}

      {entries === null ? (
        <p className="text-sm text-ink-soft">Loading…</p>
      ) : byDate.size === 0 ? (
        <p className="text-sm text-ink-soft">No holds or bookings in this window.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {[...byDate.entries()].map(([date, dayEntries]) => (
            <div key={date} className="flex flex-col gap-2">
              <p className="text-sm font-medium text-ink-soft">{date}</p>
              <ul className="flex flex-col gap-2">
                {dayEntries.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between rounded-lg border border-line p-3"
                  >
                    <span className="text-base text-ink">{entry.artist_name}</span>
                    <StatusPill
                      label={entry.state.replace(/_/g, ' ')}
                      tone={STATE_TONE[entry.state] ?? 'neutral'}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
