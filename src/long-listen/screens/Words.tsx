import { useMemo, useState } from 'react'
import { KINDS, KIND_LABEL, allWords, letterOf, searchWords, type WordKind } from '../domain/dictionary'
import { termsIn } from '../domain/glossary'
import type { Programme } from '../domain/types'
import { useLoad, useServices } from '../app/services'
import { Empty } from '../components/common'
import s from '../styles/editorial.module.css'

/**
 * The dictionary: the words of orchestral music, A to Z, set as the Journal
 * sets its weeks — the letter in the margin, a hairline running down to the
 * next. Every term the notes underline is here, and the plain words around
 * them (instruments, the people on the stage, periods, the basics of a score).
 * All kept in the app: nothing is asked for, so it opens at once, offline too.
 */
/** Which words, like the Library's views: all of them, the ones the notes underline, the ones in this week's notes. */
type Which = 'all' | 'notes' | 'week'
const WHICH: { value: Which; label: string }[] = [
  { value: 'all', label: 'Everything' },
  { value: 'notes', label: 'In your notes' },
  { value: 'week', label: 'This week' },
]

/** Everything this week's programmes say, where a term can be underlined: the notes, each work's, what to listen for. */
export function weekPassages(programmes: Programme[], weekKey: string): string[] {
  return programmes.filter((p) => p.weekKey === weekKey).flatMap((p) => [
    p.dek, p.introduction, p.whyNow, p.historicalPlace, p.howTheyRelate, p.continuityNote ?? '',
    ...p.sections.flatMap((x) => [x.note ?? '', ...x.items.flatMap((i) => [i.why, i.whyThisRecording, i.revisitReason ?? '', ...i.listenFor])]),
  ]).filter(Boolean)
}

export function WordsScreen() {
  const { repo, week } = useServices()
  const words = useMemo(() => allWords(), [])
  const [q, setQ] = useState('')
  const [which, setWhich] = useState<Which>('all')
  const [kind, setKind] = useState<WordKind | ''>('')
  // The terms this week's notes underline: read from the programmes kept on the device, nothing asked for.
  const { data: thisWeek } = useLoad(async () => termsIn(weekPassages(await repo.programmes.all(), week.key)), [week.key])
  const shown = useMemo(() => {
    const pool = words.filter((w) => (!kind || w.kind === kind) && (which === 'all' || (which === 'notes' ? w.inNotes : thisWeek?.has(w.term))))
    return searchWords(pool, q)
  }, [words, q, kind, which, thisWeek])
  const letters = useMemo(() => {
    const by = new Map<string, typeof shown>()
    for (const w of shown) by.set(letterOf(w.term), [...(by.get(letterOf(w.term)) ?? []), w])
    return [...by.entries()]
  }, [shown])

  return (
    <div>
      <p className={s.eyebrow}>Words</p>
      <h1 className={s.title}>The words of the orchestra</h1>
      <p className={s.dek}>Forms, instruments, markings and the rest: what each means, and how to hear it.</p>
      <p className={s.faint}>The words marked like <span className={s.wordsSample}>this</span> are the ones underlined in the curator’s notes.</p>

      <label className={s.visuallyHidden} htmlFor="words-q">Search the words</label>
      <input id="words-q" className={s.search} type="search" placeholder="A word, or what it does: slow, bow, repeat…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className={s.chipRow} role="radiogroup" aria-label="Which words">
        {WHICH.map((v) => (
          <button key={v.value} type="button" role="radio" aria-checked={which === v.value} className={`${s.chip} ${which === v.value ? s.chipOn : ''}`} onClick={() => setWhich(v.value)}>
            {v.label}{v.value === 'week' && thisWeek ? ` · ${thisWeek.size}` : ''}
          </button>
        ))}
      </div>
      <div className={`${s.chipRow} ${s.mtSm}`} role="radiogroup" aria-label="Which kind of word">
        {(['', ...KINDS] as const).map((k) => (
          <button key={k || 'all'} type="button" role="radio" aria-checked={kind === k} className={`${s.chip} ${kind === k ? s.chipOn : ''}`} onClick={() => setKind(k)}>
            {k ? KIND_LABEL[k] : 'Every kind'}
          </button>
        ))}
      </div>

      {letters.length === 0 && (
        <Empty>
          {which === 'week' && !q.trim() && !kind ? 'This week’s notes underline no words yet.' : `No word matches${q.trim() ? ` “${q.trim()}”` : ''}${kind ? ` in ${KIND_LABEL[kind].toLowerCase()}` : ''}${which === 'week' ? ' this week' : which === 'notes' ? ' in your notes' : ''}.`}
        </Empty>
      )}

      {letters.map(([letter, list]) => (
        <section key={letter} className={s.journalWeek} aria-label={`Words beginning with ${letter}`}>
          {/* The letter in the margin, a rule running down to the next: the journal's timeline, A to Z. */}
          <div className={s.weekMark} aria-hidden="true">
            <span className={s.weekNum}>{letter}</span>
          </div>
          <dl className={`${s.weekBody} ${s.wordList}`}>
            {list.map((w) => (
              <div key={w.term} className={s.wordEntry}>
                <dt className={s.wordTerm}>
                  <span className={w.inNotes ? s.wordsSample : undefined}>{w.term}</span>
                  {!kind && <span className={s.wordKind}>{KIND_LABEL[w.kind]}</span>}
                </dt>
                <dd className={s.wordDef}>{w.definition}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  )
}
