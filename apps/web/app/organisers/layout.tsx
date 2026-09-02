import type { Metadata } from 'next';

// This route's page is a Client Component, and a Client Component cannot
// export `metadata` - which is why 19 of the app's routes had none. A tiny
// server layout alongside it carries the metadata instead, without forcing
// the page itself back onto the server.
export const metadata: Metadata = {
  title: 'Browse event organisers',
  description:
    'See who books music in your city - venues, promoters, festivals and wedding planners - what they run, how big it gets and who has played for them.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
