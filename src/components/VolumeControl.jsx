import { useCallback, useRef } from 'react';

function volumeIcon(volume, muted) {
  if (muted || volume === 0) return '🔇';
  if (volume < 34) return '🔈';
  if (volume < 67) return '🔉';
  return '🔊';
}

export default function VolumeControl({ volume, isMuted, onChange, onToggleMute }) {
  const trackRef = useRef(null);

  const ratioFromEvent = useCallback((e) => {
    const track = trackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const ratio = (clientX - rect.left) / rect.width;
    return Math.min(1, Math.max(0, ratio));
  }, []);

  const onPointerDown = useCallback(
    (e) => {
      onChange(ratioFromEvent(e) * 100);
      const onMove = (moveEvent) => onChange(ratioFromEvent(moveEvent) * 100);
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [onChange, ratioFromEvent]
  );

  const displayVolume = isMuted ? 0 : volume;

  return (
    <div className="volume">
      <button
        type="button"
        className="volume__icon"
        onClick={onToggleMute}
        aria-label={isMuted ? 'Unmute' : 'Mute'}
        title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
      >
        {volumeIcon(volume, isMuted)}
      </button>
      <div
        className="volume__track"
        ref={trackRef}
        onPointerDown={onPointerDown}
        role="slider"
        tabIndex={0}
        aria-label="Volume"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={displayVolume}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') onChange(Math.min(100, displayVolume + 5));
          if (e.key === 'ArrowLeft') onChange(Math.max(0, displayVolume - 5));
        }}
      >
        <div className="volume__fill" style={{ width: `${displayVolume}%` }} />
        <div className="volume__thumb" style={{ left: `${displayVolume}%` }} />
      </div>
    </div>
  );
}
