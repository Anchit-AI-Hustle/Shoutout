'use client';

import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react';

// Scroll-triggered entrance — pairs with .motion-reveal in tokens.css.
// IntersectionObserver rather than a fixed page-load delay, so content
// animates in as the visitor actually scrolls to it (docs/13-DESIGN-SYSTEM.md:
// culture surfaces get "present, purposeful" motion). Fires once — a
// section re-hiding itself every time it scrolls out of view would be
// exactly the "gratuitous" motion the design system explicitly rules out.
export interface RevealProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

export function Reveal({ children, delay = 0, className = '' }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`motion-reveal ${visible ? 'motion-in' : ''} ${className}`}
      style={{ '--motion-delay': delay } as CSSProperties}
    >
      {children}
    </div>
  );
}
