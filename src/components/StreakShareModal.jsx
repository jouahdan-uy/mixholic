import { useEffect, useRef } from 'react';

const BRASS = '#f0c179';
const BRASS_DIM = '#d9a15b';

function drawFlame(ctx, cx, cy, size, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(size / 100, size / 100);
  ctx.beginPath();
  ctx.moveTo(0, 46);
  ctx.bezierCurveTo(-26, 30, -20, 2, -6, -18);
  ctx.bezierCurveTo(-2, -8, 6, -8, 4, -20);
  ctx.bezierCurveTo(20, -6, 24, 14, 14, 26);
  ctx.bezierCurveTo(22, 18, 22, 8, 18, 0);
  ctx.bezierCurveTo(24, 16, 22, 36, 0, 46);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function drawStreakCard(canvas, { streakCount, you, friend, format }) {
  const width = format === 'story' ? 1080 : 1080;
  const height = format === 'story' ? 1920 : 1080;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);

  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, '#1c1424');
  bg.addColorStop(0.55, '#130d1c');
  bg.addColorStop(1, '#09070c');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = 0.4;
  const glow = ctx.createRadialGradient(width / 2, height * 0.36, 20, width / 2, height * 0.36, width * 0.75);
  glow.addColorStop(0, 'rgba(240,150,60,0.55)');
  glow.addColorStop(1, 'rgba(240,150,60,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(246,239,255,0.55)';
  ctx.font = '600 26px Inter, sans-serif';
  ctx.fillText('MIXHOLIC', width / 2, height * 0.14);

  drawFlame(ctx, width / 2, height * 0.32, 220, (() => {
    const g = ctx.createLinearGradient(width / 2 - 90, height * 0.32 - 100, width / 2 + 90, height * 0.32 + 100);
    g.addColorStop(0, BRASS);
    g.addColorStop(1, '#ff7a3d');
    return g;
  })());

  ctx.fillStyle = '#f6efff';
  ctx.font = '800 190px Inter, sans-serif';
  ctx.fillText(String(streakCount), width / 2, height * 0.5);

  ctx.fillStyle = 'rgba(246,239,255,0.7)';
  ctx.font = '600 40px Inter, sans-serif';
  ctx.fillText('DAY STREAK', width / 2, height * 0.5 + 60);

  ctx.fillStyle = BRASS_DIM;
  ctx.font = '600 34px Inter, sans-serif';
  ctx.fillText(`${you} × ${friend}`, width / 2, height * 0.62);

  ctx.fillStyle = 'rgba(246,239,255,0.4)';
  ctx.font = '400 26px Inter, sans-serif';
  ctx.fillText('mixholic.app', width / 2, height * 0.92);
}

export default function StreakShareModal({ isOpen, onClose, streakCount, you, friend, onToast }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;
    drawStreakCard(canvasRef.current, { streakCount, you, friend, format: 'square' });
  }, [isOpen, streakCount, you, friend]);

  if (!isOpen) return null;

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const link = document.createElement('a');
      link.download = `mixholic-streak-${streakCount}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      onToast?.('Streak card diunduh — tinggal upload ke IG/TikTok Story.', 'success');
    } catch {
      onToast?.('Gagal export gambar. Coba lagi ya.', 'error');
    }
  };

  const shareNative = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !navigator.share) return download();
    try {
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      const file = new File([blob], `mixholic-streak-${streakCount}.png`, { type: 'image/png' });
      if (navigator.canShare && !navigator.canShare({ files: [file] })) return download();
      await navigator.share({
        files: [file],
        title: `${streakCount}-day streak on Mixholic`,
        text: `${streakCount} day streak with ${friend} on Mixholic 🔥`,
      });
    } catch {
      /* user cancelled the native share sheet — not an error */
    }
  };

  return (
    <div className="share-overlay" onClick={onClose}>
      <section className="share-modal streak-share-modal" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="share-modal__close" onClick={onClose} aria-label="Close share">×</button>
        <div className="share-modal__copy">
          <span className="share-modal__eyebrow">Streak unlocked 🔥</span>
          <h2>{streakCount}-day streak with {friend}.</h2>
          <p>Flex it on Instagram or TikTok before it fizzles out.</p>
        </div>
        <div className="share-modal__grid share-modal__grid--single">
          <div className="share-preview"><canvas ref={canvasRef} width="1080" height="1080" /></div>
          <div className="share-controls">
            <div className="share-info"><strong>{streakCount} hari beruntun</strong><span>{you} & {friend}</span></div>
            <button type="button" className="share-download" onClick={shareNative}>
              {typeof navigator !== 'undefined' && navigator.share ? 'Share ke IG / TikTok' : 'Download PNG'}
            </button>
            {typeof navigator !== 'undefined' && navigator.share && (
              <button type="button" className="share-copy" onClick={download}>Download PNG instead</button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
