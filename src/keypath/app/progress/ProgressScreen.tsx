import { useEffect, useMemo, useState } from 'react'
import { Button, SegmentedControl } from '../../../ds'
import { canShareReport, shareReport } from '../../probe/shareReport'
import { RecordRepo, type ChallengeRecords } from '../challenges/records'
import { useApp } from '../context'
import type { StringKey } from '../i18n'
import { JourneyRepo, type JourneyProgress } from '../journey/progress'
import { JOURNEY } from '../journey/steps'
import type { Door } from '../log'
import type { Profile } from '../profiles'
import { TopBar } from '../screens/TopBar'
import { SongLibrary } from '../songs/library'
import { TakeRepo } from '../studio/takes'
import { summarise, type ProgressSummary } from './summary'
import styles from './progress.module.css'

const DOOR_TITLE: Record<Door, StringKey> = { songs: 'doorSongs', journey: 'doorJourney', challenges: 'doorChallenges', studio: 'doorStudio' }

interface Loaded {
  profile: Profile
  summary: ProgressSummary
  journey: JourneyProgress
  bests: ChallengeRecords
  keptTakes: number
  titles: Map<string, string>
}

/**
 * Progress: each player's engagement log, read back for the parent. The
 * questions it answers are the taster's own (KEYPATH_TUTOR.md §6); Share
 * sends the same numbers as text, to read later or to hand to Claude.
 */
export function ProgressScreen() {
  const { t, store, profiles, log, profile, settings } = useApp()
  const [players, setPlayers] = useState<Profile[]>([])
  const [who, setWho] = useState<string | null>(profile?.id ?? null)
  const [data, setData] = useState<Loaded | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    void profiles.list().then(setPlayers)
  }, [profiles])

  const repos = useMemo(() => ({ journey: new JourneyRepo(store), bests: new RecordRepo(store), takes: new TakeRepo(store), songs: new SongLibrary(store) }), [store])
  useEffect(() => {
    const p = players.find((x) => x.id === who)
    if (!p) return
    void (async () => {
      const [records, journey, bests, takes, songs] = await Promise.all([log.read(p.id), repos.journey.get(p.id), repos.bests.get(p.id), repos.takes.list(p.id), repos.songs.list(settings.language)])
      setData({ profile: p, summary: summarise(records), journey, bests, keptTakes: takes.length, titles: new Map(songs.map((e) => [e.song.id, e.song.title])) })
    })()
  }, [who, players, log, repos, settings.language])

  const report = () => {
    if (!data) return ''
    const { summary, journey, bests, keptTakes, titles } = data
    return JSON.stringify(
      {
        keypathProgress: 1,
        player: data.profile.name,
        takenAt: new Date().toISOString(),
        summary: { ...summary, songs: { ...summary.songs, bySong: summary.songs.bySong.map((s) => ({ ...s, title: titles.get(s.songId) ?? s.songId })) } },
        journeySteps: journey,
        challengeBests: bests,
        keptTakes,
      },
      null,
      2,
    )
  }
  const share = async () => {
    const outcome = await shareReport(report(), undefined, { title: `KeyPath progress: ${data?.profile.name}`, intro: `KeyPath progress for ${data?.profile.name}, from the engagement log on this phone.` })
    if (outcome === 'error' || outcome === 'unsupported') await copy()
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(report())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  const s = data?.summary
  const doneSteps = data ? JOURNEY.filter((x) => data.journey[x.id]) : []

  return (
    <main className={styles.screen}>
      <TopBar title={t('progress')} />
      {players.length > 1 && (
        <SegmentedControl size="sm" value={who ?? ''} onChange={setWho} options={players.map((p) => ({ value: p.id, label: `${p.avatar} ${p.name}` }))} />
      )}

      {data && s && s.sessions === 0 && <p className={styles.hint}>{t('pNoData', { name: data.profile.name })}</p>}

      {data && s && s.sessions > 0 && (
        <>
          <section className={styles.panel}>
            <h2 className={styles.h2}>{t('pGlance')}</h2>
            <p className={styles.hint}>{t('pRange', { from: s.from ?? '', to: s.to ?? '' })}</p>
            <dl className={styles.facts}>
              <dd>{t('pDays', { count: s.days.length })}</dd>
              <dd>{t('pSessions', { count: s.sessions, minutes: Math.round(s.minutes) })}</dd>
              <dd>{t('pCameBack', { count: s.cameBackNextDay })}</dd>
            </dl>
          </section>

          <section className={styles.panel}>
            <h2 className={styles.h2}>{t('pDoors')}</h2>
            <ul className={styles.rows}>
              {(Object.keys(DOOR_TITLE) as Door[]).map((d) => {
                const most = Math.max(1, ...Object.values(s.doors).map((x) => x.minutes))
                return (
                  <li key={d} className={styles.doorRow}>
                    <span className={styles.rowTitle}>{t(DOOR_TITLE[d])}</span>
                    <span className={styles.rowMeta}>{t('pDoorLine', { opens: s.doors[d].opens, first: s.doors[d].firstOpens, minutes: Math.round(s.doors[d].minutes) })}</span>
                    <span className={styles.meter} aria-hidden>
                      <span style={{ width: `${(s.doors[d].minutes / most) * 100}%` }} />
                    </span>
                  </li>
                )
              })}
            </ul>
            <p className={styles.hint}>{t('pDoorsHint')}</p>
          </section>

          <section className={styles.panel}>
            <h2 className={styles.h2}>{t('pSongs')}</h2>
            <p>{t('pSongsLine', { finished: s.songs.finished, abandoned: s.songs.abandoned, started: s.songs.started })}</p>
            {s.songs.bySong.length > 0 && (
              <ul className={styles.rows}>
                {s.songs.bySong.map((x) => (
                  <li key={x.songId} className={styles.songRow}>
                    <span className={styles.rowTitle}>{data.titles.get(x.songId) ?? x.songId}</span>
                    <span className={styles.rowMeta}>
                      {t('pSongRow', { finished: x.finished, abandoned: x.abandoned })}
                      {x.bestStars !== null && ` · ${'★'.repeat(x.bestStars)}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {s.songs.added > 0 && <p className={styles.hint}>{t('pAdded', { count: s.songs.added })}</p>}
          </section>

          <section className={styles.panel}>
            <h2 className={styles.h2}>{t('pJourney')}</h2>
            <p>{t('pJourneyLine', { done: doneSteps.length, total: JOURNEY.length, testOuts: doneSteps.filter((x) => data.journey[x.id]?.how === 'testOut').length })}</p>
            {doneSteps.length > 0 && <p className={styles.hint}>{doneSteps.map((x) => `✓ ${t(x.title)}`).join(' · ')}</p>}
            <p className={styles.hint}>{t('pChecks', { passed: s.journey.checksPassed, failed: s.journey.checksFailed })}</p>
          </section>

          <section className={styles.panel}>
            <h2 className={styles.h2}>{t('pChallenges')}</h2>
            <p>{t('pChallengesLine', { race: s.challenges.race, staff: s.challenges.staff, echo: s.challenges.echo, chord: s.challenges.chord })}</p>
            <h2 className={styles.h2}>{t('pStudio')}</h2>
            <p>{t('pStudioLine', { recorded: s.studio.recorded, kept: data.keptTakes, played: s.studio.played })}</p>
          </section>

          <section className={styles.panel}>
            <p>{t('pSuggestions', { accepted: s.suggestions.accepted, declined: s.suggestions.declined })}</p>
            {s.keyboard.lostMidSong > 0 && <p>{t('pKeyboard', { count: s.keyboard.lostMidSong })}</p>}
            {s.settingsChanged.length > 0 && (
              <>
                <h2 className={styles.h2}>{t('pSettings')}</h2>
                <ul className={styles.changes}>
                  {s.settingsChanged.slice(-8).map((c) => (
                    <li key={c.at + c.key}>
                      {c.at.slice(0, 10)} · {c.key}: {String(c.from)} → {String(c.to)}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </>
      )}

      {data && (
        <section className={styles.panel}>
          <div className={styles.actions}>
            {canShareReport() && <Button onClick={() => void share()}>{t('pShare')}</Button>}
            <Button variant={canShareReport() ? 'outline' : 'primary'} onClick={() => void copy()}>
              {copied ? t('pCopied') : t('pCopy')}
            </Button>
          </div>
          <p className={styles.hint}>{t('pShareHint')}</p>
        </section>
      )}
    </main>
  )
}
