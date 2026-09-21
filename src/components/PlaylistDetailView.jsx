import { useCallback, useEffect, useState } from 'react';

function PlayGlyph() {
  return <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M8 5.5v13l11-6.5z" /></svg>;
}

export default function PlaylistDetailView({ playlistId, auth, onPlay, onBack, onOpenProfile, onToast }) {
  const [playlist, setPlaylist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await auth.getPlaylist(playlistId);
      setPlaylist(data);
      setRenameValue(data.name);
    } catch (err) {
      setError(err.message || 'Gagal memuat playlist.');
    } finally {
      setLoading(false);
    }
  }, [playlistId, auth]);

  useEffect(() => { load(); }, [load]);

  const isOwner = auth.isAuthenticated && playlist?.owner?.username === auth.user?.username;

  const playAll = () => {
    if (!playlist?.tracks?.length) {
      onToast?.('Playlist ini masih kosong.', 'error');
      return;
    }
    onPlay(playlist.tracks.map((t) => t.videoId), playlist.name);
  };

  const saveRename = async () => {
    const name = renameValue.trim();
    if (!name) return;
    setIsSaving(true);
    try {
      await auth.renamePlaylist(playlistId, name);
      onToast?.('Nama playlist diganti.', 'success');
      setIsRenaming(false);
      load();
    } catch (err) {
      onToast?.(err.message || 'Gagal ganti nama.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteThisPlaylist = async () => {
    try {
      await auth.deletePlaylist(playlistId);
      onToast?.('Playlist dihapus.', 'info');
      onBack();
    } catch (err) {
      onToast?.(err.message || 'Gagal hapus playlist.', 'error');
    }
  };

  const removeTrack = async (videoId) => {
    try {
      await auth.removeTrackFromPlaylist(playlistId, videoId);
      load();
    } catch (err) {
      onToast?.(err.message || 'Gagal hapus lagu.', 'error');
    }
  };

  if (loading) {
    return (
      <div className="profile-page">
        <button type="button" className="artist-page__back" onClick={onBack}>← Kembali</button>
        <p className="artist-page__state">Memuat playlist…</p>
      </div>
    );
  }

  if (error || !playlist) {
    return (
      <div className="profile-page">
        <button type="button" className="artist-page__back" onClick={onBack}>← Kembali</button>
        <p className="artist-page__state">{error || 'Playlist tidak ditemukan.'}</p>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <button type="button" className="artist-page__back" onClick={onBack}>← Kembali</button>

      <div className="playlist-header">
        <div className="playlist-header__copy">
          <span className="artist-page__eyebrow">Playlist</span>
          {isRenaming ? (
            <div className="profile-hero__edit-form">
              <input
                className="auth-panel__input"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                maxLength={60}
                autoFocus
              />
              <div className="profile-hero__edit-actions">
                <button type="button" className="artist-page__primary" onClick={saveRename} disabled={isSaving}>
                  {isSaving ? 'Menyimpan…' : 'Simpan'}
                </button>
                <button type="button" className="artist-page__secondary" onClick={() => { setIsRenaming(false); setRenameValue(playlist.name); }}>
                  Batal
                </button>
              </div>
            </div>
          ) : (
            <h1>{playlist.name}</h1>
          )}
          <p>
            oleh{' '}
            <button type="button" className="auth-panel__link" onClick={() => onOpenProfile(playlist.owner.username)}>
              @{playlist.owner.username}
            </button>
            {' · '}{playlist.tracks.length} lagu
          </p>
          <div className="artist-hero__actions">
            <button type="button" className="artist-page__primary" onClick={playAll}>
              <PlayGlyph /> Putar semua
            </button>
            {isOwner && !isRenaming && (
              <>
                <button type="button" className="artist-page__secondary" onClick={() => setIsRenaming(true)}>Ganti nama</button>
                <button type="button" className="artist-page__secondary" onClick={deleteThisPlaylist}>Hapus playlist</button>
              </>
            )}
          </div>
        </div>
      </div>

      <section className="artist-section">
        {playlist.tracks.length === 0 ? (
          <p className="artist-page__state">Belum ada lagu di playlist ini.</p>
        ) : (
          <div className="artist-songs">
            {playlist.tracks.map((t, index) => (
              <div className="artist-song playlist-track stagger-in" style={{ '--i': index }} key={t.id || t.videoId}>
                <button type="button" className="playlist-track__play" onClick={() => onPlay([t.videoId], t.title)}>
                  <span className="artist-song__index">{String(index + 1).padStart(2, '0')}</span>
                  <img src={t.thumb || `https://i.ytimg.com/vi/${t.videoId}/mqdefault.jpg`} alt="" loading="lazy" />
                  <span className="artist-song__copy"><strong>{t.title || 'Untitled'}</strong><small>{t.artist || 'Unknown artist'}</small></span>
                </button>
                {isOwner ? (
                  <button type="button" className="playlist-track__remove" onClick={() => removeTrack(t.videoId)} aria-label="Hapus dari playlist">×</button>
                ) : (
                  <span className="artist-song__play"><PlayGlyph /></span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
