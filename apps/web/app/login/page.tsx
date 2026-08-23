'use client';

import { Suspense, useEffect, useState, type ChangeEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type Step = 'contact' | 'otp' | 'role';
type OrgType = 'self' | 'organiser';
type Channel = 'email' | 'phone';

// Email is the default channel because it is the only one that can actually
// deliver today: SMS to Indian numbers is gated behind TRAI's DLT
// registration, which needs a registered business entity and cannot be
// worked around in code. Phone stays available and unchanged — it starts
// delivering the moment the MSG91 hook has credentials. See
// apps/web/app/api/auth/otp/request/route.ts.

interface ApiErrorResponse {
  error?: { message?: string };
}

const inputClass =
  'min-h-11 w-full rounded-md border border-line bg-surface px-3 text-base text-ink focus:outline-none focus:ring-2 focus:ring-trust';
const primaryButtonClass =
  'motion-lift min-h-11 rounded-md bg-signal px-4 font-medium text-surface disabled:opacity-50';

/** Google's four-colour G. Inline so it survives the CSP and needs no asset. */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

const CALLBACK_ERRORS: Record<string, string> = {
  google_unavailable:
    'Google sign-in isn’t switched on for this project yet. Use email in the meantime.',
  exchange_failed: 'That sign-in link didn’t work. Try again.',
  missing_code: 'That sign-in link was incomplete. Try again.',
};

export default function LoginPage() {
  return (
    // useSearchParams() needs a Suspense boundary or it opts the whole
    // route out of static rendering at build time.
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>('contact');
  const [channel, setChannel] = useState<Channel>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+91');
  const [otp, setOtp] = useState('');
  const [orgType, setOrgType] = useState<OrgType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Null while unknown, so the button never flashes in and out.
  const [googleAvailable, setGoogleAvailable] = useState<boolean | null>(null);

  // Google lands back here two ways: ?setup=1 for a brand-new account that
  // still needs a role, or ?error=… when the provider isn't configured.
  useEffect(() => {
    fetch('/api/auth/providers')
      .then((r) => r.json())
      .then((j: { google: boolean }) => setGoogleAvailable(j.google))
      .catch(() => setGoogleAvailable(false));
  }, []);

  useEffect(() => {
    if (searchParams.get('setup') === '1') setStep('role');
    const code = searchParams.get('error');
    if (code) setError(CALLBACK_ERRORS[code] ?? 'Sign-in failed. Try again.');
  }, [searchParams]);

  async function requestOtp() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(channel === 'email' ? { email } : { phone }),
      });
      const json = (await res.json()) as ApiErrorResponse;
      if (!res.ok) {
        setError(json.error?.message ?? 'Could not send code');
        return;
      }
      setStep('otp');
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(channel === 'email' ? { email, token: otp } : { phone, token: otp }),
      });
      const json = (await res.json()) as { needsOrgSetup?: boolean } & ApiErrorResponse;
      if (!res.ok) {
        setError(json.error?.message ?? 'Verification failed');
        return;
      }
      if (json.needsOrgSetup) {
        setStep('role');
        return;
      }
      router.push('/');
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function finishSignup() {
    if (!orgType) {
      setError('Choose one to continue.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: orgType }),
      });
      const json = (await res.json()) as ApiErrorResponse;
      if (!res.ok) {
        setError(json.error?.message ?? 'Could not finish setting up your account');
        return;
      }
      router.push('/');
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4">
      <div className="motion-rise grid w-full max-w-sm gap-3">
        <h1 className="text-center text-xl font-semibold text-ink">ShoutOut</h1>

        {step === 'contact' ? (
          <>
            {/* A plain link, not fetch() - the server route responds with a
                redirect to Google, and the browser has to follow it as a
                navigation for the PKCE cookie to be set on the way out.
                Rendered only when Google is actually configured; a button
                that always errors is worse than no button. */}
            {googleAvailable ? (
              <>
                <a
                  href="/api/auth/google"
                  className="motion-lift flex min-h-11 items-center justify-center gap-3 rounded-md border border-line bg-surface px-4 text-sm font-medium text-ink"
                >
                  <GoogleMark />
                  Continue with Google
                </a>

                <div className="flex items-center gap-3">
                  <span className="h-px flex-1 bg-line" />
                  <span className="text-xs text-ink-soft">or</span>
                  <span className="h-px flex-1 bg-line" />
                </div>
              </>
            ) : null}

            <div className="flex rounded-md border border-line p-1">
              {(['email', 'phone'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setChannel(c);
                    setError(null);
                  }}
                  className={`min-h-11 flex-1 rounded text-sm font-medium ${
                    channel === c ? 'bg-trust text-surface' : 'text-ink-soft'
                  }`}
                >
                  {c === 'email' ? 'Email' : 'Phone'}
                </button>
              ))}
            </div>

            {channel === 'email' ? (
              <>
                <label htmlFor="email" className="text-sm text-ink-soft">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder="you@example.com"
                />
              </>
            ) : (
              <>
                <label htmlFor="phone" className="text-sm text-ink-soft">
                  Phone number
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)}
                  className={inputClass}
                  placeholder="+919876543210"
                />
                <p className="text-xs text-ink-soft">
                  SMS needs a DLT-registered sender to reach Indian numbers. Use email until
                  that&apos;s set up.
                </p>
              </>
            )}

            <button
              type="button"
              onClick={requestOtp}
              disabled={loading}
              className={primaryButtonClass}
            >
              {loading ? 'Sending…' : 'Send code'}
            </button>
            <p className="text-center text-xs text-ink-soft">
              No password, ever. Signing up is free.
            </p>
          </>
        ) : null}

        {step === 'otp' ? (
          <>
            <label htmlFor="otp" className="text-sm text-ink-soft">
              Code sent to {channel === 'email' ? email : phone}
            </label>
            <input
              id="otp"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setOtp(e.target.value)}
              className={inputClass}
              placeholder="123456"
            />
            <button
              type="button"
              onClick={verifyOtp}
              disabled={loading}
              className={primaryButtonClass}
            >
              {loading ? 'Verifying…' : 'Verify'}
            </button>
            <button
              type="button"
              onClick={() => setStep('contact')}
              className="min-h-11 rounded-md px-4 font-medium text-ink-soft"
            >
              {channel === 'email' ? 'Change email' : 'Change number'}
            </button>
            <p className="text-center text-xs text-ink-soft">
              Sent a link instead of a code? Clicking it signs you in too.
            </p>
          </>
        ) : null}

        {step === 'role' ? (
          <>
            <p className="text-center text-sm text-ink-soft">
              One more thing - which best describes you?
            </p>
            <button
              type="button"
              onClick={() => setOrgType('self')}
              className={`motion-lift rounded-lg border p-4 text-left ${
                orgType === 'self' ? 'border-trust bg-trust/10' : 'border-line'
              }`}
            >
              <p className="font-medium text-ink">Artist or manager</p>
              <p className="text-sm text-ink-soft">
                Get booked, find collaborators, manage your roster.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setOrgType('organiser')}
              className={`motion-lift rounded-lg border p-4 text-left ${
                orgType === 'organiser' ? 'border-trust bg-trust/10' : 'border-line'
              }`}
            >
              <p className="font-medium text-ink">Event organiser</p>
              <p className="text-sm text-ink-soft">
                Find artists for your events and close the booking.
              </p>
            </button>
            <button
              type="button"
              onClick={finishSignup}
              disabled={loading || !orgType}
              className={primaryButtonClass}
            >
              {loading ? 'Setting up…' : 'Continue'}
            </button>
          </>
        ) : null}

        {error ? (
          <p className="text-sm text-signal" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </main>
  );
}
