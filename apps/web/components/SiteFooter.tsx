import Link from 'next/link';

// The site had no footer, and therefore no terms, no privacy policy and no
// operator identity anywhere. For a product that takes payment and holds
// personal data of working musicians, all three are table stakes: DPDP
// requires a named data fiduciary and a stated grievance route, and a
// pricing page with no terms behind it is not a page anyone should pay on.
export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line bg-surface-2">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Find</p>
            <Link href="/artists" className="text-sm text-ink-soft">
              Artists
            </Link>
            <Link href="/organisers" className="text-sm text-ink-soft">
              Organisers
            </Link>
            <Link href="/collabs" className="text-sm text-ink-soft">
              Collabs
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Product</p>
            <Link href="/gigs" className="text-sm text-ink-soft">
              Gigs
            </Link>
            <Link href="/pricing" className="text-sm text-ink-soft">
              Pricing
            </Link>
            <Link href="/login" className="text-sm text-ink-soft">
              Sign in
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Legal</p>
            <Link href="/terms" className="text-sm text-ink-soft">
              Terms of use
            </Link>
            <Link href="/privacy" className="text-sm text-ink-soft">
              Privacy
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Contact</p>
            <a href="mailto:hello@anchit-tandon.com" className="text-sm text-ink-soft">
              hello@anchit-tandon.com
            </a>
          </div>
        </div>

        <p className="border-t border-line pt-5 text-xs text-ink-soft">
          ShoutOut is an independent product for India&apos;s music industry. Profiles currently
          shown are examples, not signed-up artists. Prices exclude 18% GST.
        </p>
      </div>
    </footer>
  );
}
