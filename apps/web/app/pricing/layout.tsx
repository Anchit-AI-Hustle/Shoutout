import type { Metadata } from 'next';

// This route's page is a Client Component, and a Client Component cannot
// export `metadata` - which is why 19 of the app's routes had none. A tiny
// server layout alongside it carries the metadata instead, without forcing
// the page itself back onto the server.
export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Browsing and logging your own gigs is free forever. Paid plans are for being found by people who do not know you yet. Four tiers from Basic to Max.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
