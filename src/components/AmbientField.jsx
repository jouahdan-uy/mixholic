import { useEffect, useRef } from 'react';

// Living ambient field: layered particles + a restrained brush-like cursor trail.
export default function AmbientField({ energized }) {
  const canvasRef = useRef(null);
  const pointerRef = useRef({ x: -9999, y: -9999, active: false, speed: 0 });
  const trailRef = useRef([]);
  const rafRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let particles = [];
    let sparks = [];
    let lastTime = performance.now();

    const makeParticle = (type = 'dust') => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: type === 'dust' ? Math.random() * 1.25 + 0.35 : Math.random() * 1.9 + 0.65,
      alpha: type === 'dust' ? Math.random() * 0.28 + 0.07 : Math.random() * 0.42 + 0.18,
      vx: (Math.random() - 0.5) * (type === 'dust' ? 0.045 : 0.09),
      vy: (Math.random() - 0.5) * (type === 'dust' ? 0.045 : 0.075) - 0.012,
      phase: Math.random() * Math.PI * 2,
      twinkle: Math.random() * 0.018 + 0.004,
      type,
    });

    const makeSpark = () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 1.5 + 0.7,
      alpha: Math.random() * 0.45 + 0.25,
      vx: (Math.random() - 0.5) * 0.16,
      vy: -Math.random() * 0.22 - 0.025,
      life: Math.random(),
      speed: Math.random() * 0.0025 + 0.0009,
      phase: Math.random() * Math.PI * 2,
    });

    const resize = () => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const seed = () => {
      const area = width * height;
      const dustCount = Math.min(230, Math.max(115, Math.floor(area / 10500)));
      const brightCount = Math.min(52, Math.max(28, Math.floor(area / 42000)));
      particles = [
        ...Array.from({ length: dustCount }, () => makeParticle('dust')),
        ...Array.from({ length: brightCount }, () => makeParticle('bright')),
      ];
      sparks = Array.from({ length: Math.min(22, Math.max(10, Math.floor(area / 90000))) }, makeSpark);
    };

    resize();
    seed();

    const onResize = () => {
      resize();
      seed();
      trailRef.current = [];
    };

    const onPointerMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const previous = pointerRef.current;
      const dx = x - previous.x;
      const dy = y - previous.y;
      const distance = Math.hypot(dx, dy);
      const speed = Math.min(1, distance / 28);

      pointerRef.current = { x, y, active: true, speed };

      if (!reduced && distance > 1.5) {
        const trail = trailRef.current;
        trail.push({ x, y, life: 1, width: 7 + speed * 9 });
        if (trail.length > 18) trail.splice(0, trail.length - 18);
      }
    };

    const onPointerLeave = () => {
      pointerRef.current.active = false;
      pointerRef.current.speed = 0;
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerleave', onPointerLeave);

    const drawStatic = () => {
      ctx.clearRect(0, 0, width, height);
      particles.forEach((p) => {
        ctx.beginPath();
        ctx.fillStyle = `rgba(232, 189, 138, ${p.alpha * 0.75})`;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    if (reduced) {
      drawStatic();
      return () => {
        window.removeEventListener('resize', onResize);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerleave', onPointerLeave);
      };
    }

    let hidden = document.hidden;
    const onVisibility = () => {
      hidden = document.hidden;
      lastTime = performance.now();
    };
    document.addEventListener('visibilitychange', onVisibility);

    const drawBrushTrail = (dt) => {
      const trail = trailRef.current;
      if (!trail.length) return;

      for (let i = trail.length - 1; i >= 0; i -= 1) {
        trail[i].life -= dt * 0.0026;
        trail[i].width *= 0.9975;
        if (trail[i].life <= 0.01) trail.splice(i, 1);
      }
      if (trail.length < 2) return;

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = 'lighter';

      // Wide, soft under-stroke gives the cursor a painted-air feel without becoming neon.
      for (let pass = 0; pass < 3; pass += 1) {
        ctx.beginPath();
        trail.forEach((point, index) => {
          const next = trail[index + 1];
          const x = point.x;
          const y = point.y;
          if (index === 0) ctx.moveTo(x, y);
          else if (next) {
            const midX = (point.x + next.x) * 0.5;
            const midY = (point.y + next.y) * 0.5;
            ctx.quadraticCurveTo(point.x, point.y, midX, midY);
          } else {
            ctx.lineTo(x, y);
          }
        });

        const newest = trail[trail.length - 1];
        const oldest = trail[0];
        const gradient = ctx.createLinearGradient(oldest.x, oldest.y, newest.x, newest.y);
        gradient.addColorStop(0, `rgba(185, 137, 92, ${0.005 * pass})`);
        gradient.addColorStop(0.5, `rgba(222, 181, 129, ${0.025 + pass * 0.012})`);
        gradient.addColorStop(1, `rgba(239, 201, 146, ${0.075 - pass * 0.015})`);

        ctx.strokeStyle = gradient;
        ctx.lineWidth = 14 - pass * 4.5;
        ctx.globalAlpha = 0.7;
        ctx.filter = pass === 0 ? 'blur(5px)' : 'none';
        ctx.stroke();
      }

      // A few dry-brush flecks peel off the newest part of the stroke.
      const newest = trail[trail.length - 1];
      if (newest && newest.life > 0.55) {
        const flecks = Math.min(4, Math.ceil(pointerRef.current.speed * 4));
        for (let i = 0; i < flecks; i += 1) {
          const angle = Math.random() * Math.PI * 2;
          const radius = 5 + Math.random() * 9;
          ctx.beginPath();
          ctx.fillStyle = `rgba(239, 201, 146, ${0.018 + Math.random() * 0.025})`;
          ctx.arc(newest.x + Math.cos(angle) * radius, newest.y + Math.sin(angle) * radius, 0.5 + Math.random() * 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    };

    const tick = (now) => {
      rafRef.current = requestAnimationFrame(tick);
      if (hidden) return;

      const dt = Math.min(32, now - lastTime || 16.67);
      lastTime = now;
      const time = now * 0.001;
      const energy = energized ? 1 : 0;
      const { x: px, y: py, active } = pointerRef.current;

      ctx.clearRect(0, 0, width, height);

      const haze = ctx.createRadialGradient(width * 0.5, height * 0.48, 0, width * 0.5, height * 0.48, Math.max(width, height) * 0.62);
      haze.addColorStop(0, `rgba(217, 161, 91, ${0.018 + energy * 0.018})`);
      haze.addColorStop(0.48, 'rgba(120, 88, 200, 0.008)');
      haze.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = haze;
      ctx.fillRect(0, 0, width, height);

      particles.forEach((p) => {
        p.phase += p.twinkle * (dt / 16.67);
        const pulse = 0.72 + Math.sin(p.phase + time * (p.type === 'bright' ? 0.9 : 0.35)) * 0.28;
        const speed = energy ? (p.type === 'bright' ? 1.75 : 1.35) : 1;

        p.x += (p.vx * speed + Math.sin(time * 0.34 + p.phase) * 0.012) * dt;
        p.y += (p.vy * speed + Math.cos(time * 0.26 + p.phase) * 0.008) * dt;

        const dx = p.x - px;
        const dy = p.y - py;
        const distSq = dx * dx + dy * dy;
        if (active && distSq < 25600) {
          const dist = Math.sqrt(distSq) || 1;
          const force = (160 - dist) / 160;
          p.x += (dx / dist) * force * 0.9;
          p.y += (dy / dist) * force * 0.9;
        }

        if (p.x < -16) p.x = width + 16;
        if (p.x > width + 16) p.x = -16;
        if (p.y < -16) p.y = height + 16;
        if (p.y > height + 16) p.y = -16;

        const alpha = p.alpha * pulse * (energy ? 1.38 : 1);

        if (p.type === 'bright') {
          const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 7);
          glow.addColorStop(0, `rgba(240, 193, 121, ${alpha * 0.28})`);
          glow.addColorStop(1, 'rgba(240, 193, 121, 0)');
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 7, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.beginPath();
        ctx.fillStyle = `rgba(232, 189, 138, ${alpha})`;
        ctx.arc(p.x, p.y, p.r * (energy && p.type === 'bright' ? 1.18 : 1), 0, Math.PI * 2);
        ctx.fill();
      });

      sparks.forEach((s) => {
        s.life += s.speed * dt * (energy ? 1.8 : 1);
        s.x += s.vx * dt * (energy ? 1.5 : 1);
        s.y += s.vy * dt * (energy ? 1.5 : 1);

        if (s.life > 1 || s.y < -20) {
          Object.assign(s, makeSpark(), { y: height + Math.random() * 40, life: 0 });
        }

        const fade = Math.sin(Math.min(1, s.life) * Math.PI);
        const alpha = s.alpha * fade * (energy ? 1.45 : 0.72);
        if (alpha <= 0.01) return;

        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.phase + time * 0.35);
        ctx.fillStyle = `rgba(240, 193, 121, ${alpha})`;
        ctx.fillRect(-s.r * 0.45, -s.r * 2.6, s.r * 0.9, s.r * 5.2);
        ctx.restore();
      });

      const bright = particles.filter((p) => p.type === 'bright');
      for (let i = 0; i < bright.length; i += 1) {
        for (let j = i + 1; j < bright.length; j += 1) {
          const a = bright[i];
          const b = bright[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < 10500) {
            const dist = Math.sqrt(distSq);
            const opacity = (1 - dist / 102) * (energized ? 0.07 : 0.035);
            ctx.strokeStyle = `rgba(217, 161, 91, ${opacity})`;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      drawBrushTrail(dt);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerleave', onPointerLeave);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [energized]);

  return <canvas ref={canvasRef} className="ambient-field" aria-hidden="true" />;
}
