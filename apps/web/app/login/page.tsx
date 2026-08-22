'use client';

import { useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';

type Step = 'phone' | 'otp';

interface ApiErrorResponse {
  error?: { message?: string };
}

const inputStyle: React.CSSProperties = {
  fontSize: 'var(--text-base)',
  padding: 'var(--space-3)',
  borderRadius: 8,
  border: '1px solid var(--line)',
  background: 'var(--surface)',
  color: 'var(--ink)',
  width: '100%',
  minHeight: 44,
};

const buttonStyle: React.CSSProperties = {
  fontSize: 'var(--text-base)',
  padding: 'var(--space-3)',
  borderRadius: 8,
  border: 'none',
  background: 'var(--signal)',
  color: 'var(--surface)',
  minHeight: 44,
  cursor: 'pointer',
};

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
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-4)',
        padding: 'var(--space-5)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 360, display: 'grid', gap: 'var(--space-3)' }}>
        <h1 style={{ fontSize: 'var(--text-xl)', margin: 0, textAlign: 'center' }}>SHOUTOUT</h1>

        {step === 'phone' ? (
          <>
            <label htmlFor="phone" style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-soft)' }}>
              Phone number
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)}
              style={inputStyle}
              placeholder="+919876543210"
            />
            <button type="button" onClick={requestOtp} disabled={loading} style={buttonStyle}>
              {loading ? 'Sending…' : 'Send code'}
            </button>
          </>
        ) : (
          <>
            <label htmlFor="otp" style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-soft)' }}>
              6-digit code sent to {phone}
            </label>
            <input
              id="otp"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setOtp(e.target.value)}
              style={inputStyle}
              placeholder="123456"
            />
            <button type="button" onClick={verifyOtp} disabled={loading} style={buttonStyle}>
              {loading ? 'Verifying…' : 'Verify'}
            </button>
            <button
              type="button"
              onClick={() => setStep('phone')}
              style={{ ...buttonStyle, background: 'transparent', color: 'var(--ink-soft)' }}
            >
              Change number
            </button>
          </>
        )}

        {error ? (
          <p style={{ color: 'var(--signal)', fontSize: 'var(--text-sm)' }} role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </main>
  );
}
