import { useEffect, useRef, useState } from 'react';
import StreakShareModal from './StreakShareModal';

function FlameIcon({ size = 14 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M12.5 2c.3 2.4-.6 3.7-2 5.1C8.7 8.6 7 10.4 7 13.2a5 5 0 0 0 10 0c0-1.4-.5-2.3-1.1-3.2-.2.9-.7 1.6-1.4 1.6-.9 0-1.3-.8-1-1.7.6-1.8.6-3.6-1-7.9Z" />
    </svg>
  );
}

function PlayMiniIcon() {
  return <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M8 5.5v13l11-6.5z" /></svg>;
}

function MusicNoteIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" />
    </svg>
  );
}

function SendIcon() {
  return <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M3 11.5 20.5 4 13 21.5l-2.4-7.1z" /></svg>;
}

function BackIcon() {
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>;
}

function Avatar({ username, avatarUrl, size = 40 }) {
  return avatarUrl ? (
    <img src={avatarUrl} alt="" className="direct-avatar" style={{ width: size, height: size }} />
  ) : (
    <span className="direct-avatar direct-avatar--fallback" style={{ width: size, height: size, fontSize: size * 0.42 }}>
      {username?.[0]?.toUpperCase() || '?'}
    </span>
  );
}

function StreakBadge({ streak }) {
  if (!streak?.isActive) return null;
  return (
    <span className="direct-streak" title={`${streak.count} hari beruntun`}>
      <FlameIcon /> {streak.count}
    </span>
  );
}

function UnreadBadge({ count }) {
  if (!count) return null;
  return <span className="direct-unread-badge">{count > 9 ? '9+' : count}</span>;
}

function formatClock(iso) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function ThreadList({ threads, loading, activeUsername, onSelect, onOpenProfile }) {
  if (loading && !threads.length) {
    return <div className="direct-empty">Memuat percakapan…</div>;
  }
  if (!threads.length) {
    return (
      <div className="direct-empty">
        <p>Belum ada teman buat di-DM.</p>
        <span>Tambahkan teman lewat halaman profil mereka, terus obrolan bakal muncul di sini.</span>
      </div>
    );
  }
  return (
    <ul className="direct-thread-list">
      {threads.map((t) => (
        <li key={t.username}>
          <button
            type="button"
            className={`direct-thread ${activeUsername === t.username ? 'is-active' : ''} ${t.unreadCount ? 'is-unread' : ''}`}
            onClick={() => onSelect(t.username)}
          >
            <span
  className="direct-thread__profile-trigger"
  role="button"
  tabIndex={0}
  onClick={(e) => {
    e.stopPropagation();
    onOpenProfile?.(t.username);
  }}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      onOpenProfile?.(t.username);
    }
  }}
  title={`Lihat profil ${t.username}`}
>
  <Avatar username={t.username} avatarUrl={t.profile?.avatarUrl} />
</span>

<span className="direct-thread__body">
  <span className="direct-thread__top">
    <strong
      className="direct-thread__username"
      onClick={(e) => {
        e.stopPropagation();
        onOpenProfile?.(t.username);
      }}
    >
      {t.username}
    </strong>
    <StreakBadge streak={t.streak} />
  </span>
              <span className="direct-thread__preview">
                {t.lastMessage
                  ? t.lastMessage.type === 'SONG'
                    ? `${t.lastMessage.isMine ? 'Kamu: ' : ''}🎵 ${t.lastMessage.videoTitle || 'Lagu'}`
                    : `${t.lastMessage.isMine ? 'Kamu: ' : ''}${t.lastMessage.text}`
                  : 'Belum ada pesan — say hi!'}
              </span>
            </span>
            <UnreadBadge count={t.unreadCount} />
          </button>
        </li>
      ))}
    </ul>
  );
}

function MessageBubble({ message, onPlaySong }) {
  if (message.type === 'SONG') {
    return (
      <div className={`direct-msg direct-msg--song ${message.isMine ? 'is-mine' : ''}`}>
        <div className="direct-song-card">
          {message.videoThumb && <img src={message.videoThumb} alt="" />}
          <div className="direct-song-card__info">
            <strong>{message.videoTitle || 'Untitled'}</strong>
            <span>{message.videoArtist || 'Unknown artist'}</span>
          </div>
          <button type="button" onClick={() => onPlaySong(message.videoId)} aria-label="Play song"><PlayMiniIcon /></button>
        </div>
        <span className="direct-msg__time">{formatClock(message.createdAt)}</span>
      </div>
    );
  }
  return (
    <div className={`direct-msg ${message.isMine ? 'is-mine' : ''}`}>
      <p>{message.text}</p>
      <span className="direct-msg__time">{formatClock(message.createdAt)}</span>
    </div>
  );
}

function ChatThread({ direct, currentUsername, nowPlaying, onPlaySong, onToast }) {
  const [text, setText] = useState('');
  const [isShareOpen, setIsShareOpen] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [direct.messages.length]);

  const submitText = async (event) => {
    event.preventDefault();
    const value = text.trim();
    if (!value) return;
    setText('');
    try {
      await direct.sendText(value);
    } catch (err) {
      onToast?.(err.message || 'Gagal ngirim pesan.', 'error');
    }
  };

  const sendCurrentSong = async () => {
    if (!nowPlaying?.videoId) return;
    try {
      await direct.sendSong(nowPlaying);
      onToast?.('Lagu terkirim.', 'success');
    } catch (err) {
      onToast?.(err.message || 'Gagal ngirim lagu.', 'error');
    }
  };

  if (!direct.activeUsername) {
    return (
      <div className="direct-main direct-main--empty">
        <p>Pilih teman buat mulai chat.</p>
      </div>
    );
  }

  return (
    <div className="direct-main">
      <header className="direct-main__header">
        <button type="button" className="direct-back" onClick={direct.closeThread} aria-label="Kembali"><BackIcon /></button>
        <Avatar username={direct.activeUsername} avatarUrl={direct.activeFriend?.avatarUrl} size={34} />
        <div className="direct-main__title">
          <strong>{direct.activeUsername}</strong>
          {direct.activeFriend?.isOnline && <span className="direct-online">Online</span>}
        </div>
        <StreakBadge streak={direct.activeStreak} />
        {direct.activeStreak?.count >= 50 && (
          <button type="button" className="direct-share-btn" onClick={() => setIsShareOpen(true)}>Share streak</button>
        )}
      </header>

      <div className="direct-messages" ref={scrollRef}>
        {direct.messagesLoading && !direct.messages.length && <div className="direct-empty">Memuat pesan…</div>}
        {!direct.messagesLoading && !direct.messages.length && (
          <div className="direct-empty"><p>Belum ada obrolan. Kirim pesan atau lagu pertama kamu!</p></div>
        )}
        {direct.messages.map((m) => <MessageBubble key={m.id} message={m} onPlaySong={onPlaySong} />)}
      </div>

      <form className="direct-composer" onSubmit={submitText}>
        <button
          type="button"
          className="direct-composer__song"
          onClick={sendCurrentSong}
          disabled={!nowPlaying?.videoId}
          title={nowPlaying?.videoId ? `Kirim "${nowPlaying.title}"` : 'Gak ada lagu yang lagi diputar'}
        >
          <MusicNoteIcon />
        </button>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Kirim pesan ke ${direct.activeUsername}…`}
          maxLength={2000}
        />
        <button type="submit" className="direct-composer__send" disabled={!text.trim()} aria-label="Kirim"><SendIcon /></button>
      </form>

      <StreakShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        streakCount={direct.activeStreak?.count || 0}
        you={currentUsername}
        friend={direct.activeUsername}
        onToast={onToast}
      />
    </div>
  );
}

export default function DirectView({
  direct,
  currentUsername,
  nowPlaying,
  onPlaySong,
  onToast,
  onOpenProfile
}) {
  return (
    <div className="direct-page">
      <div className={`direct-sidebar ${direct.activeUsername ? 'is-hidden-mobile' : ''}`}>
        <div className="direct-sidebar__header">
          <h2>Direct</h2>
          {!direct.isConnected && <span className="direct-connecting">Menyambungkan…</span>}
        </div>
        <ThreadList
          threads={direct.threads}
          loading={direct.threadsLoading}
          activeUsername={direct.activeUsername}
          onSelect={direct.openThread}
          onOpenProfile={onOpenProfile}
        />
      </div>
      <div className={`direct-main-wrap ${direct.activeUsername ? '' : 'is-hidden-mobile'}`}>
        <ChatThread direct={direct} currentUsername={currentUsername} nowPlaying={nowPlaying} onPlaySong={onPlaySong} onToast={onToast} />
      </div>
    </div>
  );
}
