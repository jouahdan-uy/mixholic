import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'Mixholic.player.v1';
const FAVORITES_KEY = 'Mixholic.favorites.v1';
const RESUME_KEY = 'Mixholic.resume.v1';
const DEFAULT_PLAYLIST_ID = 'PLHTTPpLYCllE';
const RESUME_MIN_SECONDS = 8; // don't bother resuming a track that barely started

function loadPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function savePrefs(patch) {
  try {
    const current = loadPrefs();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...patch }));
  } catch {
    /* storage unavailable — silently ignore */
  }
}

function loadFavorites() {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveFavorites(set) {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([...set]));
  } catch {
    /* storage unavailable — silently ignore */
  }
}

function loadResume() {
  try {
    const raw = localStorage.getItem(RESUME_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveResume(patch) {
  try {
    localStorage.setItem(RESUME_KEY, JSON.stringify(patch));
  } catch {
    /* storage unavailable — silently ignore */
  }
}

// Pulls the `list=` param out of a pasted YouTube / YouTube Music URL,
// or falls back to treating the input as a raw playlist ID.
export function extractPlaylistId(urlOrId) {
  const trimmed = (urlOrId || '').trim();
  if (!trimmed) return '';
  try {
    if (trimmed.includes('list=')) {
      const query = trimmed.split('?')[1] || '';
      const params = new URLSearchParams(query);
      return params.get('list') || trimmed;
    }
    return trimmed;
  } catch {
    return trimmed;
  }
}

export default function usePlayerEngine() {
  const prefs = loadPrefs();
  const resumeOnLoad = useRef(loadResume());

  const [playlistId, setPlaylistId] = useState(prefs.playlistId || DEFAULT_PLAYLIST_ID);
  const [recentPlaylists, setRecentPlaylists] = useState(prefs.recentPlaylists || []);

  const [isReady, setIsReady] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  const [title, setTitle] = useState('Waiting for the needle to drop…');
  const [artist, setArtist] = useState('');
  const [videoId, setVideoId] = useState('');

  const [index, setIndex] = useState(0);
  const [total, setTotal] = useState(0);
  const [titleCache, setTitleCache] = useState({}); // { [playlistIndex]: {title, artist} }
  const [playlistVideoIds, setPlaylistVideoIds] = useState([]);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const [volume, setVolume] = useState(prefs.volume ?? 80);
  const [isMuted, setIsMuted] = useState(prefs.isMuted ?? false);

  const [shuffle, setShuffle] = useState(prefs.shuffle ?? false);
  const [repeatMode, setRepeatMode] = useState(prefs.repeatMode ?? 'all'); // off | all | one

  const [favorites, setFavorites] = useState(loadFavorites);

  const [toasts, setToasts] = useState([]);

  const playerRef = useRef(null);
  const pollRef = useRef(null);
  const autoplayTimerRef = useRef(null);
  const hasResumedRef = useRef(false);

  const pushToast = useCallback((message, tone = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((t) => [...t, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((t) => t.filter((toast) => toast.id !== id));
    }, 4200);
  }, []);

  const readTrackInfo = useCallback((player) => {
    try {
      const data = player.getVideoData();
      if (data && data.title) {
        setTitle(data.title);
        setArtist(data.author || 'Unknown artist');
        setVideoId(data.video_id || '');
      }
      const list = player.getPlaylist();
      if (Array.isArray(list)) {
        setTotal(list.length);
        setPlaylistVideoIds((prev) => {
          if (prev.length === list.length && prev.every((id, i) => id === list[i])) return prev;
          return list;
        });
      }

      const idx = player.getPlaylistIndex();
      if (typeof idx === 'number' && idx >= 0) {
        setIndex(idx);
        if (data && data.title) {
          setTitleCache((cache) => ({
            ...cache,
            [idx]: { title: data.title, artist: data.author || 'Unknown artist' },
          }));
        }
      }
      const dur = player.getDuration();
      if (typeof dur === 'number' && Number.isFinite(dur)) setDuration(dur);
    } catch {
      /* player not fully ready yet — ignore this tick */
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = window.setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      try {
        const t = player.getCurrentTime();
        if (typeof t === 'number') setCurrentTime(t);
        const d = player.getDuration();
        if (typeof d === 'number' && Number.isFinite(d) && d > 0) setDuration(d);
      } catch {
        /* ignore transient errors while buffering */
      }
    }, 400);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  // Periodically persist playback position so a reload can resume where the
  // listener left off. Cheap: piggybacks on the same interval as polling.
  useEffect(() => {
    if (!isReady) return undefined;
    const id = window.setInterval(() => {
      if (currentTime > RESUME_MIN_SECONDS && videoId) {
        saveResume({ playlistId, index, currentTime, videoId, savedAt: Date.now() });
      }
    }, 5000);
    return () => window.clearInterval(id);
  }, [isReady, playlistId, index, currentTime, videoId]);

  const onReady = useCallback(
    (event) => {
      const player = event.target;
      playerRef.current = player;
      setIsReady(true);
      setIsBuffering(false);
      try {
        player.setVolume(isMuted ? 0 : volume);
        player.setLoop(repeatMode === 'all');
        player.setShuffle(shuffle);
      } catch {
        /* first-load race — safe to ignore */
      }
      readTrackInfo(player);
      startPolling();

      // Detect a browser blocking autoplay: if playback never actually
      // starts a few seconds after the player says it's ready, surface a
      // clear, actionable message instead of a silently stuck UI.
      autoplayTimerRef.current = window.setTimeout(() => {
        try {
          if (player.getPlayerState && player.getPlayerState() !== 1) {
            setAutoplayBlocked(true);
          }
        } catch {
          /* ignore */
        }
      }, 2500);
    },
    [isMuted, volume, repeatMode, shuffle, readTrackInfo, startPolling]
  );

  const onStateChange = useCallback(
    (event) => {
      const player = event.target;
      const state = event.data;
      // -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued
      if (state === 1) {
        setIsPlaying(true);
        setIsBuffering(false);
        setAutoplayBlocked(false);
        if (autoplayTimerRef.current) window.clearTimeout(autoplayTimerRef.current);

        // Resume mid-track position once, only for the playlist we saved it for.
        const resume = resumeOnLoad.current;
        if (
          resume &&
          !hasResumedRef.current &&
          resume.playlistId === playlistId &&
          resume.videoId
        ) {
          hasResumedRef.current = true;
          try {
            const currentData = player.getVideoData();
            if (currentData?.video_id === resume.videoId && resume.currentTime > RESUME_MIN_SECONDS) {
              player.seekTo(resume.currentTime, true);
            }
          } catch {
            /* not critical — just skip resuming */
          }
        }
        readTrackInfo(player);
      } else if (state === 2) {
        setIsPlaying(false);
      } else if (state === 3) {
        setIsBuffering(true);
        readTrackInfo(player);
      } else if (state === 0) {
        if (repeatMode === 'one') {
          player.seekTo(0, true);
          player.playVideo();
        }
      } else if (state === 5) {
        setIsBuffering(false);
        readTrackInfo(player);
      }
    },
    [repeatMode, readTrackInfo, playlistId]
  );

  const onError = useCallback(
    (event) => {
      const messages = {
        2: 'That playlist link looks malformed — double-check the URL.',
        5: 'This track cannot play in the embedded player.',
        100: 'That playlist or video could not be found.',
        101: 'The owner of this track has disabled embedded playback.',
        150: 'The owner of this track has disabled embedded playback.',
      };
      pushToast(messages[event.data] || 'Playback hit a snag — trying to recover.', 'error');
    },
    [pushToast]
  );

  const loadPlaylist = useCallback(
    (rawInput) => {
      const id = extractPlaylistId(rawInput);
      if (!id) {
        pushToast('Paste a YouTube or YouTube Music playlist link first.', 'error');
        return;
      }
      hasResumedRef.current = id === playlistId ? hasResumedRef.current : false;
      setPlaylistId(id);
      setIsReady(false);
      setIsBuffering(true);
      setIsPlaying(false);
      setAutoplayBlocked(false);
      setTitle('Cueing up the playlist…');
      setArtist('');
      setTitleCache({});
      setPlaylistVideoIds([]);
      setCurrentTime(0);
      setDuration(0);

      setRecentPlaylists((prev) => {
        const next = [id, ...prev.filter((p) => p !== id)].slice(0, 5);
        savePrefs({ recentPlaylists: next });
        return next;
      });
      savePrefs({ playlistId: id });

      if (playerRef.current) {
        try {
          playerRef.current.loadPlaylist({ listType: 'playlist', list: id, index: 0 });
        } catch {
          pushToast('Could not load that playlist. Try again in a moment.', 'error');
        }
      }
    },
    [pushToast, playlistId]
  );

  const loadVideo = useCallback((id) => {
    if (!id) return;
    const player = playerRef.current;
    if (!player) {
      pushToast('Player is still warming up. Try again in a moment.', 'info');
      return;
    }
    try {
      player.loadVideoById(id);
      setIsBuffering(true);
      setIsPlaying(true);
      setCurrentTime(0);
      setDuration(0);
    } catch {
      pushToast('Could not start that track.', 'error');
    }
  }, [pushToast]);

  // Plays an arbitrary list of video IDs as a queue — used for custom
  // playlists and the "mix your songs with theirs" feature, neither of
  // which map to a real YouTube playlist ID.
  const playQueue = useCallback((videoIds, label = 'Custom queue') => {
    const ids = (videoIds || []).filter(Boolean);
    if (ids.length === 0) {
      pushToast('Gak ada lagu buat diputer di sini.', 'error');
      return;
    }
    const player = playerRef.current;
    if (!player) {
      pushToast('Player is still warming up. Try again in a moment.', 'info');
      return;
    }
    hasResumedRef.current = false;
    setPlaylistId('');
    setIsReady(false);
    setIsBuffering(true);
    setIsPlaying(false);
    setAutoplayBlocked(false);
    setTitle(label);
    setArtist('');
    setTitleCache({});
    setPlaylistVideoIds(ids);
    setCurrentTime(0);
    setDuration(0);
    try {
      player.loadPlaylist(ids, 0);
    } catch {
      pushToast('Gagal muter antrian ini.', 'error');
    }
  }, [pushToast]);

  const togglePlay = useCallback(() => {
    const player = playerRef.current;
    if (!isReady || !player) return;
    if (isPlaying) player.pauseVideo();
    else player.playVideo();
    setAutoplayBlocked(false);
  }, [isReady, isPlaying]);

  const next = useCallback(() => playerRef.current?.nextVideo(), []);
  const prev = useCallback(() => playerRef.current?.previousVideo(), []);
  const jumpTo = useCallback((i) => playerRef.current?.playVideoAt(i), []);

  const seek = useCallback((seconds) => {
    playerRef.current?.seekTo(seconds, true);
    setCurrentTime(seconds);
  }, []);

  const toggleShuffle = useCallback(() => {
    setShuffle((prevState) => {
      const nextState = !prevState;
      playerRef.current?.setShuffle(nextState);
      savePrefs({ shuffle: nextState });
      return nextState;
    });
  }, []);

  const cycleRepeat = useCallback(() => {
    setRepeatMode((prevMode) => {
      const order = ['off', 'all', 'one'];
      const nextMode = order[(order.indexOf(prevMode) + 1) % order.length];
      playerRef.current?.setLoop(nextMode === 'all');
      savePrefs({ repeatMode: nextMode });
      return nextMode;
    });
  }, []);

  const changeVolume = useCallback((v) => {
    const clamped = Math.min(100, Math.max(0, Math.round(v)));
    setVolume(clamped);
    setIsMuted(clamped === 0);
    playerRef.current?.setVolume(clamped);
    savePrefs({ volume: clamped, isMuted: clamped === 0 });
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prevMuted) => {
      const nextMuted = !prevMuted;
      const player = playerRef.current;
      if (player) {
        if (nextMuted) player.mute();
        else {
          player.unMute();
          player.setVolume(volume || 60);
        }
      }
      savePrefs({ isMuted: nextMuted });
      return nextMuted;
    });
  }, [volume]);

  const toggleFavorite = useCallback((id) => {
    if (!id) return;
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveFavorites(next);
      return next;
    });
  }, []);

  const isFavorite = useCallback((id) => favorites.has(id), [favorites]);

  // Wholesale-replace the favorites set — used after login, once the
  // server's list has been fetched (and merged with any local-only ones).
  const replaceFavorites = useCallback((ids) => {
    const next = new Set(ids);
    saveFavorites(next);
    setFavorites(next);
  }, []);

  useEffect(() => {
    if (!('mediaSession' in navigator) || !videoId) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: title || 'Mixholic',
        artist: artist || 'Unknown artist',
        album: 'Mixholic',
        artwork: [
          { src: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, sizes: '480x360', type: 'image/jpeg' },
        ],
      });
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    } catch {
      /* Media Session is optional. */
    }
  }, [videoId, title, artist, isPlaying]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const actions = {
      play: togglePlay,
      pause: togglePlay,
      nexttrack: next,
      previoustrack: prev,
      seekbackward: () => seek(Math.max(0, currentTime - 10)),
      seekforward: () => seek(Math.min(duration || currentTime + 10, currentTime + 10)),
    };
    Object.entries(actions).forEach(([action, handler]) => {
      try { navigator.mediaSession.setActionHandler(action, handler); } catch { /* unsupported action */ }
    });
    return () => Object.keys(actions).forEach((action) => {
      try { navigator.mediaSession.setActionHandler(action, null); } catch { /* ignore */ }
    });
  }, [togglePlay, next, prev, seek, currentTime, duration]);

  return {
    playlistId,
    recentPlaylists,
    isReady,
    isBuffering,
    isPlaying,
    autoplayBlocked,
    title,
    artist,
    videoId,
    index,
    total,
    titleCache,
    playlistVideoIds,
    currentTime,
    duration,
    volume,
    isMuted,
    shuffle,
    repeatMode,
    favorites,
    toggleFavorite,
    isFavorite,
    replaceFavorites,
    toasts,
    pushToast,
    onReady,
    onStateChange,
    onError,
    loadPlaylist,
    loadVideo,
    playQueue,
    togglePlay,
    next,
    prev,
    jumpTo,
    seek,
    toggleShuffle,
    cycleRepeat,
    changeVolume,
    toggleMute,
  };
}
