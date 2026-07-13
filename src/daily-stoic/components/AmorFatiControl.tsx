import { Field } from './Field';
import { 
  Globe, 
  Award, 
  Users, 
  Clock, 
  Lock,
  Heart
} from 'lucide-react';
import { cn } from '../lib/cn';
import { triggerHaptic } from '../../shared/haptics';

interface AmorFatiControlProps {
  fateInput: string;
  onFateInputChange: (val: string) => void;
  acceptanceTags: string[];
  onAcceptanceTagsChange: (tags: string[]) => void;
}

const AVAILABLE_TAGS = ['Situation', 'Outcome', 'People', 'Time', 'Limitation'];

const TAG_ICONS: Record<string, any> = {
  Situation: Globe,
  Outcome: Award,
  People: Users,
  Time: Clock,
  Limitation: Lock,
};

const TAG_HINTS: Record<string, string> = {
  Situation: 'Situation (Events): An external crisis, accident, or unexpected disruption that unfolded outside your wishes.',
  Outcome: 'Outcome (Results): A failure, rejection, loss, or result that did not match your expectations.',
  People: 'People (Frictions): A difficult conversation, rude remark, conflict, or tension with others.',
  Time: 'Time (Delays): A delay, wasted hour, rush, waiting line, or schedule conflict beyond your control.',
  Limitation: 'Limitation (Constraints): A lack of resources, energy, illness, physical boundary, or systemic constraint.',
};

export default function AmorFatiControl({
  fateInput,
  onFateInputChange,
  acceptanceTags,
  onAcceptanceTagsChange,
}: AmorFatiControlProps) {
  const handleTagToggle = (tag: string) => {
    triggerHaptic('light');
    if (acceptanceTags.includes(tag)) {
      onAcceptanceTagsChange(acceptanceTags.filter((t) => t !== tag));
    } else {
      onAcceptanceTagsChange([...acceptanceTags, tag]);
    }
  };

  return (
    <section className="rounded-xl border border-secondary bg-background-secondary p-4 sm:p-6 shadow-md hover:shadow-lg transition-all duration-300">
      <h3 className="font-display text-xl text-text-primary mb-3 border-b border-tertiary pb-3 flex items-center gap-2">
        <Heart size={20} className="text-text-secondary" /> Amor Fati (Love of Fate)
      </h3>
      <p className="text-sm text-text-secondary mb-4">
        Frame today's resistances as necessary constraints to be embraced rather than fought.
      </p>

      <div className="flex flex-col gap-4">
        <Field
          label="What part of today feels forced or heavy?"
          type="text"
          value={fateInput}
          onChange={(e) => onFateInputChange(e.target.value)}
          placeholder="e.g. Flight delay, difficult conversation, unexpected chore..."
          className="border-tertiary bg-background-tertiary"
        />

        <div className="rounded-lg border border-energy/30 bg-energy/5 p-4 sm:p-5 mt-2">
          <h4 className="text-sm font-semibold text-energy flex items-center gap-2 mb-2">
            <span>☁</span> Challenge Types
          </h4>
          <p className="text-xs text-text-secondary mb-3">
            Select the categories that best describe this challenge:
          </p>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_TAGS.map((tag) => {
              const active = acceptanceTags.includes(tag);
              const Icon = TAG_ICONS[tag] || Globe;
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleTagToggle(tag)}
                  className={cn(
                    "text-xs rounded px-2.5 py-1 text-left border transition-all duration-200 flex items-center gap-1.5",
                    active
                      ? "border-energy bg-energy/15 text-energy font-medium"
                      : "text-text-primary bg-background-secondary border-tertiary hover:border-energy"
                  )}
                >
                  <span>{active ? '✓' : '○'}</span>
                  <Icon size={12} strokeWidth={active ? 2.5 : 2} />
                  <span>{tag}</span>
                </button>
              );
            })}
          </div>
          {acceptanceTags.length > 0 && (
            <div className="mt-3 space-y-1">
              {acceptanceTags.filter(t => TAG_HINTS[t]).map(tag => (
                <p key={tag} className="text-xs text-text-secondary italic border-l-2 border-energy pl-3 pt-0.5 pb-0.5 animate-in fade-in duration-200">
                  {TAG_HINTS[tag]}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
