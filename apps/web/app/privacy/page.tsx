import type { Metadata } from 'next';

// Written against what the system actually stores, not a generic template:
// phone/email for OTP, profile and media in Supabase Storage, booking and
// invoice records, and the org-scoped RLS that separates tenants.
//
// India's DPDP Act requires a named data fiduciary and a grievance route, so
// those are the two bracketed placeholders. Inventing them would defeat the
// purpose of having the page.
export const metadata: Metadata = {
  title: 'Privacy - ShoutOut',
  description: 'What ShoutOut collects, why, and what you can ask us to do with it.',
};

const WHAT_WE_STORE: [string, string][] = [
  [
    'Your email or phone',
    'To sign you in. We never store a password because there is no password.',
  ],
  [
    'Your profile',
    'Stage name, city, genres, roles, biography - all of it public by design once you list.',
  ],
  ['Photos and audio you upload', 'Stored in our object storage and shown on your public page.'],
  [
    'Bookings and requests',
    'Who approached whom, what was quoted, which date was held, what the rider said.',
  ],
  [
    'Invoices and plan status',
    'What you were billed and whether it is paid. We do not store card details.',
  ],
];

const RIGHTS = [
  'Ask for a copy of what we hold about you.',
  'Correct anything that is wrong - most of it you can edit yourself.',
  'Delete your account and your profile. Booking records referencing you are retained where the other party needs them, with your profile detached.',
  'Withdraw consent for anything you gave it for.',
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-12">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Privacy</h1>
        <p className="mt-2 text-sm text-ink-soft">Last updated 23 August 2026.</p>
      </div>

      <div className="rounded-lg border border-accent/40 bg-accent/5 p-4 text-sm text-ink-soft">
        The data fiduciary is <strong className="text-ink">[LEGAL ENTITY]</strong>, and the
        grievance officer is <strong className="text-ink">[NAME]</strong>, reachable at{' '}
        <a href="mailto:hello@anchit-tandon.com" className="text-trust">
          hello@anchit-tandon.com
        </a>
        . These are pending incorporation and will be completed before any paid plan is sold.
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-ink">What we store</h2>
        <ul className="flex flex-col gap-2">
          {WHAT_WE_STORE.map(([what, why]) => (
            <li key={what} className="rounded-lg border border-line p-3">
              <p className="text-sm font-medium text-ink">{what}</p>
              <p className="text-sm text-ink-soft">{why}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-ink">What is public</h2>
        <p className="text-sm text-ink-soft">
          A listed profile is public and indexable by search engines. That is the point of it: being
          findable is the product. Your phone number is never shown - organisers reach you through
          ShoutOut.
        </p>
        <p className="text-sm text-ink-soft">
          Until you list, your profile is a draft and nobody else can see it.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-ink">Who else sees it</h2>
        <p className="text-sm text-ink-soft">
          Your account&apos;s data is isolated from every other account at the database level, not
          by application code. We use Supabase for hosting and storage, and Google for optional
          sign-in. We do not sell data and we do not share it with advertisers.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-ink">Your rights</h2>
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          {RIGHTS.map((r) => (
            <li key={r.slice(0, 30)} className="text-sm text-ink-soft">
              {r}
            </li>
          ))}
        </ul>
        <p className="mt-1 text-sm text-ink-soft">
          Email the address above and we will respond within 30 days.
        </p>
      </section>
    </main>
  );
}
