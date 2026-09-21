import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { apiRequest } from '../lib/api';

// Where the real-time server (server/socket.ts) lives — separate port from
// the REST API, see the backend README for why.
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

// Direct messages, real-time: connects one Socket.IO session for the whole
// app (call this once, near the top — e.g. in App.jsx — and pass the
// pieces down as props), keeps the friend list + unread counts live, and
// exposes send/read actions that go straight over the socket instead of
// REST. History (GET /api/dm/threads, GET /api/dm/:username/messages)
// still comes from the REST API — sockets are for anything that needs to
// update *while the app is open*, not for the initial fetch.
export default function useDirectSocket(token, { onToast } = {}) {
  const socketRef = useRef(null);
  const activeUsernameRef = useRef(null);

  const [isConnected, setIsConnected] = useState(false);
  const [threads, setThreads] = useState([]);
  const [threadsLoading, setThreadsLoading] = useState(false);

  const [activeUsername, setActiveUsername] = useState(null);
  const [activeFriend, setActiveFriend] = useState(null);
  const [activeStreak, setActiveStreak] = useState({ count: 0, isActive: false });
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  useEffect(() => { activeUsernameRef.current = activeUsername; }, [activeUsername]);

  const refreshThreads = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiRequest('/api/dm/threads', { token });
      setThreads(data.threads || []);
    } catch {
      /* silent — next resync (reconnect, next open) will catch up */
    }
  }, [token]);

  const bumpThreadPreview = useCallback((username, patch) => {
    setThreads((prev) => {
      const idx = prev.findIndex((t) => t.username === username);
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch(next[idx]) };
      next.unshift(next.splice(idx, 1)[0]); // most recently active thread first
      return next;
    });
  }, []);

  // One socket connection for as long as we're logged in. Auto-reconnects
  // on its own (that's just how socket.io works); we resync the thread
  // list on every (re)connect in case something happened while offline.
  useEffect(() => {
    if (!token) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      setThreads([]);
      return undefined;
    }

    const socket = io(SOCKET_URL, { auth: { token } });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      refreshThreads();
    });
    socket.on('disconnect', () => setIsConnected(false));

    socket.on('message:new', (msg) => {
      const viewingThisThread = activeUsernameRef.current === msg.fromUsername;

      if (viewingThisThread) {
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        setActiveStreak(msg.streak);
        socket.emit('message:read', { withUsername: msg.fromUsername });
      } else if (!msg.isMine) {
        onToast?.(
          msg.type === 'SONG' ? `${msg.fromUsername} ngirim lagu 🎵 ${msg.videoTitle || ''}` : `${msg.fromUsername}: ${msg.text}`,
          'info'
        );
      }

      bumpThreadPreview(msg.fromUsername, (thread) => ({
        streak: msg.streak,
        lastMessage: { type: msg.type, text: msg.text, videoTitle: msg.videoTitle, isMine: msg.isMine, createdAt: msg.createdAt },
        unreadCount: viewingThisThread || msg.isMine ? 0 : (thread.unreadCount || 0) + 1,
      }));
    });

    socket.on('thread:read', ({ username }) => {
      setThreads((prev) => prev.map((t) => (t.username === username ? { ...t, unreadCount: 0 } : t)));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, refreshThreads, bumpThreadPreview, onToast]);

  useEffect(() => {
    if (!token) return;
    setThreadsLoading(true);
    refreshThreads().finally(() => setThreadsLoading(false));
  }, [token, refreshThreads]);

  const openThread = useCallback(async (username) => {
    setActiveUsername(username);
    setMessages([]);
    setActiveFriend(null);
    setMessagesLoading(true);
    try {
      const data = await apiRequest(`/api/dm/${username}/messages`, { token });
      setActiveFriend(data.friend);
      setActiveStreak(data.streak);
      setMessages(data.messages || []);
      setThreads((prev) => prev.map((t) => (t.username === username ? { ...t, unreadCount: 0 } : t)));
      socketRef.current?.emit('message:read', { withUsername: username });
    } catch (err) {
      onToast?.(err.message || 'Gagal buka chat.', 'error');
    } finally {
      setMessagesLoading(false);
    }
  }, [token, onToast]);

  const closeThread = useCallback(() => {
    setActiveUsername(null);
    setMessages([]);
  }, []);

  // Low-level sender — always goes over the socket, to whichever username
  // is passed in. Updates the open thread's messages ONLY when the reply
  // is for the thread currently open (so sending a song to someone from
  // outside the chat, e.g. the player's Share sheet, doesn't dump it into
  // whatever conversation happens to be open).
  const sendViaSocket = useCallback((to, payload) => new Promise((resolve, reject) => {
    const socket = socketRef.current;
    if (!socket || !isConnected) return reject(new Error('Belum konek ke server real-time. Coba sebentar lagi.'));
    if (!to) return reject(new Error('Belum ada chat yang dibuka.'));

    socket.emit('message:send', { to, ...payload }, (res) => {
      if (!res?.ok) return reject(new Error(res?.error || 'Gagal ngirim pesan.'));
      if (activeUsernameRef.current === to) {
        setMessages((prev) => (prev.some((m) => m.id === res.message.id) ? prev : [...prev, res.message]));
        setActiveStreak(res.streak);
      }
      bumpThreadPreview(to, () => ({
        streak: res.streak,
        lastMessage: { type: res.message.type, text: res.message.text, videoTitle: res.message.videoTitle, isMine: true, createdAt: res.message.createdAt },
        unreadCount: 0,
      }));
      resolve(res.message);
    });
  }), [isConnected, bumpThreadPreview]);

  const sendText = useCallback((text) => sendViaSocket(activeUsernameRef.current, { type: 'TEXT', text }), [sendViaSocket]);
  const sendSong = useCallback((song) => sendViaSocket(activeUsernameRef.current, {
    type: 'SONG',
    videoId: song.videoId,
    videoTitle: song.title,
    videoArtist: song.artist,
    videoThumb: song.thumb,
  }), [sendViaSocket]);

  // Same as sendSong, but for sharing a track to a friend from anywhere in
  // the app (e.g. the player's Share sheet) without needing their thread
  // open first.
  const sendSongTo = useCallback((username, song) => sendViaSocket(username, {
    type: 'SONG',
    videoId: song.videoId,
    videoTitle: song.title,
    videoArtist: song.artist,
    videoThumb: song.thumb,
  }), [sendViaSocket]);

  const unreadTotal = useMemo(
    () => threads.reduce((sum, t) => sum + (t.unreadCount || 0), 0),
    [threads]
  );

  return {
    isConnected,
    threads,
    threadsLoading,
    unreadTotal,
    activeUsername,
    activeFriend,
    activeStreak,
    messages,
    messagesLoading,
    openThread,
    closeThread,
    sendText,
    sendSong,
    sendSongTo,
    refreshThreads,
  };
}
