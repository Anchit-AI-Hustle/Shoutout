'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { StatusPill, MoneyValue } from '@shoutout/ui';

// The organiser's own calendar — "plan their schedule completely" across
// every artist they've booked, mirroring /gigs/calendar's roster-wide view
// for the artist side. Confirmed bookings only (see modules/gigs's
// listMyCalendar) — same stacked-list-by-date shape as the roster
// calendar, same reasoning (docs/13-DESIGN-SYSTEM.md's mobile rules).

interface CalendarEntry {
  id: string;
  artist_id: string;
  artist_name: string;
  event_date: string;
  status: string;
  fee_paise: number;
}

const STATUS_TONE: Record<string, 'neutral' | 'active' | 'success' | 'warning'> = {
  confirmed: 'success',
  performed: 'success',
  settled: 'success',
  cancelled: 'neutral',
};

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function OrganiserCalendarPage() {
  const [entries, setEntries] = useState<CalendarEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const from = todayPlus(0);
      const to = todayPlus(180);
      const res = await fetch(`/api/organiser/calendar?from=${from}&to=${to}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? 'Could not load your calendar');
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
        <Link href="/organiser" className="text-sm text-ink-soft">
          ← My requests
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-ink">My calendar</h1>
        <p className="text-sm text-ink-soft">Next 180 days, every artist you've confirmed.</p>
      </div>

      {error ? (
        <p className="text-sm text-signal" role="alert">
          {error}
        </p>
      ) : null}

      {entries === null ? (
        <p className="text-sm text-ink-soft">Loading…</p>
      ) : byDate.size === 0 ? (
        <p className="text-sm text-ink-soft">Nothing confirmed in this window yet.</p>
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
                    <div className="flex items-center gap-2">
                      <MoneyValue paise={entry.fee_paise} size="sm" />
                      <StatusPill
                        label={entry.status}
                        tone={STATUS_TONE[entry.status] ?? 'neutral'}
                      />
                    </div>
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
