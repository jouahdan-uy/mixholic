import { useCallback, useRef } from 'react';

// Applies a subtle 3D tilt + glare-position CSS variable pair to a ref'd
// element as the pointer moves across it. Pure CSS-var driven so it costs
// nothing when the pointer is elsewhere, and respects prefers-reduced-motion.
export default function useTilt({ max = 8, scale = 1.015 } = {}) {
  const elementRef = useRef(null);
  const reduced = useRef(
    typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  const onMouseMove = useCallback(
    (e) => {
      if (reduced.current || !elementRef.current) return;
      const rect = elementRef.current.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      const rx = (0.5 - py) * max;
      const ry = (px - 0.5) * max;
      elementRef.current.style.setProperty('--tilt-x', `${rx.toFixed(2)}deg`);
      elementRef.current.style.setProperty('--tilt-y', `${ry.toFixed(2)}deg`);
      elementRef.current.style.setProperty('--tilt-scale', String(scale));
      elementRef.current.style.setProperty('--glare-x', `${(px * 100).toFixed(1)}%`);
      elementRef.current.style.setProperty('--glare-y', `${(py * 100).toFixed(1)}%`);
    },
    [max, scale]
  );

  const onMouseLeave = useCallback(() => {
    if (!elementRef.current) return;
    elementRef.current.style.setProperty('--tilt-x', '0deg');
    elementRef.current.style.setProperty('--tilt-y', '0deg');
    elementRef.current.style.setProperty('--tilt-scale', '1');
  }, []);

  return { elementRef, onMouseMove, onMouseLeave };
}
