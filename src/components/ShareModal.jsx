import { useEffect, useRef, useState } from 'react';

const TEMPLATES = [
  { id: 'cinematic', label: 'Cinematic' },
  { id: 'minimal', label: 'Minimal' },
  { id: 'visualizer', label: 'Visualizer' },
];

function drawCard(canvas, { template, title, artist, videoId, format }) {
  const width = format === 'story' ? 1080 : format === 'landscape' ? 1200 : 1080;
  const height = format === 'story' ? 1920 : format === 'landscape' ? 630 : 1080;
  canvas.width = width;
  canvas.height = height;
  const size = width;
  const ctx = canvas.getContext('2d');
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.onload = () => {
    ctx.clearRect(0, 0, width, height);
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, template === 'minimal' ? '#16131a' : '#302018');
    gradient.addColorStop(1, '#09070c');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    if (template !== 'minimal') {
      ctx.save();
      ctx.globalAlpha = template === 'cinematic' ? 0.34 : 0.22;
      ctx.filter = 'blur(55px) saturate(1.5)';
      const coverSize = Math.max(width, height) + 160;
      ctx.drawImage(image, (width - coverSize) / 2, (height - coverSize) / 2, coverSize, coverSize);
      ctx.restore();
    }

    const art = format === 'story' ? 700 : format === 'landscape' ? 410 : template === 'minimal' ? 510 : 560;
    const x = (width - art) / 2;
    const y = format === 'story' ? 230 : format === 'landscape' ? 72 : template === 'minimal' ? 120 : 92;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, art, art, 42);
    ctx.clip();
    ctx.drawImage(image, x, y, art, art);
    ctx.restore();

    const shade = ctx.createLinearGradient(0, size * 0.68, 0, size);
    shade.addColorStop(0, 'rgba(8,6,12,0)');
    shade.addColorStop(1, 'rgba(8,6,12,0.92)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, height * 0.55, width, height * 0.45);

    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font = '600 22px Inter, sans-serif';
    ctx.letterSpacing = '2px';
    ctx.fillText('NOW PLAYING', 74, format === 'story' ? 104 : 72);

    ctx.fillStyle = '#f6efff';
    ctx.font = '600 54px Inter, sans-serif';
    const textY = format === 'story' ? 1120 : format === 'landscape' ? 500 : 720;
    const titleSize = format === 'landscape' ? 42 : 54;
    const lines = wrapText(ctx, title || 'Untitled', titleSize, width - 148, format === 'landscape' ? 1 : 2);
    lines.forEach((line, i) => ctx.fillText(line, 74, textY + i * (titleSize + 8)));
    ctx.fillStyle = 'rgba(246,239,255,0.68)';
    ctx.font = '400 30px Inter, sans-serif';
    ctx.fillText(artist || 'Unknown artist', 74, textY + lines.length * (titleSize + 8) + 18);

    if (template === 'visualizer') {
      ctx.strokeStyle = 'rgba(240,193,121,0.8)';
      ctx.lineWidth = 5;
      const visualizerY = format === 'story' ? 1780 : format === 'landscape' ? 575 : 936;
      const barCount = format === 'landscape' ? 30 : 34;
      for (let i = 0; i < barCount; i += 1) {
        const h = 14 + Math.abs(Math.sin(i * 1.8)) * 44;
        const xx = 74 + i * ((width - 148) / barCount);
        ctx.beginPath();
        ctx.moveTo(xx, visualizerY - h / 2);
        ctx.lineTo(xx, visualizerY + h / 2);
        ctx.stroke();
      }
    }

    ctx.fillStyle = 'rgba(246,239,255,0.48)';
    ctx.font = '600 24px Inter, sans-serif';
    const footerY = format === 'story' ? 1845 : format === 'landscape' ? 590 : 1012;
    ctx.fillText('MIXHOLIC', 74, footerY);
    ctx.fillStyle = 'rgba(246,239,255,0.38)';
    ctx.font = '400 18px Inter, sans-serif';
    ctx.fillText('mixholic · listen to the moment', 74, footerY + 32);
  };
  image.src = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

function wrapText(ctx, text, fontSize, maxWidth, maxLines) {
  ctx.font = `600 ${fontSize}px Inter, sans-serif`;
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

function FriendAvatar({ username, avatarUrl }) {
  return avatarUrl ? (
    <img src={avatarUrl} alt="" className="share-friend__avatar" />
  ) : (
    <span className="share-friend__avatar share-friend__avatar--fallback">{username?.[0]?.toUpperCase() || '?'}</span>
  );
}

// Friend picker + send — lives inside the modal's "Kirim ke teman" tab.
// `friends` is the same shape as useDirectSocket's `threads` (one entry
// per accepted friendship, whether or not there's a conversation yet).
function SendToFriends({ friends, song, onSendToFriend, onToast }) {
  const [query, setQuery] = useState('');
  const [sendingTo, setSendingTo] = useState(null);
  const [sentTo, setSentTo] = useState(() => new Set());

  const visible = (friends || []).filter((t) => t.username.toLowerCase().includes(query.trim().toLowerCase()));

  const send = async (username) => {
    if (sendingTo) return;
    setSendingTo(username);
    try {
      await onSendToFriend(username, song);
      setSentTo((prev) => new Set(prev).add(username));
      onToast?.(`Lagu dikirim ke ${username}.`, 'success');
    } catch (err) {
      onToast?.(err.message || `Gagal ngirim ke ${username}.`, 'error');
    } finally {
      setSendingTo(null);
    }
  };

  return (
    <div className="share-friends">
      <input
        type="text"
        className="share-friends__search"
        placeholder="Cari teman…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {!friends?.length && (
        <div className="share-friends__empty">Belum ada teman. Tambahin teman dulu lewat halaman profil mereka.</div>
      )}
      {friends?.length > 0 && !visible.length && (
        <div className="share-friends__empty">Gak ketemu teman dengan nama itu.</div>
      )}
      <ul className="share-friends__list">
        {visible.map((t) => {
          const isSent = sentTo.has(t.username);
          return (
            <li key={t.username} className="share-friend">
              <FriendAvatar username={t.username} avatarUrl={t.profile?.avatarUrl} />
              <span className="share-friend__name">{t.username}</span>
              <button
                type="button"
                className={`share-friend__send ${isSent ? 'is-sent' : ''}`}
                disabled={sendingTo === t.username || isSent}
                onClick={() => send(t.username)}
              >
                {isSent ? 'Terkirim ✓' : sendingTo === t.username ? 'Ngirim…' : 'Kirim'}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function ShareModal({
  isOpen, onClose, title, artist, videoId, onToast,
  isAuthenticated, friends, onSendToFriend, onLoginRequired,
}) {
  const [tab, setTab] = useState('poster');
  const [template, setTemplate] = useState('cinematic');
  const [format, setFormat] = useState('square');
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!isOpen) setTab('poster');
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || tab !== 'poster' || !videoId || !canvasRef.current) return;
    drawCard(canvasRef.current, { template, title, artist, videoId, format });
  }, [isOpen, tab, template, format, title, artist, videoId]);

  if (!isOpen) return null;

  const songLink = `https://www.youtube.com/watch?v=${videoId}`;

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const link = document.createElement('a');
      link.download = `mixholic-${template}-${(title || 'song').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      onToast?.('Share card exported as PNG.', 'success');
    } catch {
      onToast?.('The artwork blocked canvas export. Try opening the image once and retrying.', 'error');
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(songLink);
      onToast?.('Song link copied.', 'success');
    } catch {
      onToast?.('Could not copy the link.', 'error');
    }
  };

  const shareWhatsApp = () => {
    const text = `Dengerin "${title || 'lagu ini'}"${artist ? ` — ${artist}` : ''} di Mixholic: ${songLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  const shareNative = async () => {
    if (!navigator.share) return copyLink();
    try {
      await navigator.share({ title: title || 'Mixholic', text: artist ? `${title} — ${artist}` : title, url: songLink });
    } catch {
      /* user cancelled — not an error */
    }
  };

  const handleFriendsTab = () => {
    if (!isAuthenticated) {
      onToast?.('Login dulu buat kirim lagu ke teman.', 'error');
      onLoginRequired?.();
      return;
    }
    setTab('friends');
  };

  return (
    <div className="share-overlay" onClick={onClose}>
      <section className="share-modal" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="share-modal__close" onClick={onClose} aria-label="Close share">×</button>
        <div className="share-modal__copy"><span className="share-modal__eyebrow">Share the song</span><h2>{tab === 'poster' ? 'Make it post-worthy.' : 'Kirim ke teman.'}</h2><p>{tab === 'poster' ? 'Choose a visual style, preview it, then export a crisp PNG.' : 'Kirim langsung ke DM temen kamu di Mixholic.'}</p></div>

        <div className="share-modal__tabs">
          <button type="button" className={tab === 'poster' ? 'is-active' : ''} onClick={() => setTab('poster')}>Poster & link</button>
          <button type="button" className={tab === 'friends' ? 'is-active' : ''} onClick={handleFriendsTab}>Kirim ke teman</button>
        </div>

        {tab === 'poster' ? (
          <div className="share-modal__grid">
            <div className="share-preview"><canvas ref={canvasRef} width="1080" height="1080" /></div>
            <div className="share-controls">
              <span className="share-controls__label">Template</span>
              <div className="share-templates">
                {TEMPLATES.map((item) => <button type="button" key={item.id} className={template === item.id ? 'is-active' : ''} onClick={() => setTemplate(item.id)}>{item.label}</button>)}
              </div>
              <span className="share-controls__label">Format</span>
              <div className="share-templates share-formats">
                {['square', 'story', 'landscape'].map((item) => <button type="button" key={item} className={format === item ? 'is-active' : ''} onClick={() => setFormat(item)}>{item === 'square' ? 'Square' : item === 'story' ? 'Story' : 'Landscape'}</button>)}
              </div>
              <div className="share-info"><strong>{title}</strong><span>{artist}</span></div>
              <button type="button" className="share-download" onClick={download}>Download PNG</button>
              <div className="share-out-row">
                <button type="button" className="share-copy" onClick={copyLink}>Copy link</button>
                <button type="button" className="share-copy share-whatsapp" onClick={shareWhatsApp}>WhatsApp</button>
                {typeof navigator !== 'undefined' && navigator.share && (
                  <button type="button" className="share-copy" onClick={shareNative}>Share…</button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <SendToFriends friends={friends} song={{ videoId, title, artist }} onSendToFriend={onSendToFriend} onToast={onToast} />
        )}
      </section>
    </div>
  );
}
