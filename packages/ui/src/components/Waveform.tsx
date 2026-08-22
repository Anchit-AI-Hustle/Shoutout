// The full-width "music vibe" background texture for hero sections — a
// wider, taller sibling to EqualizerAccent (which stays as the small
// inline badge next to headings). Pure CSS animation (.motion-waveform in
// tokens.css), inert under prefers-reduced-motion. Bar heights vary by
// position so it reads as an actual waveform, not a repeating tile.
export interface WaveformProps {
  bars?: number;
  className?: string;
}

// A small pseudo-random-looking but deterministic height/delay pattern —
// deterministic matters here: this renders on the server (no 'use client'),
// so Math.random() would mismatch between server and client render.
function pseudoVariance(i: number): number {
  return ((i * 47) % 23) / 23;
}

export function Waveform({ bars = 32, className = '' }: WaveformProps) {
  return (
    <div className={`motion-waveform ${className}`} aria-hidden="true">
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className="motion-waveform-bar"
          style={{
            animationDelay: `${(pseudoVariance(i) * 900).toFixed(0)}ms`,
            animationDuration: `${(1100 + pseudoVariance(bars - i) * 700).toFixed(0)}ms`,
          }}
        />
      ))}
    </div>
  );
}
