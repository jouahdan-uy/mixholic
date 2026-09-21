import { useEffect, useMemo, useState } from 'react';

const API_BASE = 'https://www.googleapis.com/youtube/v3';

async function fetchJson(url, signal) {
  const response = await fetch(url, { signal });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || 'YouTube request failed.');
  return data;
}

function PlayGlyph() {
  return <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5.5v13l11-6.5z" /></svg>;
}

function normalizeVideo(item) {
  const id = item?.id?.videoId || item?.id;
  if (!id) return null;
  return {
    id,
    title: item?.snippet?.title || 'Untitled',
    channel: item?.snippet?.channelTitle || 'Unknown artist',
    thumb: item?.snippet?.thumbnails?.high?.url || item?.snippet?.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  };
}

// Handles both shapes YouTube gives us: a plain playlists.list item (id is
// the playlist ID directly) and a search-with-type=playlist item (id is
// nested under id.playlistId).
function normalizePlaylist(item) {
  const id = item?.id?.playlistId || item?.id;
  if (!id || typeof id !== 'string') return null;
  return {
    id,
    title: item?.snippet?.title || 'Untitled playlist',
    thumb: item?.snippet?.thumbnails?.high?.url || item?.snippet?.thumbnails?.medium?.url,
    count: item?.contentDetails?.itemCount,
  };
}

function formatNumber(value) {
  const number = Number(value || 0);
  if (number >= 1000000) return `${(number / 1000000).toFixed(number >= 10000000 ? 0 : 1)}M`;
  if (number >= 1000) return `${(number / 1000).toFixed(number >= 100000 ? 0 : 1)}K`;
  return number.toLocaleString();
}

export default function ArtistView({ artistName, onPlay, onLoadPlaylist, onBack, onToast }) {
  const [artist, setArtist] = useState(null);
  const [popular, setPopular] = useState([]);
  const [latest, setLatest] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [followed, setFollowed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('mixholic:followed-artists') || '[]').includes(artistName); } catch { return false; }
  });

  useEffect(() => {
    const key = import.meta.env.VITE_YOUTUBE_API_KEY;
    if (!key || !artistName?.trim()) {
      setLoading(false);
      setError(!key ? 'Add VITE_YOUTUBE_API_KEY to .env to load artist profiles.' : 'Artist name is missing.');
      return undefined;
    }

    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const channelSearch = new URL(`${API_BASE}/search`);
        channelSearch.search = new URLSearchParams({ part: 'snippet', q: artistName, type: 'channel', maxResults: '5', key }).toString();
        const channelResults = await fetchJson(channelSearch, controller.signal);
        const channelId = channelResults.items?.[0]?.id?.channelId;
        if (!channelId) throw new Error('No artist channel was found for this search.');

        const channelUrl = new URL(`${API_BASE}/channels`);
        channelUrl.search = new URLSearchParams({ part: 'snippet,statistics', id: channelId, key }).toString();

        // Scoped to the artist's OWN channel (not a text search for their
        // name) so "popular"/"latest" are actually their uploads, not
        // covers, reactions, or other channels that happen to mention them.
        // "Popular" = sorted by view count within that channel.
        const popularUrl = new URL(`${API_BASE}/search`);
        popularUrl.search = new URLSearchParams({ part: 'snippet', channelId, type: 'video', order: 'viewCount', maxResults: '8', key }).toString();

        // Their 2 most recently uploaded videos.
        const latestUrl = new URL(`${API_BASE}/search`);
        latestUrl.search = new URLSearchParams({ part: 'snippet', channelId, type: 'video', order: 'date', maxResults: '2', key }).toString();

        // Playlists published on the artist's own channel — for official
        // artist channels these are usually their albums/EPs.
        const albumsUrl = new URL(`${API_BASE}/playlists`);
        albumsUrl.search = new URLSearchParams({ part: 'snippet,contentDetails', channelId, maxResults: '8', key }).toString();

        const relatedUrl = new URL(`${API_BASE}/search`);
        relatedUrl.search = new URLSearchParams({ part: 'snippet', q: `${artistName} similar artists music`, type: 'channel', maxResults: '6', key }).toString();

        const [channelData, popularData, latestData, albumsData, relatedData] = await Promise.all([
          fetchJson(channelUrl, controller.signal),
          fetchJson(popularUrl, controller.signal),
          fetchJson(latestUrl, controller.signal),
          fetchJson(albumsUrl, controller.signal),
          fetchJson(relatedUrl, controller.signal),
        ]);

        setArtist(channelData.items?.[0] || null);
        setPopular((popularData.items || []).map(normalizeVideo).filter(Boolean).slice(0, 8));
        setLatest((latestData.items || []).map(normalizeVideo).filter(Boolean).slice(0, 2));
        setRelated((relatedData.items || []).filter((item) => item.id?.channelId && item.id.channelId !== channelId).slice(0, 5));

        let albumItems = (albumsData.items || []).map(normalizePlaylist).filter(Boolean);
        // Some channels (VEVO/aggregator pages especially) don't publish any
        // playlists of their own — fall back to a broader "album" search.
        if (albumItems.length === 0) {
          const fallbackUrl = new URL(`${API_BASE}/search`);
          fallbackUrl.search = new URLSearchParams({ part: 'snippet', q: `${artistName} album`, type: 'playlist', maxResults: '8', key }).toString();
          const fallbackData = await fetchJson(fallbackUrl, controller.signal);
          albumItems = (fallbackData.items || []).map(normalizePlaylist).filter(Boolean);
        }
        setAlbums(albumItems.slice(0, 8));
      } catch (err) {
        if (err.name !== 'AbortError') setError(err.message || 'Could not load artist profile.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, [artistName]);

  const channel = artist?.snippet;
  const stats = artist?.statistics;
  const image = channel?.thumbnails?.high?.url || channel?.thumbnails?.medium?.url;
  const displayName = channel?.title || artistName;
  const description = useMemo(() => {
    const text = channel?.description || `Explore popular songs and videos from ${artistName}.`;
    return text.length > 230 ? `${text.slice(0, 230).trim()}…` : text;
  }, [channel?.description, artistName]);

  const toggleFollow = () => {
    try {
      const current = JSON.parse(localStorage.getItem('mixholic:followed-artists') || '[]');
      const next = followed ? current.filter((name) => name !== displayName) : [...new Set([...current, displayName])];
      localStorage.setItem('mixholic:followed-artists', JSON.stringify(next));
      setFollowed(!followed);
      onToast?.(followed ? `${displayName} removed from followed artists.` : `${displayName} added to followed artists.`, 'success');
    } catch { /* localStorage can be unavailable */ }
  };

  return (
    <main className="artist-page">
      <button type="button" className="artist-page__back" onClick={onBack}>← Back to Explore</button>

      {loading && <div className="artist-page__state">Loading artist dashboard…</div>}
      {!loading && error && <div className="artist-page__notice"><strong>Artist dashboard needs a little setup.</strong><span>{error}</span></div>}

      {!loading && !error && artist && (
        <>
          <section className="artist-hero">
            <div className="artist-hero__glow" style={image ? { backgroundImage: `url(${image})` } : undefined} />
            <div className="artist-hero__avatar">{image ? <img src={image} alt="" /> : <span>♪</span>}</div>
            <div className="artist-hero__copy">
              <span className="artist-page__eyebrow">Artist dashboard</span>
              <h1>{displayName}</h1>
              <p>{description}</p>
              <div className="artist-hero__stats">
                <span><b>{formatNumber(stats?.subscriberCount)}</b> subscribers</span>
                <span><b>{popular.length}</b> popular picks</span>
                <span><b>{albums.length}</b> albums</span>
              </div>
              <div className="artist-hero__actions">
                <button type="button" className="artist-page__primary" onClick={() => popular[0] && onPlay(popular[0].id)} disabled={!popular.length}><PlayGlyph /> Play</button>
                <button type="button" className={`artist-page__secondary ${followed ? 'is-followed' : ''}`} onClick={toggleFollow}>{followed ? 'Following ✓' : 'Follow'}</button>
              </div>
            </div>
          </section>

          {latest.length > 0 && (
            <section className="artist-section">
              <div className="artist-section__heading"><div><span>Baru dirilis</span><h2>Terbaru</h2></div></div>
              <div className="artist-songs">
                {latest.map((song, index) => (
                  <button type="button" className="artist-song stagger-in" style={{ '--i': index }} key={song.id} onClick={() => onPlay(song.id)}>
                    <span className="artist-song__index">{String(index + 1).padStart(2, '0')}</span>
                    <img src={song.thumb} alt="" loading="lazy" />
                    <span className="artist-song__copy"><strong>{song.title}</strong><small>{song.channel}</small></span>
                    <span className="artist-song__play"><PlayGlyph /></span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="artist-section">
            <div className="artist-section__heading"><div><span>Diurutkan berdasarkan penonton</span><h2>Terpopuler</h2></div><span>{popular.length} tracks</span></div>
            <div className="artist-songs">
              {popular.map((song, index) => (
                <button type="button" className="artist-song stagger-in" style={{ '--i': index }} key={song.id} onClick={() => onPlay(song.id)}>
                  <span className="artist-song__index">{String(index + 1).padStart(2, '0')}</span>
                  <img src={song.thumb} alt="" loading="lazy" />
                  <span className="artist-song__copy"><strong>{song.title}</strong><small>{song.channel}</small></span>
                  <span className="artist-song__play"><PlayGlyph /></span>
                </button>
              ))}
            </div>
          </section>

          {albums.length > 0 && (
            <section className="artist-section">
              <div className="artist-section__heading"><div><span>Rilisan</span><h2>Album</h2></div></div>
              <div className="artist-albums">
                {albums.map((album, index) => (
                  <button type="button" className="artist-album stagger-in" style={{ '--i': index }} key={album.id} onClick={() => onLoadPlaylist?.(album.id)}>
                    <span className="artist-album__thumb">{album.thumb ? <img src={album.thumb} alt="" loading="lazy" /> : '♪'}</span>
                    <strong>{album.title}</strong>
                    {album.count != null && <span>{album.count} lagu</span>}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="artist-section">
            <div className="artist-section__heading"><div><span>Discovery lane</span><h2>More like this</h2></div></div>
            <div className="artist-related">
              {related.map((item, index) => {
                const thumb = item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url;
                return <button type="button" className="artist-related__card stagger-in" style={{ '--i': index }} key={item.id.channelId} onClick={() => window.dispatchEvent(new CustomEvent('mixholic:open-artist', { detail: item.snippet?.title || '' }))}>
                  <span className="artist-related__image">{thumb ? <img src={thumb} alt="" loading="lazy" /> : '♪'}</span>
                  <strong>{item.snippet?.title || 'Artist'}</strong>
                  <span>Artist / channel</span>
                </button>;
              })}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
