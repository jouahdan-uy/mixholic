import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import YouTube from 'react-youtube';

import usePlayerEngine from './hooks/usePlayerEngine';
import useTilt from './hooks/useTilt';
import useMagnetic from './hooks/useMagnetic';
import useLibraryMetadata from './hooks/useLibraryMetadata';
import useAuth from './hooks/useAuth';
import useDirectSocket from './hooks/useDirectSocket';

import AmbientField from './components/AmbientField';
import AuthModal from './components/AuthModal';
import ProfileView from './components/ProfileView';
import PlaylistDetailView from './components/PlaylistDetailView';
import VinylDisc from './components/VinylDisc';
import Visualizer from './components/Visualizer';
import ProgressBar from './components/ProgressBar';
import VolumeControl from './components/VolumeControl';
import TransportControls from './components/TransportControls';
import PlaylistLoader from './components/PlaylistLoader';
import LibraryPanel from './components/LibraryPanel';
import ToastStack from './components/ToastStack';
import ShortcutsHint from './components/ShortcutsHint';
import InitialLoader from './components/InitialLoader';
import OnboardingTutorial from './components/OnboardingTutorial';
import LyricsPanel from './components/LyricsPanel';
import ShareModal from './components/ShareModal';
import HomeView from './components/HomeView';
import SearchView from './components/SearchView';
import ArtistView from './components/ArtistView';
import DirectView from './components/DirectView';

export default function App() {
  const engine = usePlayerEngine();
  const tilt = useTilt({ max: 4, scale: 1.006 });
  const cueMagnet = useMagnetic(0.18);
  const metadata = useLibraryMetadata(engine.playlistVideoIds);
  const auth = useAuth();
  const direct = useDirectSocket(auth.isAuthenticated ? auth.token : null, { onToast: engine.pushToast });

  const [isLoaderOpen, setIsLoaderOpen] = useState(false);
  const [showInitialLoader, setShowInitialLoader] = useState(true);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isImmersive, setIsImmersive] = useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [isLyricsOpen, setIsLyricsOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isPlaylistSaveOpen, setIsPlaylistSaveOpen] = useState(false);
  const [savePlaylists, setSavePlaylists] = useState([]);
  const [isLoadingSavePlaylists, setIsLoadingSavePlaylists] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [resetToken, setResetToken] = useState(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [page, setPage] = useState('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArtist, setSelectedArtist] = useState('');
  const [selectedProfileUsername, setSelectedProfileUsername] = useState('');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);
  useEffect(() => {
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    });
    setIsMobileMoreOpen(false);
    setIsUserMenuOpen(false);
  }, [page]);

  const searchInputRef = useRef(null);
  const autoplayNoticeShown = useRef(false);
  const avatarInputRef = useRef(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const handleAvatarChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow picking the same file again later
    if (!file) return;
    setIsUploadingAvatar(true);
    try {
      await auth.uploadAvatar(file);
      engine.pushToast('Foto profil berhasil diganti.', 'success');
    } catch (err) {
      engine.pushToast(err.message || 'Gagal upload foto profil.', 'error');
    } finally {
      setIsUploadingAvatar(false);
    }
  }, [auth, engine]);

  const toggleImmersive = useCallback(() => {
    setIsImmersive((prev) => {
      const next = !prev;
      if (next && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
      else if (!next && document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
      return next;
    });
  }, []);

  const openExplore = useCallback((query = '') => {
    setPage('explore');
    setSearchQuery(query);
  }, []);

  const openArtist = useCallback((name = '') => {
    if (!name.trim()) return;
    setSelectedArtist(name.trim());
    setPage('artist');
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, []);

  const openProfile = useCallback((username = '') => {
    if (!username?.trim()) return;
    setSelectedProfileUsername(username.trim());
    setPage('profile');
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, []);

  const openPlaylist = useCallback((id) => {
    if (!id) return;
    setSelectedPlaylistId(id);
    setPage('playlist');
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, []);

  const openDirect = useCallback(async () => {
  if (!auth.isAuthenticated) {
    engine.pushToast('Login dulu buat nge-DM teman.', 'error');
    setAuthMode('login');
    setIsAuthOpen(true);
    return;
  }

  await direct.refreshThreads();

  setPage('direct');
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
}, [auth.isAuthenticated, engine, direct]);

  // Plays an arbitrary queue of video IDs (custom playlists, the "mix
  // with them" feature) and jumps to the player.
  const playQueue = useCallback((ids, label) => {
    engine.playQueue(ids, label);
    setPage('player');
  }, [engine]);

  const loadPlaylistAndPlay = useCallback((value) => {
    engine.loadPlaylist(value);
    setPage('player');
  }, [engine]);

  useEffect(() => {
    const handler = (event) => openArtist(event.detail || '');
    window.addEventListener('mixholic:open-artist', handler);
    return () => window.removeEventListener('mixholic:open-artist', handler);
  }, [openArtist]);

  // Best-effort title/artist/thumbnail for a track, used when saving a
  // favorite to the backend (which likes to have something to show later).
  const resolveTrackMeta = useCallback((id) => {
    if (id === engine.videoId) {
      return {
        title: engine.title,
        artist: engine.artist,
        thumb: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
      };
    }
    const m = metadata[id];
    return {
      title: m?.title || 'Untitled track',
      artist: m?.artist || 'Unknown artist',
      thumb: m?.thumb || `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
    };
  }, [engine.videoId, engine.title, engine.artist, metadata]);
  const openSaveToPlaylist = async () => {
  if (!engine.videoId) return;

  if (!auth.isAuthenticated) {
    engine.pushToast('Login dulu untuk menyimpan lagu ke playlist.', 'error');
    return;
  }

  setIsPlaylistSaveOpen(true);
  setIsLoadingSavePlaylists(true);

  try {
    const playlists = await auth.fetchPlaylists();
    setSavePlaylists(playlists);
  } catch (err) {
    engine.pushToast(err.message || 'Gagal memuat playlist.', 'error');
    setIsPlaylistSaveOpen(false);
  } finally {
    setIsLoadingSavePlaylists(false);
  }
};

  const saveCurrentTrackToPlaylist = async (playlistId) => {
  if (!playlistId || !engine.videoId) return;

  try {
    const track = resolveTrackMeta(engine.videoId);

    await auth.addTrackToPlaylist(playlistId, {
      videoId: engine.videoId,
      title: track.title,
      artist: track.artist,
      thumb: track.thumb,
    });

    setIsPlaylistSaveOpen(false);
    engine.pushToast('Lagu ditambahkan ke playlist.', 'success');
  } catch (err) {
    engine.pushToast(err.message || 'Gagal menambahkan lagu.', 'error');
  }
};



  // Toggles the favorite locally (instant UI, works offline), then — if
  // logged in — mirrors the change to the backend so it's there on other
  // devices too.
  const handleToggleFavorite = useCallback((id) => {
    if (!id) return;
    const willBeFavorite = !engine.isFavorite(id);
    engine.toggleFavorite(id);
    if (!auth.isAuthenticated) return;
    if (willBeFavorite) {
      auth.addFavorite(id, resolveTrackMeta(id)).catch(() => {
        engine.pushToast('Gagal menyimpan favorit ke server.', 'error');
      });
    } else {
      auth.removeFavorite(id).catch(() => {
        engine.pushToast('Gagal menghapus favorit di server.', 'error');
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, auth.isAuthenticated, resolveTrackMeta]);

  // The first time a session becomes authenticated, pull favorites down
  // from the server and merge them with whatever's saved locally, pushing
  // any local-only favorites up so nothing gets lost.
  const favoritesSyncedRef = useRef(false);

useEffect(() => {
  if (auth.status !== 'authenticated') {
    favoritesSyncedRef.current = false;

    // Saat logout, bersihkan favorite dari state browser
    // supaya akun berikutnya tidak mewarisi favorite akun sebelumnya.
    engine.replaceFavorites([]);

    return;
  }

  if (favoritesSyncedRef.current) return;
  favoritesSyncedRef.current = true;

  (async () => {
    try {
      // Saat login, database akun tersebut adalah sumber utama.
      const serverFavorites = await auth.fetchFavorites();

      const serverIds = serverFavorites.map((f) => f.videoId);

      // Jangan merge dengan localStorage.
      // Favorite akun lain tidak boleh ikut terbawa.
      engine.replaceFavorites(serverIds);
    } catch {
      favoritesSyncedRef.current = false;
      engine.pushToast('Gagal mengambil favorit akun.', 'error');
    }
  })();
}, [auth.status]);

  // Presence heartbeat — lets other people see you as online and (if
  // you're playing something) what you're currently listening to. Pings
  // on a timer, plus right away whenever play state or the track changes.
  useEffect(() => {
    if (auth.status !== 'authenticated') return undefined;

    const sendPing = () => {
      auth.ping(
        engine.isPlaying && engine.videoId
          ? { videoId: engine.videoId, title: engine.title, artist: engine.artist }
          : { videoId: null, title: null, artist: null }
      );
    };

    sendPing();
    const interval = window.setInterval(sendPing, 25000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.status, engine.isPlaying, engine.videoId]);

  // Registers exactly one "play" per track start, for the monthly/yearly
  // listening stats on the profile page.
  const loggedPlayRef = useRef('');
  useEffect(() => {
    if (auth.status !== 'authenticated' || !engine.videoId) return;
    if (loggedPlayRef.current === engine.videoId) return;
    loggedPlayRef.current = engine.videoId;
    auth.logListening({ videoId: engine.videoId, title: engine.title, artist: engine.artist, secondsDelta: 0, isNewPlay: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.status, engine.videoId]);

  // Accumulates listening seconds in ~25s chunks. Deliberately a single
  // stable interval (not restarted on play/pause/track-change) so pausing
  // and resuming a lot doesn't cause the chunk window to keep resetting
  // and never firing — it just reads whatever's playing right now via ref.
  const engineRef = useRef(engine);
  engineRef.current = engine;
  useEffect(() => {
    if (auth.status !== 'authenticated') return undefined;
    const interval = window.setInterval(() => {
      const e = engineRef.current;
      if (e.isPlaying && e.videoId) {
        auth.logListening({ videoId: e.videoId, title: e.title, artist: e.artist, secondsDelta: 25, isNewPlay: false });
      }
    }, 25000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.status]);

  useEffect(() => {
    const onFsChange = () => { if (!document.fullscreenElement) setIsImmersive(false); };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return undefined;
    const onMove = (e) => {
      document.documentElement.style.setProperty('--cursor-x', `${e.clientX}px`);
      document.documentElement.style.setProperty('--cursor-y', `${e.clientY}px`);
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  useEffect(() => {
    if (engine.autoplayBlocked && !autoplayNoticeShown.current) {
      autoplayNoticeShown.current = true;
      engine.pushToast('Your browser blocked autoplay. Press play to start the music.', 'info');
    }
    if (!engine.autoplayBlocked) autoplayNoticeShown.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.autoplayBlocked]);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowInitialLoader(false), 2000);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const completed = localStorage.getItem('mixholic:onboarding-complete');
    if (completed) return undefined;
    const timer = window.setTimeout(() => setIsTutorialOpen(true), 2350);
    return () => window.clearTimeout(timer);
  }, []);

  // A password-reset email link lands here as "/?resetToken=…" — pick it
  // up, drop straight into the reset-password form, then clean the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('resetToken');
    if (!token) return;
    setResetToken(token);
    setAuthMode('reset');
    setIsAuthOpen(true);
    params.delete('resetToken');
    const nextSearch = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (nextSearch ? `?${nextSearch}` : ''));
  }, []);

  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName;
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA';
      if (e.key === '/' && !isTyping) {
        e.preventDefault();
        setIsLibraryOpen(true);
        window.setTimeout(() => searchInputRef.current?.focus(), 50);
        return;
      }
      if (isTyping) return;
      switch (e.key.toLowerCase()) {
        case ' ': e.preventDefault(); engine.togglePlay(); break;
        case 'arrowright': engine.next(); break;
        case 'arrowleft': engine.prev(); break;
        case 'arrowup': e.preventDefault(); engine.changeVolume((engine.isMuted ? 0 : engine.volume) + 5); break;
        case 'arrowdown': e.preventDefault(); engine.changeVolume((engine.isMuted ? 0 : engine.volume) - 5); break;
        case 'm': engine.toggleMute(); break;
        case 's': engine.toggleShuffle(); break;
        case 'r': engine.cycleRepeat(); break;
        case 'f': handleToggleFavorite(engine.videoId); break;
        case 'l': setIsLibraryOpen((v) => !v); break;
        case 'i': toggleImmersive(); break;
        case '?': setIsShortcutsOpen((v) => !v); break;
        case 'escape':
          setIsLoaderOpen(false); setIsLibraryOpen(false); setIsShortcutsOpen(false); setIsLyricsOpen(false); setIsShareOpen(false); setIsMobileMoreOpen(false); setIsAuthOpen(false); setIsUserMenuOpen(false); break;
        default: break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.isMuted, engine.volume, engine.videoId, toggleImmersive, handleToggleFavorite]);

  const statusLabel = !engine.isReady ? 'Cueing up…' : engine.isBuffering ? 'Buffering…' : engine.isPlaying ? 'Now playing' : 'Paused';

  const playVideo = useCallback((id) => {
    engine.loadVideo(id);
    setPage('player');
  }, [engine]);

  return (
    <>
      <InitialLoader isVisible={showInitialLoader} />
      <div className={`stage ${isImmersive ? 'stage--immersive' : ''} ${showInitialLoader ? 'stage--loading' : 'stage--entered'}`}>
        <AmbientField energized={engine.isPlaying} />
        <div className="stage__cursor-glow" aria-hidden="true" />

        <header className={`topbar ${isScrolled ? 'topbar--scrolled' : ''}`}>
          <button type="button" className="topbar__brand topbar__brand-button" onClick={() => setPage('home')} aria-label="Go home">
            <span className="topbar__mark" aria-hidden="true">◈</span>
            <span className="topbar__wordmark">Mixholic</span>
          </button>
          <nav className="topbar__nav" aria-label="Main navigation">
            <button type="button" className={page === 'home' ? 'is-active' : ''} onClick={() => setPage('home')}>Home</button>
            <button type="button" className={page === 'explore' ? 'is-active' : ''} onClick={() => openExplore()}>Explore</button>
            <button type="button" className={page === 'player' ? 'is-active' : ''} onClick={() => setPage('player')}>
              Player
              {engine.isPlaying && <LiveEqualizer />}
            </button>
            <button type="button" className={page === 'direct' ? 'is-active' : ''} onClick={openDirect}>
              <DirectGlyph /> Direct
              {direct.unreadTotal > 0 && <span className="nav-unread-dot">{direct.unreadTotal > 9 ? '9+' : direct.unreadTotal}</span>}
            </button>
          </nav>
          <div className="topbar__actions">
            <button type="button" className="topbar__search-button" onClick={() => openExplore()} aria-label="Search music"><SearchIcon /></button>
            <button
              type="button"
              ref={cueMagnet.elementRef}
              onMouseMove={cueMagnet.onMouseMove}
              onMouseLeave={cueMagnet.onMouseLeave}
              className="topbar__button topbar__button--cue"
              onClick={() => setIsLoaderOpen(true)}
            >
              Cue playlist
            </button>
            <button type="button" className="topbar__button topbar__button--icon" onClick={() => setIsLibraryOpen((v) => !v)} aria-label="Toggle library" title="Library (L)"><LibraryIcon /></button>
            <button type="button" className="topbar__button topbar__button--icon" onClick={() => setIsTutorialOpen(true)} aria-label="Replay tutorial"><TutorialIcon /></button>
            <button type="button" className="topbar__button topbar__button--icon topbar__shortcuts" onClick={() => setIsShortcutsOpen(true)} aria-label="Keyboard shortcuts">?</button>
            <button type="button" className="topbar__button topbar__button--icon" onClick={toggleImmersive} aria-label="Toggle immersive mode"><ImmersiveIcon active={isImmersive} /></button>
            {auth.isAuthenticated ? (
              <div className="user-chip">
                <button
                  type="button"
                  className="user-chip__trigger"
                  onClick={() => setIsUserMenuOpen((v) => !v)}
                  aria-expanded={isUserMenuOpen}
                >
                  {auth.user?.avatarUrl ? (
                    <img className="user-chip__avatar user-chip__avatar--img" src={auth.user.avatarUrl} alt="" />
                  ) : (
                    <span className="user-chip__avatar">{auth.user?.username?.[0] || '?'}</span>
                  )}
                  {auth.user?.username}
                </button>
                {isUserMenuOpen && (
                  <div className="user-chip__menu" role="menu">
                    <span className="user-chip__menu-email">{auth.user?.email}</span>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { openProfile(auth.user.username); setIsUserMenuOpen(false); }}
                    >
                      Lihat profil
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { avatarInputRef.current?.click(); }}
                      disabled={isUploadingAvatar}
                    >
                      {isUploadingAvatar ? 'Mengupload…' : 'Ganti foto profil'}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { auth.logout(); setIsUserMenuOpen(false); engine.pushToast('Berhasil keluar.', 'info'); }}
                    >
                      Keluar
                    </button>
                  </div>
                )}
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="user-chip__avatar-input"
                  onChange={handleAvatarChange}
                />
              </div>
            ) : (
              <button type="button" className="topbar__button topbar__button--auth" onClick={() => { setAuthMode('login'); setIsAuthOpen(true); }}>
                Masuk
              </button>
            )}
            <button type="button" className="topbar__button topbar__button--icon topbar__mobile-more" onClick={() => setIsMobileMoreOpen((v) => !v)} aria-label="More options" aria-expanded={isMobileMoreOpen}>⋯</button>
          </div>
          {isMobileMoreOpen && (
  <div className="mobile-more" role="menu">
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        setIsLoaderOpen(true);
        setIsMobileMoreOpen(false);
      }}
    >
      Cue playlist
    </button>

    <button
      type="button"
      role="menuitem"
      onClick={() => {
        setIsTutorialOpen(true);
        setIsMobileMoreOpen(false);
      }}
    >
      Help & tutorial
    </button>

    <button
      type="button"
      role="menuitem"
      onClick={() => {
        toggleImmersive();
        setIsMobileMoreOpen(false);
      }}
    >
      Fullscreen
    </button>

    {auth.isAuthenticated && (
      <>
        <div className="mobile-more__divider" />

        <button
          type="button"
          role="menuitem"
          className="mobile-more__logout"
          onClick={() => {
            auth.logout();
            setIsMobileMoreOpen(false);
            engine.pushToast('Berhasil keluar.', 'info');
          }}
        >
          Keluar
        </button>
      </>
    )}
  </div>
)}
        </header>

        {createPortal(
          <div className="mobile-sticky-dock">
            {page !== 'player' && !isLibraryOpen && !isMobileMoreOpen && (
              <MobileMiniPlayer
                title={engine.title}
                artist={engine.artist}
                videoId={engine.videoId || engine.playlistVideoIds[engine.index] || ''}
                isPlaying={engine.isPlaying}
                isReady={engine.isReady}
                currentTime={engine.currentTime}
                duration={engine.duration}
                onOpen={() => { setPage('player'); }}
                onTogglePlay={engine.togglePlay}
                onNext={engine.next}
              />
            )}

            <MobileBottomNav
              page={page}
              isLibraryOpen={isLibraryOpen}
              unreadCount={direct.unreadTotal}
              onHome={() => setPage('home')}
              onExplore={() => openExplore()}
              onPlayer={() => setPage('player')}
              onLibrary={() => setIsLibraryOpen((v) => !v)}
              onDirect={openDirect}
            />
          </div>,
          document.body,
        )}

        <div className="mobile-page-scroll">
        {page === 'home' && (
          <HomeView
            engine={engine}
            metadata={metadata}
            username={auth.user?.username}
            onPlay={playVideo}
            onExplore={() => openExplore()}
            onShare={async () => {
  if (auth.isAuthenticated) {
    await direct.refreshThreads();
  }
  setIsShareOpen(true);
}}
          />
        )}

        {page === 'explore' && (
          <SearchView
            initialQuery={searchQuery}
            onPlayVideo={playVideo}
            onLoadPlaylist={loadPlaylistAndPlay}
            onOpenArtist={openArtist}
          />
        )}

        {page === 'artist' && (
          <ArtistView
            artistName={selectedArtist}
            onPlay={playVideo}
            onLoadPlaylist={loadPlaylistAndPlay}
            onBack={() => openExplore(selectedArtist)}
            onToast={engine.pushToast}
          />
        )}

        {page === 'direct' && auth.isAuthenticated && (
          <DirectView
            direct={direct}
            currentUsername={auth.user?.username}
            nowPlaying={engine.videoId ? {
              videoId: engine.videoId,
              title: engine.title,
              artist: engine.artist,
              thumb: `https://i.ytimg.com/vi/${engine.videoId}/mqdefault.jpg`,
            } : null}
            onPlaySong={playVideo}
            onToast={engine.pushToast}
            onOpenProfile={openProfile}
          />
        )}

        {page === 'profile' && (
          <ProfileView
            username={selectedProfileUsername}
            auth={auth}
            onPlay={playVideo}
            onPlayQueue={playQueue}
            onBack={() => setPage('home')}
            onOpenProfile={openProfile}
            onOpenPlaylist={openPlaylist}
            onToast={engine.pushToast}
            onFriendshipChanged={direct.refreshThreads}
          />
        )}

        {page === 'playlist' && (
          <PlaylistDetailView
            playlistId={selectedPlaylistId}
            auth={auth}
            onPlay={playQueue}
            onBack={() => (selectedProfileUsername ? openProfile(selectedProfileUsername) : setPage('home'))}
            onOpenProfile={openProfile}
            onToast={engine.pushToast}
          />
        )}

        {page === 'player' && (
          <main className="console-wrap">
            <section
              className={`console-card ${isLyricsOpen ? 'console-card--lyrics-open' : ''}`}
              ref={tilt.elementRef}
              onMouseMove={tilt.onMouseMove}
              onMouseLeave={tilt.onMouseLeave}
            >
              <div className="console-card__art-glow" style={engine.videoId ? { backgroundImage: `url(https://i.ytimg.com/vi/${engine.videoId}/hqdefault.jpg)` } : undefined} aria-hidden="true" />
              <div className="console-card__player">
                <div className="console">
                  <VinylDisc isPlaying={engine.isPlaying} isBuffering={!engine.isReady || engine.isBuffering} videoId={engine.videoId} title={engine.title} />
                  <div className="console__info">
                    <p className="console__eyebrow">{statusLabel}</p>
                    <h1 className="console__title" title={engine.title}>{engine.title}</h1>
                    <p className="console__artist">{engine.artist}</p>
                    {engine.total > 0 && <p className="console__track-count">Track {engine.index + 1} of {engine.total}</p>}
                  </div>
                  <Visualizer isPlaying={engine.isPlaying} />
                  <ProgressBar currentTime={engine.currentTime} duration={engine.duration} onSeek={engine.seek} disabled={!engine.isReady} />
                  <TransportControls
                    isPlaying={engine.isPlaying}
                    isReady={engine.isReady}
                    shuffle={engine.shuffle}
                    repeatMode={engine.repeatMode}
                    isFavorite={engine.isFavorite(engine.videoId)}
                    onTogglePlay={engine.togglePlay}
                    onNext={engine.next}
                    onPrev={engine.prev}
                    onToggleShuffle={engine.toggleShuffle}
                    onCycleRepeat={engine.cycleRepeat}
                    onToggleFavorite={() => handleToggleFavorite(engine.videoId)}
                  />
                  <div className="player-extra-actions">
  <button
    type="button"
    className="player-extra-action"
    onClick={() => setIsLyricsOpen((v) => !v)}
  >
    <span>♪</span> Lyrics
  </button>

  <button
    type="button"
    className="player-extra-action"
    onClick={openSaveToPlaylist}
    disabled={!engine.videoId}
  >
    <span>＋</span> Playlist
  </button>

  <button
    type="button"
    className="player-extra-action"
    onClick={() => setIsShareOpen(true)}
    disabled={!engine.videoId}
  >
    <span>↗</span> Share
  </button>
</div>
                  <VolumeControl volume={engine.volume} isMuted={engine.isMuted} onChange={engine.changeVolume} onToggleMute={engine.toggleMute} />
                </div>
              </div>
              {isLyricsOpen && (
                <button type="button" className="lyrics-backdrop" onClick={() => setIsLyricsOpen(false)} aria-label="Close lyrics" />
              )}
              <div className={`console-card__lyrics ${isLyricsOpen ? 'is-open' : ''}`}>
                <LyricsPanel title={engine.title} artist={engine.artist} currentTime={engine.currentTime} onSeek={engine.seek} mobile onClose={() => setIsLyricsOpen(false)} />
              </div>
            </section>
          </main>
        )}

        </div>

        {createPortal(
          <LibraryPanel
            isOpen={isLibraryOpen}
            onClose={() => setIsLibraryOpen(false)}
            total={engine.total}
            index={engine.index}
            titleCache={engine.titleCache}
            playlistVideoIds={engine.playlistVideoIds}
            metadata={metadata}
            favorites={engine.favorites}
            onToggleFavorite={handleToggleFavorite}
            onJump={(i) => { engine.jumpTo(i); setPage('player'); setIsLibraryOpen(false); }}
            searchInputRef={searchInputRef}
          />,
          document.body,
        )}

        <PlaylistLoader isOpen={isLoaderOpen} onClose={() => setIsLoaderOpen(false)} onLoad={(value) => { engine.loadPlaylist(value); setPage('player'); }} recentPlaylists={engine.recentPlaylists} />
        <ShortcutsHint isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />
        <OnboardingTutorial isOpen={isTutorialOpen} onClose={() => setIsTutorialOpen(false)} />
        <ShareModal
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
          title={engine.title}
          artist={engine.artist}
          videoId={engine.videoId}
          onToast={engine.pushToast}
          isAuthenticated={auth.isAuthenticated}
          friends={direct.threads}
          onSendToFriend={direct.sendSongTo}
          onLoginRequired={() => { setAuthMode('login'); setIsAuthOpen(true); }}
        />

{isPlaylistSaveOpen && (
  <div
    className="playlist-save-overlay"
    onClick={() => setIsPlaylistSaveOpen(false)}
  >
    <div
      className="playlist-save-modal"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="playlist-save-close"
        onClick={() => setIsPlaylistSaveOpen(false)}
        aria-label="Close"
      >
        ×
      </button>

      <div className="playlist-save-eyebrow">SAVE TRACK</div>

      <h2>Simpan ke playlist</h2>

      <p>{engine.title || 'Lagu ini'}</p>

      {isLoadingSavePlaylists ? (
        <div className="playlist-save-state">
          Memuat playlist...
        </div>
      ) : savePlaylists.length === 0 ? (
        <div className="playlist-save-state">
          Belum ada playlist.
        </div>
      ) : (
        <div className="playlist-save-list">
          {savePlaylists.map((playlist) => (
            <button
              key={playlist.id}
              type="button"
              className="playlist-save-item"
              onClick={() => saveCurrentTrackToPlaylist(playlist.id)}
            >
              <span className="playlist-save-item__icon">♫</span>

              <span className="playlist-save-item__text">
                <strong>{playlist.name}</strong>
                <small>{playlist.trackCount || 0} lagu</small>
              </span>

              <span className="playlist-save-item__arrow">›</span>
            </button>
          ))}
        </div>
      )}
    </div>
  </div>
)}

<AuthModal
  // ...
/>
        <AuthModal
          isOpen={isAuthOpen}
          onClose={() => { setIsAuthOpen(false); setAuthMode('login'); setResetToken(null); }}
          auth={auth}
          onToast={engine.pushToast}
          initialMode={authMode}
          resetToken={resetToken}
        />
        <ToastStack toasts={engine.toasts} />

        <div className="yt-host" aria-hidden="true">
          <YouTube
            opts={{ width: '100', height: '100', playerVars: { listType: 'playlist', list: engine.playlistId, autoplay: 1, controls: 0, playsinline: 1, enablejsapi: 1, origin: window.location.origin } }}
            onReady={engine.onReady}
            onStateChange={engine.onStateChange}
            onError={engine.onError}
          />
        </div>
      </div>
    </>
  );
}


function MobileMiniPlayer({ title, artist, videoId, isPlaying, isReady, currentTime, duration, onOpen, onTogglePlay, onNext }) {
  const progress = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const hasArtwork = Boolean(videoId);
  return (
    <section className="mobile-mini-player" aria-label="Now playing">
      <button type="button" className="mobile-mini-player__main" onClick={onOpen} aria-label="Open full player">
        <span className={`mobile-mini-player__art ${hasArtwork ? '' : 'is-placeholder'}`}>
          {hasArtwork ? <img src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`} alt="" /> : <span className="mobile-mini-player__placeholder">◇</span>}
        </span>
        <span className="mobile-mini-player__copy">
          <strong title={title}>{title || 'Unknown track'}</strong>
          <span>{artist || 'Mixholic'}</span>
        </span>
      </button>
      <button type="button" className="mobile-mini-player__action" onClick={onTogglePlay} disabled={!isReady} aria-label={isPlaying ? 'Pause' : 'Play'}>
        {isPlaying ? <PauseGlyph /> : <PlayGlyph />}
      </button>
      <button type="button" className="mobile-mini-player__action mobile-mini-player__next" onClick={onNext} aria-label="Next track">
        <NextGlyph />
      </button>
      <span className="mobile-mini-player__progress" aria-hidden="true"><span style={{ width: `${progress}%` }} /></span>
    </section>
  );
}

function MobileBottomNav({ page, isLibraryOpen, unreadCount, onHome, onExplore, onPlayer, onLibrary, onDirect }) {
  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
      <button type="button" className={page === 'home' ? 'is-active' : ''} onClick={onHome} aria-label="Home">
        <span className="mobile-bottom-nav__icon"><HomeGlyph /></span><span>Home</span>
      </button>
      <button type="button" className={page === 'explore' ? 'is-active' : ''} onClick={onExplore} aria-label="Explore">
        <span className="mobile-bottom-nav__icon"><SearchIcon /></span><span>Explore</span>
      </button>
      <button type="button" className={page === 'player' ? 'is-active' : ''} onClick={onPlayer} aria-label="Player">
        <span className="mobile-bottom-nav__icon"><PlayerGlyph /></span><span>Player</span>
      </button>
      <button type="button" className={page === 'direct' ? 'is-active' : ''} onClick={onDirect} aria-label="Direct">
        <span className="mobile-bottom-nav__icon">
          <DirectGlyph />
          {unreadCount > 0 && <span className="mobile-bottom-nav__dot" />}
        </span><span>Direct</span>
      </button>
      <button type="button" className={isLibraryOpen ? 'is-active' : ''} onClick={onLibrary} aria-label="Library">
        <span className="mobile-bottom-nav__icon"><LibraryGlyph /></span><span>Library</span>
      </button>
    </nav>
  );
}

function PlayGlyph() { return <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5.5v13l11-6.5z" /></svg>; }
function PauseGlyph() { return <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M7 5h4v14H7zM13 5h4v14h-4z" /></svg>; }
function NextGlyph() { return <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M16 5h2v14h-2zM5 6.4L14.5 12 5 17.6z" /></svg>; }
function HomeGlyph() { return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3.8 10.6 12 4l8.2 6.6" /><path d="M5.7 9.7v9.5h12.6V9.7" /><path d="M9.5 19.2v-5.3h5v5.3" /></svg>; }
function PlayerGlyph() { return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8.3" /><path d="m10 8.5 5.2 3.5-5.2 3.5z" fill="currentColor" stroke="none" /></svg>; }
function LibraryGlyph() { return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4h12v16H5z" /><path d="M8 4V2.8h11v16.4H17" /><path d="M8.5 9h5M8.5 13h5M8.5 17h3" /></svg>; }
function DirectGlyph() { return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5.5h16v11H9.5L5 20v-3.5H4z" /></svg>; }

function LiveEqualizer() {
  return (
    <span className="live-eq" aria-hidden="true">
      <span /><span /><span />
    </span>
  );
}

function SearchIcon() { return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.3-4.3" /></svg>; }
function LibraryIcon() { return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 6h12M4 12h16M4 18h9" /></svg>; }
function TutorialIcon() { return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8.4" /><path d="M12 16.4v.01" /><path d="M9.6 9.6a2.4 2.4 0 1 1 3.4 2.18c-.72.36-1 .84-1 1.62" /></svg>; }
function ImmersiveIcon({ active }) { return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{active ? <path d="M9 4H5v4M15 4h4v4M9 20H5v-4M15 20h4v-4" /> : <path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" />}</svg>; }
