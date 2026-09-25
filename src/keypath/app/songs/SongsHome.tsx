import { useEffect, useMemo, useState } from 'react'
import { Button, Field } from '../../../ds'
import { useApp } from '../context'
import { navigate } from '../router'
import { TopBar } from '../screens/TopBar'
import { MAX_TITLE, SongLibrary, type LibraryEntry } from './library'
import { fitOptions, type FitMode } from '../../engine'
import { FitChoice } from './FitChoice'
import { byLevel, levelOf, ratedLevel, type Level } from './level'
import { LevelPick, SongFacts } from './SongFacts'
import { playedWhen, songProgress, type SongProgress } from './songProgress'
import styles from './songs.module.css'

/** The Songs door: the starter pack, then the family's own songs, then "Add a song". Each with her stars and when she last played it. */
export function SongsHome() {
  const { t, store, settings, profile, log } = useApp()
  const library = useMemo(() => new SongLibrary(store), [store])
  const [entries, setEntries] = useState<LibraryEntry[] | null>(null)
  const [progress, setProgress] = useState<ReadonlyMap<string, SongProgress>>(new Map())
  /** The added song whose title and Remove are open. */
  const [open, setOpen] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [sure, setSure] = useState(false)

  useEffect(() => {
    void library.list(settings.language).then(setEntries)
  }, [library, settings.language])
  useEffect(() => {
    if (profile) void log.read(profile.id).then((r) => setProgress(songProgress(r)))
  }, [log, profile])

  if (!entries) return null
  // Easiest first, so the list itself is a way up.
  const starters = byLevel(entries.filter((e) => e.source === 'starter'))
  const own = entries.filter((e) => e.source === 'import')

  const when = (iso: string) => {
    const w = playedWhen(iso)
    if (w.kind === 'today') return t('songPlayedToday')
    if (w.kind === 'yesterday') return t('songPlayedYesterday')
    const date = new Date(`${w.date}T12:00`).toLocaleDateString(settings.language === 'ro' ? 'ro-RO' : 'en-GB', { day: 'numeric', month: 'short' })
    return t('songPlayedOn', { date })
  }
  const toggle = (e: LibraryEntry) => {
    setSure(false)
    setDraft(e.song.title)
    setOpen((o) => (o === e.song.id ? null : e.song.id))
  }
  const rename = async (id: string) => {
    await library.rename(id, draft)
    setEntries(await library.list(settings.language))
    setOpen(null)
    if (profile) void log.add(profile.id, { type: 'song_renamed', songId: id })
  }
  const refit = async (id: string, mode: FitMode) => {
    await library.refit(id, mode)
    setEntries(await library.list(settings.language))
  }
  const relevel = async (id: string, level: Level) => {
    await library.setLevel(id, level)
    setEntries(await library.list(settings.language))
  }
  const remove = async (id: string) => {
    if (!sure) return setSure(true)
    await library.remove(id)
    setEntries(await library.list(settings.language))
    setOpen(null)
    setSure(false)
    if (profile) void log.add(profile.id, { type: 'song_removed', songId: id })
  }

  /** Notes past the keyboard: the choice made when it was added, to change here. */
  const fitSection = (e: LibraryEntry) => {
    const options = fitOptions(e.song.source ?? [])
    if (options.length === 0) return null
    const outside = options.find((o) => o.mode === 'dropNotes')?.dropped ?? 0
    return <FitChoice options={options} value={e.song.fit ?? options[0].mode} onChange={(m) => void refit(e.song.id, m)} outside={outside} />
  }

  const item = (e: LibraryEntry, editable: boolean) => {
    const p = progress.get(e.song.id)
    return (
      <li key={e.song.id} className={styles.songRow}>
        <button type="button" className={styles.songItem} onClick={() => navigate({ name: 'play', songId: e.song.id })}>
          <span className={styles.songText}>
            <span className={styles.songTitle}>{e.song.title}</span>
            <SongFacts song={e.song} />
            {p && (
              <span className={styles.songProgress}>
                {p.bestStars !== null && (
                  <span className={styles.songStars} aria-label={t('songStars', { count: p.bestStars })}>
                    {'★'.repeat(p.bestStars)}
                    {'☆'.repeat(Math.max(0, 3 - p.bestStars))}
                  </span>
                )}
                <span>{when(p.lastPlayed)}</span>
              </span>
            )}
          </span>
        </button>
        {editable && (
          <button type="button" className={styles.songMoreButton} aria-expanded={open === e.song.id} aria-label={t('songMore', { title: e.song.title })} onClick={() => toggle(e)}>
            ⋯
          </button>
        )}
        {open === e.song.id && (
          <div className={styles.songMore}>
            <form
              className={styles.renameRow}
              onSubmit={(ev) => {
                ev.preventDefault()
                void rename(e.song.id)
              }}
            >
              <Field label={t('songTitle')} value={draft} maxLength={MAX_TITLE} onChange={(ev) => setDraft(ev.target.value)} />
              <Button type="submit" size="sm" disabled={!draft.trim()}>
                {t('songSaveTitle')}
              </Button>
            </form>
            <LevelPick level={levelOf(e.song)} rated={ratedLevel(e.song)} onChange={(l) => void relevel(e.song.id, l)} />
            {e.song.source && fitSection(e)}
            <div className={styles.actions}>
              <Button size="sm" variant={sure ? 'danger' : 'ghost'} onClick={() => void remove(e.song.id)}>
                {sure ? t('songRemoveSure') : t('songRemove')}
              </Button>
            </div>
            <p className={styles.hint}>{t('songRemoveHint')}</p>
          </div>
        )}
      </li>
    )
  }

  return (
    <main className={styles.screen}>
      <TopBar title={t('doorSongs')} />
      <section className={styles.panel}>
        <h2 className={styles.h2}>{t('starterSongs')}</h2>
        <ul className={styles.songList}>{starters.map((e) => item(e, false))}</ul>
      </section>
      <section className={styles.panel}>
        <h2 className={styles.h2}>{t('yourSongs')}</h2>
        {own.length > 0 && <ul className={styles.songList}>{own.map((e) => item(e, true))}</ul>}
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
