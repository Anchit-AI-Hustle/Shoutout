import Link from 'next/link';
import { StatusPill } from '@shoutout/ui';

// The block a gated action shows instead of the action.
//
// Two rules it follows. It always says *which* plan unlocks the thing, so
// the reader can price the decision without hunting; and it never hides
// what the feature is, because a paywall that also withholds the
// explanation just reads as a broken page.
export interface PaywallProps {
  title: string;
  description: string;
  /** Lowest tier that unlocks this. */
  requiredTier: 'basic' | 'plus' | 'pro' | 'max';
  /** Shown when the block is a usage cap rather than a missing feature. */
  usage?: { used: number; cap: number } | undefined;
}

const TIER_NAME: Record<PaywallProps['requiredTier'], string> = {
  basic: 'Basic',
  plus: 'Plus',
  pro: 'Pro',
  max: 'Max',
};

const TIER_PRICE: Record<PaywallProps['requiredTier'], string> = {
  basic: '₹499/mo',
  plus: '₹1,499/mo',
  pro: '₹4,999/mo',
  max: '₹14,999/mo',
};

export function Paywall({ title, description, requiredTier, usage }: PaywallProps) {
  const capped = usage !== undefined && usage.used >= usage.cap;

  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-accent/40 bg-accent/5 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-ink">{title}</h3>
        <StatusPill label={capped ? 'Limit reached' : TIER_NAME[requiredTier]} tone="warning" />
      </div>

      <p className="max-w-prose text-sm text-ink-soft">{description}</p>

      {capped ? (
        <p className="text-sm text-ink-soft">
          You&apos;ve used{' '}
          <span className="font-medium tabular-nums text-ink">
            {usage.used} of {usage.cap}
          </span>{' '}
          booking requests this month. Upgrade for more, or wait for the reset.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/pricing"
          className="motion-lift min-h-11 rounded-md bg-signal px-5 text-sm font-medium leading-[44px] text-surface"
        >
          {capped ? 'Upgrade plan' : `Unlock with ${TIER_NAME[requiredTier]}`}
        </Link>
        <span className="text-xs text-ink-soft">
          From {TIER_PRICE[requiredTier]} · cancel any time
        </span>
      </div>
    </div>
  );
}
