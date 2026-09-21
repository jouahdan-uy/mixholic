const SHORTCUTS = [
  ['Space', 'Play / pause'],
  ['← →', 'Previous / next track'],
  ['↑ ↓', 'Volume'],
  ['M', 'Mute'],
  ['S', 'Shuffle'],
  ['R', 'Cycle repeat'],
  ['F', 'Favorite current track'],
  ['L', 'Toggle library'],
  ['/', 'Focus search'],
  ['I', 'Immersive mode'],
  ['Esc', 'Close panels'],
];

export default function ShortcutsHint({ isOpen, onClose }) {
  if (!isOpen) return null;
  return (
    <div className="shortcuts-overlay" onClick={onClose}>
      <div className="shortcuts-panel" onClick={(e) => e.stopPropagation()}>
        <h2 className="shortcuts-panel__title">Keyboard shortcuts</h2>
        <dl className="shortcuts-panel__list">
          {SHORTCUTS.map(([key, desc]) => (
            <div className="shortcuts-panel__row" key={key}>
              <dt>
                <kbd>{key}</kbd>
              </dt>
              <dd>{desc}</dd>
            </div>
          ))}
        </dl>
        <button type="button" className="shortcuts-panel__close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
    </div>
  );
}
