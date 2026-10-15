import { useMemo, useState } from 'react'
import { ComposerLink } from './Composer'
import { filingLetter } from '../domain/library'
import { useLoad, useServices } from '../app/services'
import { href } from '../app/router'
import { Empty, Problem, Waiting } from '../components/common'
import { LibraryWorks, loadLibrary } from '../components/LibraryEntries'
import { searchLibrary } from '../domain/librarySearch'
import s from '../styles/editorial.module.css'

/**
 * Everything met so far, as a library: composers by surname, their works, and
 * every recording of each — the curator's choice and any second perspective —
 * with where it stands and what you said. Explore, without a feed.
 */
export function LibraryScreen() {
  const { repo, settings } = useServices()
  const [q, setQ] = useState('')
  const { data, error, retry } = useLoad(() => loadLibrary(repo, settings), [settings.hideSkipped, settings.timeZone])

  const shown = useMemo(() => (data ? searchLibrary(data, q) : []), [data, q])

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
          <input id="lib-q" className={s.search} type="search" placeholder="A composer, a work, a conductor…" value={q} onChange={(e) => setQ(e.target.value)} />
        </>
      )}

      {data.length === 0 && <Empty link={{ href: href({ name: 'week' }), label: 'This week' }}>Nothing yet. Each work you’re offered, and each concert you keep, is filed here.</Empty>}
      {data.length > 0 && shown.length === 0 && <p className={s.quiet}>Nothing here matches “{q}”.</p>}

      {shown.map((e, i) => {
        // A card catalogue's guide letter wherever the surnames move on to a new one.
        const letter = filingLetter(e.composer)
        const newLetter = i === 0 || filingLetter(shown[i - 1].composer) !== letter
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
