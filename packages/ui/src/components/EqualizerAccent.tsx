// The "music vibe" accent for culture surfaces (docs/13-DESIGN-SYSTEM.md:
// culture gets "Present, purposeful" motion — this is the purposeful part,
// not just polish). Pure CSS animation (.motion-eq in tokens.css), inert
// under prefers-reduced-motion. Decorative only — never the sole carrier
// of information, so it's always aria-hidden.
export interface EqualizerAccentProps {
  bars?: number;
  className?: string;
}

export function EqualizerAccent({ bars = 4, className = '' }: EqualizerAccentProps) {
  return (
    <span className={`motion-eq ${className}`} aria-hidden="true">
      {Array.from({ length: bars }).map((_, i) => (
        <span key={i} className="motion-eq-bar" />
      ))}
    </span>
  );
}
