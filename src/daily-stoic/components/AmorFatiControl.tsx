import { Field } from './Field';
import { 
  Globe, 
  Award, 
  Users, 
  Clock, 
  Lock 
} from 'lucide-react';
import { cn } from '../lib/cn';

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

export default function AmorFatiControl({
  fateInput,
  onFateInputChange,
  acceptanceTags,
  onAcceptanceTagsChange,
}: AmorFatiControlProps) {
  const handleTagToggle = (tag: string) => {
    if (acceptanceTags.includes(tag)) {
      onAcceptanceTagsChange(acceptanceTags.filter((t) => t !== tag));
    } else {
      onAcceptanceTagsChange([...acceptanceTags, tag]);
    }
  };

  return (
    <div className="rounded-xl border border-tertiary bg-background-secondary p-4 sm:p-6 h-full">
      <h3 className="font-display text-xl text-text-primary mb-4 flex items-center gap-2">
        <span aria-hidden="true" className="text-2xl">🍂</span> Amor Fati (Love of Fate)
      </h3>
      <p className="text-sm text-text-secondary mb-8">
        Frame today's resistances as necessary constraints to be embraced rather than fought.
      </p>

      <div className="flex flex-col gap-8">
        <Field
          label="What part of today feels forced or heavy?"
          type="text"
          value={fateInput}
          onChange={(e) => onFateInputChange(e.target.value)}
          placeholder="e.g. Flight delay, difficult conversation, unexpected chore..."
        />

        <div>
          <label className="block text-sm font-medium text-text-primary mb-3">Challenge Types</label>
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
                      ? "border-accent bg-accent/15 text-accent font-medium"
                      : "text-text-primary bg-background-secondary border-tertiary hover:border-accent"
                  )}
                >
                  <span>{active ? '✓' : '○'}</span>
                  <Icon size={12} strokeWidth={active ? 2.5 : 2} />
                  <span>{tag}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
