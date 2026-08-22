'use client';

import { useEffect, useState, use as usePromise } from 'react';
import Link from 'next/link';
import { StatusPill, MoneyValue } from '@shoutout/ui';

// Brief workspace: shortlist → quote → hold, in one screen (docs/05-GIGS.md
// "Manager OS": "inbound WhatsApp message to sent quote in under 90
// seconds"). A client component like /works/[id] — every action here is
// interactive (shortlist run, quote send, hold create), so there's no real
// server-rendered resting state worth splitting out.

interface Brief {
  id: string;
  city: string;
  event_type: string;
  event_date: string | null;
  genres: string[];
  crowd_size: number | null;
  notes: string | null;
  status: string;
  budget_min_paise: number | null;
  budget_max_paise: number | null;
}

interface ShortlistEntry {
  artistId: string;
  artistName: string;
  score: number;
  components: { genreFit: number; cityFit: number };
}

interface ApiErrorResponse {
  error?: { code?: string; message?: string };
}

const CROWD_BANDS = [
  { value: 'under_100', label: 'Under 100' },
  { value: '100_to_500', label: '100–500' },
  { value: '500_to_2000', label: '500–2,000' },
  { value: 'over_2000', label: '2,000+' },
  { value: 'unknown', label: 'Not sure' },
] as const;

export default function BriefWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [shortlist, setShortlist] = useState<ShortlistEntry[] | null>(null);
  const [loadingShortlist, setLoadingShortlist] = useState(false);
  const [quoteFeeByArtist, setQuoteFeeByArtist] = useState<Record<string, string>>({});
  const [indexGenre, setIndexGenre] = useState('');
  const [crowdBand, setCrowdBand] = useState<(typeof CROWD_BANDS)[number]['value']>('unknown');
  const [indexResult, setIndexResult] = useState<
    { p25: number; p50: number; p75: number; sampleN: number } | { code: string } | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [holdDate, setHoldDate] = useState('');

  async function loadBrief() {
    const res = await fetch(`/api/gigs/briefs/${id}`);
    const json = (await res.json()) as Brief & ApiErrorResponse;
    if (res.ok) {
      setBrief(json);
      setHoldDate(json.event_date ?? '');
      if (json.genres[0]) setIndexGenre(json.genres[0]);
    } else {
      setError(json.error?.message ?? 'Could not load this brief');
    }
  }

  useEffect(() => {
    void loadBrief();
  }, [id]);

  async function runShortlist() {
    setError(null);
    setLoadingShortlist(true);
    try {
      const res = await fetch(`/api/gigs/briefs/${id}/shortlist`);
      const json = (await res.json()) as { data?: ShortlistEntry[] } & ApiErrorResponse;
      if (!res.ok) {
        setError(json.error?.message ?? 'Could not run the shortlist');
        return;
      }
      setShortlist(json.data ?? []);
    } finally {
      setLoadingShortlist(false);
    }
  }

  async function sendQuote(artistId: string) {
    setError(null);
    const feeRupees = quoteFeeByArtist[artistId];
    const feePaise = Math.round(Number(feeRupees) * 100);
    if (!feeRupees || !Number.isFinite(feePaise) || feePaise <= 0) {
      setError('Enter a fee before sending a quote');
      return;
    }
    const res = await fetch('/api/gigs/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ briefId: id, artistId, feePaise }),
    });
    const json = (await res.json()) as ApiErrorResponse;
    if (!res.ok) {
      setError(json.error?.message ?? 'Could not send quote');
      return;
    }
    await loadBrief();
  }

  async function createHold(artistId: string) {
    setError(null);
    if (!holdDate) {
      setError('Set an event date before holding it');
      return;
    }
    const res = await fetch('/api/gigs/holds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artistId, eventDate: holdDate, briefId: id }),
    });
    const json = (await res.json()) as ApiErrorResponse;
    if (!res.ok) {
      setError(json.error?.message ?? 'Could not create a hold');
      return;
    }
    await loadBrief();
  }

  async function checkIndex() {
    if (!brief) return;
    const params = new URLSearchParams({
      genre: indexGenre,
      city: brief.city,
      eventType: brief.event_type,
      crowdBand,
    });
    const res = await fetch(`/api/gigs/index?${params.toString()}`);
    const json = await res.json();
    setIndexResult(json);
  }

  if (error && !brief) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-sm text-signal">{error}</p>
      </main>
    );
  }

  if (!brief) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-sm text-ink-soft">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12">
      <div>
        <Link href="/gigs" className="text-sm text-ink-soft">
          ← Pipeline
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-ink">
            {brief.event_type} · {brief.city}
          </h1>
          <StatusPill label={brief.status} tone="active" />
        </div>
        <p className="text-sm text-ink-soft">
          {brief.event_date ?? 'Date flexible'}
          {brief.crowd_size ? ` · ~${brief.crowd_size} people` : ''}
          {brief.genres.length > 0 ? ` · ${brief.genres.join(', ')}` : ''}
        </p>
        {brief.notes ? <p className="mt-2 text-base text-ink">{brief.notes}</p> : null}
      </div>

      <section className="flex flex-col gap-3 rounded-lg border border-line p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink-soft">Price comps</h2>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <input
            className="min-h-11 rounded-md border border-line bg-surface px-3 text-base text-ink"
            placeholder="genre"
            value={indexGenre}
            onChange={(e) => setIndexGenre(e.target.value)}
          />
          <select
            className="min-h-11 rounded-md border border-line bg-surface px-3 text-base text-ink"
            value={crowdBand}
            onChange={(e) => setCrowdBand(e.target.value as (typeof CROWD_BANDS)[number]['value'])}
          >
            {CROWD_BANDS.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={checkIndex}
            className="min-h-11 rounded-md border border-line px-4 text-sm text-ink-soft"
          >
            Check
          </button>
        </div>
        {indexResult ? (
          'code' in indexResult ? (
            <p className="text-sm text-ink-soft">
              Not enough settled deals yet for this exact combination — price it manually.
            </p>
          ) : (
            <p className="text-sm text-ink">
              p25 <MoneyValue paise={indexResult.p25} /> · p50{' '}
              <MoneyValue paise={indexResult.p50} /> · p75 <MoneyValue paise={indexResult.p75} /> ·{' '}
              {indexResult.sampleN} deals
            </p>
          )
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink-soft">Shortlist</h2>
          <button
            type="button"
            onClick={runShortlist}
            disabled={loadingShortlist}
            className="min-h-11 rounded-md border border-line px-4 text-sm text-ink-soft disabled:opacity-50"
          >
            {loadingShortlist ? 'Scoring…' : 'Run shortlist'}
          </button>
        </div>

        {shortlist === null ? (
          <p className="text-sm text-ink-soft">Not run yet.</p>
        ) : shortlist.length === 0 ? (
          <p className="text-sm text-ink-soft">
            No roster artists available for this date, or the roster is empty.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {shortlist.map((entry) => (
              <li
                key={entry.artistId}
                className="flex flex-col gap-2 rounded-lg border border-line p-4"
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium text-ink">{entry.artistName}</p>
                  <StatusPill label={`score ${entry.score.toFixed(2)}`} tone="active" />
                </div>
                <p className="text-xs text-ink-soft">
                  genre fit {entry.components.genreFit.toFixed(2)} · city fit{' '}
                  {entry.components.cityFit.toFixed(2)}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    className="min-h-11 w-32 rounded-md border border-line bg-surface px-3 text-base text-ink"
                    placeholder="fee (₹)"
                    inputMode="decimal"
                    value={quoteFeeByArtist[entry.artistId] ?? ''}
                    onChange={(e) =>
                      setQuoteFeeByArtist((prev) => ({ ...prev, [entry.artistId]: e.target.value }))
                    }
                  />
                  <button
                    type="button"
                    onClick={() => sendQuote(entry.artistId)}
                    className="min-h-11 rounded-md border border-line px-4 text-sm text-ink-soft"
                  >
                    Send quote
                  </button>
                  <button
                    type="button"
                    onClick={() => createHold(entry.artistId)}
                    className="min-h-11 rounded-md bg-signal px-4 text-sm font-medium text-surface"
                  >
                    Hold {holdDate || '(set date above)'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <label className="text-sm text-ink-soft">Hold date</label>
        <input
          type="date"
          className="min-h-11 w-full rounded-md border border-line bg-surface px-3 text-base text-ink"
          value={holdDate}
          onChange={(e) => setHoldDate(e.target.value)}
        />
      </section>

      {error ? (
        <p className="text-sm text-signal" role="alert">
          {error}
        </p>
      ) : null}
    </main>
  );
}
