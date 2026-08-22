'use client';

import { useState, type ChangeEvent, type FormEvent } from 'react';

// The public brief-intake path (docs/05-GIGS.md §1's "web form"), scoped to
// this one artist — see migration 012's create_public_brief for why. A
// client island inside the otherwise-server /a/[slug] page.

const inputClass =
  'min-h-11 w-full rounded-md border border-line bg-surface px-3 text-base text-ink focus:outline-none focus:ring-2 focus:ring-trust';
const labelClass = 'text-sm text-ink-soft';

const eventTypes = [
  'wedding',
  'corporate',
  'festival',
  'club',
  'college',
  'private',
  'government',
  'temple',
  'other',
] as const;

interface ApiErrorResponse {
  error?: { message?: string };
}

export function BookArtistForm({ artistId }: { artistId: string }) {
  const [open, setOpen] = useState(false);
  const [eventDate, setEventDate] = useState('');
  const [city, setCity] = useState('');
  const [eventType, setEventType] = useState<(typeof eventTypes)[number]>('wedding');
  const [crowdSize, setCrowdSize] = useState('');
  const [notes, setNotes] = useState('');
  const [organiserName, setOrganiserName] = useState('');
  const [organiserPhone, setOrganiserPhone] = useState('+91');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/gigs/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistId,
          eventDate: eventDate || undefined,
          city,
          eventType,
          crowdSize: crowdSize ? Number(crowdSize) : undefined,
          notes: notes || undefined,
          organiserName,
          organiserPhone,
        }),
      });
      const json = (await res.json()) as ApiErrorResponse;
      if (!res.ok) {
        setError(json.error?.message ?? 'Could not send this request');
        return;
      }
      setSubmitted(true);
    } catch {
      setError('Could not send this request');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="motion-rise rounded-lg border border-line p-4">
        <p className="text-base text-ink">Request sent.</p>
        <p className="mt-1 text-sm text-ink-soft">
          The manager will follow up with a quote directly.
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="motion-lift min-h-11 self-start rounded-md bg-signal px-4 font-medium text-surface"
      >
        Book this artist
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="motion-rise flex flex-col gap-3 rounded-lg border border-line p-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Event date</label>
          <input
            type="date"
            className={inputClass}
            value={eventDate}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setEventDate(e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>City</label>
          <input
            className={inputClass}
            required
            value={city}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setCity(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Event type</label>
          <select
            className={inputClass}
            value={eventType}
            onChange={(e: ChangeEvent<HTMLSelectElement>) =>
              setEventType(e.target.value as (typeof eventTypes)[number])
            }
          >
            {eventTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Crowd size (optional)</label>
          <input
            type="number"
            min={1}
            className={inputClass}
            value={crowdSize}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setCrowdSize(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>Anything they should know?</label>
        <textarea
          className={inputClass}
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Your name</label>
          <input
            className={inputClass}
            required
            value={organiserName}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setOrganiserName(e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Your phone</label>
          <input
            className={inputClass}
            required
            value={organiserPhone}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setOrganiserPhone(e.target.value)}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="motion-lift min-h-11 self-start rounded-md bg-signal px-4 font-medium text-surface disabled:opacity-50"
      >
        {submitting ? 'Sending…' : 'Send request'}
      </button>

      {error ? (
        <p className="text-sm text-signal" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
