'use client';

import { useState } from 'react';
import Link from 'next/link';

// The only genuinely interactive part of an artist card: the booking form.
//
// Everything else on /artists is now server-rendered. This stays a Client
// Component because it posts and holds form state - but it takes `signedIn`
// and `canBook` as props rather than fetching them, because the page already
// knows both from the session it read on the server. The old page fired
// /api/profiles/me and /api/entitlements from the browser on every visit and
// rendered the wrong call-to-action until they came back.
//
// The database refuses a request this component would not have offered
// (migration 030); `canBook` only decides whether someone is shown a form
// that would fail.

const EVENT_TYPES = [
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

interface BookArtistProps {
  artistId: string;
  /** Prefilled from the search, which is almost always the event's city. */
  defaultCity: string;
  signedIn: boolean;
  canBook: boolean;
}

export function BookArtist({ artistId, defaultCity, signedIn, canBook }: BookArtistProps) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [city, setCity] = useState(defaultCity);
  const [eventDate, setEventDate] = useState('');
  const [eventType, setEventType] = useState<(typeof EVENT_TYPES)[number]>('wedding');
  const [notes, setNotes] = useState('');

  if (!signedIn) {
    return (
      <Link href="/login" className="text-sm text-trust">
        Sign in to book →
      </Link>
    );
  }

  if (!canBook) {
    return (
      <Link href="/pricing" className="text-sm text-trust">
        Upgrade to send a booking request →
      </Link>
    );
  }

  if (sent) return <p className="text-sm text-ok">Request sent.</p>;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="motion-lift min-h-11 self-start rounded-md border border-line px-4 text-sm text-ink-soft"
      >
        Book
      </button>
    );
  }

  async function submit() {
    setError(null);
    if (!city.trim()) {
      setError('City is required.');
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/gigs/book-as-org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistId,
          eventDate: eventDate || undefined,
          city: city.trim(),
          eventType,
          notes: notes || undefined,
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      if (!res.ok) {
        setError(json?.error?.message ?? 'Could not send this request');
        return;
      }
      setSent(true);
    } catch {
      setError('Could not send this request. Check your connection and try again.');
    } finally {
      setSending(false);
    }
  }

  const fieldClass =
    'min-h-11 w-full rounded-md border border-line bg-surface px-3 text-base text-ink';

  return (
    <div className="flex flex-col gap-2 rounded-md border border-line p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-ink-soft">Event date</span>
          <input
            type="date"
            className={fieldClass}
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-ink-soft">Event type</span>
          <select
            className={fieldClass}
            value={eventType}
            onChange={(e) => setEventType(e.target.value as (typeof EVENT_TYPES)[number])}
          >
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>
      {/* City was read from a filter the organiser may have left blank, and
          the request is rejected without one. Asking here beats failing on
          submit with a message about a field that is not on screen. */}
      <label className="flex flex-col gap-1">
        <span className="text-xs text-ink-soft">City</span>
        <input
          className={fieldClass}
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Where is the event"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-ink-soft">Notes (optional)</span>
        <textarea
          className={fieldClass}
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={sending}
          className="motion-lift min-h-11 rounded-md bg-signal px-4 text-sm font-medium text-surface disabled:opacity-50"
        >
          {sending ? 'Sending…' : 'Send request'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="min-h-11 rounded-md px-3 text-sm text-ink-soft"
        >
          Cancel
        </button>
      </div>
      {error ? (
        <p className="text-sm text-signal" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
