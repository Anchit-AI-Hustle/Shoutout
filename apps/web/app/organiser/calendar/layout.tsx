import type { Metadata } from 'next';

// Authenticated, per-user surface: no search value, and indexing it would put
// thin near-duplicate pages into competition with the public profile and
// event pages that carry the acquisition strategy.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
