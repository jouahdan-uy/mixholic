const MESSAGE = 'mixholic - a place to find something random';

export default function InitialLoader({ isVisible }) {
  return (
    <div
      className={`initial-loader ${isVisible ? 'initial-loader--visible' : 'initial-loader--hidden'}`}
      aria-hidden={!isVisible}
      aria-label={isVisible ? 'Loading Mixholic' : undefined}
    >
      <div className="initial-loader__content">
        <div className="initial-loader__record" aria-hidden="true">
          <div className="initial-loader__grooves" />
          <div className="initial-loader__shine" />
          <div className="initial-loader__label">
            <span className="initial-loader__label-text">M</span>
          </div>
          <div className="initial-loader__spindle" />
        </div>

        <p className="initial-loader__tagline" aria-label={MESSAGE}>
          {Array.from(MESSAGE).map((char, index) => (
            <span
              className={char === ' ' ? 'initial-loader__letter initial-loader__letter--space' : 'initial-loader__letter'}
              style={{ '--letter-index': index }}
              key={`${char}-${index}`}
              aria-hidden="true"
            >
              {char === ' ' ? '\u00A0' : char}
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}
