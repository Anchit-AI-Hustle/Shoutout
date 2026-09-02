import type { Metadata } from 'next';

// This route's page is a Client Component, and a Client Component cannot
// export `metadata` - which is why 19 of the app's routes had none. A tiny
// server layout alongside it carries the metadata instead, without forcing
// the page itself back onto the server.
export const metadata: Metadata = {
  title: 'Sign in',
  description:
    'Sign in to ShoutOut to list yourself, manage bookings and get credited on your work.',
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
