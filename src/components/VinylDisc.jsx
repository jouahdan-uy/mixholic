export default function VinylDisc({ isPlaying, isBuffering, videoId, title }) {
  const artUrl = videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null;

  return (
    <div className="turntable">
      <div className={`vinyl ${isPlaying ? 'is-spinning' : ''}`}>
        <div className="vinyl__grooves" />
        <div className="vinyl__label">
          {artUrl ? (
            <img src={artUrl} alt="" className="vinyl__art" draggable="false" />
          ) : (
            <div className="vinyl__art vinyl__art--placeholder" />
          )}
        </div>
        <div className="vinyl__spindle" />
      </div>

      <div className={`tonearm ${isPlaying || isBuffering ? 'tonearm--down' : 'tonearm--up'}`}>
        <div className="tonearm__base" />
        <div className="tonearm__arm">
          <div className="tonearm__head" />
        </div>
      </div>

      {isBuffering && (
        <div className="turntable__buffering" role="status" aria-live="polite">
          <span className="turntable__buffering-dot" />
          <span className="turntable__buffering-dot" />
          <span className="turntable__buffering-dot" />
          <span className="sr-only">Loading {title || 'track'}…</span>
        </div>
      )}
    </div>
  );
}
