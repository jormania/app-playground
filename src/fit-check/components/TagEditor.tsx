import {
  CATEGORIES, COLOURS, STYLES, WARMTHS,
  type Category, type Colour, type Style, type Warmth,
} from '../lib/vocabulary.ts'
import type { SuggestedTags } from '../lib/tagging.ts'

/**
 * Review and correct the tags. Every value is a chip, because the vocabulary is
 * closed — there is nothing to type, so there is nothing to get wrong, and the
 * charter asks for taps over forms.
 *
 * Shown whether or not the AI ran. If it did, its answer arrives pre-selected
 * and this is a correction pass; if it didn't (no key, offline, a refusal) the
 * chips are simply empty and this is how tags get set. Same component, so the
 * AI is a shortcut rather than a dependency.
 */
export default function TagEditor({
  tags,
  onChange,
  disabled,
}: {
  tags: SuggestedTags
  onChange: (next: SuggestedTags) => void
  disabled?: boolean
}) {
  /** Single-choice: tapping the selected chip clears it, so a wrong guess is
   *  one tap to remove rather than a value you're stuck with. */
  function single<T extends string>(key: 'category' | 'warmth', value: T) {
    onChange({ ...tags, [key]: tags[key] === value ? null : value })
  }

  function multi(key: 'colours' | 'styles', value: string) {
    const current = tags[key] as string[]
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value]
    onChange({ ...tags, [key]: next })
  }

  return (
    <>
      <TagRow label="What kind of thing is it?">
        {CATEGORIES.map((c) => (
          <Chip
            key={c}
            label={c}
            selected={tags.category === c}
            disabled={disabled}
            onClick={() => single<Category>('category', c)}
          />
        ))}
      </TagRow>

      <TagRow label="How warm is it?">
        {WARMTHS.map((w) => (
          <Chip
            key={w}
            label={w}
            selected={tags.warmth === w}
            disabled={disabled}
            onClick={() => single<Warmth>('warmth', w)}
          />
        ))}
      </TagRow>

      <TagRow label="Colours">
        {COLOURS.map((c) => (
          <Chip
            key={c}
            label={c}
            selected={tags.colours.includes(c as Colour)}
            disabled={disabled}
            onClick={() => multi('colours', c)}
          />
        ))}
      </TagRow>

      <TagRow label="When would you wear it?">
        {STYLES.map((s) => (
          <Chip
            key={s}
            label={s}
            selected={tags.styles.includes(s as Style)}
            disabled={disabled}
            onClick={() => multi('styles', s)}
          />
        ))}
      </TagRow>
    </>
  )
}

function TagRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="fc-tag-row">
      <p className="fc-settings-hint">{label}</p>
      <div className="fc-chips">{children}</div>
    </section>
  )
}

function Chip({
  label, selected, disabled, onClick,
}: {
  label: string
  selected: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className="fc-chip"
      role="checkbox"
      aria-checked={selected}
      data-selected={selected}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  )
}
