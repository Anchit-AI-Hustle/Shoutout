'use client';

import { useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';

type Step = 'phone' | 'otp';

interface ApiErrorResponse {
  error?: { message?: string };
}

const inputClass =
  'min-h-11 w-full rounded-md border border-line bg-surface px-3 text-base text-ink focus:outline-none focus:ring-2 focus:ring-trust';
const primaryButtonClass =
  'min-h-11 rounded-md bg-signal px-4 font-medium text-surface disabled:opacity-50';

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('+91');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function requestOtp() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
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
        body: JSON.stringify({ phone, token: otp }),
      });
      const json = (await res.json()) as ApiErrorResponse;
      if (!res.ok) {
        setError(json.error?.message ?? 'Verification failed');
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
      <div className="grid w-full max-w-sm gap-3">
        <h1 className="text-center text-xl font-semibold text-ink">SHOUTOUT</h1>

        {step === 'phone' ? (
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
            <button
              type="button"
              onClick={requestOtp}
              disabled={loading}
              className={primaryButtonClass}
            >
              {loading ? 'Sending…' : 'Send code'}
            </button>
          </>
        ) : (
          <>
            <label htmlFor="otp" className="text-sm text-ink-soft">
              6-digit code sent to {phone}
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
              onClick={() => setStep('phone')}
              className="min-h-11 rounded-md px-4 font-medium text-ink-soft"
            >
              Change number
            </button>
          </>
        )}

        {error ? (
          <p className="text-sm text-signal" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </main>
  );
}
