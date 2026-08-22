// "Live running total. Red until exactly 100. The single most important
// control in the product." (docs/06-DESIGN-SYSTEM.md)
export interface SplitBarProps {
  label: string;
  total: number; // percentage points, e.g. sum of writer_pct across contributors
}

export function SplitBar({ label, total }: SplitBarProps) {
  const isComplete = total === 100;
  const clampedWidth = Math.min(100, Math.max(0, total));

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-ink-soft">{label}</span>
        <span
          className={`font-[var(--font-data)] tabular-nums font-medium ${isComplete ? 'text-ok' : 'text-signal'}`}
        >
          {total}%
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-valuenow={total}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={`h-full rounded-full transition-[width] ${isComplete ? 'bg-ok' : 'bg-signal'}`}
          style={{ width: `${clampedWidth}%` }}
        />
      </div>
    </div>
  );
}
