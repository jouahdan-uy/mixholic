import useMagnetic from '../hooks/useMagnetic';

function MagneticButton({ className, onClick, label, title, children, strength }) {
  const magnet = useMagnetic(strength);
  return (
    <button
      ref={magnet.elementRef}
      type="button"
      className={className}
      onClick={onClick}
      onMouseMove={magnet.onMouseMove}
      onMouseLeave={magnet.onMouseLeave}
      aria-label={label}
      title={title}
    >
      {children}
    </button>
  );
}

export default function TransportControls({
  isPlaying,
  isReady,
  shuffle,
  repeatMode,
  isFavorite,
  onTogglePlay,
  onNext,
  onPrev,
  onToggleShuffle,
  onCycleRepeat,
  onToggleFavorite,
}) {
  return (
    <div className="transport">
      <MagneticButton
        className={`transport__toggle ${shuffle ? 'is-active' : ''}`}
        onClick={onToggleShuffle}
        label="Toggle shuffle"
        title="Shuffle (S)"
        strength={0.3}
      >
        <ShuffleIcon />
      </MagneticButton>

      <MagneticButton
        className="transport__step"
        onClick={onPrev}
        label="Previous track"
        title="Previous (←)"
        strength={0.25}
      >
        <PrevIcon />
      </MagneticButton>

      <MagneticButton
        className="transport__play"
        onClick={onTogglePlay}
        label={isPlaying ? 'Pause' : 'Play'}
        title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
        strength={0.2}
      >
        {isReady ? isPlaying ? <PauseIcon /> : <PlayIcon /> : <SpinnerIcon />}
      </MagneticButton>

      <MagneticButton
        className="transport__step"
        onClick={onNext}
        label="Next track"
        title="Next (→)"
        strength={0.25}
      >
        <NextIcon />
      </MagneticButton>

      <MagneticButton
        className={`transport__toggle ${repeatMode !== 'off' ? 'is-active' : ''}`}
        onClick={onCycleRepeat}
        label="Cycle repeat mode"
        title={`Repeat: ${repeatMode} (R)`}
        strength={0.3}
      >
        {repeatMode === 'one' ? <RepeatOneIcon /> : <RepeatIcon />}
      </MagneticButton>

      <MagneticButton
        className={`transport__toggle transport__toggle--favorite ${isFavorite ? 'is-active' : ''}`}
        onClick={onToggleFavorite}
        label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        title="Favorite (F)"
        strength={0.3}
      >
        <HeartIcon filled={isFavorite} />
      </MagneticButton>
    </div>
  );
}

function ShuffleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h3.6c1.2 0 2.3.6 2.9 1.6L15 18a3.4 3.4 0 0 0 2.9 1.6H21" />
      <path d="M17 3l4 3-4 3" />
      <path d="M3 18h3.6c1.2 0 2.3-.6 2.9-1.6l.8-1.3" />
      <path d="M14.5 7.3l.4-.7A3.4 3.4 0 0 1 18 5H21" />
      <path d="M17 15l4 3-4 3" />
    </svg>
  );
}

function RepeatIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 2l4 4-4 4" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

function RepeatOneIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 2l4 4-4 4" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
      <path d="M12 8.6v3.9" strokeWidth="1.6" />
      <path d="M11.3 9.4l.7-.8v3.9" />
    </svg>
  );
}

function PrevIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M6 5h2v14H6zM19 6.4L9.5 12l9.5 5.6z" />
    </svg>
  );
}

function NextIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M16 5h2v14h-2zM5 6.4L14.5 12 5 17.6z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
      <path d="M8 5.5v13l11-6.5z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
      <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
    </svg>
  );
}

function SpinnerIcon() {
  return <span className="transport__spinner" aria-hidden="true" />;
}

function HeartIcon({ filled }) {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8">
      <path d="M12 20.4c-.2 0-.4-.07-.55-.2C7.2 16.7 4 13.9 4 10.4 4 7.9 5.9 6 8.3 6c1.4 0 2.7.65 3.7 1.85C13 6.65 14.3 6 15.7 6 18.1 6 20 7.9 20 10.4c0 3.5-3.2 6.3-7.45 9.8-.15.13-.35.2-.55.2Z" />
    </svg>
  );
}
