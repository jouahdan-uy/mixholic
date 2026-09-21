import { useMemo, useRef, useState } from 'react';

function HeartIcon({ filled }) {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8">
      <path d="M12 20.4c-.2 0-.4-.07-.55-.2C7.2 16.7 4 13.9 4 10.4 4 7.9 5.9 6 8.3 6c1.4 0 2.7.65 3.7 1.85C13 6.65 14.3 6 15.7 6 18.1 6 20 7.9 20 10.4c0 3.5-3.2 6.3-7.45 9.8-.15.13-.35.2-.55.2Z" />
    </svg>
  );
}

function TrackRow({ i, meta, isCurrent, isFavorite, onPlay, onToggleFavorite }) {
  const status = meta?.status || 'pending';
  const title = meta?.title || (status === 'error' ? `Track ${i + 1}` : null);
  const artist = meta?.artist;

  return (
    <li>
      <div className={`library__row ${isCurrent ? 'library__row--current' : ''}`}>
        <button type="button" className="library__row-play" onClick={onPlay} aria-label={`Play track ${i + 1}`}>
          <span className="library__thumb">
            {meta?.thumb ? (
              <img src={meta.thumb} alt="" loading="lazy" />
            ) : (
              <span className={`library__thumb-skel ${status === 'pending' ? 'is-loading' : ''}`} />
            )}
            <span className="library__thumb-indicator">{isCurrent ? '♪' : i + 1}</span>
          </span>
          <span className="library__meta">
            <span className={`library__meta-title ${!title ? 'is-loading' : ''}`}>{title || 'Loading title…'}</span>
            {artist && <span className="library__meta-artist">{artist}</span>}
          </span>
        </button>
        <button
          type="button"
          className={`library__favorite ${isFavorite ? 'is-active' : ''}`}
          onClick={onToggleFavorite}
          aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          aria-pressed={isFavorite}
          title="Favorite (F)"
        >
          <HeartIcon filled={isFavorite} />
        </button>
      </div>
    </li>
  );
}

export default function LibraryPanel({
  isOpen,
  onClose,
  total,
  index,
  titleCache,
  playlistVideoIds,
  metadata,
  favorites,
  onToggleFavorite,
  onJump,
  searchInputRef,
}) {
  const [query, setQuery] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const localInputRef = useRef(null);
  const inputRef = searchInputRef || localInputRef;

  const rows = useMemo(() => {
    return Array.from({ length: total }, (_, i) => {
      const videoId = playlistVideoIds[i];
      const cached = titleCache[i];
      const meta = (videoId && metadata[videoId]) || null;
      const title = meta?.title || cached?.title || '';
      const artist = meta?.artist || cached?.artist || '';
      return { i, videoId, title, artist, thumb: meta?.thumb, status: meta?.status };
    });
  }, [total, playlistVideoIds, titleCache, metadata]);

  const filtered = useMemo(() => {
    let list = rows;
    if (favoritesOnly) {
      list = list.filter((r) => r.videoId && favorites.has(r.videoId));
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) => r.title.toLowerCase().includes(q) || r.artist.toLowerCase().includes(q)
      );
    }
    return list;
  }, [rows, query, favoritesOnly, favorites]);

  const handleClose = () => {
    setQuery('');
    setFavoritesOnly(false);
    onClose();
  };

  return (
    <aside className={`library ${isOpen ? 'library--open' : ''}`} aria-hidden={!isOpen}>
      <div className="library__header">
        <h2 className="library__title">Library</h2>
        <button type="button" className="library__close" onClick={handleClose} aria-label="Close library">
          ×
        </button>
      </div>

      <div className="library__search">
        <SearchIcon />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search this playlist…"
          aria-label="Search tracks"
        />
        {query && (
          <button type="button" className="library__search-clear" onClick={() => setQuery('')} aria-label="Clear search">
            ×
          </button>
        )}
      </div>

      <div className="library__filters">
        <button
          type="button"
          className={`library__filter-chip ${!favoritesOnly ? 'is-active' : ''}`}
          onClick={() => setFavoritesOnly(false)}
        >
          All tracks
        </button>
        <button
          type="button"
          className={`library__filter-chip ${favoritesOnly ? 'is-active' : ''}`}
          onClick={() => setFavoritesOnly(true)}
        >
          Favorites
        </button>
      </div>

      <ol className="library__list">
        {filtered.map((row) => (
          <TrackRow
            key={row.i}
            i={row.i}
            meta={
              row.thumb || row.title
                ? { title: row.title, artist: row.artist, thumb: row.thumb, status: row.status }
                : { status: row.status }
            }
            isCurrent={row.i === index}
            isFavorite={!!row.videoId && favorites.has(row.videoId)}
            onPlay={() => onJump(row.i)}
            onToggleFavorite={() => row.videoId && onToggleFavorite(row.videoId)}
          />
        ))}

        {total === 0 && <li className="library__empty">Playlist is loading…</li>}
        {total > 0 && filtered.length === 0 && (
          <li className="library__empty">
            {favoritesOnly ? 'No favorites yet — tap the heart on a track.' : `No tracks match "${query}".`}
          </li>
        )}
      </ol>
    </aside>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.3-4.3" />
    </svg>
  );
}
