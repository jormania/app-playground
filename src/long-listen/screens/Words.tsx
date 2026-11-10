import { useEffect, useMemo, useState } from 'react'
import { FILTERS, allWords, crossReferences, letterOf, searchWords, wordAnchor } from '../domain/dictionary'
import { useKept } from '../app/kept'
import { href } from '../app/router'
import { BackLink } from '../components/BackLink'
import { Empty } from '../components/common'
import s from '../styles/editorial.module.css'

/**
 * The dictionary: the words of orchestral music, A to Z, set as the Journal
 * sets its weeks — the letter in the margin, a hairline running down to the
 * next. Every term the notes underline is here, and the plain words around
 * them (instruments, the people on the stage, periods, the basics of a score).
 * All kept in the app: nothing is asked for, so it opens at once, offline too.
 */
export function WordsScreen() {
  const words = useMemo(() => allWords(), [])
  // Kept for the tab, as the Library keeps its search: back from a programme, the page is as it was left.
  const [q, setQ] = useKept('words-search', 'tab')
  // One row of four chips, broad shelves (2026-11-10: eleven chips on three rows were too many).
  const [shelfKept, setShelf] = useKept('words-shelf', 'tab')
  const shelf = FILTERS.find((f) => f.value === shelfKept)
  // A word followed from another's definition: everything that would hide it is cleared, then it is brought into view.
  const [jump, setJump] = useState<string | null>(null)
  useEffect(() => {
    if (!jump) return
    const el = document.getElementById(wordAnchor(jump))
    // At once: a smooth glide across two hundred words takes seconds, and the wash would fade before it landed.
    el?.scrollIntoView({ block: 'center' })
    el?.focus({ preventScroll: true })
    const t = window.setTimeout(() => setJump(null), 2400)
    return () => window.clearTimeout(t)
  }, [jump])
  const follow = (term: string) => { setQ(''); setShelf(''); setJump(term) }
  const shown = useMemo(() => searchWords(shelf ? words.filter((w) => shelf.kinds.includes(w.kind)) : words, q), [words, q, shelf])
  const letters = useMemo(() => {
    const by = new Map<string, typeof shown>()
    for (const w of shown) by.set(letterOf(w.term), [...(by.get(letterOf(w.term)) ?? []), w])
    return [...by.entries()]
  }, [shown])

  return (
    <div>
      {/* A dictionary is looked things up in: the way back to where you were reading. */}
      <BackLink back to={href({ name: 'week' })} label="This week" />
      <p className={s.eyebrow}>Words</p>
      <h1 className={s.title}>The words of the orchestra</h1>
      <p className={s.dek}>Forms, instruments, markings and the rest: what each means, and how to hear it.</p>
      <p className={s.faint}>The words marked like <span className={s.wordsSample}>this</span> are the ones underlined in the curator’s notes.</p>

      <label className={s.visuallyHidden} htmlFor="words-q">Search the words</label>
      <input id="words-q" className={s.search} type="search" placeholder="A word, or what it does: slow, bow, repeat…" value={q} onChange={(e) => setQ(e.target.value)} />
      {/* Four shelves on one row, no "All": the lit one, tapped again, shows every word. */}
      <div className={`${s.chipRow} ${s.shelfRow}`} role="group" aria-label="Show only">
        {FILTERS.map((f) => {
          const on = shelf?.value === f.value
          return (
            <button key={f.value} type="button" aria-pressed={on} className={`${s.chip} ${on ? s.chipOn : ''}`} onClick={() => setShelf(on ? '' : f.value)}>
              {f.label}
            </button>
          )
        })}
      </div>

      {letters.length > 0 && (
        <>
          <p className={`${s.faint} ${s.mtSm}`} role="status">
            {shown.length === words.length ? `${words.length} words` : `${shown.length} of ${words.length} words`}
          </p>
          {/* A to Z at a tap: only the letters there are words for, as the page now stands. */}
          <nav className={s.letterIndex} aria-label="Jump to a letter">
            {letters.map(([letter]) => (
              <button key={letter} type="button" className={s.letterJump} onClick={() => document.getElementById(`letter-${letter}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })}>{letter}</button>
            ))}
          </nav>
        </>
      )}

      {letters.length === 0 && (
        <Empty>
          {`No word matches${q.trim() ? ` “${q.trim()}”` : ''}${shelf ? ` in ${shelf.label.toLowerCase()}` : ''}.`}
        </Empty>
      )}

      {letters.map(([letter, list]) => (
        <section key={letter} id={`letter-${letter}`} className={`${s.journalWeek} ${s.letterSection}`} aria-label={`Words beginning with ${letter}`}>
          {/* The letter in the margin, a rule running down to the next: the journal's timeline, A to Z. */}
          <div className={s.weekMark} aria-hidden="true">
            <span className={s.weekNum}>{letter}</span>
          </div>
          <dl className={`${s.weekBody} ${s.wordList}`}>
            {list.map((w) => (
              <div key={w.term} id={wordAnchor(w.term)} tabIndex={-1} className={`${s.wordEntry} ${jump === w.term ? s.wordJumped : ''}`}>
                <dt className={s.wordTerm}>
                  <span className={w.inNotes ? s.wordsSample : undefined}>{w.term}</span>
                  {/* Its other name, listed with it rather than as a second entry saying the same. */}
                  {w.aka.length > 0 && <span className={s.wordKind}>also {w.aka.join(', ')}</span>}
                </dt>
                <dd className={s.wordDef}>
                  {/* Another word with its own entry, followed from here: the notes' dotted line, a tap to it. */}
                  {crossReferences(w.definition, w.term).map((p, i) => (typeof p === 'string' ? p : (
                    <button key={i} type="button" className={s.wordRef} onClick={() => follow(p.term)}>{p.text}</button>
                  )))}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  )
}
