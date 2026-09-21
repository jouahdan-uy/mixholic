import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest, API_BASE } from '../lib/api';

const TOKEN_KEY = 'Mixholic.auth.token.v1';

function loadToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

// remember=true -> survives browser restarts (localStorage).
// remember=false -> cleared when the tab closes (sessionStorage).
function persistToken(token, remember = true) {
  try {
    if (!token) {
      localStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
      return;
    }
    if (remember) {
      localStorage.setItem(TOKEN_KEY, token);
      sessionStorage.removeItem(TOKEN_KEY);
    } else {
      sessionStorage.setItem(TOKEN_KEY, token);
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    /* storage unavailable — session-only auth is fine */
  }
}

// Manages sign up / login / session state, plus thin wrappers around the
// favorites endpoints (all of which need the current token).
export default function useAuth() {
  const [token, setToken] = useState(loadToken);
  const [user, setUser] = useState(null);
  // 'guest' | 'loading' | 'authenticated'
  const [status, setStatus] = useState(loadToken() ? 'loading' : 'guest');

  useEffect(() => {
    if (!token) {
      setStatus('guest');
      setUser(null);
      return undefined;
    }
    let cancelled = false;
    setStatus('loading');
    apiRequest('/api/auth/me', { token })
      .then((data) => {
        if (cancelled) return;
        setUser(data.user);
        setStatus('authenticated');
      })
      .catch(() => {
        if (cancelled) return;
        persistToken('');
        setToken('');
        setUser(null);
        setStatus('guest');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const signup = useCallback(async ({ email, username, password, gender }) => {
    const data = await apiRequest('/api/auth/signup', {
      method: 'POST',
      body: { email, username, password, gender },
    });
    persistToken(data.token, true);
    setToken(data.token);
    setUser(data.user);
    setStatus('authenticated');
    return data.user;
  }, []);

  const login = useCallback(async ({ identifier, password, remember = true }) => {
    const data = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: { identifier, password },
    });
    persistToken(data.token, remember);
    setToken(data.token);
    setUser(data.user);
    setStatus('authenticated');
    return data.user;
  }, []);

  const logout = useCallback(() => {
    persistToken('');
    setToken('');
    setUser(null);
    setStatus('guest');
  }, []);

  const forgotPassword = useCallback(
    (email) => apiRequest('/api/auth/forgot-password', { method: 'POST', body: { email } }),
    []
  );

  const resetPassword = useCallback(
    ({ token: resetToken, password }) =>
      apiRequest('/api/auth/reset-password', { method: 'POST', body: { token: resetToken, password } }),
    []
  );

  const uploadAvatar = useCallback(async (file) => {
    const form = new FormData();
    form.append('avatar', file);
    const res = await fetch(`${API_BASE}/api/auth/avatar`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Upload gagal (${res.status})`);
    setUser(data.user);
    return data.user;
  }, [token]);

  const fetchFavorites = useCallback(
    () => apiRequest('/api/favorites', { token }).then((d) => d.favorites || []),
    [token]
  );

  const addFavorite = useCallback(
    (videoId, meta = {}) =>
      apiRequest('/api/favorites', { method: 'POST', token, body: { videoId, ...meta } }),
    [token]
  );

  const removeFavorite = useCallback(
    (videoId) => apiRequest(`/api/favorites/${encodeURIComponent(videoId)}`, { method: 'DELETE', token }),
    [token]
  );

  const syncFavorites = useCallback(
    (videoIds) => apiRequest('/api/favorites/sync', { method: 'POST', token, body: { videoIds } }),
    [token]
  );

  // Heartbeat — call every ~25s and on track change while the app is open.
  // Best-effort: failures (e.g. offline) are swallowed, since a missed
  // heartbeat just means the next one updates lastSeenAt a bit later.
  const ping = useCallback(
    (nowPlaying = {}) => {
      if (!token) return Promise.resolve();
      return apiRequest('/api/presence/ping', { method: 'POST', token, body: nowPlaying }).catch(() => {});
    },
    [token]
  );

  // Fire-and-forget listening log — called on a timer while a track plays.
  // Failures are swallowed so a flaky connection never interrupts playback.
  const logListening = useCallback(
    (entry) => {
      if (!token) return Promise.resolve();
      return apiRequest('/api/stats/log', { method: 'POST', token, body: entry }).catch(() => {});
    },
    [token]
  );

  const getStatsSummary = useCallback(
    ({ period = 'month', value } = {}) => {
      const params = new URLSearchParams({ period, ...(value ? { value } : {}) });
      return apiRequest(`/api/stats/summary?${params.toString()}`, { token });
    },
    [token]
  );

  const updateProfile = useCallback(
    async (updates) => {
      const data = await apiRequest('/api/auth/profile', { method: 'PATCH', token, body: updates });
      setUser(data.user);
      return data.user;
    },
    [token]
  );

  const searchUsers = useCallback(
    (q) => apiRequest(`/api/users/search?q=${encodeURIComponent(q)}`, { token }).then((d) => d.users || []),
    [token]
  );

  const getUserProfile = useCallback(
    (username) => apiRequest(`/api/users/${encodeURIComponent(username)}`, { token }).then((d) => d.user),
    [token]
  );

  const fetchFriends = useCallback(
    () => apiRequest('/api/friends', { token }).then((d) => d.friends || []),
    [token]
  );

  const fetchFriendRequests = useCallback(
    () => apiRequest('/api/friends/requests', { token }).then((d) => d.requests || []),
    [token]
  );

  const sendFriendRequest = useCallback(
    (username) => apiRequest('/api/friends/request', { method: 'POST', token, body: { username } }),
    [token]
  );

  const acceptFriendRequest = useCallback(
    (username) => apiRequest(`/api/friends/${encodeURIComponent(username)}/accept`, { method: 'POST', token }),
    [token]
  );

  const removeFriendship = useCallback(
    (username) => apiRequest(`/api/friends/${encodeURIComponent(username)}`, { method: 'DELETE', token }),
    [token]
  );

  const fetchPlaylists = useCallback(
    () => apiRequest('/api/playlists', { token }).then((d) => d.playlists || []),
    [token]
  );

  const createPlaylist = useCallback(
    (name) => apiRequest('/api/playlists', { method: 'POST', token, body: { name } }).then((d) => d.playlist),
    [token]
  );

  const getPlaylist = useCallback(
    (id) => apiRequest(`/api/playlists/${id}`, { token }).then((d) => d.playlist),
    [token]
  );

  const renamePlaylist = useCallback(
    (id, name) => apiRequest(`/api/playlists/${id}`, { method: 'PATCH', token, body: { name } }),
    [token]
  );

  const deletePlaylist = useCallback(
    (id) => apiRequest(`/api/playlists/${id}`, { method: 'DELETE', token }),
    [token]
  );

  const addTrackToPlaylist = useCallback(
    (id, track) => apiRequest(`/api/playlists/${id}/tracks`, { method: 'POST', token, body: track }),
    [token]
  );

  const removeTrackFromPlaylist = useCallback(
    (id, videoId) => apiRequest(`/api/playlists/${id}/tracks/${encodeURIComponent(videoId)}`, { method: 'DELETE', token }),
    [token]
  );

  return useMemo(() => ({
    user,
    status,
    token,
    isAuthenticated: status === 'authenticated',
    signup,
    login,
    logout,
    forgotPassword,
    resetPassword,
    uploadAvatar,
    updateProfile,
    searchUsers,
    getUserProfile,
    fetchFriends,
    fetchFriendRequests,
    sendFriendRequest,
    acceptFriendRequest,
    removeFriendship,
    fetchPlaylists,
    createPlaylist,
    getPlaylist,
    renamePlaylist,
    deletePlaylist,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    fetchFavorites,
    addFavorite,
    removeFavorite,
    syncFavorites,
    ping,
    logListening,
    getStatsSummary,
  }), [
    user,
    status,
    token,
    signup,
    login,
    logout,
    forgotPassword,
    resetPassword,
    uploadAvatar,
    updateProfile,
    searchUsers,
    getUserProfile,
    fetchFriends,
    fetchFriendRequests,
    sendFriendRequest,
    acceptFriendRequest,
    removeFriendship,
    fetchPlaylists,
    createPlaylist,
    getPlaylist,
    renamePlaylist,
    deletePlaylist,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    fetchFavorites,
    addFavorite,
    removeFavorite,
    syncFavorites,
    ping,
    logListening,
    getStatsSummary,
  ]);
}
