'use client';

import { useEffect, useState, use as usePromise } from 'react';
import { useSearchParams } from 'next/navigation';
import { SplitBar, StatusPill } from '@shoutout/ui';

interface PublicContributor {
  id: string;
  name: string;
  role: string;
  writer_pct: number;
  master_pct: number;
  signed: boolean;
}

interface PublicWork {
  id: string;
  title: string;
  status: 'draft' | 'locked';
  contributors: PublicContributor[];
}

interface ApiErrorResponse {
  error?: { message?: string };
}

// The public, read-only split-sheet share page (docs/05-API.md:
// "GET /api/w/:id PUBLIC read-only share page data"). A contributor
// visiting their own signing link (?contributorId=&token=) sees a Sign
// button; anyone else viewing the link sees the split sheet only.
export default function PublicWorkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const searchParams = useSearchParams();
  const contributorId = searchParams.get('contributorId');
  const token = searchParams.get('token');

  const [work, setWork] = useState<PublicWork | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [justSigned, setJustSigned] = useState(false);

  async function load() {
    const res = await fetch(`/api/w/${id}`);
    const json = (await res.json()) as PublicWork & ApiErrorResponse;
    if (!res.ok) {
      setError(json.error?.message ?? 'This split sheet could not be found');
      return;
    }
    setWork(json);
  }

  useEffect(() => {
    void load();
  }, [id]);

  async function handleSign() {
    if (!contributorId || !token) return;
    setError(null);
    setSigning(true);
    try {
      const res = await fetch(`/api/works/${id}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contributorId, token }),
      });
      const json = (await res.json()) as ApiErrorResponse;
      if (!res.ok) {
        setError(json.error?.message ?? 'Could not sign');
        return;
      }
      setJustSigned(true);
      await load();
    } finally {
      setSigning(false);
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
  const signingContributor = work.contributors.find((c) => c.id === contributorId);
  const canSign =
    signingContributor && !signingContributor.signed && work.status === 'draft' && !justSigned;

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

      <ul className="flex flex-col gap-3">
        {work.contributors.map((c) => (
          <li
            key={c.id}
            className="flex items-center justify-between rounded-lg border border-line p-4"
          >
            <div>
              <p className="font-medium text-ink">{c.name}</p>
              <p className="text-sm text-ink-soft">
                {c.role} · {c.writer_pct}% writer · {c.master_pct}% master
              </p>
            </div>
            <StatusPill
              label={c.signed ? 'Signed' : 'Awaiting'}
              tone={c.signed ? 'success' : 'warning'}
            />
          </li>
        ))}
      </ul>

      {signingContributor ? (
        <div className="rounded-lg border border-trust bg-trust/5 p-4">
          {canSign ? (
            <>
              <p className="mb-3 text-sm text-ink">
                You&apos;re signing as <strong>{signingContributor.name}</strong>. This confirms
                your split as shown above.
              </p>
              <button
                type="button"
                onClick={handleSign}
                disabled={signing}
                className="min-h-11 rounded-md bg-signal px-4 font-medium text-surface disabled:opacity-50"
              >
                {signing ? 'Signing…' : 'Sign this split sheet'}
              </button>
            </>
          ) : (
            <p className="text-sm text-ok">You&apos;ve signed this split sheet.</p>
          )}
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
