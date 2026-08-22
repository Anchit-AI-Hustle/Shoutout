'use client';

import { useRef, type ReactNode, type CSSProperties, type PointerEvent } from 'react';

// Real 3D tilt-on-hover via CSS perspective + rotateX/rotateY (pairs with
// .motion-tilt in tokens.css) — driven by pointer position, not a
// WebGL/Three.js scene. Deliberately: this reads as "3D" to a viewer at a
// fraction of the bundle cost and with no risk to the 4G LCP budget
// (docs/13-DESIGN-SYSTEM.md's mobile rules). No-op on touch devices (no
// pointer hover), which is correct — a tilt effect needs a mouse.
export interface TiltCardProps {
  children: ReactNode;
  className?: string;
  maxTiltDeg?: number;
}

export function TiltCard({ children, className = '', maxTiltDeg = 8 }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  function handlePointerMove(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== 'mouse') return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5; // -0.5..0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.setProperty('--tilt-x', `${(px * maxTiltDeg * 2).toFixed(2)}deg`);
    el.style.setProperty('--tilt-y', `${(-py * maxTiltDeg * 2).toFixed(2)}deg`);
  }

  function handlePointerLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--tilt-x', '0deg');
    el.style.setProperty('--tilt-y', '0deg');
  }

  return (
    <div
      ref={ref}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={`motion-tilt ${className}`}
      style={{ '--tilt-x': '0deg', '--tilt-y': '0deg' } as CSSProperties}
    >
      {children}
    </div>
  );
}
