import { useEffect, useRef } from 'react';

// YouTube's iframe embed does not expose raw audio to the Web Audio API
// (cross-origin), so this renders a stylised procedural equalizer rather
// than a true FFT — tuned to look convincingly alive, calm at rest, and
// idle to a flat line when paused.
export default function Visualizer({ isPlaying, bars = 40 }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const valuesRef = useRef(Array.from({ length: bars }, () => 0.08));
  const targetsRef = useRef(Array.from({ length: bars }, () => 0.08));
  const tickCounter = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      tickCounter.current += 1;

      if (isPlaying && !reduced && tickCounter.current % 4 === 0) {
        targetsRef.current = targetsRef.current.map((_, i) => {
          const center = bars / 2;
          const distanceFromCenter = Math.abs(i - center) / center;
          const envelope = 1 - distanceFromCenter * 0.55;
          return Math.max(0.06, Math.min(1, Math.random() * envelope));
        });
      } else if (!isPlaying) {
        targetsRef.current = targetsRef.current.map(() => 0.08);
      }

      valuesRef.current = valuesRef.current.map((v, i) => v + (targetsRef.current[i] - v) * 0.18);

      ctx.clearRect(0, 0, width, height);
      const gap = width / bars;
      const barWidth = Math.max(1.5, gap * 0.5);

      valuesRef.current.forEach((v, i) => {
        const h = Math.max(2, v * height);
        const x = i * gap + gap / 2 - barWidth / 2;
        const y = height - h;
        const gradient = ctx.createLinearGradient(0, y, 0, height);
        gradient.addColorStop(0, 'rgba(240, 193, 121, 0.95)');
        gradient.addColorStop(1, 'rgba(217, 161, 91, 0.25)');
        ctx.fillStyle = gradient;
        const radius = Math.min(barWidth / 2, 3);
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, y, barWidth, h, radius);
        } else {
          ctx.rect(x, y, barWidth, h);
        }
        ctx.fill();
      });
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [isPlaying, bars]);

  return <canvas ref={canvasRef} className="visualizer" aria-hidden="true" />;
}
