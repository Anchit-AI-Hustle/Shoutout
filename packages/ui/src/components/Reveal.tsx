'use client';

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from 'react';

// Scroll-triggered entrance, paired with .motion-reveal in tokens.css.
//
// Rewritten after it hid an entire page. The previous version rendered
// .motion-reveal (opacity 0) on the server and removed it only when an
// IntersectionObserver fired. That makes content *conditional on a
// callback*: if the observer does not fire, or JS fails, or a crawler never
// runs it, the section is not merely un-animated, it is invisible. On the
// homepage that meant the problem statement and every audience block
// rendered blank while sitting in the DOM.
//
// Three changes, all in service of one rule: motion is an enhancement, and
// content must never depend on it.
//
//   1. Progressive enhancement. Nothing is hidden until JS has run and
//      confirmed it can also un-hide. The hidden class is applied in a
//      layout effect (before paint, so there is no flash), which means the
//      server-rendered HTML is visible by default.
//
//   2. threshold 0 instead of 0.15. A block taller than the viewport can
//      struggle to expose 15% of its own area, which is exactly the shape
//      the audience sections have on a phone. Any intersecting pixel is a
//      better trigger and cannot deadlock on tall content.
//
//   3. A failsafe. If the observer has not fired within a second of mount,
//      reveal anyway. A late animation is a cosmetic miss; permanently
//      invisible copy is a broken page.
export interface RevealProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

type Phase = 'visible' | 'armed' | 'revealed';

export function Reveal({ children, delay = 0, className = '' }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Starts 'visible': the server render and any no-JS client shows content.
  const [phase, setPhase] = useState<Phase>('visible');

  useLayoutEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    // Only hide once we know we are able to reveal again.
    setPhase('armed');
  }, []);

  useEffect(() => {
    if (phase !== 'armed') return;
    const node = ref.current;
    if (!node) {
      setPhase('revealed');
      return;
    }

    const reveal = () => setPhase('revealed');

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          reveal();
          observer.disconnect();
        }
      },
      { threshold: 0 },
    );
    observer.observe(node);

    // Never leave content hidden because a trigger did not arrive.
    const failsafe = window.setTimeout(reveal, 1000);

    return () => {
      observer.disconnect();
      window.clearTimeout(failsafe);
    };
  }, [phase]);

  const motion =
    phase === 'armed' ? 'motion-reveal' : phase === 'revealed' ? 'motion-reveal motion-in' : '';

  return (
    <div
      ref={ref}
      className={`${motion} ${className}`.trim()}
      style={{ '--motion-delay': delay } as CSSProperties}
    >
      {children}
    </div>
  );
}
