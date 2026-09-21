import { useEffect, useMemo, useState } from 'react';

const STEPS = [
  {
    icon: '▶',
    eyebrow: '01 · START LISTENING',
    title: 'Your player, your mood.',
    text: 'Press the center play button to start a track. Use previous and next to move through your playlist.',
    tip: 'Tip: Spacebar also toggles play / pause.',
  },
  {
    icon: '⌕',
    eyebrow: '02 · FIND YOUR TRACK',
    title: 'Explore your library.',
    text: 'Open Library to search tracks, jump directly to a song, and keep your favorites close.',
    tip: 'Shortcut: press / to focus search instantly.',
  },
  {
    icon: '♫',
    eyebrow: '03 · MAKE IT YOURS',
    title: 'Shape the listening experience.',
    text: 'Use shuffle, repeat, favorite, volume and immersive mode to tune the player to your taste.',
    tip: 'Shortcut: I opens immersive mode.',
  },
  {
    icon: '?',
    eyebrow: '04 · QUICK CONTROLS',
    title: 'You are ready to mix.',
    text: 'Everything is built to stay out of your way. When you need a reminder, open the keyboard shortcuts panel.',
    tip: 'Press ? anytime to see all shortcuts.',
  },
];

export default function OnboardingTutorial({ isOpen, onClose }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const progress = useMemo(() => ((step + 1) / STEPS.length) * 100, [step]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') setStep((value) => Math.min(value + 1, STEPS.length - 1));
      if (event.key === 'ArrowLeft') setStep((value) => Math.max(value - 1, 0));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const finish = () => {
    localStorage.setItem('mixholic:onboarding-complete', 'true');
    onClose();
  };

  return (
    <div className="onboarding-overlay" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className="onboarding-panel" onClick={(event) => event.stopPropagation()}>
        <div className="onboarding-panel__topline">
          <span className="onboarding-panel__brand"><span>◈</span> MIXHOLIC</span>
          <button type="button" className="onboarding-panel__skip" onClick={finish}>Skip tour</button>
        </div>

        <div className="onboarding-panel__visual" key={step}>
          <div className="onboarding-panel__orb"><span>{current.icon}</span></div>
          <div className="onboarding-panel__rings" aria-hidden="true" />
        </div>

        <div className="onboarding-panel__content" key={`content-${step}`}>
          <p className="onboarding-panel__eyebrow">{current.eyebrow}</p>
          <h2 id="onboarding-title">{current.title}</h2>
          <p className="onboarding-panel__text">{current.text}</p>
          <div className="onboarding-panel__tip">{current.tip}</div>
        </div>

        <div className="onboarding-panel__footer">
          <div className="onboarding-panel__progress" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
            <div className="onboarding-panel__progress-track"><span style={{ width: `${progress}%` }} /></div>
            <div className="onboarding-panel__dots">
              {STEPS.map((_, index) => <span key={index} className={index === step ? 'is-active' : index < step ? 'is-done' : ''} />)}
            </div>
          </div>
          <div className="onboarding-panel__actions">
            {step > 0 && <button type="button" className="onboarding-panel__back" onClick={() => setStep((value) => value - 1)}>Back</button>}
            {step < STEPS.length - 1 ? (
              <button type="button" className="onboarding-panel__next" onClick={() => setStep((value) => value + 1)}>Next <span>→</span></button>
            ) : (
              <button type="button" className="onboarding-panel__next" onClick={finish}>Let’s go <span>→</span></button>
            )}
          </div>
        </div>

        <button type="button" className="onboarding-panel__close" onClick={finish} aria-label="Close tutorial">×</button>
      </div>
    </div>
  );
}
