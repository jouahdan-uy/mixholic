import { useCallback, useRef, useState } from 'react';

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${m}:${s}`;
}

export default function ProgressBar({ currentTime, duration, onSeek, disabled }) {
  const trackRef = useRef(null);
  const [dragRatio, setDragRatio] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showRemaining, setShowRemaining] = useState(false);

  const ratioFromEvent = useCallback((e) => {
    const track = trackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const ratio = (clientX - rect.left) / rect.width;
    return Math.min(1, Math.max(0, ratio));
  }, []);

  const commit = useCallback(
    (ratio) => {
      if (!duration) return;
      onSeek(ratio * duration);
    },
    [duration, onSeek]
  );

  const onPointerDown = useCallback(
    (e) => {
      if (disabled || !duration) return;
      setIsDragging(true);
      const ratio = ratioFromEvent(e);
      setDragRatio(ratio);

      const onMove = (moveEvent) => {
        setDragRatio(ratioFromEvent(moveEvent));
      };
      const onUp = (upEvent) => {
        const finalRatio = ratioFromEvent(upEvent);
        commit(finalRatio);
        setIsDragging(false);
        setDragRatio(null);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [disabled, duration, ratioFromEvent, commit]
  );

  const activeRatio = isDragging && dragRatio !== null ? dragRatio : duration ? currentTime / duration : 0;
  const displayTime = isDragging && dragRatio !== null ? dragRatio * duration : currentTime;

  return (
    <div className="progress">
      <span className="progress__time">{formatTime(displayTime)}</span>
      <div
        className={`progress__track ${disabled ? 'is-disabled' : ''}`}
        ref={trackRef}
        onPointerDown={onPointerDown}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration) || 0}
        aria-valuenow={Math.round(displayTime)}
        onKeyDown={(e) => {
          if (disabled || !duration) return;
          if (e.key === 'ArrowRight') commit(Math.min(1, activeRatio + 0.02));
          if (e.key === 'ArrowLeft') commit(Math.max(0, activeRatio - 0.02));
        }}
      >
        <div className="progress__fill" style={{ width: `${activeRatio * 100}%` }} />
        <div className="progress__thumb" style={{ left: `${activeRatio * 100}%` }} />
      </div>
      <button
        type="button"
        className="progress__time progress__time--toggle"
        onClick={() => setShowRemaining((v) => !v)}
        title={showRemaining ? 'Show total duration' : 'Show remaining time'}
      >
        {showRemaining ? `-${formatTime(Math.max(0, duration - displayTime))}` : formatTime(duration)}
      </button>
    </div>
  );
}
