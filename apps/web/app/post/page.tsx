'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { registry } from '@shoutout/shout-types';
import type { ShoutType } from '@shoutout/shout-types';
import { ShoutComposer } from '@shoutout/ui';
import type { ShoutDraft } from '@shoutout/ui';

// Only types with a registry entry can be posted — Launch scope is collab
// and gig (docs/09-BUILD-SEQUENCE.md). This list is never hardcoded per
// type name; it's whatever the registry actually has configured.
const configuredTypes = Object.keys(registry) as ShoutType[];

interface ApiErrorResponse {
  error?: { message?: string };
}

export default function PostPage() {
  const router = useRouter();
  const [type, setType] = useState<ShoutType>(configuredTypes[0] ?? 'collab');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const config = registry[type];

  async function handleSubmit(draft: ShoutDraft) {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/shouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          title: draft.title,
          city: draft.city || undefined,
          deadline: draft.deadline ? new Date(draft.deadline).toISOString() : undefined,
          visibility: draft.visibility,
          slots: draft.slots.map((s) => ({
            role: s.role,
            compModel: s.compModel,
            attributes: s.attributes,
          })),
        }),
      });
      const json = (await res.json()) as ApiErrorResponse;
      if (!res.ok) {
        setError(json.error?.message ?? 'Could not post your shout');
        return;
      }
      router.push('/');
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-12">
      <div>
        <h1 className="text-xl font-semibold text-ink">Put out a shout</h1>
        <p className="text-sm text-ink-soft">
          Needs a session — sign in first if you haven&apos;t already.
        </p>
      </div>

      {configuredTypes.length > 1 ? (
        <div className="flex gap-2">
          {configuredTypes.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`min-h-11 rounded-md border px-4 text-sm font-medium ${
                t === type ? 'border-trust bg-trust text-surface' : 'border-line text-ink-soft'
              }`}
            >
              {registry[t]?.label ?? t}
            </button>
          ))}
        </div>
      ) : null}

      {config ? (
        <ShoutComposer
          type={type}
          config={config}
          onSubmit={handleSubmit}
          submitting={submitting}
        />
      ) : null}

      {error ? (
        <p className="text-sm text-signal" role="alert">
          {error}
        </p>
      ) : null}
    </main>
  );
}
