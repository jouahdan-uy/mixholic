import { useEffect, useMemo, useRef, useState } from 'react';

function parseLrc(text) {
  if (!text) return [];
  const rows = [];
  for (const raw of text.split(/\r?\n/)) {
    const matches = [...raw.matchAll(/\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]/g)];
    const lyric = raw.replace(/\[\d{1,3}:\d{2}(?:\.\d{1,3})?\]/g, '').trim();
    if (!matches.length || !lyric) continue;
    for (const match of matches) {
      const minutes = Number(match[1]);
      const seconds = Number(match[2]);
      const fraction = match[3] ? Number(`0.${match[3]}`) : 0;
      rows.push({ time: minutes * 60 + seconds + fraction, text: lyric });
    }
  }
  return rows.sort((a, b) => a.time - b.time);
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

export default function LyricsPanel({ title, artist, currentTime, onSeek, mobile = false, onClose }) {
  const [lyrics, setLyrics] = useState([]);
  const [plainLyrics, setPlainLyrics] = useState('');
  const [status, setStatus] = useState('loading');
  const [source, setSource] = useState('');
  const activeRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const cleanTitle = title?.replace(/\s*\[[^\]]+\]\s*$/g, '').trim();
    if (!cleanTitle || !artist) {
      setLyrics([]);
      setPlainLyrics('');
      setStatus('empty');
      return () => controller.abort();
    }

    setStatus('loading');
    setLyrics([]);
    setPlainLyrics('');

    // Fallback: plain (unsynced) lyrics from lyrics.ovh when LRCLIB has nothing.
    const fetchPlainFallback = () => {
      const path = `${encodeURIComponent(artist)}/${encodeURIComponent(cleanTitle)}`;
      return fetch(`https://api.lyrics.ovh/v1/${path}`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error('No plain lyrics');
          return response.json();
        })
        .then((data) => {
          if (cancelled) return;
          const text = (data?.lyrics || '').trim();
          if (text) {
            setPlainLyrics(text);
            setSource('Lyrics.ovh');
            setStatus('plain');
          } else {
            setStatus('empty');
          }
        })
        .catch(() => {
          if (!cancelled) setStatus('empty');
        });
    };

    const params = new URLSearchParams({ track_name: cleanTitle, artist_name: artist });
    fetch(`https://lrclib.net/api/get?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('No synced lyrics');
        return response.json();
      })
      .then((data) => {
        if (cancelled) return;
        const parsed = parseLrc(data?.syncedLyrics);
        if (parsed.length) {
          setLyrics(parsed);
          setSource('LRCLIB');
          setStatus('ready');
        } else {
          return fetchPlainFallback();
        }
      })
      .catch(() => {
        if (!cancelled) return fetchPlainFallback();
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [title, artist]);

  const activeIndex = useMemo(() => {
    let index = -1;
    for (let i = 0; i < lyrics.length; i += 1) {
      if (lyrics[i].time <= currentTime + 0.12) index = i;
      else break;
    }
    return index;
  }, [lyrics, currentTime]);

  useEffect(() => {
    const node = activeRef.current;
    const container = listRef.current;
    if (!node || !container) return;
    const target = node.offsetTop - container.clientHeight * 0.42 + node.offsetHeight / 2;
    container.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
  }, [activeIndex]);

  return (
    <section className={`lyrics ${mobile ? 'lyrics--mobile' : ''}`} aria-label="Synchronized lyrics">
      <div className="lyrics__head">
        <div>
          <span className="lyrics__eyebrow">Lyrics</span>
          <h2 className="lyrics__title">{title || 'Waiting for a track'}</h2>
          <p className="lyrics__artist">{artist || 'Unknown artist'}</p>
        </div>
        {mobile && (
          <button type="button" className="lyrics__close" onClick={onClose} aria-label="Close lyrics">×</button>
        )}
      </div>

      <div className="lyrics__body" ref={listRef}>
        {status === 'loading' && <div className="lyrics__state">Finding synchronized lyrics…</div>}
        {status === 'empty' && (
          <div className="lyrics__state">
            <strong>No synced lyrics found.</strong>
            <span>Try another track or keep listening.</span>
          </div>
        )}
        {status === 'ready' && (
          <div className="lyrics__lines">
            {lyrics.map((line, index) => (
              <button
                type="button"
                key={`${line.time}-${index}`}
                ref={index === activeIndex ? activeRef : null}
                className={`lyrics__line ${index === activeIndex ? 'is-active' : ''} ${index === activeIndex - 1 ? 'is-before' : ''} ${index === activeIndex + 1 ? 'is-after' : ''}`}
                onClick={() => onSeek(line.time)}
                title={`Seek to ${formatTime(line.time)}`}
              >
                {line.text}
              </button>
            ))}
          </div>
        )}
        {status === 'plain' && (
          <div className="lyrics__plain">{plainLyrics}</div>
        )}
      </div>
      <div className="lyrics__foot">
        {status === 'plain'
          ? `${source} · unsynced lyrics`
          : source
            ? `Synced by ${source} · Click a line to seek`
            : 'Synchronized lyrics'}
      </div>
    </section>
  );
}
