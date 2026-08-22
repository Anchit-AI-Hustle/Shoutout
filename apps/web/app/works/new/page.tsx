'use client';

import { useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { SplitBar } from '@shoutout/ui';

interface ContributorDraft {
  name: string;
  phone: string;
  role: string;
  writerPct: number;
  masterPct: number;
}

interface ApiErrorResponse {
  error?: { message?: string };
}

function emptyContributor(): ContributorDraft {
  return { name: '', phone: '', role: '', writerPct: 0, masterPct: 0 };
}

const inputClass =
  'min-h-11 w-full rounded-md border border-line bg-surface px-3 text-base text-ink focus:outline-none focus:ring-2 focus:ring-trust';

export default function NewWorkPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [contributors, setContributors] = useState<ContributorDraft[]>([emptyContributor()]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const writerTotal = contributors.reduce((sum, c) => sum + (c.writerPct || 0), 0);
  const masterTotal = contributors.reduce((sum, c) => sum + (c.masterPct || 0), 0);

  function updateContributor(index: number, patch: Partial<ContributorDraft>) {
    setContributors(contributors.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function addContributor() {
    setContributors([...contributors, emptyContributor()]);
  }

  function removeContributor(index: number) {
    setContributors(contributors.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/works', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, contributors }),
      });
      const json = (await res.json()) as ApiErrorResponse & { id?: string };
      if (!res.ok) {
        setError(json.error?.message ?? 'Could not create the split sheet');
        return;
      }
      router.push(`/works/${json.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12">
      <div>
        <h1 className="text-xl font-semibold text-ink">New split sheet</h1>
        <p className="text-sm text-ink-soft">
          Writer % and master % must each total exactly 100 before this can lock.
        </p>
      </div>

      <div>
        <label className="text-sm text-ink-soft">Work title</label>
        <input
          className={inputClass}
          value={title}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
          required
        />
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-line p-4">
        <SplitBar label="Writer %" total={writerTotal} />
        <SplitBar label="Master %" total={masterTotal} />
      </div>

      <div className="flex flex-col gap-4">
        {contributors.map((c, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-lg border border-line p-4">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-sm text-ink-soft">Name</label>
                <input
                  className={inputClass}
                  value={c.name}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    updateContributor(i, { name: e.target.value })
                  }
                />
              </div>
              <div className="flex-1">
                <label className="text-sm text-ink-soft">Phone</label>
                <input
                  className={inputClass}
                  value={c.phone}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    updateContributor(i, { phone: e.target.value })
                  }
                  placeholder="+919876543210"
                />
              </div>
            </div>
            <div>
              <label className="text-sm text-ink-soft">Role</label>
              <input
                className={inputClass}
                value={c.role}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  updateContributor(i, { role: e.target.value })
                }
                placeholder="e.g. songwriter, producer, vocalist"
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-sm text-ink-soft">Writer %</label>
                <input
                  type="number"
                  className={inputClass}
                  value={c.writerPct}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    updateContributor(i, { writerPct: Number(e.target.value) })
                  }
                />
              </div>
              <div className="flex-1">
                <label className="text-sm text-ink-soft">Master %</label>
                <input
                  type="number"
                  className={inputClass}
                  value={c.masterPct}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    updateContributor(i, { masterPct: Number(e.target.value) })
                  }
                />
              </div>
            </div>
            {contributors.length > 1 ? (
              <button
                type="button"
                onClick={() => removeContributor(i)}
                className="self-start text-sm text-ink-soft underline"
              >
                Remove
              </button>
            ) : null}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addContributor}
        className="min-h-11 self-start rounded-md border border-line px-4 text-sm text-ink-soft"
      >
        + Add contributor
      </button>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="min-h-11 rounded-md bg-signal px-4 font-medium text-surface disabled:opacity-50"
      >
        {submitting ? 'Creating…' : 'Create split sheet'}
      </button>

      {error ? (
        <p className="text-sm text-signal" role="alert">
          {error}
        </p>
      ) : null}
    </main>
  );
}
