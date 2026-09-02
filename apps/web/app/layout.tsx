import type { Metadata } from 'next';
import './globals.css';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';

// Every page that does not set its own title used to render the bare string
// "ShoutOut", because this was the only metadata in the app - 23 of 29 routes
// shared one title and one description. For a product whose acquisition model
// is organic search, that is 23 pages competing with each other for the same
// query and telling a searcher nothing about which one to open.
//
// The template fixes the shared case; per-route metadata (added alongside the
// pages, and in a layout.tsx for the client-component routes, which cannot
// export metadata themselves) fixes the specific case.
//
// metadataBase is required for Open Graph and canonical URLs to resolve to
// absolute addresses. Without it Next emits relative og:url values, which
// most crawlers and every social unfurler discard.
export const metadata: Metadata = {
  metadataBase: new URL('https://shoutout.anchit-tandon.com'),
  title: {
    default: 'ShoutOut - book musicians and find collaborators in India',
    template: '%s | ShoutOut',
  },
  description:
    'Search by role, genre or city, book acts for your event, and find people to make music with. Built for India’s independent music industry.',
  openGraph: {
    siteName: 'ShoutOut',
    locale: 'en_IN',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
