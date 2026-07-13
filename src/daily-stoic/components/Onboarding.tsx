import { useState } from 'react';
import { Button, Field } from '../../ds';
import { triggerHaptic } from '../../shared/haptics';

interface OnboardingProps {
  onComplete: () => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(1);
  const [birthDate, setBirthDate] = useState(() => localStorage.getItem('daily-stoic:birthdate') || '');

  const handleNext = () => {
    triggerHaptic('light');
    if (step === 2) {
      if (birthDate) {
        localStorage.setItem('daily-stoic:birthdate', birthDate);
      }
      onComplete();
    } else {
      setStep(step + 1);
    }
  };

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <div className="w-full max-w-md rounded-2xl bg-background-secondary border border-tertiary p-8 shadow-sm">
        {step === 1 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <span className="text-5xl mb-4 block" role="img" aria-label="stoic temple">🏛️</span>
            <h2 className="font-display text-3xl font-bold text-text-primary mb-3">Welcome to Daily Stoic</h2>
            <p className="text-text-secondary mb-8 leading-relaxed">
              A private, minimalist space to build resilience, cultivate gratitude, and reflect on what truly matters.
            </p>
            <Button className="w-full" onClick={handleNext}>
              Begin Journey
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 text-left">
            <span className="text-4xl mb-4 block text-center" role="img" aria-label="hourglass">⏳</span>
            <h2 className="font-display text-2xl font-bold text-text-primary mb-2 text-center">Memento Mori</h2>
            <p className="text-text-secondary text-sm mb-6 text-center">
              Remember you will die. Enter your birth date to unlock a visualization of your life in weeks—a powerful reminder to value your time.
            </p>
            <div className="mb-8">
              <Field
                label="Birth Date (Optional)"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-3">
              <Button className="w-full" onClick={handleNext}>
                {birthDate ? 'Save & Continue' : 'Skip for now'}
              </Button>
              <p className="text-xs text-text-secondary text-center mt-2">
                Your data is stored locally on this device by default. You can configure cloud sync in Settings later.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
