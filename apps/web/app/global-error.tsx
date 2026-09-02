'use client';

// Last-resort boundary: catches errors thrown by the root layout itself,
// which error.tsx cannot, because error.tsx renders *inside* that layout.
//
// It has to supply its own <html> and <body>, and it cannot rely on the app's
// stylesheet having loaded, so the styling here is inline on purpose. The
// palette values are copied from packages/ui/src/tokens.css rather than
// referenced, for the same reason.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#e2ded3',
          color: '#15181b',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          padding: '1.5rem',
        }}
      >
        <div style={{ maxWidth: '32rem' }}>
          <p style={{ margin: 0, color: '#c1272d', fontWeight: 600, fontSize: '0.875rem' }}>
            ShoutOut
          </p>
          <h1 style={{ margin: '0.5rem 0', fontSize: '1.5rem' }}>Something went badly wrong</h1>
          <p style={{ margin: '0 0 1.5rem', color: '#4e5259', lineHeight: 1.6 }}>
            The whole page failed to load, not just part of it. Reloading usually fixes it.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              minHeight: '2.75rem',
              padding: '0 1.5rem',
              borderRadius: '0.375rem',
              border: 'none',
              background: '#c1272d',
              color: '#e2ded3',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
          {error.digest ? (
            <p style={{ marginTop: '1.5rem', fontSize: '0.75rem', color: '#4e5259' }}>
              Reference: <span style={{ fontFamily: 'monospace' }}>{error.digest}</span>
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
