import { formatPaiseAsINR, formatPaiseAsUSD } from '../currency';

// Dual currency, tabular numerals always — "never a bare number in a money
// context" (docs/06-DESIGN-SYSTEM.md). Numeric pairs sit side by side on
// cards, not stacked, even on mobile.
export interface MoneyValueProps {
  paise: number;
  size?: 'sm' | 'base' | 'lg';
}

const sizeClasses = {
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-lg',
} as const;

export function MoneyValue({ paise, size = 'base' }: MoneyValueProps) {
  return (
    <span
      className={`inline-flex items-baseline gap-2 font-[var(--font-data)] tabular-nums ${sizeClasses[size]}`}
    >
      <span className="font-medium text-ink">{formatPaiseAsINR(paise)}</span>
      <span className="text-ink-soft text-xs">{formatPaiseAsUSD(paise)}</span>
    </span>
  );
}
