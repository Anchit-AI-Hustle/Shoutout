'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// The signed-in corner of the header.
//
// /api/auth/logout existed from early on and nothing ever called it, so a
// signed-in user had no way to sign out at all. That is worse than a
// missing convenience: on a shared laptop or a venue machine there was no
// way to end the session short of clearing cookies.
//
// A menu rather than one more top-level link, because the nav already
// carries six items and wraps to a second row at 375px.
export function AccountMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on an outside click or Escape. Without both, a menu on a phone is
  // a trap: there is no cursor to move away and no obvious dismiss target.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function signOut() {
    setBusy(true);
    try {
      // POST, not GET: a link prefetch or a crawler must never be able to
      // end someone's session.
      await fetch('/api/auth/logout', { method: 'POST' });
      setOpen(false);
      // refresh() clears the cached Server Component tree so nothing
      // signed-in survives the navigation.
      router.push('/');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const itemClass =
    'flex min-h-11 w-full items-center px-4 text-left text-sm text-ink hover:bg-surface-2';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-trust"
      >
        Account
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path
            d="M1 3l4 4 4-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 min-w-48 overflow-hidden rounded-md border border-line bg-surface py-1 shadow-lg"
        >
          <Link
            href="/profile"
            role="menuitem"
            className={itemClass}
            onClick={() => setOpen(false)}
          >
            Your profile
          </Link>
          <Link
            href="/organiser"
            role="menuitem"
            className={itemClass}
            onClick={() => setOpen(false)}
          >
            My requests
          </Link>
          <Link
            href="/pricing"
            role="menuitem"
            className={itemClass}
            onClick={() => setOpen(false)}
          >
            Plan and billing
          </Link>
          <div className="my-1 border-t border-line" />
          <button
            type="button"
            role="menuitem"
            onClick={signOut}
            disabled={busy}
            className={`${itemClass} text-signal disabled:opacity-50`}
          >
            {busy ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
