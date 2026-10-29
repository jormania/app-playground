import s from '../styles/editorial.module.css'

/**
 * A few descriptive words, named for what they describe — "Character:
 * atmospheric · luminous", "The playing: transparent · exact" — as quiet tags
 * on one labelled row, never a loose italic line whose purpose has to be guessed.
 * Accepts a list or the curator's comma-separated phrase.
 */
export function Traits({ label, words, className }: { label: string; words: string[] | string | undefined; className?: string }) {
  const { tags, prose } = traitsOf(words)
  if (!tags.length && !prose) return null
  return (
    <p className={className ? `${s.traits} ${className}` : s.traits}>
      <span className={s.traitsLabel}>{label}</span>
      {tags.length ? tags.map((w) => <span key={w} className={s.tag}>{w}</span>) : <em className={s.traitsProse}>{prose}</em>}
    </p>
  )
}

/**
 * The words as tags. A sentence isn't a handful of words: cut at its commas it ran
 * off the screen as tags ("velvety and fluid; a rich…", 29 October 2026). Its
 * opening words are tags when they are short ("Warm, velvety and fluid; a rich,
 * blended orchestral sound…" → warm · velvety and fluid), and the rest is left: a
 * stand-in reads like any recording. A sentence with no short opening is said as written.
 */
export function traitsOf(words: string[] | string | undefined): { tags: string[]; prose?: string } {
  if (Array.isArray(words)) return { tags: words.map((w) => w.trim()).filter(Boolean) }
  const text = String(words ?? '').trim()
  if (!text) return { tags: [] }
  const tags: string[] = []
  for (const part of text.split(/\s*([,·;.])\s*/)) {
    if (part === ',' || part === '·') continue
    if (part === ';' || part === '.') break
    const w = part.trim()
    if (!w) continue
    if (w.split(/\s+/).length > 3) break
    tags.push(w.charAt(0).toLowerCase() + w.slice(1))
  }
  return tags.length ? { tags } : { tags: [], prose: text }
}
