import { useEffect, useMemo, useState } from 'react'
import { Button } from '../../../ds'
import { useApp } from '../context'
import { navigate } from '../router'
import { TopBar } from '../screens/TopBar'
import { SongLibrary, type LibraryEntry } from './library'
import styles from './songs.module.css'

/** The Songs door: the starter pack, then the family's own songs, then "Add a song". */
export function SongsHome() {
  const { t, store, settings } = useApp()
  const library = useMemo(() => new SongLibrary(store), [store])
  const [entries, setEntries] = useState<LibraryEntry[] | null>(null)

  useEffect(() => {
    void library.list(settings.language).then(setEntries)
  }, [library, settings.language])

  if (!entries) return null
  const starters = entries.filter((e) => e.source === 'starter')
  const own = entries.filter((e) => e.source === 'import')
  const item = (e: LibraryEntry) => (
    <li key={e.song.id}>
      <button type="button" className={styles.songItem} onClick={() => navigate({ name: 'play', songId: e.song.id })}>
        <span className={styles.songTitle}>{e.song.title}</span>
        <span className={styles.songMeta}>
          {e.song.notes.some((n) => n.hand === 'left') ? '🖐🖐' : '🖐'} · {Math.round(e.song.durationMs / 1000)} s
        </span>
      </button>
    </li>
  )

  return (
    <main className={styles.screen}>
      <TopBar title={t('doorSongs')} />
      <section className={styles.panel}>
        <h2 className={styles.h2}>{t('starterSongs')}</h2>
        <ul className={styles.songList}>{starters.map(item)}</ul>
      </section>
      <section className={styles.panel}>
        <h2 className={styles.h2}>{t('yourSongs')}</h2>
        {own.length > 0 && <ul className={styles.songList}>{own.map(item)}</ul>}
        <div>
          <Button variant="outline" onClick={() => navigate({ name: 'songImport' })}>
            {t('addSong')}
          </Button>
        </div>
        <p className={styles.hint}>{t('addSongHint')}</p>
      </section>
    </main>
  )
}
