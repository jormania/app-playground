import s from '../styles/editorial.module.css'

/**
 * A few descriptive words, named for what they describe — "Character:
 * atmospheric · luminous", "The playing: transparent · exact" — as quiet tags
 * on one labelled row, never a loose italic line whose purpose has to be guessed.
 * Accepts a list or the curator's comma-separated phrase.
 */
export function Traits({ label, words, className }: { label: string; words: string[] | string | undefined; className?: string }) {
  const list = (Array.isArray(words) ? words : String(words ?? '').split(/\s*[,·]\s*/)).map((w) => w.trim()).filter(Boolean)
  if (!list.length) return null
  // A sentence isn't a handful of words: cut at its commas it ran off the screen as tags
  // ("velvety and fluid; a rich…", 29 October 2026). Said as it was written, under the same label.
  if (!Array.isArray(words) && list.some((w) => w.split(/\s+/).length > 3 || /[;.]/.test(w))) {
    return (
      <p className={className ? `${s.traits} ${className}` : s.traits}>
        <span className={s.traitsLabel}>{label}</span>
        <em className={s.traitsProse}>{String(words).trim()}</em>
      </p>
    )
  }
  return (
    <p className={className ? `${s.traits} ${className}` : s.traits}>
      <span className={s.traitsLabel}>{label}</span>
      {list.map((w) => <span key={w} className={s.tag}>{w}</span>)}
    </p>
  )
}
