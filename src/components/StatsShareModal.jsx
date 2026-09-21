import { useEffect, useRef, useState } from 'react';

const BRASS = '#f0c179';
const BRASS_DIM = '#d9a15b';

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function wrapText(ctx, text, fontSize, weight, maxWidth, maxLines) {
  ctx.font = `${weight} ${fontSize}px Inter, sans-serif`;
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines - 1) break;
    } else line = next;
  }
  if (lines.length < maxLines && line) lines.push(line);
  return lines;
}

// Draws one full pass of the card. `avatarImg` is either a loaded <img>
// element or null (in which case an initials circle is drawn instead) —
// callers render once immediately with null for instant feedback, then
// again once the real avatar image has loaded.
function paintStatsCard(ctx, { stats, period, username, avatarImg, width, height }) {
  const pad = 76;
  ctx.clearRect(0, 0, width, height);

  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, '#1c1424');
  bg.addColorStop(0.55, '#130d1c');
  bg.addColorStop(1, '#09070c');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = 0.35;
  const glow = ctx.createRadialGradient(width * 0.82, height * 0.06, 20, width * 0.82, height * 0.06, width * 0.7);
  glow.addColorStop(0, 'rgba(217,161,91,0.55)');
  glow.addColorStop(1, 'rgba(217,161,91,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
  ctx.globalAlpha = 0.25;
  const glow2 = ctx.createRadialGradient(width * 0.1, height * 0.85, 20, width * 0.1, height * 0.85, width * 0.6);
  glow2.addColorStop(0, 'rgba(120,88,200,0.55)');
  glow2.addColorStop(1, 'rgba(120,88,200,0)');
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  let y = pad + 6;

  ctx.fillStyle = 'rgba(246,239,255,0.55)';
  ctx.font = '600 24px Inter, sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillText('MIXHOLIC', pad, y);
  ctx.fillStyle = 'rgba(246,239,255,0.38)';
  ctx.font = '400 22px Inter, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(period === 'year' ? 'Wrapped tahunan' : 'Rekap bulanan', width - pad, y);
  ctx.textAlign = 'left';

  y += 70;

  const avatarSize = 76;
  if (avatarImg) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(pad + avatarSize / 2, y + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatarImg, pad, y, avatarSize, avatarSize);
    ctx.restore();
  } else {
    ctx.save();
    ctx.beginPath();
    ctx.arc(pad + avatarSize / 2, y + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    const g = ctx.createLinearGradient(pad, y, pad + avatarSize, y + avatarSize);
    g.addColorStop(0, BRASS);
    g.addColorStop(1, BRASS_DIM);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.fillStyle = '#1a1108';
    ctx.font = '700 34px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((username?.[0] || '?').toUpperCase(), pad + avatarSize / 2, y + avatarSize / 2 + 2);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }
  ctx.fillStyle = '#f6efff';
  ctx.font = '600 34px Inter, sans-serif';
  ctx.fillText(`@${username}`, pad + avatarSize + 24, y + avatarSize / 2 + 12);

  y += avatarSize + 76;

  ctx.fillStyle = 'rgba(246,239,255,0.5)';
  ctx.font = '600 26px Inter, sans-serif';
  ctx.fillText(period === 'year' ? `Tahun ${stats.value}` : `Bulan ${stats.value}`, pad, y);
  y += 90;
  ctx.fillStyle = BRASS;
  ctx.font = '700 132px Inter, sans-serif';
  ctx.fillText(String(stats.totalMinutes.toLocaleString('id-ID')), pad, y);
  ctx.fillStyle = 'rgba(246,239,255,0.72)';
  ctx.font = '500 34px Inter, sans-serif';
  ctx.fillText('menit didengerin', pad, y + 48);

  y += 120;

  const secondaryY = y;
  const colWidth = (width - pad * 2) / 2;
  [
    [String(stats.totalPlays.toLocaleString('id-ID')), 'kali diputer'],
    [String(stats.uniqueTracks.toLocaleString('id-ID')), 'lagu berbeda'],
  ].forEach(([value, label], i) => {
    const x = pad + i * colWidth;
    ctx.fillStyle = '#f6efff';
    ctx.font = '700 46px Inter, sans-serif';
    ctx.fillText(value, x, secondaryY);
    ctx.fillStyle = 'rgba(246,239,255,0.5)';
    ctx.font = '400 24px Inter, sans-serif';
    ctx.fillText(label, x, secondaryY + 34);
  });

  y += 100;

  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, y);
  ctx.lineTo(width - pad, y);
  ctx.stroke();

  y += 60;

  ctx.fillStyle = 'rgba(246,239,255,0.55)';
  ctx.font = '600 24px Inter, sans-serif';
  ctx.fillText('VIBE KAMU', pad, y);
  y += 44;

  let chipX = pad;
  let chipY = y;
  const maxChipWidth = width - pad * 2;
  (stats.topArtists || []).slice(0, 5).forEach((artist) => {
    ctx.font = '600 28px Inter, sans-serif';
    const label = artist.artist;
    const textWidth = ctx.measureText(label).width;
    const chipWidth = textWidth + 44;
    if (chipX + chipWidth > pad + maxChipWidth) {
      chipX = pad;
      chipY += 66;
    }
    roundRectPath(ctx, chipX, chipY, chipWidth, 52, 26);
    ctx.fillStyle = 'rgba(217,161,91,0.16)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(217,161,91,0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = BRASS;
    ctx.textBaseline = 'middle';
    ctx.fillText(label, chipX + 22, chipY + 27);
    ctx.textBaseline = 'alphabetic';
    chipX += chipWidth + 14;
  });

  y = chipY + 90;

  const topTrack = stats.topTracks?.[0];
  if (topTrack) {
    ctx.fillStyle = 'rgba(246,239,255,0.55)';
    ctx.font = '600 24px Inter, sans-serif';
    ctx.fillText('LAGU TERATAS', pad, y);
    y += 44;
    ctx.fillStyle = '#f6efff';
    const lines = wrapText(ctx, topTrack.title || 'Untitled', 40, '700', width - pad * 2, 2);
    lines.forEach((line, i) => {
      ctx.font = '700 40px Inter, sans-serif';
      ctx.fillText(line, pad, y + i * 48);
    });
    y += lines.length * 48 + 8;
    ctx.fillStyle = 'rgba(246,239,255,0.55)';
    ctx.font = '400 28px Inter, sans-serif';
    ctx.fillText(`${topTrack.artist || 'Unknown artist'} · diputer ${topTrack.playCount}x`, pad, y);
  }

  ctx.fillStyle = 'rgba(246,239,255,0.42)';
  ctx.font = '600 22px Inter, sans-serif';
  ctx.fillText('MIXHOLIC', pad, height - pad + 4);
  ctx.fillStyle = 'rgba(246,239,255,0.3)';
  ctx.font = '400 18px Inter, sans-serif';
  ctx.fillText('mixholic · listen to the moment', pad, height - pad + 32);
}

function drawStatsCard(canvas, { stats, period, username, avatarUrl, format }) {
  const width = 1080;
  const height = format === 'story' ? 1920 : 1080;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Draw immediately with an initials avatar for instant feedback, then
  // repaint once the real photo has loaded (if there is one).
  paintStatsCard(ctx, { stats, period, username, avatarImg: null, width, height });

  if (avatarUrl) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => paintStatsCard(ctx, { stats, period, username, avatarImg: img, width, height });
    img.onerror = () => {};
    img.src = avatarUrl;
  }
}

export default function StatsShareModal({ isOpen, onClose, stats, period, username, avatarUrl, onToast }) {
  const [format, setFormat] = useState('square');
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !stats || !canvasRef.current) return;
    drawStatsCard(canvasRef.current, { stats, period, username, avatarUrl, format });
  }, [isOpen, stats, period, username, avatarUrl, format]);

  if (!isOpen || !stats) return null;

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const link = document.createElement('a');
      link.download = `mixholic-stats-${period}-${(username || 'me').toLowerCase()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      onToast?.('Kartu statistik diekspor sebagai PNG.', 'success');
    } catch {
      onToast?.('Gagal export gambar. Coba lagi — mungkin foto profil dari domain lain memblokir ekspor canvas.', 'error');
    }
  };

  return (
    <div className="share-overlay" onClick={onClose}>
      <section className="share-modal" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="share-modal__close" onClick={onClose} aria-label="Close share">×</button>
        <div className="share-modal__copy">
          <span className="share-modal__eyebrow">Bagikan statistik</span>
          <h2>Pamerin apa yang kamu dengerin.</h2>
          <p>Pilih rasio, lalu unduh sebagai PNG buat story atau feed.</p>
        </div>
        <div className="share-modal__grid">
          <div className="share-preview">
            <canvas ref={canvasRef} width="1080" height={format === 'story' ? '1920' : '1080'} />
          </div>
          <div className="share-controls">
            <span className="share-controls__label">Format</span>
            <div className="share-templates share-formats--pair">
              {['square', 'story'].map((item) => (
                <button type="button" key={item} className={format === item ? 'is-active' : ''} onClick={() => setFormat(item)}>
                  {item === 'square' ? 'Square (1:1)' : 'Story (9:16)'}
                </button>
              ))}
            </div>
            <div className="share-info">
              <strong>{stats.totalMinutes.toLocaleString('id-ID')} menit</strong>
              <span>{period === 'year' ? `Tahun ${stats.value}` : `Bulan ${stats.value}`}</span>
            </div>
            <button type="button" className="share-download" onClick={download}>Download PNG</button>
          </div>
        </div>
      </section>
    </div>
  );
}
