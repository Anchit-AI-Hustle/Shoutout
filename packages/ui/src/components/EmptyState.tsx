// "An invitation to act, never an apology" (docs/06-DESIGN-SYSTEM.md).
export interface EmptyStateProps {
  title: string;
  body?: string;
  action?: React.ReactNode;
}

export function EmptyState({ title, body, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-line px-6 py-12 text-center">
      <p className="text-base font-medium text-ink">{title}</p>
      {body ? <p className="text-sm text-ink-soft">{body}</p> : null}
      {action}
    </div>
  );
}
