import { Field } from '../../ds';
import styles from '../App.module.css';

interface AmorFatiControlProps {
  fateInput: string;
  onFateInputChange: (val: string) => void;
  acceptanceTags: string[];
  onAcceptanceTagsChange: (tags: string[]) => void;
}

const AVAILABLE_TAGS = ['Situation', 'Outcome', 'People', 'Time', 'Limitation'];

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
    <div className={styles.amorFatiCard}>
      <h3 className={styles.amorFatiTitle}>
        <span className={styles.brandEmoji} aria-hidden="true">🍂</span> Amor Fati (Love of Fate)
      </h3>
      <p className={styles.amorFatiIntro}>
        Frame today's resistances as necessary constraints to be embraced rather than fought.
      </p>

      <div className={styles.amorFatiForm}>
        <Field
          label="What part of today feels forced or heavy?"
          type="text"
          value={fateInput}
          onChange={(e) => onFateInputChange(e.target.value)}
          placeholder="e.g. Flight delay, difficult conversation, unexpected chore..."
        />

        <div className={styles.tagsContainer}>
          <label className={styles.tagsLabel}>Acceptance Tags</label>
          <div className={styles.pillsRow}>
            {AVAILABLE_TAGS.map((tag) => {
              const active = acceptanceTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleTagToggle(tag)}
                  className={`${styles.pillButton} ${active ? styles.pillActive : ''}`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
