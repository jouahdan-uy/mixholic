import { useEffect, useMemo, useState } from 'react';

const API_BASE = 'https://www.googleapis.com/youtube/v3';

const GENRES = [
  ['Pop', 'bright', 'pop music'],
  ['Hip-Hop', 'violet', 'hip hop music'],
  ['R&B', 'wine', 'r&b music'],
  ['Rock', 'ember', 'rock music'],
  ['K-Pop', 'rose', 'k-pop music'],
  ['J-Pop', 'indigo', 'j-pop music'],
  ['Lo-fi', 'mist', 'lofi music'],
  ['EDM', 'cyan', 'edm music'],
  ['Dangdut', 'gold', 'dangdut music'],
  ['Phonk', 'smoke', 'phonk music'],
  ['City Pop', 'sunset', 'city pop music'],
  ['Jazz', 'olive', 'jazz music'],
  ['Classical', 'ivory', 'classical music'],
  ['Indie', 'forest', 'indie music'],
  ['Metal', 'steel', 'metal music'],
  ['Afrobeats', 'orange', 'afrobeats music'],
  ['Amapiano', 'plum', 'amapiano music'],
  ['Jersey Club', 'electric', 'jersey club music'],
  ['Drum & Bass', 'night', 'drum and bass music'],
  ['Breakcore', 'acid', 'breakcore music'],
  ['Shoegaze', 'haze', 'shoegaze music'],
  ['Darkwave', 'dark', 'darkwave music'],
  ['Synthwave', 'neon', 'synthwave music'],
  ['Vaporwave', 'pastel', 'vaporwave music'],
  ['Chillhop', 'coffee', 'chillhop music'],
  ['Trap', 'red', 'trap music'],
  ['Emo Rap', 'blue', 'emo rap music'],
  ['Cloud Rap', 'cloud', 'cloud rap music'],
  ['Nu Metal', 'iron', 'nu metal music'],
  ['Bedroom Pop', 'bedroom', 'bedroom pop music'],
  ['Dream Pop', 'dream', 'dream pop music'],
  ['Funkot', 'tropical', 'funkot music'],
  ['Koplo Remix', 'koplo', 'dangdut koplo remix'],
  ['Hipdut', 'hipdut', 'hipdut music'],
  ['Pop Jawa', 'java', 'pop jawa music'],
  ['Pop Sunda', 'sunda', 'pop sunda music'],
  ['Brazilian Phonk', 'brasil', 'brazilian phonk music'],
];

const MOODS = [
  ['Late Night', 'late night chill music'],
  ['Feel Good', 'feel good upbeat music'],
  ['Gaming', 'gaming music mix'],
  ['Focus', 'focus study music'],
  ['Chill', 'chill relaxing music'],
  ['Energy', 'high energy workout music'],
];

function SearchIcon() {
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.3-4.3" /></svg>;
}

function ResultCard({ item, onPlay, onPlaylist, onSearch, onOpenArtist, index, kind }) {
  const id = item.id?.videoId || item.id?.playlistId || item.id?.channelId;
  const thumb = item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.high?.url;
  const isPlaylist = !!item.id?.playlistId;
  const isArtist = !!item.id?.channelId;
  const typeLabel = isPlaylist ? 'Playlist' : isArtist ? 'Artist / channel' : kind === 'album' ? 'Album result' : 'Song / video';
  return (
    <article className="search-result reveal" style={{ '--i': index % 9 }}>
      {thumb ? <img className="search-result__thumb" src={thumb} alt="" loading="lazy" /> : <span className="search-result__thumb search-result__thumb--fallback">♪</span>}
      <div className="search-result__meta">
        <div className="search-result__type">{typeLabel}</div>
        <h3>{item.snippet?.title || 'Untitled'}</h3>
        <p>{item.snippet?.channelTitle || 'Unknown artist'}</p>
      </div>
      <button type="button" className="search-result__action" onClick={() => (isPlaylist ? onPlaylist(id) : isArtist ? (onOpenArtist ? onOpenArtist(item.snippet?.title || '') : onSearch(item.snippet?.title || '')) : onPlay(id))}>
        {isPlaylist ? 'Load' : isArtist ? 'Explore' : 'Play'}
      </button>
    </article>
  );
}

function GenreCard({ name, tone, query, onSelect, index }) {
  return (
    <button type="button" className={`genre-card genre-card--${tone} reveal`} style={{ '--i': index % 8 }} onClick={() => onSelect(query)}>
      <span className="genre-card__orb" aria-hidden="true" />
      <span className="genre-card__grain" aria-hidden="true" />
      <span className="genre-card__index">{String(index + 1).padStart(2, '0')}</span>
      <strong>{name}</strong>
      <span className="genre-card__arrow">↗</span>
    </button>
  );
}

export default function SearchView({ initialQuery = '', onPlayVideo, onLoadPlaylist, onOpenArtist }) {
  const [query, setQuery] = useState(initialQuery);
  const [submitted, setSubmitted] = useState(initialQuery);
  const [kind, setKind] = useState('all');
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [showAllGenres, setShowAllGenres] = useState(false);

  useEffect(() => {
    if (initialQuery && initialQuery !== submitted) {
      setQuery(initialQuery);
      setSubmitted(initialQuery);
    }
  }, [initialQuery, submitted]);

  useEffect(() => {
    if (!submitted.trim()) {
      setStatus('idle');
      setResults([]);
      return undefined;
    }
    const key = import.meta.env.VITE_YOUTUBE_API_KEY;
    if (!key) {
      setStatus('config');
      setResults([]);
      return undefined;
    }
    const controller = new AbortController();
    setStatus('loading');
    setError('');
    const effectiveQuery = kind === 'album' ? `${submitted.trim()} album official` : submitted.trim();
    const params = new URLSearchParams({
      part: 'snippet',
      q: effectiveQuery,
      maxResults: '18',
      type: kind === 'all' ? 'video,playlist' : kind === 'song' || kind === 'album' ? 'video' : kind,
      key,
    });
    fetch(`${API_BASE}/search?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error?.message || 'YouTube search failed.');
        return data;
      })
      .then((data) => {
        setResults(data.items || []);
        setStatus('ready');
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setStatus('error');
        setError(err.message || 'Search failed.');
      });
    return () => controller.abort();
  }, [submitted, kind]);

  const visibleGenres = useMemo(() => (showAllGenres ? GENRES : GENRES.slice(0, 8)), [showAllGenres]);

  const runSearch = (value, nextKind = 'song') => {
    const clean = value.trim();
    if (!clean) return;
    setQuery(clean);
    setSubmitted(clean);
    setKind(nextKind);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = (event) => {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    if (/^(https?:\/\/)?(www\.)?(music\.)?youtube\.com\/playlist\?/.test(value) || /[?&]list=/.test(value)) {
      onLoadPlaylist(value);
      return;
    }
    setSubmitted(value);
  };

  return (
    <main className="discover">
      <div className="discover__hero">
        <span className="discover__eyebrow">Explore</span>
        <h1>Find something worth playing.</h1>
        <p>Search songs, artists, albums and playlists, or start with a genre.</p>
        <form className="discover__search" onSubmit={submit}>
          <SearchIcon />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search songs, artists, albums…" aria-label="Search YouTube" />
          <button type="submit">Search</button>
        </form>
      </div>

      <section className="discover__genre-section">
        <div className="discover__section-heading">
          <div><span>Browse by sound</span><h2>Genres</h2></div>
          <button type="button" className="discover__text-button" onClick={() => setShowAllGenres((value) => !value)}>
            {showAllGenres ? 'Show less ↑' : 'Explore all genres →'}
          </button>
        </div>
        <div className="genre-grid">
          {visibleGenres.map(([name, tone, genreQuery], index) => <GenreCard key={name} name={name} tone={tone} query={genreQuery} index={index} onSelect={runSearch} />)}
        </div>
      </section>

      <section className="discover__mood-section">
        <div className="discover__section-heading"><div><span>Set the atmosphere</span><h2>Mood & vibe</h2></div></div>
        <div className="mood-rail">
          {MOODS.map(([name, moodQuery], index) => (
            <button type="button" className="mood-card reveal" style={{ '--i': index }} key={name} onClick={() => runSearch(moodQuery)}>
              <span>{name}</span><b>↗</b>
            </button>
          ))}
        </div>
      </section>

      <div className="discover__filters" aria-label="Search type">
        {[
          ['all', 'Everything'],
          ['song', 'Songs'],
          ['channel', 'Artists'],
          ['album', 'Albums'],
          ['playlist', 'Playlists'],
        ].map(([value, label]) => (
          <button type="button" key={value} className={kind === value ? 'is-active' : ''} onClick={() => setKind(value)}>{label}</button>
        ))}
      </div>

      {status === 'config' && (
        <div className="discover__notice"><strong>Search is ready, but it needs a YouTube Data API key.</strong><span>Create a <code>.env</code> file and add <code>VITE_YOUTUBE_API_KEY=your_key</code>, then restart Vite.</span></div>
      )}
      {status === 'loading' && <div className="discover__state">Searching YouTube…</div>}
      {status === 'error' && <div className="discover__notice"><strong>Search failed.</strong><span>{error}</span></div>}
      {status === 'ready' && !results.length && <div className="discover__state">Nothing matched that search.</div>}
      {results.length > 0 && (
        <section className="search-results">
          <div className="search-results__heading"><h2>Results</h2><span>{results.length} found</span></div>
          <div className="search-results__list">
            {results.map((item, index) => <ResultCard key={item.id?.videoId || item.id?.playlistId || item.id?.channelId} item={item} index={index} kind={kind} onPlay={onPlayVideo} onPlaylist={onLoadPlaylist} onSearch={(value) => runSearch(value, 'song')} onOpenArtist={onOpenArtist} />)}
          </div>
        </section>
      )}
    </main>
  );
}
