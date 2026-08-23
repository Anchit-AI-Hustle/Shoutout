import type { Metadata } from 'next';

// Written to describe what the product actually does today, not a template.
// Two things are deliberately left as bracketed placeholders rather than
// invented: the operating legal entity and its registered address. Naming a
// company that has not been incorporated would be worse than an obvious gap,
// and these are the two facts a user needs in order to enforce anything.
export const metadata: Metadata = {
  title: 'Terms of use - ShoutOut',
  description: 'The terms that apply to using ShoutOut.',
};

const SECTIONS: [string, string[]][] = [
  [
    'What ShoutOut is',
    [
      'ShoutOut is a marketplace where artists and event organisers find each other, agree bookings and keep a record of them. We introduce the two sides and record what was agreed.',
      'We are not a party to any booking. The contract for a performance is between the artist and the organiser. We do not employ artists, represent them, or guarantee that any booking takes place.',
    ],
  ],
  [
    'Accounts',
    [
      'You need an account to list a profile or send booking requests. Browsing is open to everyone.',
      'You are responsible for what is posted from your account. Do not list a person you do not represent, and do not claim work you did not do.',
    ],
  ],
  [
    'Plans and payment',
    [
      'Listing a profile publicly and sending booking requests require an active plan. Prices are shown on the pricing page and exclude 18% GST, which is added on the invoice.',
      'Plans are currently invoiced and paid by bank transfer. A plan activates when payment clears and runs for the period stated on the invoice.',
      'We do not process, hold or move money between an artist and an organiser. Booking fees are settled directly between them.',
    ],
  ],
  [
    'Content you post',
    [
      'You keep ownership of everything you upload: photos, audio, biography, credits. You give us permission to display it on ShoutOut and in search results, and to show it on landing pages that help people find you.',
      'Only upload material you have the right to upload. If you upload a recording, you must hold the rights to it or have permission from whoever does.',
    ],
  ],
  [
    'Credits and split sheets',
    [
      'A credit becomes public only when the work is locked and every contributor on it has signed. We publish what the contributors agreed; we do not adjudicate disputes about who did what.',
    ],
  ],
  [
    'What we will remove',
    [
      'Profiles impersonating someone else, uploads infringing copyright, and content that harasses or endangers a person. We may suspend an account for any of these without notice.',
    ],
  ],
  [
    'Liability',
    [
      'ShoutOut is provided as-is. We do not guarantee that a booking will be honoured, that an artist will perform, or that anyone will be paid.',
      'Nothing here limits liability that cannot be limited under Indian law.',
    ],
  ],
  [
    'Governing law',
    [
      'These terms are governed by the laws of India, and the courts of [CITY] have exclusive jurisdiction.',
    ],
  ],
];

export default function TermsPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-12">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Terms of use</h1>
        <p className="mt-2 text-sm text-ink-soft">Last updated 23 August 2026.</p>
      </div>

      <div className="rounded-lg border border-accent/40 bg-accent/5 p-4 text-sm text-ink-soft">
        ShoutOut is operated by <strong className="text-ink">[LEGAL ENTITY]</strong>, registered at{' '}
        <strong className="text-ink">[REGISTERED ADDRESS]</strong>. These details are pending
        incorporation and will be completed before any paid plan is sold. Questions:{' '}
        <a href="mailto:hello@anchit-tandon.com" className="text-trust">
          hello@anchit-tandon.com
        </a>
        .
      </div>

      {SECTIONS.map(([heading, paras]) => (
        <section key={heading} className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-ink">{heading}</h2>
          {paras.map((p) => (
            <p key={p.slice(0, 40)} className="text-sm text-ink-soft">
              {p}
            </p>
          ))}
        </section>
      ))}
    </main>
  );
}
