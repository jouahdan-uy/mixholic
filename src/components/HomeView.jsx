import { useEffect, useMemo, useState } from 'react';

const API_BASE = 'https://www.googleapis.com/youtube/v3';
const MUSIC_CATEGORY = '10';
const MAX_CARDS = 6;

function LiveEqualizer() {
  return (
    <span className="live-eq" aria-hidden="true">
      <span /><span /><span />
    </span>
  );
}

function PlayGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M8 5.5v13l11-6.5z" /></svg>
  );
}

// Morning / afternoon / evening / night — picked off the visitor's own
// clock so the greeting always matches whatever time it is for them.
function getTimeGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'Morning';
  if (hour >= 12 && hour < 17) return 'Afternoon';
  if (hour >= 17 && hour < 21) return 'Evening';
  return 'Night';
}

// A few casual lines per time of day so the hero headline doesn't feel
// like it's reading the same script every visit.
const GREETING_LINES = {
  Morning: [
    "ready to start the day right?",
    "let's ease into it.",
    "got your first track lined up?",
    "coffee's optional, good music isn't.",
  ],
  Afternoon: [
    "need a little pick-me-up?",
    "let's keep the day moving.",
    "what's the vibe today?",
    "perfect time for a soundtrack.",
  ],
  Evening: [
    "time to unwind a bit.",
    "let's set the mood.",
    "ready to vibe?",
    "how about something to wind down to?",
  ],
  Night: [
    "still up? let's make it worth it.",
    "perfect hour for something chill.",
    "burning the midnight oil?",
    "let's find your late-night sound.",
  ],
};

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function normalizeVideo(item) {
  const id = item?.id?.videoId || item?.id;
  if (!id) return null;
  const snippet = item?.snippet || {};
  return {
    id,
    title: snippet.title || 'Untitled',
    artist: snippet.channelTitle || 'Unknown artist',
    thumb: snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  };
}

async function fetchJson(url, signal) {
  const response = await fetch(url, { signal });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || 'YouTube request failed.');
  return data;
}

function TrackRail({ title, eyebrow, items, currentId, isLoading, onPlay }) {
  const cards = items.slice(0, MAX_CARDS);
  return (
    <section className="home__section home__section--recommendations">
      <div className="home__heading">
        <div><span>{eyebrow}</span><h2>{title}</h2></div>
        <span className="home__count">{isLoading ? 'Loading…' : `${cards.length} tracks`}</span>
      </div>
      {isLoading ? (
        <div className="home__rail home__rail--skeleton" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, index) => <span className="home-skeleton" key={index} />)}
        </div>
      ) : cards.length ? (
        <div className="home__rail">
          {cards.map((track, index) => {
            const isCurrent = track.id === currentId;
            return (
              <button type="button" className={`home-track reveal ${isCurrent ? 'is-current' : ''}`} key={`${track.id}-${index}`} style={{ '--i': index }} onClick={() => onPlay(track.id)}>
                <span className="home-track__art">
                  <img src={track.thumb} alt="" loading="lazy" />
                  <span className="home-track__play"><span><PlayGlyph /></span></span>
                </span>
                <span className="home-track__title">{track.title}</span>
                <span className="home-track__artist">{isCurrent && <LiveEqualizer />}{track.artist}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="home__empty">Add a playlist or start listening to unlock more picks.</div>
      )}
    </section>
  );
}

export default function HomeView({ engine, metadata, username, onPlay, onExplore, onShare }) {
  const [recommendations, setRecommendations] = useState([]);
  const [popular, setPopular] = useState([]);
  const [indonesiaTop, setIndonesiaTop] = useState([]);
  const [loading, setLoading] = useState({ recommendations: false, popular: false, indonesia: false });

  // Recomputed on every real visit (mount), not on every re-render, so
  // the line doesn't shuffle mid-session while you're just playing songs.
  const greetingPeriod = useMemo(() => getTimeGreeting(), []);
  // Math.random() is a side effect, so it can't run during render (React
  // will warn/misbehave under Strict Mode double-rendering) — pick it in
  // an effect instead, seeded once per time-of-day.
  const [greetingLine, setGreetingLine] = useState(() => {
    const options = GREETING_LINES[getTimeGreeting()] || GREETING_LINES.Night;
    return options[0];
  });
  useEffect(() => {
    const options = GREETING_LINES[greetingPeriod] || GREETING_LINES.Night;
    setGreetingLine(options[Math.floor(Math.random() * options.length)]);
  }, [greetingPeriod]);

  const recent = useMemo(() => engine.playlistVideoIds.slice(0, Math.min(engine.playlistVideoIds.length, MAX_CARDS)), [engine.playlistVideoIds]);
  const featured = recent.length ? recent : [''];

  useEffect(() => {
    const key = import.meta.env.VITE_YOUTUBE_API_KEY;
    if (!key) return undefined;

    const controller = new AbortController();
    const load = async () => {
      setLoading({ recommendations: true, popular: true, indonesia: true });
      try {
        const popularUrl = new URL(`${API_BASE}/videos`);
        popularUrl.search = new URLSearchParams({ part: 'snippet', chart: 'mostPopular', videoCategoryId: MUSIC_CATEGORY, regionCode: 'US', maxResults: String(MAX_CARDS), key }).toString();

        const indonesiaUrl = new URL(`${API_BASE}/videos`);
        indonesiaUrl.search = new URLSearchParams({ part: 'snippet', chart: 'mostPopular', videoCategoryId: MUSIC_CATEGORY, regionCode: 'ID', maxResults: String(MAX_CARDS), key }).toString();

        const recommendationQuery = [engine.artist, engine.title]
          .filter(Boolean)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        const recommendationUrl = new URL(`${API_BASE}/search`);
        recommendationUrl.search = new URLSearchParams({
          part: 'snippet',
          q: recommendationQuery || 'popular music official audio',
          type: 'video',
          videoCategoryId: MUSIC_CATEGORY,
          maxResults: String(MAX_CARDS + 2),
          key,
        }).toString();

        const [popularData, indonesiaData, recommendationData] = await Promise.all([
          fetchJson(popularUrl, controller.signal),
          fetchJson(indonesiaUrl, controller.signal),
          fetchJson(recommendationUrl, controller.signal),
        ]);

        const currentId = engine.videoId;
        setPopular((popularData.items || []).map(normalizeVideo).filter(Boolean).filter((item) => item.id !== currentId));
        setIndonesiaTop((indonesiaData.items || []).map(normalizeVideo).filter(Boolean).filter((item) => item.id !== currentId));
        setRecommendations((recommendationData.items || []).map(normalizeVideo).filter(Boolean).filter((item) => item.id !== currentId));
      } catch (error) {
        if (error.name !== 'AbortError') {
          setPopular([]);
          setIndonesiaTop([]);
          setRecommendations([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading({ recommendations: false, popular: false, indonesia: false });
      }
    };

    load();
    return () => controller.abort();
  }, [engine.artist, engine.title, engine.videoId]);

  const localRecent = featured.map((id, index) => {
    const meta = id ? metadata[id] : null;
    return id ? {
      id,
      title: meta?.title || engine.titleCache[index]?.title || `Track ${index + 1}`,
      artist: meta?.artist || engine.titleCache[index]?.artist || 'Mixholic',
      thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    } : null;
  }).filter(Boolean);

  return (
    <main className="home">
      <section className="home__hero">
        <div className="home__hero-art" style={engine.videoId ? { backgroundImage: `url(https://i.ytimg.com/vi/${engine.videoId}/maxresdefault.jpg)` } : undefined} />
        <div className="home__hero-copy">
          <span className="home__eyebrow">
            {engine.isPlaying ? (
              <><LiveEqualizer /> Now playing</>
            ) : username ? (
              `${greetingPeriod}, ${username}!`
            ) : (
              'Welcome to Mixholic'
            )}
          </span>
          <h1>{!engine.isPlaying && username ? capitalize(greetingLine) : 'Your music, your moment.'}</h1>
          <p>Pick up where you left off, explore something new, or turn the current song into a shareable card.</p>
          <div className="home__hero-actions">
            <button type="button" className="home__primary" onClick={() => onPlay(engine.videoId)} disabled={!engine.videoId}><PlayGlyph /> Continue listening</button>
            <button type="button" className="home__secondary" onClick={onExplore}>Explore music</button>
          </div>
        </div>
      </section>

      <TrackRail title="Recommended for you" eyebrow="Based on what you're playing" items={recommendations} currentId={engine.videoId} isLoading={loading.recommendations} onPlay={onPlay} />
      <TrackRail title="Popular right now" eyebrow="Trending worldwide" items={popular} currentId={engine.videoId} isLoading={loading.popular} onPlay={onPlay} />
      <TrackRail title="Indonesia Top" eyebrow="Most popular in Indonesia" items={indonesiaTop} currentId={engine.videoId} isLoading={loading.indonesia} onPlay={onPlay} />
      <TrackRail title="Recently loaded" eyebrow="Picked from your queue" items={localRecent} currentId={engine.videoId} isLoading={false} onPlay={onPlay} />

      <section className="home__section home__section--split">
        <div className="home-promo reveal" style={{ '--i': 0 }}><span>Share the moment</span><h2>Make the song look as good as it sounds.</h2><p>Choose a cinematic, minimal, or visualizer card and export it for your socials.</p><button type="button" onClick={onShare} disabled={!engine.videoId}>Create share card ↗</button></div>
        <div className="home-promo home-promo--quiet reveal" style={{ '--i': 1 }}><span>Tip</span><h2>Press <kbd>/</kbd> to jump straight into your library.</h2><p>Or use Explore to search YouTube for songs and public playlists.</p></div>
      </section>
    </main>
  );
}
