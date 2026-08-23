'use client';

import { useEffect, useState, use as usePromise } from 'react';
import { SplitBar, StatusPill } from '@shoutout/ui';

interface Contributor {
  id: string;
  name: string;
  role: string;
  writer_pct: number;
  master_pct: number;
  signed_at: string | null;
  signature_ref: string;
}

interface WorkDetail {
  id: string;
  title: string;
  status: 'draft' | 'locked';
  locked_at: string | null;
  contributors: Contributor[];
}

interface ApiErrorResponse {
  error?: { message?: string };
}

export default function WorkDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const [work, setWork] = useState<WorkDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locking, setLocking] = useState(false);

  async function load() {
    const res = await fetch(`/api/works/${id}`);
    const json = (await res.json()) as WorkDetail & ApiErrorResponse;
    if (!res.ok) {
      setError(json.error?.message ?? 'Could not load this work');
      return;
    }
    setWork(json);
  }

  useEffect(() => {
    void load();
  }, [id]);

  async function handleLock() {
    setError(null);
    setLocking(true);
    try {
      const res = await fetch(`/api/works/${id}/lock`, { method: 'POST' });
      const json = (await res.json()) as ApiErrorResponse;
      if (!res.ok) {
        setError(json.error?.message ?? 'Could not lock - check totals and signatures');
        return;
      }
      await load();
    } finally {
      setLocking(false);
    }
  }

  if (error && !work) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-sm text-signal">{error}</p>
      </main>
    );
  }

  if (!work) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-sm text-ink-soft">Loading…</p>
      </main>
    );
  }

  const writerTotal = work.contributors.reduce((sum, c) => sum + Number(c.writer_pct), 0);
  const masterTotal = work.contributors.reduce((sum, c) => sum + Number(c.master_pct), 0);
  const allSigned = work.contributors.every((c) => c.signed_at !== null);
  const canLock =
    work.status === 'draft' && writerTotal === 100 && masterTotal === 100 && allSigned;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-ink">{work.title}</h1>
        <StatusPill
          label={work.status === 'locked' ? 'Locked' : 'Draft'}
          tone={work.status === 'locked' ? 'success' : 'neutral'}
        />
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-line p-4">
        <SplitBar label="Writer %" total={writerTotal} />
        <SplitBar label="Master %" total={masterTotal} />
      </div>

      <div className="flex flex-col gap-3">
        {work.contributors.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between rounded-lg border border-line p-4"
          >
            <div>
              <p className="font-medium text-ink">{c.name}</p>
              <p className="text-sm text-ink-soft">
                {c.role} · {c.writer_pct}% writer · {c.master_pct}% master
              </p>
              {work.status === 'draft' && !c.signed_at ? (
                <p className="mt-1 break-all text-xs text-ink-soft">
                  Signing link (share manually - WhatsApp dispatch isn&apos;t wired up yet):{' '}
                  {typeof window !== 'undefined' ? window.location.origin : ''}/w/{work.id}
                  ?contributorId=
                  {c.id}&token={c.signature_ref}
                </p>
              ) : null}
            </div>
            <StatusPill
              label={c.signed_at ? 'Signed' : 'Awaiting signature'}
              tone={c.signed_at ? 'success' : 'warning'}
            />
          </div>
        ))}
      </div>

      {work.status === 'draft' ? (
        <button
          type="button"
          onClick={handleLock}
          disabled={!canLock || locking}
          className="min-h-11 rounded-md bg-signal px-4 font-medium text-surface disabled:opacity-50"
        >
          {locking ? 'Locking…' : 'Lock split sheet'}
        </button>
      ) : (
        <p className="text-sm text-ok">
          Locked {work.locked_at ? new Date(work.locked_at).toLocaleString() : ''} - this split
          sheet is now immutable.
        </p>
      )}

      {error ? (
        <p className="text-sm text-signal" role="alert">
          {error}
        </p>
      ) : null}
    </main>
  );
}
