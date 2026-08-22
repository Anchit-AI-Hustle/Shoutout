// Single config every dual-currency display references (docs/06-DESIGN-SYSTEM.md,
// docs/11-MASTER-PROMPT.md: "Dual currency everywhere: USD and INR at ₹85/$1").
export const INR_PER_USD = 85;

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export function formatPaiseAsINR(paise: number): string {
  return inrFormatter.format(paise / 100);
}

export function formatPaiseAsUSD(paise: number): string {
  return usdFormatter.format(paise / 100 / INR_PER_USD);
}
