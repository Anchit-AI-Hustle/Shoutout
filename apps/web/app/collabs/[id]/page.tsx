'use client';

import { useEffect, useState, use as usePromise } from 'react';
import Link from 'next/link';
import { StatusPill, MoneyValue } from '@shoutout/ui';

// Request detail: apply to a slot, or — if you're the poster — manage
// applicants (shortlist/accept/decline) per slot. There's no separate
// poster-only view: RLS and the poster_update_application/accept_application
// RPCs (migration 014) are the actual authorisation boundary, so a non-poster
// attempting a poster action just gets FORBIDDEN back — the UI doesn't need
// to duplicate that check to stay correct, only to stay pleasant, and time
// went to the boundary itself first.

interface Slot {
  id: string;
  role: string;
  comp_model: string;
  fee_paise: number | null;
  writer_pct: number | null;
  master_pct: number | null;
  status: string;
  filled_by: string | null;
}

interface RequestDetail {
  id: string;
  title: string;
  body: string | null;
  kind: string;
  city: string | null;
  status: string;
  slots: Slot[];
}

interface Applicant {
  id: string;
  artist_id: string;
  pitch: string | null;
  status: string;
  score: number;
  components: { languageFit: number };
}

export default function CollabDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [artistId, setArtistId] = useState<string | null>(null);
  const [applicantsBySlot, setApplicantsBySlot] = useState<Record<string, Applicant[]>>({});
  const [pitchDraft, setPitchDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/collabs/${id}`);
    const json = await res.json();
    if (res.ok) setRequest(json);
    else setError(json.error?.message ?? 'Could not load this request');
  }

  useEffect(() => {
    void load();
    fetch('/api/profiles/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setArtistId(j.id));
  }, [id]);

  async function apply(slotId: string) {
    setError(null);
    if (!artistId) {
      setError('Save your profile first.');
      return;
    }
    const res = await fetch(`/api/collabs/slots/${slotId}/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artistId, pitch: pitchDraft || undefined }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error?.message ?? 'Could not apply');
      return;
    }
    setPitchDraft('');
    await loadApplicants(slotId);
  }

  async function loadApplicants(slotId: string) {
    const res = await fetch(`/api/collabs/slots/${slotId}/applicants`);
    const json = await res.json();
    if (res.ok) {
      setApplicantsBySlot((prev) => ({ ...prev, [slotId]: json.data ?? [] }));
    }
  }

  async function shortlist(applicationId: string, slotId: string) {
    const res = await fetch(`/api/collabs/applications/${applicationId}/shortlist`, {
      method: 'POST',
    });
    const json = await res.json();
    if (!res.ok) setError(json.error?.message ?? 'Could not shortlist');
    else await loadApplicants(slotId);
  }

  async function decline(applicationId: string, slotId: string) {
    const reason = window.prompt('Reason for declining (required):');
    if (!reason) return;
    const res = await fetch(`/api/collabs/applications/${applicationId}/decline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    const json = await res.json();
    if (!res.ok) setError(json.error?.message ?? 'Could not decline');
    else await loadApplicants(slotId);
  }

  async function accept(applicationId: string) {
    const res = await fetch(`/api/collabs/applications/${applicationId}/accept`, {
      method: 'POST',
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error?.message ?? 'Could not accept');
      return;
    }
    await load();
  }

  if (error && !request) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-sm text-signal">{error}</p>
      </main>
    );
  }

  if (!request) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-sm text-ink-soft">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12">
      <div>
        <Link href="/collabs" className="text-sm text-ink-soft">
          ← Collabs
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-ink">{request.title}</h1>
          <StatusPill label={request.status.replace(/_/g, ' ')} tone="active" />
        </div>
        <p className="text-sm text-ink-soft">
          {request.kind}
          {request.city ? ` · ${request.city}` : ''}
        </p>
        {request.body ? <p className="mt-2 text-base text-ink">{request.body}</p> : null}
      </div>

      <div className="flex flex-col gap-4">
        {request.slots.map((slot) => (
          <section key={slot.id} className="flex flex-col gap-3 rounded-lg border border-line p-4">
            <div className="flex items-center justify-between">
              <p className="font-medium text-ink">{slot.role}</p>
              <StatusPill
                label={slot.status}
                tone={slot.status === 'accepted' ? 'success' : 'neutral'}
              />
            </div>
            <p className="text-sm text-ink-soft">
              {slot.comp_model}
              {slot.fee_paise ? (
                <>
                  {' · '}
                  <MoneyValue paise={slot.fee_paise} size="sm" />
                </>
              ) : null}
              {slot.writer_pct ? ` · ${slot.writer_pct}% writer` : ''}
              {slot.master_pct ? ` · ${slot.master_pct}% master` : ''}
            </p>

            {slot.status === 'open' ? (
              <div className="flex gap-2">
                <input
                  className="min-h-11 flex-1 rounded-md border border-line bg-surface px-3 text-base text-ink"
                  placeholder="Pitch (optional)"
                  value={pitchDraft}
                  onChange={(e) => setPitchDraft(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => apply(slot.id)}
                  className="min-h-11 rounded-md border border-line px-4 text-sm text-ink-soft"
                >
                  Apply
                </button>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => loadApplicants(slot.id)}
              className="self-start text-xs text-trust"
            >
              View applicants
            </button>

            {applicantsBySlot[slot.id]?.length ? (
              <ul className="flex flex-col gap-2">
                {(applicantsBySlot[slot.id] ?? []).map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between rounded-md border border-line p-2"
                  >
                    <div>
                      <p className="text-sm text-ink">
                        {a.artist_id.slice(0, 8)}… — score {a.score.toFixed(2)}
                      </p>
                      {a.pitch ? <p className="text-xs text-ink-soft">{a.pitch}</p> : null}
                      <StatusPill label={a.status} tone="neutral" />
                    </div>
                    {a.status !== 'accepted' && a.status !== 'declined' ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => shortlist(a.id, slot.id)}
                          className="min-h-11 rounded-md border border-line px-3 text-xs text-ink-soft"
                        >
                          Shortlist
                        </button>
                        <button
                          type="button"
                          onClick={() => accept(a.id)}
                          className="min-h-11 rounded-md bg-signal px-3 text-xs font-medium text-surface"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => decline(a.id, slot.id)}
                          className="min-h-11 rounded-md border border-line px-3 text-xs text-ink-soft"
                        >
                          Decline
                        </button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>

      {error ? (
        <p className="text-sm text-signal" role="alert">
          {error}
        </p>
      ) : null}
    </main>
  );
}
