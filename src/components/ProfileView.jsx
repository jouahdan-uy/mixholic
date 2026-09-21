import { useCallback, useEffect, useRef, useState } from 'react';
import StatsShareModal from './StatsShareModal';

function PlayGlyph() {
  return <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M8 5.5v13l11-6.5z" /></svg>;
}

function LiveEqualizer() {
  return (
    <span className="live-eq" aria-hidden="true">
      <span /><span /><span />
    </span>
  );
}

// Two overlapping circles standing in for "your taste + theirs" — used on
// the Mix CTA instead of an emoji so it matches the rest of the app's icons.
function MixGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="9.5" cy="12" r="6.5" />
      <circle cx="14.5" cy="12" r="6.5" />
    </svg>
  );
}

// Renders the right button for wherever things stand between the viewer
// and this profile: none / outgoing request / incoming request / friends.
function FriendButton({ status, onAction, compact }) {
  const cls = compact ? 'profile-user-row__button' : 'artist-page__secondary';
  if (status === 'self' || status === 'guest') return null;
  if (status === 'friends') {
    return <button type="button" className={cls} onClick={() => onAction('remove')}>Berteman ✓</button>;
  }
  if (status === 'outgoing') {
    return <button type="button" className={cls} onClick={() => onAction('remove')}>Batalkan</button>;
  }
  if (status === 'incoming') {
    return (
      <div className="profile-user-row__actions">
        <button type="button" className={compact ? 'profile-user-row__button' : 'artist-page__primary'} onClick={() => onAction('accept')}>Terima</button>
        <button type="button" className={cls} onClick={() => onAction('remove')}>Tolak</button>
      </div>
    );
  }
  return <button type="button" className={compact ? 'profile-user-row__button is-accent' : 'artist-page__primary'} onClick={() => onAction('request')}>+ Teman</button>;
}

function PresenceDot({ isOnline }) {
  return <span className={`presence-dot${isOnline ? ' is-online' : ''}`} title={isOnline ? 'Online' : 'Offline'} aria-hidden="true" />;
}

function UserRow({ user, index = 0, onOpenProfile, onAction }) {
  return (
    <div className="profile-user-row stagger-in" style={{ '--i': index }}>
      <button type="button" className="profile-user-row__identity" onClick={() => onOpenProfile(user.username)}>
        <span className="profile-user-row__avatar">
          {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : user.username[0]}
          <PresenceDot isOnline={user.isOnline} />
        </span>
        <span>
          {user.username}
          {user.isOnline && user.nowPlaying ? (
            <small className="profile-now-playing">
              <LiveEqualizer /> {user.nowPlaying.title || 'Sesuatu'}{user.nowPlaying.artist ? ` — ${user.nowPlaying.artist}` : ''}
            </small>
          ) : user.bio ? (
            <small>{user.bio}</small>
          ) : null}
        </span>
      </button>
      <FriendButton status={user.friendshipStatus} onAction={onAction} compact />
    </div>
  );
}

function GenderLabel({ gender }) {
  if (!gender) return null;
  const label = gender === 'MALE' ? 'Laki-laki' : gender === 'FEMALE' ? 'Perempuan' : 'Lainnya';
  return <span className="profile-gender-chip">{label}</span>;
}

function PlaylistGrid({ playlists, onOpen }) {
  if (!playlists || playlists.length === 0) return null;
  return (
    <div className="playlists-grid">
      {playlists.map((p, index) => (
        <button type="button" key={p.id} className="playlist-card stagger-in" style={{ '--i': index }} onClick={() => onOpen(p.id)}>
          <span className="playlist-card__thumb">
            {p.thumb ? <img src={p.thumb} alt="" /> : '♪'}
          </span>
          <span className="playlist-card__name">{p.name}</span>
          <span className="playlist-card__count">{p.trackCount} lagu</span>
        </button>
      ))}
    </div>
  );
}

export default function ProfileView({ username, auth, onPlay, onPlayQueue, onBack, onOpenProfile, onOpenPlaylist, onToast, onFriendshipChanged }) {  const isOwn = auth.isAuthenticated && auth.user?.username === username;

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [isEditing, setIsEditing] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editGender, setEditGender] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);

  const [playlists, setPlaylists] = useState([]);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [isMixing, setIsMixing] = useState(false);

  const [statsPeriod, setStatsPeriod] = useState('month');
  const [stats, setStats] = useState(null);
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  const [isShareStatsOpen, setIsShareStatsOpen] = useState(false);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const avatarInputRef = useRef(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await auth.getUserProfile(username);
      setProfile(data);
      setEditUsername(data.username);
      setEditBio(data.bio || '');
      setEditGender(data.gender || '');
    } catch (err) {
      setError(err.message || 'Gagal memuat profil.');
    } finally {
      setLoading(false);
    }
  }, [username, auth]);

  useEffect(() => { load(); }, [load]);

  const refreshSocial = useCallback(() => {
    if (!isOwn) return;
    auth.fetchFriends().then(setFriends).catch(() => {});
    auth.fetchFriendRequests().then(setRequests).catch(() => {});
  }, [isOwn, auth]);

  useEffect(() => { refreshSocial(); }, [refreshSocial]);

  const refreshPlaylists = useCallback(() => {
    if (!isOwn) return;
    auth.fetchPlaylists().then(setPlaylists).catch(() => {});
  }, [isOwn, auth]);

  useEffect(() => { refreshPlaylists(); }, [refreshPlaylists]);

  useEffect(() => {
    if (!isOwn) return;
    setIsStatsLoading(true);
    auth.getStatsSummary({ period: statsPeriod })
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setIsStatsLoading(false));
  }, [isOwn, auth, statsPeriod]);

  useEffect(() => {
    if (!isOwn) return undefined;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return undefined;
    }
    let cancelled = false;
    setIsSearching(true);
    const timer = setTimeout(() => {
      auth.searchUsers(trimmed)
        .then((users) => { if (!cancelled) setResults(users); })
        .catch(() => {})
        .finally(() => { if (!cancelled) setIsSearching(false); });
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, isOwn, auth]);

  const saveProfile = async () => {
    const nextUsername = editUsername.trim();
    setIsSaving(true);
    try {
      await auth.updateProfile({ username: nextUsername, bio: editBio.trim(), gender: editGender || undefined });
      onToast?.('Profil berhasil disimpan.', 'success');
      setIsEditing(false);
      if (nextUsername !== username) onOpenProfile(nextUsername);
      else load();
    } catch (err) {
      onToast?.(err.message || 'Gagal simpan profil.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setIsUploadingAvatar(true);
    try {
      await auth.uploadAvatar(file);
      onToast?.('Foto profil berhasil diganti.', 'success');
      load();
    } catch (err) {
      onToast?.(err.message || 'Gagal upload foto.', 'error');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleFriendAction = async (targetUsername, action) => {
  try {
    if (action === 'request') {
      await auth.sendFriendRequest(targetUsername);
    } else if (action === 'accept') {
      await auth.acceptFriendRequest(targetUsername);
    } else if (action === 'remove') {
      await auth.removeFriendship(targetUsername);
    }

    await load();
    refreshSocial();

    if (action === 'accept' || action === 'remove') {
      await onFriendshipChanged?.();
    }

    setResults((prev) => prev.map((u) => (
      u.username === targetUsername
        ? {
            ...u,
            friendshipStatus:
              action === 'request'
                ? 'outgoing'
                : action === 'accept'
                  ? 'friends'
                  : 'none'
          }
        : u
    )));
  } catch (err) {
    onToast?.(err.message || 'Gagal, coba lagi.', 'error');
  }
};

  const handleCreatePlaylist = async () => {
    const name = newPlaylistName.trim();
    if (!name) return;
    setIsCreatingPlaylist(true);
    try {
      await auth.createPlaylist(name);
      setNewPlaylistName('');
      refreshPlaylists();
      onToast?.('Playlist dibuat.', 'success');
    } catch (err) {
      onToast?.(err.message || 'Gagal bikin playlist.', 'error');
    } finally {
      setIsCreatingPlaylist(false);
    }
  };

  // Grabs both listeners' favorites, dedupes, shuffles, and hands the
  // combined queue off to the player — a quick "what would we both like"
  // mix rather than a real recommendation engine.
  const handleMix = async () => {
    setIsMixing(true);
    try {
      const mine = await auth.fetchFavorites();
      const theirs = profile.favorites || [];
      const seen = new Set();
      const combined = [];
      for (const track of [...mine, ...theirs]) {
        if (!track.videoId || seen.has(track.videoId)) continue;
        seen.add(track.videoId);
        combined.push(track.videoId);
      }
      if (combined.length === 0) {
        onToast?.('Kalian berdua belum punya lagu favorit buat di-mix.', 'error');
        return;
      }
      // Fisher-Yates shuffle
      for (let i = combined.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [combined[i], combined[j]] = [combined[j], combined[i]];
      }
      onPlayQueue(combined, `Mix kamu & ${profile.username}`);
    } catch (err) {
      onToast?.(err.message || 'Gagal bikin mix.', 'error');
    } finally {
      setIsMixing(false);
    }
  };

  const handleAddToPlaylist = async (playlistId, track) => {
    if (!playlistId) return;
    try {
      await auth.addTrackToPlaylist(playlistId, {
        videoId: track.videoId,
        title: track.title,
        artist: track.artist,
        thumb: track.thumb,
      });
      onToast?.('Lagu ditambahin ke playlist.', 'success');
      refreshPlaylists();
    } catch (err) {
      onToast?.(err.message || 'Gagal nambahin ke playlist.', 'error');
    }
  };

  if (loading) {
    return (
      <div className="profile-page">
        <button type="button" className="artist-page__back" onClick={onBack}>← Kembali</button>
        <p className="artist-page__state">Memuat profil…</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="profile-page">
        <button type="button" className="artist-page__back" onClick={onBack}>← Kembali</button>
        <p className="artist-page__state">{error || 'Profil tidak ditemukan.'}</p>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <button type="button" className="artist-page__back" onClick={onBack}>← Kembali</button>

      <div className="artist-hero profile-hero">
        <div className="artist-hero__avatar profile-hero__avatar">
          {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : <span>{profile.username[0]}</span>}
          {!isOwn && <PresenceDot isOnline={profile.isOnline} />}
          {isOwn && (
            <>
              <button
                type="button"
                className="profile-hero__avatar-edit"
                onClick={() => avatarInputRef.current?.click()}
                disabled={isUploadingAvatar}
              >
                {isUploadingAvatar ? '…' : 'Ganti foto'}
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="user-chip__avatar-input"
                onChange={handleAvatarChange}
              />
            </>
          )}
        </div>

        <div className="artist-hero__copy">
          <span className="artist-page__eyebrow">Profil</span>

          {isEditing ? (
            <div className="profile-hero__edit-form">
              <input
                className="auth-panel__input"
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                maxLength={24}
                minLength={3}
                placeholder="username"
              />
              <textarea
                className="auth-panel__input profile-hero__bio-input"
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                maxLength={160}
                rows={3}
                placeholder="Ceritain dikit soal selera musik kamu…"
              />
              <select
                className="auth-panel__input"
                value={editGender}
                onChange={(e) => setEditGender(e.target.value)}
              >
                <option value="">Jenis kelamin (opsional)</option>
                <option value="MALE">Laki-laki</option>
                <option value="FEMALE">Perempuan</option>
                <option value="OTHER">Lainnya</option>
              </select>
              <div className="profile-hero__edit-actions">
                <button type="button" className="artist-page__primary" onClick={saveProfile} disabled={isSaving}>
                  {isSaving ? 'Menyimpan…' : 'Simpan'}
                </button>
                <button
                  type="button"
                  className="artist-page__secondary"
                  onClick={() => { setIsEditing(false); setEditUsername(profile.username); setEditBio(profile.bio || ''); setEditGender(profile.gender || ''); }}
                >
                  Batal
                </button>
              </div>
            </div>
          ) : (
            <>
              <h1>{profile.username} <GenderLabel gender={profile.gender} /></h1>
              {!isOwn && (
                <div className={`profile-hero__presence${profile.isOnline ? ' is-online' : ''}`}>
                  <PresenceDot isOnline={profile.isOnline} />
                  {profile.isOnline
                    ? (profile.nowPlaying
                      ? <span className="profile-hero__presence-text"><LiveEqualizer /> Lagi dengerin <b>{profile.nowPlaying.title || 'sesuatu'}</b>{profile.nowPlaying.artist ? ` — ${profile.nowPlaying.artist}` : ''}</span>
                      : <span>Online</span>)
                    : <span>Offline</span>}
                </div>
              )}
              <p>{profile.bio || (isOwn ? 'Belum ada bio. Klik "Edit profil" buat nambahin.' : 'Belum ada bio.')}</p>
              <div className="artist-hero__stats">
                <span><b>{profile.favorites?.length || 0}</b> favorit</span>
                <span><b>{(isOwn ? playlists : profile.playlists)?.length || 0}</b> playlist</span>
                {isOwn && <span><b>{friends.length}</b> teman</span>}
              </div>
              <div className="artist-hero__actions">
                {isOwn ? (
                  <button type="button" className="artist-page__secondary" onClick={() => setIsEditing(true)}>Edit profil</button>
                ) : (
                  <FriendButton status={profile.friendshipStatus} onAction={(action) => handleFriendAction(profile.username, action)} />
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {!isOwn && auth.isAuthenticated && (
        <div className="mix-cta">
          <div className="mix-cta__copy">
            <strong><span className="mix-cta__icon"><MixGlyph /></span>Mix bareng {profile.username}</strong>
            <span>Gabungin lagu favorit kalian berdua jadi satu antrian acak.</span>
          </div>
          <button type="button" className="artist-page__primary" onClick={handleMix} disabled={isMixing}>
            {isMixing ? 'Nyiapin…' : 'Mulai mix'}
          </button>
        </div>
      )}

      {isOwn && (
        <section className="artist-section stats-section">
          <div className="artist-section__heading">
            <div><span>Dihitung & dicatat otomatis</span><h2>Statistik dengerin</h2></div>
            <div className="stats-period-toggle" role="tablist">
              <button type="button" role="tab" aria-selected={statsPeriod === 'month'} className={statsPeriod === 'month' ? 'is-active' : ''} onClick={() => setStatsPeriod('month')}>Bulan ini</button>
              <button type="button" role="tab" aria-selected={statsPeriod === 'year'} className={statsPeriod === 'year' ? 'is-active' : ''} onClick={() => setStatsPeriod('year')}>Tahun ini</button>
            </div>
          </div>

          {isStatsLoading ? (
            <p className="artist-page__state">Ngitung statistik…</p>
          ) : !stats || stats.totalPlays === 0 ? (
            <p className="artist-page__state">
              Belum ada yang kerekam {statsPeriod === 'month' ? 'bulan ini' : 'tahun ini'} — statistik kesimpen otomatis tiap kamu muter lagu, jadi tinggal dengerin aja.
            </p>
          ) : (
            <>
              <div className="stats-cards">
                <div className="stats-card stagger-in" style={{ '--i': 0 }}><strong>{stats.totalMinutes.toLocaleString('id-ID')}</strong><span>menit didengerin</span></div>
                <div className="stats-card stagger-in" style={{ '--i': 1 }}><strong>{stats.totalPlays.toLocaleString('id-ID')}</strong><span>kali diputer</span></div>
                <div className="stats-card stagger-in" style={{ '--i': 2 }}><strong>{stats.uniqueTracks.toLocaleString('id-ID')}</strong><span>lagu berbeda</span></div>
              </div>

              {stats.topArtists.length > 0 && (
                <div className="stats-vibe">
                  <span className="stats-vibe__label">Vibe kamu {statsPeriod === 'month' ? 'bulan ini' : 'tahun ini'}</span>
                  <div className="stats-vibe__chips">
                    {stats.topArtists.map((a, index) => (
                      <span key={a.artist} className="stats-vibe__chip stagger-in" style={{ '--i': index }}>{a.artist}</span>
                    ))}
                  </div>
                </div>
              )}

              {stats.topTracks.length > 0 && (
                <div className="artist-songs stats-top-tracks">
                  {stats.topTracks.map((t, index) => (
                    <div className="artist-song stagger-in" style={{ '--i': index }} key={t.videoId}>
                      <span className="artist-song__index">{String(index + 1).padStart(2, '0')}</span>
                      <img src={`https://i.ytimg.com/vi/${t.videoId}/mqdefault.jpg`} alt="" loading="lazy" />
                      <span className="artist-song__copy"><strong>{t.title || 'Untitled'}</strong><small>{t.artist || 'Unknown artist'} · {t.playCount}x diputer</small></span>
                    </div>
                  ))}
                </div>
              )}

              <button type="button" className="artist-page__secondary stats-share-btn" onClick={() => setIsShareStatsOpen(true)}>
                Bagikan statistik
              </button>
            </>
          )}
        </section>
      )}

      {isOwn && (
        <section className="artist-section">
          <div className="artist-section__heading">
            <div><span>Temukan pendengar lain</span><h2>Cari teman</h2></div>
          </div>
          <input
            className="auth-panel__input profile-search__input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari username…"
          />
          {isSearching && <p className="profile-page__hint">Mencari…</p>}
          {!isSearching && query.trim().length >= 2 && results.length === 0 && (
            <p className="profile-page__hint">Gak ketemu username itu.</p>
          )}
          {results.length > 0 && (
            <div className="profile-user-list">
              {results.map((u, index) => (
                <UserRow key={u.id} user={u} index={index} onOpenProfile={onOpenProfile} onAction={(action) => handleFriendAction(u.username, action)} />
              ))}
            </div>
          )}
        </section>
      )}

      {isOwn && requests.length > 0 && (
        <section className="artist-section">
          <div className="artist-section__heading">
            <div><span>Menunggu direspon</span><h2>Permintaan pertemanan</h2></div>
          </div>
          <div className="profile-user-list">
            {requests.map((u, index) => (
              <UserRow key={u.id} user={{ ...u, friendshipStatus: 'incoming' }} index={index} onOpenProfile={onOpenProfile} onAction={(action) => handleFriendAction(u.username, action)} />
            ))}
          </div>
        </section>
      )}

      {isOwn && friends.length > 0 && (
        <section className="artist-section">
          <div className="artist-section__heading">
            <div><span>{friends.length} teman</span><h2>Teman kamu</h2></div>
          </div>
          <div className="profile-user-list">
            {friends.map((u, index) => (
              <UserRow key={u.id} user={{ ...u, friendshipStatus: 'friends' }} index={index} onOpenProfile={onOpenProfile} onAction={(action) => handleFriendAction(u.username, action)} />
            ))}
          </div>
        </section>
      )}

      <section className="artist-section">
        <div className="artist-section__heading">
          <div><span>{(isOwn ? playlists : profile.playlists)?.length || 0} playlist</span><h2>Playlist {isOwn ? 'kamu' : profile.username}</h2></div>
        </div>
        {isOwn && (
          <div className="profile-new-playlist">
            <input
              className="auth-panel__input"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreatePlaylist(); }}
              placeholder="Nama playlist baru…"
              maxLength={60}
            />
            <button type="button" className="artist-page__secondary" onClick={handleCreatePlaylist} disabled={isCreatingPlaylist || !newPlaylistName.trim()}>
              {isCreatingPlaylist ? 'Bikin…' : '+ Buat'}
            </button>
          </div>
        )}
        {(isOwn ? playlists : profile.playlists)?.length > 0 ? (
          <PlaylistGrid playlists={isOwn ? playlists : profile.playlists} onOpen={onOpenPlaylist} />
        ) : (
          <p className="artist-page__state">Belum ada playlist di sini.</p>
        )}
      </section>

      <section className="artist-section">
        <div className="artist-section__heading">
          <div><span>{profile.favorites?.length || 0} lagu</span><h2>Favorit {isOwn ? 'kamu' : profile.username}</h2></div>
        </div>
        {!profile.favorites || profile.favorites.length === 0 ? (
          <p className="artist-page__state">Belum ada lagu favorit di sini.</p>
        ) : (
          <div className="artist-songs">
            {profile.favorites.map((f, index) => (
              isOwn ? (
                <div className="artist-song favorite-track stagger-in" style={{ '--i': index }} key={f.id || f.videoId}>
                  <button type="button" className="favorite-track__play" onClick={() => onPlay(f.videoId)}>
                    <span className="artist-song__index">{String(index + 1).padStart(2, '0')}</span>
                    <img src={f.thumb || `https://i.ytimg.com/vi/${f.videoId}/mqdefault.jpg`} alt="" loading="lazy" />
                    <span className="artist-song__copy"><strong>{f.title || 'Untitled'}</strong><small>{f.artist || 'Unknown artist'}</small></span>
                  </button>
                  {playlists.length > 0 && (
                    <select
                      className="favorite-track__add"
                      defaultValue=""
                      onChange={(e) => { const id = e.target.value; e.target.value = ''; if (id) handleAddToPlaylist(id, f); }}
                    >
                      <option value="" disabled>+ playlist</option>
                      {playlists.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  )}
                </div>
              ) : (
                <button type="button" className="artist-song stagger-in" style={{ '--i': index }} key={f.id || f.videoId} onClick={() => onPlay(f.videoId)}>
                  <span className="artist-song__index">{String(index + 1).padStart(2, '0')}</span>
                  <img src={f.thumb || `https://i.ytimg.com/vi/${f.videoId}/mqdefault.jpg`} alt="" loading="lazy" />
                  <span className="artist-song__copy"><strong>{f.title || 'Untitled'}</strong><small>{f.artist || 'Unknown artist'}</small></span>
                  <span className="artist-song__play"><PlayGlyph /></span>
                </button>
              )
            ))}
          </div>
        )}
      </section>

      {isOwn && (
        <StatsShareModal
          isOpen={isShareStatsOpen}
          onClose={() => setIsShareStatsOpen(false)}
          stats={stats}
          period={statsPeriod}
          username={profile.username}
          avatarUrl={profile.avatarUrl}
          onToast={onToast}
        />
      )}
    </div>
  );
}
