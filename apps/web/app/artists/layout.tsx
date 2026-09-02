import type { Metadata } from 'next';

// This route's page is a Client Component, and a Client Component cannot
// export `metadata` - which is why 19 of the app's routes had none. A tiny
// server layout alongside it carries the metadata instead, without forcing
// the page itself back onto the server.
export const metadata: Metadata = {
  title: 'Find artists to book',
  description:
    'Search musicians by role, genre and city - vocalists, producers, mix engineers, tabla players and more. See past gigs and crowd sizes before you book.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
