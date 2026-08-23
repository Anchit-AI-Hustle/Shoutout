'use client';

import { useEffect, useState, use as usePromise } from 'react';

// Rider — backline, travel, hospitality, both sides tick off, timestamped
// (docs/05-GIGS.md §5). Each category is a single freeform note rather
// than a structured sub-form — a real simplification (reusable
// per-artist templates from the doc aren't modelled at all yet, per
// migration 012's comment), kept because a freeform note is still exactly
// as useful for the one thing the acceptance criteria actually checks:
// a timestamped, confirmed checklist existing at all.

interface Rider {
  id: string;
  backline: { text?: string };
  travel: { text?: string };
  hospitality: { text?: string };
  artist_confirmed_at: string | null;
  organiser_confirmed_at: string | null;
  confirm_token: string;
}

const textareaClass =
  'min-h-24 w-full rounded-md border border-line bg-surface px-3 py-2 text-base text-ink';

export default function RiderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const [rider, setRider] = useState<Rider | null>(null);
  const [backline, setBackline] = useState('');
  const [travel, setTravel] = useState('');
  const [hospitality, setHospitality] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch(`/api/gigs/${id}/rider`);
    if (res.status === 404) return; // no rider saved yet - blank form is correct
    const json = await res.json();
    if (res.ok) {
      setRider(json);
      setBackline(json.backline?.text ?? '');
      setTravel(json.travel?.text ?? '');
      setHospitality(json.hospitality?.text ?? '');
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  async function save() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/gigs/${id}/rider`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          backline: { text: backline },
          travel: { text: travel },
          hospitality: { text: hospitality },
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? 'Could not save the rider');
        return;
      }
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function confirmArtistSide() {
    setError(null);
    const res = await fetch(`/api/gigs/${id}/rider/confirm`, { method: 'POST' });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error?.message ?? 'Could not confirm');
      return;
    }
    await load();
  }

  const shareUrl =
    rider && typeof window !== 'undefined'
      ? `${window.location.origin}/r/${id}?token=${rider.confirm_token}`
      : null;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12">
      <div>
        <h1 className="text-xl font-semibold text-ink">Rider</h1>
        <p className="text-sm text-ink-soft">
          Backline, travel, hospitality - both sides tick off.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <label className="text-sm text-ink-soft">Backline</label>
          <textarea
            className={textareaClass}
            value={backline}
            onChange={(e) => setBackline(e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm text-ink-soft">Travel</label>
          <textarea
            className={textareaClass}
            value={travel}
            onChange={(e) => setTravel(e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm text-ink-soft">Hospitality</label>
          <textarea
            className={textareaClass}
            value={hospitality}
            onChange={(e) => setHospitality(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="min-h-11 self-start rounded-md bg-signal px-4 font-medium text-surface disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save rider'}
        </button>
      </div>

      {rider ? (
        <div className="flex flex-col gap-3 rounded-lg border border-line p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-ink-soft">Artist side</p>
            {rider.artist_confirmed_at ? (
              <p className="text-sm text-ok">
                Confirmed {new Date(rider.artist_confirmed_at).toLocaleString()}
              </p>
            ) : (
              <button
                type="button"
                onClick={confirmArtistSide}
                className="min-h-11 rounded-md border border-line px-4 text-sm text-ink-soft"
              >
                Confirm on artist&apos;s behalf
              </button>
            )}
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-ink-soft">Organiser side</p>
            {rider.organiser_confirmed_at ? (
              <p className="text-sm text-ok">
                Confirmed {new Date(rider.organiser_confirmed_at).toLocaleString()}
              </p>
            ) : (
              <p className="text-sm text-ink-soft">Not yet confirmed</p>
            )}
          </div>
          {shareUrl ? (
            <p className="break-all text-xs text-ink-soft">
              Share with the organiser (manually - WhatsApp dispatch isn&apos;t wired up yet):{' '}
              {shareUrl}
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-signal" role="alert">
          {error}
        </p>
      ) : null}
    </main>
  );
}
