'use client';

import { useCallback, useEffect, useState } from 'react';
import { StatusPill, EqualizerAccent } from '@shoutout/ui';

// Customer discovery, tracked in the product itself.
//
// Validation is the one score no amount of engineering closes — but leaving
// it to memory guarantees twenty conversations produce twenty impressions
// and no conclusion. Every interview is logged against pre-registered
// hypotheses, and the scoreboard refuses to call anything below five data
// points, so the founder's own beliefs are held to the same evidentiary bar
// as the price index.

interface Row {
  hypothesis_id: string;
  claim: string;
  supports: number;
  kills: number;
  unclear: number;
  n: number;
  status: 'insufficient_data' | 'supported' | 'killed' | 'contested';
}

interface Interview {
  id: string;
  segment: string;
  company_name: string | null;
  city: string | null;
  held_on: string;
  quoted_price_paise: number | null;
}

const SEGMENTS = [
  ['event_company', 'Event company'],
  ['college_fest', 'College fest'],
  ['artist_manager', 'Artist manager'],
  ['musician', 'Musician'],
  ['wedding_planner', 'Wedding planner'],
  ['venue', 'Venue'],
] as const;

const STATUS_TONE: Record<Row['status'], 'neutral' | 'active' | 'success' | 'warning'> = {
  insufficient_data: 'neutral',
  supported: 'success',
  killed: 'warning',
  contested: 'active',
};

const STATUS_LABEL: Record<Row['status'], string> = {
  insufficient_data: 'Need more',
  supported: 'Supported',
  killed: 'Killed',
  contested: 'Contested',
};

export default function ResearchPage() {
  const [board, setBoard] = useState<Row[] | null>(null);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [segment, setSegment] = useState<string>('event_company');
  const [company, setCompany] = useState('');
  const [city, setCity] = useState('');
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [verdicts, setVerdicts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/research');
    if (res.status === 401 || res.status === 403) {
      setSignedIn(false);
      return;
    }
    setSignedIn(true);
    const json = await res.json();
    setBoard(json.scoreboard ?? []);
    setInterviews(json.interviews ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segment,
          companyName: company || undefined,
          city: city || undefined,
          // Rupees in the field, paise in the database — money is never a
          // float and never stored in the unit a human typed.
          quotedPricePaise: price ? Math.round(Number(price) * 100) : undefined,
          notes: notes || undefined,
          verdicts: Object.entries(verdicts).map(([hypothesisId, verdict]) => ({
            hypothesisId,
            verdict,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? 'Could not save this interview');
        return;
      }
      setCompany('');
      setCity('');
      setPrice('');
      setNotes('');
      setVerdicts({});
      await load();
    } finally {
      setSaving(false);
    }
  }

  if (signedIn === false) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-ink">Customer discovery</h1>
        <p className="mt-2 text-sm text-ink-soft">Sign in to log interviews.</p>
      </main>
    );
  }

  const total = interviews.length;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-12">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-ink">Customer discovery</h1>
          <EqualizerAccent bars={3} />
        </div>
        <p className="text-sm text-ink-soft">
          {total} of 20 interviews logged. Nothing is called either way below five data points.
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-ok transition-all"
            style={{ width: `${Math.min(100, (total / 20) * 100)}%` }}
          />
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-ink">Scoreboard</h2>
        {board === null ? (
          <p className="text-sm text-ink-soft">Loading…</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {board.map((r) => (
              <li key={r.hypothesis_id} className="rounded-lg border border-line p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">
                      <span className="font-mono text-xs text-ink-soft">{r.hypothesis_id}</span>{' '}
                      {r.claim}
                    </p>
                    <p className="mt-1 text-xs tabular-nums text-ink-soft">
                      {r.supports} support · {r.kills} kill · {r.unclear} unclear · n={r.n}
                    </p>
                  </div>
                  <StatusPill label={STATUS_LABEL[r.status]} tone={STATUS_TONE[r.status]} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-line p-4">
        <h2 className="text-lg font-semibold text-ink">Log an interview</h2>
        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Segment"
            className="min-h-11 rounded-md border border-line bg-surface px-3 text-base text-ink"
            value={segment}
            onChange={(e) => setSegment(e.target.value)}
          >
            {SEGMENTS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <input
            className="min-h-11 flex-1 rounded-md border border-line bg-surface px-3 text-base text-ink"
            placeholder="Company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
          <input
            className="min-h-11 rounded-md border border-line bg-surface px-3 text-base text-ink"
            placeholder="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
          <input
            type="number"
            inputMode="numeric"
            className="min-h-11 rounded-md border border-line bg-surface px-3 text-base text-ink"
            placeholder="₹/mo they'd pay"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>

        {board?.map((r) => (
          <div key={r.hypothesis_id} className="flex flex-wrap items-center gap-2">
            <span className="w-8 font-mono text-xs text-ink-soft">{r.hypothesis_id}</span>
            {(['supports', 'unclear', 'kills'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() =>
                  setVerdicts((prev) => {
                    const next = { ...prev };
                    if (next[r.hypothesis_id] === v) delete next[r.hypothesis_id];
                    else next[r.hypothesis_id] = v;
                    return next;
                  })
                }
                className={`min-h-11 rounded-md border px-3 text-xs ${
                  verdicts[r.hypothesis_id] === v
                    ? 'border-trust bg-trust/10 font-medium text-ink'
                    : 'border-line text-ink-soft'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        ))}

        <textarea
          className="min-h-24 rounded-md border border-line bg-surface p-3 text-base text-ink"
          placeholder="What did they actually say? Their words, not your summary."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="motion-lift min-h-11 self-start rounded-md bg-signal px-6 text-sm font-medium text-surface disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Log interview'}
        </button>

        {error ? (
          <p className="text-sm text-signal" role="alert">
            {error}
          </p>
        ) : null}
      </section>
    </main>
  );
}
