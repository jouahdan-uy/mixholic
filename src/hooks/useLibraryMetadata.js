import { useEffect, useRef, useState } from 'react';

const CACHE_PREFIX = 'Mixholic.oembed.';
const CONCURRENCY = 4;

function readCache(videoId) {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + videoId);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(videoId, data) {
  try {
    sessionStorage.setItem(CACHE_PREFIX + videoId, JSON.stringify(data));
  } catch {
    /* storage full or unavailable — fine, it's just a cache */
  }
}

// YouTube's oEmbed endpoint (https://www.youtube.com/oembed) is public,
// keyless and CORS-enabled, and returns a video's title + channel name
// (`author_name`) plus a thumbnail. It's the only way to get real metadata
// for an entire playlist client-side without a YouTube Data API key.
async function fetchOEmbed(videoId, signal) {
  const cached = readCache(videoId);
  if (cached) return cached;

  const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(
    `https://www.youtube.com/watch?v=${videoId}`
  )}&format=json`;

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`oEmbed ${res.status}`);
  const json = await res.json();
  const data = {
    title: json.title || 'Untitled track',
    artist: json.author_name || 'Unknown artist',
    thumb: json.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
  };
  writeCache(videoId, data);
  return data;
}

// Fetches metadata for a list of video IDs with a small concurrency cap so
// large playlists don't fire hundreds of simultaneous requests. Resolved
// entries stream in as they arrive rather than waiting for the whole batch.
export default function useLibraryMetadata(videoIds) {
  const [entries, setEntries] = useState({}); // { [videoId]: { title, artist, thumb, status } }
  const controllerRef = useRef(null);

  useEffect(() => {
    if (!videoIds || videoIds.length === 0) {
      return undefined;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setEntries((prev) => {
      const next = { ...prev };
      videoIds.forEach((id) => {
        if (!next[id]) next[id] = { status: 'pending' };
      });
      return next;
    });

    let cursor = 0;
    const runNext = async () => {
      if (controller.signal.aborted) return;
      const id = videoIds[cursor];
      cursor += 1;
      if (id === undefined) return;

      try {
        const data = await fetchOEmbed(id, controller.signal);
        if (controller.signal.aborted) return;
        setEntries((prev) => ({ ...prev, [id]: { ...data, status: 'ready' } }));
      } catch {
        if (controller.signal.aborted) return;
        setEntries((prev) => ({ ...prev, [id]: { status: 'error' } }));
      }
      return runNext();
    };

    const workers = Array.from({ length: Math.min(CONCURRENCY, videoIds.length) }, runNext);
    Promise.all(workers).catch(() => {});

    return () => controller.abort();
  }, [videoIds]);

  return entries;
}
