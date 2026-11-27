import { useEffect, useMemo, useState } from 'react'
import { Button, SegmentedControl } from '../../../ds'
import { canShareReport, shareReport } from '../../probe/shareReport'
import { RecordRepo, type ChallengeRecords } from '../challenges/records'
import { useApp } from '../context'
import type { StringKey } from '../i18n'
import { JourneyRepo, type JourneyProgress } from '../journey/progress'
import { JOURNEY } from '../journey/steps'
import type { Door, LogRecord } from '../log'
import { levelOf } from '../songs/level'
import { WeeklyNote } from './WeeklyNote'
import type { Profile } from '../profiles'
import { TopBar } from '../screens/TopBar'
import { SongLibrary } from '../songs/library'
import { TakeRepo } from '../studio/takes'
import { SETUP_STEP_TITLE } from '../connect/setup'
import { CHORD_LEVEL_NAME, EAR_LEVEL_NAME, ECHO_LEVEL_NAME, RACE_LEVEL_NAME, READ_LEVEL_NAME, STAFF_LEVEL_NAME } from '../challenges/ChallengesHome'
import { localDate, summarise, type ProgressSummary } from './summary'
import styles from './progress.module.css'

const DOOR_TITLE: Record<Door, StringKey> = { songs: 'doorSongs', journey: 'doorJourney', challenges: 'doorChallenges', studio: 'doorStudio' }

interface Loaded {
  profile: Profile
  summary: ProgressSummary
  journey: JourneyProgress
  bests: ChallengeRecords
  keptTakes: number
  titles: Map<string, string>
  records: LogRecord[]
  levels: Map<string, 1 | 2 | 3>
}

/**
 * Progress: each player's engagement log, read back for the parent. The
 * questions it answers are the taster's own (KEYPATH_TUTOR.md §6); Share
 * sends the same numbers as text, to read later or to hand to Claude.
 */
/** The games, as Progress lists them: the race on the staff is a game of its own here, with its own bests. */
const GAMES: { key: 'race' | 'staff' | 'echo' | 'chord' | 'ear' | 'read'; title: StringKey; levels: Record<number, StringKey> }[] = [
  { key: 'race', title: 'raceTitle', levels: RACE_LEVEL_NAME },
  { key: 'staff', title: 'raceTitle', levels: STAFF_LEVEL_NAME },
  { key: 'echo', title: 'echoTitle', levels: ECHO_LEVEL_NAME },
  { key: 'chord', title: 'chordTitle', levels: CHORD_LEVEL_NAME },
  { key: 'ear', title: 'earTitle', levels: EAR_LEVEL_NAME },
  { key: 'read', title: 'readTitle', levels: READ_LEVEL_NAME },
]

/** Each setting as Settings names it, for the list of changes. */
const SETTING_NAME: Record<string, StringKey> = {
  language: 'language',
  noteNames: 'noteNames',
  onWrong: 'onWrong',
  timing: 'timing',
  report: 'report',
  wrongAffectsStars: 'wrongAffectsStars',
  keyNames: 'keyNames',
  fingers: 'fingerNumbers',
  fingersFade: 'fingerFade',
  score: 'scoreToggle',
  coach: 'coachToggle',
}
const SETTING_VALUE: Record<string, StringKey> = {
  'onWrong:wait': 'onWrongWait',
  'onWrong:show': 'onWrongShow',
  'onWrong:keepGoing': 'onWrongKeepGoing',
  'timing:relaxed': 'timingRelaxed',
  'timing:normal': 'timingNormal',
  'timing:strict': 'timingStrict',
  'report:off': 'reportOff',
  'report:short': 'reportShort',
  'report:detailed': 'reportDetailed',
  'noteNames:auto': 'noteNamesAuto',
  'noteNames:letters': 'noteNamesLetters',
  'noteNames:solfege': 'noteNamesSolfege',
  'noteNames:both': 'noteNamesBoth',
}

/** A few headline numbers, each a label over its value: read at a glance, two to a row on a phone. */
function Tiles({ items }: { items: [string, string | number][] }) {
  return (
    <dl className={styles.tiles}>
      {items.map(([label, value]) => (
        <div key={label} className={styles.tile}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

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
      setData({
        profile: p,
        summary: summarise(records),
        journey,
        bests,
        keptTakes: takes.length,
        titles: new Map(songs.map((e) => [e.song.id, e.song.title])),
        records,
        levels: new Map(songs.map((e) => [e.song.id, levelOf(e.song)])),
      })
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
  /** "24 Sep" (or "24 sept." in Romanian) from the summary's local YYYY-MM-DD. */
  const day = (d: string | null) => (d ? new Date(`${d}T12:00`).toLocaleDateString(settings.language === 'ro' ? 'ro-RO' : 'en-GB', { day: 'numeric', month: 'short' }) : '')
  const doneSteps = data ? JOURNEY.filter((x) => data.journey[x.id]) : []
  const testOuts = data ? doneSteps.filter((x) => data.journey[x.id]?.how === 'testOut').length : 0
  /** The games she has played, with rounds and her best at each level she played; and the ones not yet. */
  const games = data && s ? GAMES.map((g) => {
    const bests = Object.entries(data.bests[g.key] ?? {}).filter(([, v]) => typeof v === 'number' && v > 0) as [string, number][]
    return {
      key: g.key,
      name: g.key === 'staff' ? t('pRaceStaff') : t(g.title),
      rounds: s.challenges[g.key],
      best: bests.map(([level, score]) => `${score} (${t(g.levels[Number(level)] ?? g.levels[1])})`).join(', '),
    }
  }) : []
  const played = games.filter((g) => g.rounds > 0 || g.best)
  const notPlayed = games.filter((g) => !(g.rounds > 0 || g.best) && g.key !== 'staff').map((g) => g.name)
  /** A setting's name and values as Settings shows them, not as stored. */
  const settingName = (key: string) => (key in SETTING_NAME ? t(SETTING_NAME[key]) : key)
  const settingValue = (key: string, v: unknown): string => {
    if (typeof v === 'boolean') return t(v ? 'pSettingOn' : 'pSettingOff')
    if (key === 'language') return v === 'ro' ? 'Română' : v === 'en' ? 'English' : String(v)
    const k = SETTING_VALUE[`${key}:${String(v)}`]
    return k ? t(k) : String(v)
  }

  return (
    <main className={styles.screen}>
      <TopBar title={t('progress')} />
      {players.length > 1 && (
        <SegmentedControl wrap size="sm" value={who ?? ''} onChange={setWho} options={players.map((p) => ({ value: p.id, label: `${p.avatar} ${p.name}` }))} />
      )}

      {data && s && s.sessions === 0 && <p className={styles.hint}>{t('pNoData', { name: data.profile.name })}</p>}

      {data && s && s.sessions > 0 && (
        <>
          <WeeklyNote key={data.profile.id} player={data.profile} records={data.records} titles={data.titles} levels={data.levels} />
          <section className={styles.panel}>
            <h2 className={styles.h2}>{t('pGlance')}</h2>
            <p className={styles.hint}>{s.from === s.to ? day(s.from) : t('pRange', { from: day(s.from), to: day(s.to) })}</p>
            <Tiles
              items={[
                [t('pTileDays'), s.days.length],
                [t('pTileTime'), t('pMinutes', { count: Math.round(s.minutes) })],
                [t('pTileSessions'), s.sessions],
                [t('pTileCameBack'), t('pTimes', { count: s.cameBackNextDay })],
              ]}
            />
          </section>

          <section className={styles.panel}>
            <h2 className={styles.h2}>{t('pDoors')}</h2>
            <ul className={styles.rows}>
              {(Object.keys(DOOR_TITLE) as Door[]).map((d) => {
                const most = Math.max(1, ...Object.values(s.doors).map((x) => x.minutes))
                const door = s.doors[d]
                return (
                  <li key={d} className={styles.meterRow}>
                    <span className={styles.rowTitle}>{t(DOOR_TITLE[d])}</span>
                    <span className={styles.figure}>{door.opens > 0 ? t('pMinutes', { count: Math.round(door.minutes) }) : ''}</span>
                    <span className={styles.meter} aria-hidden>
                      <span style={{ width: `${(door.minutes / most) * 100}%` }} />
                    </span>
                    <span className={styles.rowMeta}>{door.opens === 0 ? t('pDoorNever') : door.firstOpens > 0 ? t('pDoorMeta', { opens: door.opens, first: door.firstOpens }) : t('pDoorOpened', { opens: door.opens })}</span>
                  </li>
                )
              })}
            </ul>
            <p className={styles.hint}>{t('pDoorsHint')}</p>
          </section>

          <section className={styles.panel}>
            <h2 className={styles.h2}>{t('pSongs')}</h2>
            <Tiles
              items={[
                [t('pTileTries'), s.songs.started],
                [t('pTilePartsLearnt'), s.songs.parts.learnt],
                [t('pTileFinished'), s.songs.finished],
                [t('pTileStopped'), s.songs.abandoned],
              ]}
            />
            {s.songs.bySong.length > 0 && (
              <div className={styles.tableWrap}>
                {/* Each song is two rows: its title across the width, then its figures in
                    columns, so a long title never squeezes the numbers off a phone. */}
                <table className={`${styles.table} ${styles.songTable}`}>
                  <thead>
                    <tr>
                      <th scope="col">{t('pColTries')}</th>
                      <th scope="col">{t('pColParts')}</th>
                      <th scope="col">{t('pColFinished')}</th>
                      <th scope="col">{t('pColStars')}</th>
                    </tr>
                  </thead>
                  {s.songs.bySong.map((x) => (
                    <tbody key={x.songId}>
                      <tr>
                        <th scope="rowgroup" colSpan={4} className={styles.songTitle}>
                          {data.titles.get(x.songId) ?? x.songId}
                        </th>
                      </tr>
                      <tr>
                        <td>{x.started || '–'}</td>
                        <td>{x.partsLearnt || '–'}</td>
                        <td>{x.finished || '–'}</td>
                        {x.bestStars === null ? (
                          <td>–</td>
                        ) : (
                          <td className={styles.stars} aria-label={`${x.bestStars} / 3`}>
                            {'★'.repeat(x.bestStars) + '☆'.repeat(3 - x.bestStars)}
                          </td>
                        )}
                      </tr>
                    </tbody>
                  ))}
                </table>
              </div>
            )}
            {s.warmUps > 0 && <p className={styles.hint}>{t('pWarmUpsLine', { count: s.warmUps })}</p>}
            {s.songs.bars.practised > 0 && <p className={styles.hint}>{t('pBars', { count: s.songs.bars.practised, clean: s.songs.bars.clean })}</p>}
            {s.songs.added > 0 && <p className={styles.hint}>{t('pAdded', { count: s.songs.added })}</p>}
          </section>

          <section className={styles.panel}>
            <h2 className={styles.h2}>{t('pJourney')}</h2>
            <div className={styles.meterRow}>
              <span className={styles.rowTitle}>{t('pJourneyMeter', { done: doneSteps.length, total: JOURNEY.length })}</span>
              <span className={styles.meter} aria-hidden>
                <span style={{ width: `${(doneSteps.length / JOURNEY.length) * 100}%` }} />
              </span>
            </div>
            {doneSteps.length > 0 && (
              <ul className={styles.ticks}>
                {doneSteps.map((x) => (
                  <li key={x.id}>{t(x.title)}</li>
                ))}
              </ul>
            )}
            {testOuts > 0 && <p className={styles.hint}>{t('pTestedOut', { count: testOuts })}</p>}
            {s.journey.checksPassed + s.journey.checksFailed > 0 && <p className={styles.hint}>{t('pChecks', { passed: s.journey.checksPassed, failed: s.journey.checksFailed })}</p>}
          </section>

          <section className={styles.panel}>
            <h2 className={styles.h2}>{t('pChallenges')}</h2>
            {played.length > 0 && (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">{t('pColGame')}</th>
                      <th scope="col">{t('pColRounds')}</th>
                      <th scope="col">{t('pColBest')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {played.map((g) => (
                      <tr key={g.key}>
                        <th scope="row">{g.name}</th>
                        <td>{g.rounds}</td>
                        <td className={styles.best}>{g.best || '–'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {notPlayed.length > 0 && <p className={styles.hint}>{t('pNotPlayed', { games: notPlayed.join(', ') })}</p>}
          </section>

          <section className={styles.panel}>
            <h2 className={styles.h2}>{t('pStudio')}</h2>
            {s.studio.recorded + data.keptTakes + s.studio.played > 0 ? (
              <Tiles
                items={[
                  [t('pTileRecorded'), s.studio.recorded],
                  [t('pTileKept'), data.keptTakes],
                  [t('pTilePlayed'), s.studio.played],
                ]}
              />
            ) : (
              <p className={styles.hint}>{t('pStudioNone')}</p>
            )}
          </section>

          {s.keyboard.setupsDone + s.keyboard.setupsLeft + s.keyboard.lostMidSong > 0 && (
            <section className={styles.panel}>
              <h2 className={styles.h2}>{t('pKeyboardTitle')}</h2>
              <dl className={styles.pairs}>
                <div>
                  <dt>{t('pSetupsFinished')}</dt>
                  <dd>{s.keyboard.setupsDone}</dd>
                </div>
                {s.keyboard.setupsLeft > 0 && (
                  <div>
                    <dt>{t('pSetupsLeftLabel')}</dt>
                    <dd>{s.keyboard.setupsLeft}</dd>
                  </div>
                )}
                {Object.entries(s.keyboard.leftAt)
                  .sort((a, b) => b[1] - a[1])
                  .map(([step, n]) => (
                    <div key={step} className={styles.sub}>
                      <dt>{t('pLeftAtStep', { step: step in SETUP_STEP_TITLE ? t(SETUP_STEP_TITLE[step as keyof typeof SETUP_STEP_TITLE]) : step })}</dt>
                      <dd>{n}</dd>
                    </div>
                  ))}
                {s.keyboard.lostMidSong > 0 && (
                  <div>
                    <dt>{t('pLostMidSong')}</dt>
                    <dd>{s.keyboard.lostMidSong}</dd>
                  </div>
                )}
              </dl>
            </section>
          )}

          <section className={styles.panel}>
            <h2 className={styles.h2}>{t('pSettingsTitle')}</h2>
            <dl className={styles.pairs}>
              <div>
                <dt>{t('pInvitations')}</dt>
                <dd>{t('pInvitationAnswers', { accepted: s.suggestions.accepted, declined: s.suggestions.declined })}</dd>
              </div>
            </dl>
            {s.settingsChanged.length > 0 && (
              <>
                <h3 className={styles.h3}>{t('pChangesTitle')}</h3>
                <ul className={styles.changes}>
                  {s.settingsChanged
                    .slice(-8)
                    .reverse()
                    .map((c) => (
                      <li key={c.at + c.key}>
                        <span className={styles.changeDay}>{day(localDate(c.at))}</span>
                        <span>
                          {settingName(c.key)}: {settingValue(c.key, c.from)} → <strong>{settingValue(c.key, c.to)}</strong>
                        </span>
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
