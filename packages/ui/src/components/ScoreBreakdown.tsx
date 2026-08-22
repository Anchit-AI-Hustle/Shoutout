// "Always shown with a ranking. An unexplained score is not trusted."
// (docs/06-DESIGN-SYSTEM.md, docs/05-API.md)
const factorLabels: Record<string, string> = {
  roleMatch: 'Role',
  attributeFit: 'Sound fit',
  availability: 'Availability',
  priceBandFit: 'Price fit',
  reliability: 'Reliability',
  responsiveness: 'Responsiveness',
};

export interface ScoreBreakdownProps {
  score: number;
  components: Partial<Record<string, number>>;
}

export function ScoreBreakdown({ score, components }: ScoreBreakdownProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-ink-soft">Match score</span>
        <span className="font-[var(--font-data)] text-lg font-medium tabular-nums text-trust">
          {Math.round(score * 100)}%
        </span>
      </div>
      <ul className="flex flex-col gap-1">
        {Object.entries(components).map(([factor, value]) => (
          <li key={factor} className="flex items-center justify-between text-xs">
            <span className="text-ink-soft">{factorLabels[factor] ?? factor}</span>
            <span className="font-[var(--font-data)] tabular-nums text-ink">
              {Math.round((value ?? 0) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
