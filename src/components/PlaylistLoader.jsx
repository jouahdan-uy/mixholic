import { useState } from 'react';

export default function PlaylistLoader({ onLoad, recentPlaylists, isOpen, onClose }) {
  const [value, setValue] = useState('');

  if (!isOpen) return null;

  const submit = (e) => {
    e.preventDefault();
    if (!value.trim()) return;
    onLoad(value);
    setValue('');
    onClose();
  };

  return (
    <div className="loader-overlay" onClick={onClose}>
      <div className="loader-panel" onClick={(e) => e.stopPropagation()}>
        <h2 className="loader-panel__title">Cue a new playlist</h2>
        <p className="loader-panel__hint">
          Paste a YouTube or YouTube Music playlist link, or a playlist ID.
        </p>
        <form onSubmit={submit} className="loader-panel__form">
          <input
            autoFocus
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="https://music.youtube.com/playlist?list=…"
            className="loader-panel__input"
          />
          <button type="submit" className="loader-panel__submit">
            Load
          </button>
        </form>

        {recentPlaylists?.length > 0 && (
          <div className="loader-panel__recent">
            <span className="loader-panel__recent-label">Recent</span>
            <div className="loader-panel__chips">
              {recentPlaylists.map((id) => (
                <button
                  key={id}
                  type="button"
                  className="loader-panel__chip"
                  onClick={() => {
                    onLoad(id);
                    onClose();
                  }}
                >
                  {id.slice(0, 18)}
                  {id.length > 18 ? '…' : ''}
                </button>
              ))}
            </div>
          </div>
        )}

        <button type="button" className="loader-panel__close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
    </div>
  );
}
