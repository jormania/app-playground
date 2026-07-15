import { useState } from 'react';
import { Modal, Button } from '../../ds';
import { Wind, Scale, Eye, Sparkles } from 'lucide-react';
import { AVAILABLE_PASSIONS } from '../data/passions';
import { getPassionWisdom } from '../lib/curriculum';
import { triggerHaptic } from '../../shared/haptics';
import { cn } from '../lib/cn';

interface PauseDrillProps {
  open: boolean;
  onClose: () => void;
}

// Enhance 3 — the in-the-moment Pause. A ~60-second walk-through for when a
// passion flares in real life: name it, separate what's up to you, withhold
// assent from the impression, and meet it with the right ancient maxim. Fully
// offline, nothing persisted — it is a reset, not a record.
export default function PauseDrill({ open, onClose }: PauseDrillProps) {
  const [step, setStep] = useState(0);
  const [passionId, setPassionId] = useState<string | null>(null);

  const passion = AVAILABLE_PASSIONS.find((p) => p.id === passionId) || null;
  const wisdom = passionId ? getPassionWisdom(passionId) : null;

  const reset = () => {
    setStep(0);
    setPassionId(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const next = () => {
    triggerHaptic('light');
    setStep((s) => s + 1);
  };

  return (
    <Modal open={open} onClose={close} title="Pause">
      <div className="space-y-5">
        {/* Breathing marker — a quiet anchor across every step */}
        <div className="flex justify-center">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full rounded-full bg-accent/40 animate-ping" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-accent" />
          </span>
        </div>

        {step === 0 && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <p className="text-sm text-text-secondary leading-relaxed text-center">
              Something has stirred a passion. Before you act, take one breath and name it.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {AVAILABLE_PASSIONS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setPassionId(p.id);
                    triggerHaptic('light');
                    setStep(1);
                  }}
                  className="rounded-lg border border-tertiary bg-background-secondary px-3 py-2.5 text-left text-sm text-text-primary hover:border-accent hover:bg-accent-soft transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 1 && passion && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center gap-2 text-accent">
              <Scale size={18} />
              <h3 className="font-display text-lg text-text-primary">Separate it</h3>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed">
              <strong className="text-text-primary">{passion.label}</strong> has taken hold. Divide the
              situation cleanly: what part of this is <em>up to you</em> — your judgement, your next
              choice, your effort — and what part simply is not?
            </p>
            <p className="text-sm text-text-secondary leading-relaxed rounded-lg border border-tertiary bg-background-tertiary p-3">
              Give the part that is not yours back to fate. Spend nothing on it. Keep only what your own
              will can move.
            </p>
            <div className="flex justify-end">
              <Button size="sm" onClick={next}>Next</Button>
            </div>
          </div>
        )}

        {step === 2 && passion && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center gap-2 text-accent">
              <Eye size={18} />
              <h3 className="font-display text-lg text-text-primary">Withhold assent</h3>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed">
              The impression is not the fact. “This is unbearable,” “they did it on purpose,” “I must
              have it” — these are verdicts you are adding, and you have not yet agreed to them.
            </p>
            <p className="text-sm text-text-secondary leading-relaxed rounded-lg border border-tertiary bg-background-tertiary p-3">
              Say to the impression: <em>you are just an appearance, and not at all the thing you claim
              to be.</em> Then decide, slowly, what is actually true.
            </p>
            <div className="flex justify-end">
              <Button size="sm" onClick={next}>Next</Button>
            </div>
          </div>
        )}

        {step === 3 && passion && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center gap-2 text-accent">
              <Sparkles size={18} />
              <h3 className="font-display text-lg text-text-primary">Return with virtue</h3>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed">
              You have your judgement back. Now act as the person you are practising to become — not as
              the passion would have you act.
            </p>
            {wisdom && (
              <blockquote className="rounded-lg border border-accent/30 bg-accent-soft p-4 text-sm text-text-primary italic leading-relaxed">
                “{wisdom.maxim}”
                <cite className="block not-italic text-xs font-semibold text-text-secondary mt-2">
                  — {wisdom.author}
                </cite>
              </blockquote>
            )}
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={reset}
                className="text-xs text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1.5"
              >
                <Wind size={13} /> Another passion
              </button>
              <Button size="sm" onClick={close}>I’m ready</Button>
            </div>
          </div>
        )}

        {/* Step dots */}
        {passion && (
          <div className="flex justify-center gap-1.5 pt-1">
            {[1, 2, 3].map((s) => (
              <span
                key={s}
                className={cn('h-1.5 rounded-full transition-all', step >= s ? 'w-5 bg-accent' : 'w-1.5 bg-tertiary')}
              />
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
