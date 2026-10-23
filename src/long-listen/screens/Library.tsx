import { useMemo } from 'react'
import { ComposerLink } from './Composer'
import { filingLetter } from '../domain/library'
import { useLoad, useServices } from '../app/services'
import { href } from '../app/router'
import { useKept } from '../app/kept'
import { Empty, Problem, Waiting } from '../components/common'
import { LibraryWorks, loadLibrary } from '../components/LibraryEntries'
import { searchLibrary } from '../domain/librarySearch'
import { LIBRARY_VIEWS, viewLibrary, type LibraryView } from '../domain/library'
import s from '../styles/editorial.module.css'

/**
 * Everything met so far, as a library: composers by surname, their works, and
 * every recording of each — the curator's choice and any second perspective —
 * with where it stands and what you said. Explore, without a feed.
 */
export function LibraryScreen() {
  const { repo, settings } = useServices()
  // The search stays as it was left: back from a composer's page, the same list, the same place in it.
  const [q, setQ] = useKept('library-search', 'tab')
  const { data, error, retry } = useLoad(() => loadLibrary(repo, settings), [settings.hideSkipped, settings.timeZone])

  // Three ways to look: everything met (A–Z), only what was heard (A–Z), or the most recently met first.
  const [viewKept, setView] = useKept('library-view', 'tab')
  const view: LibraryView = viewKept === 'heard' || viewKept === 'recent' ? viewKept : 'all'
  const shown = useMemo(() => (data ? viewLibrary(searchLibrary(data, q), view) : []), [data, q, view])

  if (error) return <Problem error={error} onRetry={retry} />
  if (!data) return <Waiting>Opening the library…</Waiting>

  return (
    <div>
      <p className={s.eyebrow}>Library</p>
      <h1 className={s.title}>Everything met so far</h1>
      <p className={s.dek}>Composers, their works, every recording you’ve been offered, and what you heard live.</p>
      {/* Nothing to search until something has been met. */}
      {data.length > 0 && (
        <>
          <label className={s.visuallyHidden} htmlFor="lib-q">Search the library</label>
          <input id="lib-q" className={s.search} type="search" placeholder="A composer, a work, a conductor, what you said…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className={s.chipRow} role="radiogroup" aria-label="What the library shows">
            {LIBRARY_VIEWS.map((v) => (
              <button key={v.value} type="button" role="radio" aria-checked={view === v.value} className={`${s.chip} ${view === v.value ? s.chipOn : ''}`} onClick={() => setView(v.value === 'all' ? '' : v.value)}>{v.label}</button>
            ))}
          </div>
        </>
      )}

      {data.length === 0 && <Empty link={{ href: href({ name: 'week' }), label: 'This week' }}>Nothing yet. Each work you’re offered, and each concert you keep, is filed here.</Empty>}
      {data.length > 0 && shown.length === 0 && <p className={s.quiet}>{q.trim() ? <>Nothing here matches “{q}”{view === 'heard' ? ' among what you’ve heard' : ''}.</> : 'Nothing heard yet — what you hear is filed here as you go.'}</p>}

      {shown.map((e, i) => {
        // A card catalogue's guide letter wherever the surnames move on to a new one.
        const letter = filingLetter(e.composer)
        // Not in "recent": the order is time there, and letters would only interrupt it.
        const newLetter = view !== 'recent' && (i === 0 || filingLetter(shown[i - 1].composer) !== letter)
        return (
          <section key={e.composer} className={s.journalWeek}>
            {newLetter && <p className={s.indexLetter} aria-hidden="true">{letter}</p>}
            <h2 className={s.h2}><ComposerLink name={e.composer} /></h2>
            <LibraryWorks works={e.works} />
          </section>
        )
      })}
    </div>
  )
}
