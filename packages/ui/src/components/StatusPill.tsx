// One vocabulary across the whole product (docs/06-DESIGN-SYSTEM.md).
// Color is never the only signal — the label always renders alongside it
// (docs/06-DESIGN-SYSTEM.md accessibility floor: "Colour is never the only
// signal — status carries a label too").
export type StatusTone = 'neutral' | 'active' | 'success' | 'warning' | 'danger';

const toneClasses: Record<StatusTone, string> = {
  neutral: 'bg-surface-2 text-ink-soft',
  active: 'bg-trust/10 text-trust',
  success: 'bg-ok/10 text-ok',
  warning: 'bg-accent/20 text-ink',
  danger: 'bg-signal/10 text-signal',
};

export interface StatusPillProps {
  label: string;
  tone?: StatusTone;
}

export function StatusPill({ label, tone = 'neutral' }: StatusPillProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${toneClasses[tone]}`}
    >
      {label}
    </span>
  );
}
