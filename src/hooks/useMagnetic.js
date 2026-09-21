import { useCallback, useRef } from 'react';

// Nudges an element a few pixels toward the cursor while hovered, giving
// controls a tactile "magnetic" pull. Snaps back on leave.
export default function useMagnetic(strength = 0.35) {
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
      const dx = e.clientX - (rect.left + rect.width / 2);
      const dy = e.clientY - (rect.top + rect.height / 2);
      elementRef.current.style.transform = `translate(${dx * strength}px, ${dy * strength}px)`;
    },
    [strength]
  );

  const onMouseLeave = useCallback(() => {
    if (!elementRef.current) return;
    elementRef.current.style.transform = 'translate(0, 0)';
  }, []);

  return { elementRef, onMouseMove, onMouseLeave };
}
