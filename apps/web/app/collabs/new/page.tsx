'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// POST /api/collabs — a request with up to six independent slots
// (docs/06-COLLABS.md). artistId is resolved from the caller's own
// profile (GET /api/profiles/me), same as Gigs' quote flow resolving org
// server-side — never typed in by the user.

const kinds = ['track', 'band', 'crew', 'engineer', 'visual', 'mentor', 'session'] as const;
const compModels = ['fee', 'points', 'hybrid', 'credit'] as const;

interface SlotDraft {
  role: string;
  compModel: (typeof compModels)[number];
  feePaise: string;
  writerPct: string;
  masterPct: string;
}

const inputClass =
  'min-h-11 w-full rounded-md border border-line bg-surface px-3 text-base text-ink focus:outline-none focus:ring-2 focus:ring-trust';
const labelClass = 'text-sm text-ink-soft';

function emptySlot(): SlotDraft {
  return { role: '', compModel: 'fee', feePaise: '', writerPct: '', masterPct: '' };
}

export default function NewCollabPage() {
  const router = useRouter();
  const [artistId, setArtistId] = useState<string | null>(null);
  const [kind, setKind] = useState<(typeof kinds)[number]>('track');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [city, setCity] = useState('');
  const [slots, setSlots] = useState<SlotDraft[]>([emptySlot()]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/profiles/me');
      if (!res.ok) return;
      const json = await res.json();
      setArtistId(json.id);
    }
    void load();
  }, []);

  function updateSlot(index: number, patch: Partial<SlotDraft>) {
    setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  async function submit() {
    setError(null);
    if (!artistId) {
      setError('Save your profile first - a request needs a poster artist.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/collabs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistId,
          kind,
          title,
          body: body || undefined,
          city: city || undefined,
          slots: slots.map((s) => ({
            role: s.role,
            compModel: s.compModel,
            feePaise:
              s.compModel !== 'credit' && s.feePaise
                ? Math.round(Number(s.feePaise) * 100)
                : undefined,
            writerPct: s.writerPct ? Number(s.writerPct) : undefined,
            masterPct: s.masterPct ? Number(s.masterPct) : undefined,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? 'Could not post this request');
        return;
      }
      router.push(`/collabs/${json.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12">
      <div>
        <h1 className="text-xl font-semibold text-ink">Post a request</h1>
        <p className="text-sm text-ink-soft">Up to six slots, each independent.</p>
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <label className={labelClass}>What kind of collab?</label>
          <select
            className={inputClass}
            value={kind}
            onChange={(e) => setKind(e.target.value as (typeof kinds)[number])}
          >
            {kinds.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Title</label>
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Details (optional)</label>
          <textarea
            className={inputClass}
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>City (optional)</label>
          <input className={inputClass} value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-sm font-medium text-ink-soft">Slots</h2>
        {slots.map((slot, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-lg border border-line p-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Role</label>
                <input
                  className={inputClass}
                  placeholder="e.g. vocalist"
                  value={slot.role}
                  onChange={(e) => updateSlot(i, { role: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>Comp model</label>
                <select
                  className={inputClass}
                  value={slot.compModel}
                  onChange={(e) =>
                    updateSlot(i, { compModel: e.target.value as (typeof compModels)[number] })
                  }
                >
                  {compModels.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {slot.compModel === 'fee' || slot.compModel === 'hybrid' ? (
              <div>
                <label className={labelClass}>Fee (₹)</label>
                <input
                  className={inputClass}
                  inputMode="decimal"
                  value={slot.feePaise}
                  onChange={(e) => updateSlot(i, { feePaise: e.target.value })}
                />
              </div>
            ) : null}
            {slot.compModel === 'points' || slot.compModel === 'hybrid' ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Writer %</label>
                  <input
                    className={inputClass}
                    inputMode="decimal"
                    value={slot.writerPct}
                    onChange={(e) => updateSlot(i, { writerPct: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelClass}>Master %</label>
                  <input
                    className={inputClass}
                    inputMode="decimal"
                    value={slot.masterPct}
                    onChange={(e) => updateSlot(i, { masterPct: e.target.value })}
                  />
                </div>
              </div>
            ) : null}
          </div>
        ))}
        {slots.length < 6 ? (
          <button
            type="button"
            onClick={() => setSlots((prev) => [...prev, emptySlot()])}
            className="min-h-11 self-start rounded-md border border-line px-4 text-sm text-ink-soft"
          >
            + Add another slot
          </button>
        ) : null}
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={submitting || !title || slots.some((s) => !s.role)}
        className="min-h-11 self-start rounded-md bg-signal px-4 font-medium text-surface disabled:opacity-50"
      >
        {submitting ? 'Posting…' : 'Post request'}
      </button>

      {error ? (
        <p className="text-sm text-signal" role="alert">
          {error}
        </p>
      ) : null}
    </main>
  );
}
