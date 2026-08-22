// Marks a feature as part of the paid tier — orgs.plan_tier (migration 001)
// already exists in the schema as the source of truth for this, unused
// until now. This badge is deliberately presentation-only: it labels a
// feature as Pro, it does not gate access to it. Every feature wearing
// this badge today still works for every org regardless of plan_tier —
// that's an explicit, temporary product decision (mark now, enforce
// later), not an oversight. When real enforcement lands, it reads
// plan_tier server-side in the route/module, not from this badge.
export function ProBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-accent/20 px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide text-ink">
      Pro
    </span>
  );
}
