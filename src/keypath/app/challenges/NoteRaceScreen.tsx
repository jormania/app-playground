import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, SegmentedControl } from '../../../ds'
import { MIN_VELOCITY } from '../../engine'
import { isPlayerChannel } from '../../midi/channels'
import type { MidiEvent } from '../../midi/types'
import { useKeyboard } from '../connect/keyboard'
import { KeyboardStatus } from '../connect/KeyboardStatus'
import { celebrate } from '../celebrate/celebrate'
import { useApp } from '../context'
import { noteLabel } from '../i18n'
import { navigate } from '../router'
import { TopBar } from '../screens/TopBar'
import { keyBoxes } from '../songs/keyGeometry'
import { PlayKeyboard } from '../songs/PlayKeyboard'
import { Staff } from '../journey/Staff'
import { RACE_LEVEL_NAME, STAFF_LEVEL_NAME } from './ChallengesHome'
import { NoteRace, RACE_MS, type RaceLevel, type RaceMode } from './noteRace'
import { RecordRepo, type ChallengeRecords } from './records'
import styles from './challenges.module.css'

type Phase = 'setup' | 'run' | 'result'
const FLASH_MS = 300

/** Note race: a note is shown, by name or on a staff; find that key anywhere, as many as she can in 30 seconds. */
export function NoteRaceScreen() {
  const { t, store, profile, log, settings } = useApp()
  const repo = useMemo(() => new RecordRepo(store), [store])
  const [records, setRecords] = useState<ChallengeRecords | null>(null)
  const [level, setLevel] = useState<RaceLevel>(1)
  const [mode, setMode] = useState<RaceMode>('names')
  const game = mode === 'staff' ? 'staff' : 'race'
  const [phase, setPhase] = useState<Phase>('setup')
  const [prompt, setPrompt] = useState(0)
  const [score, setScore] = useState(0)
  const [left, setLeft] = useState(0)
  const [flash, setFlash] = useState<{ right: ReadonlySet<number>; wrong: ReadonlySet<number> }>({ right: new Set(), wrong: new Set() })
  const [result, setResult] = useState<{ score: number; wrong: number; best: boolean } | null>(null)
  const race = useRef<NoteRace | null>(null)
  const startedAt = useRef(0)
  const profileId = profile?.id ?? null

  useEffect(() => {
    if (profileId) void repo.get(profileId).then(setRecords)
  }, [repo, profileId])

  const label = useCallback((p: number) => noteLabel(p, settings.noteNames, settings.language), [settings.noteNames, settings.language])

  const start = () => {
    const r = new NoteRace(level, Math.random, RACE_MS, mode)
    const now = performance.now()
    r.start(now)
    race.current = r
    startedAt.current = now
    setPrompt(r.prompt)
    setScore(0)
    setLeft(r.durationMs)
    setResult(null)
    setPhase('run')
    if (profileId) void log.add(profileId, { type: 'challenge_started', game, level })
  }

  const finish = useCallback(async () => {
    const r = race.current
    if (!r || !profileId) return
    race.current = null
    const g = r.mode === 'staff' ? 'staff' : 'race'
    const best = await repo.offer(profileId, g, r.level, r.score)
    setRecords(await repo.get(profileId))
    setResult({ score: r.score, wrong: r.wrong, best })
    if (best) celebrate('newBest')
    setPhase('result')
    void log.add(profileId, { type: 'challenge_finished', game: g, level: r.level, score: r.score, best, wrong: r.wrong, ms: r.durationMs })
  }, [repo, profileId, log])

  // The clock: a few times a second is plenty for a seconds counter.
  useEffect(() => {
    if (phase !== 'run') return
    const id = setInterval(() => {
      const r = race.current
      if (!r) return
      const now = performance.now()
      setLeft(r.remaining(now))
      if (r.finished(now)) void finish()
    }, 100)
    return () => clearInterval(id)
  }, [phase, finish])

  const show = (kind: 'right' | 'wrong', p: number) => {
    setFlash((f) => ({ ...f, [kind]: new Set(f[kind]).add(p) }))
    setTimeout(() => setFlash((f) => { const s = new Set(f[kind]); s.delete(p); return { ...f, [kind]: s } }), FLASH_MS)
  }
  const press = useCallback((pitch: number, at: number) => {
    const r = race.current
    if (!r) return
    const outcome = r.press(pitch, at)
    if (!outcome) return
    show(outcome, pitch)
    setScore(r.score)
    setPrompt(r.prompt)
  }, [])

  const onMidi = useCallback(
    (e: MidiEvent) => {
      if (e.type === 'noteon' && isPlayerChannel(e.channel) && e.velocity >= MIN_VELOCITY) press(e.note, e.time)
    },
    [press],
  )
  const kb = useKeyboard(onMidi)

  // Leaving mid-race is logged, like every other door.
  useEffect(
    () => () => {
      const r = race.current
      if (r && profileId) void log.add(profileId, { type: 'challenge_left', game: r.mode === 'staff' ? 'staff' : 'race', level: r.level, ms: Math.round(performance.now() - startedAt.current) })
    },
    [log, profileId],
  )

  const boxes = useMemo(() => keyBoxes(48, 72), [])
  const best = records?.[game][level]
  const levelNames = mode === 'staff' ? STAFF_LEVEL_NAME : RACE_LEVEL_NAME

  return (
    <main className={styles.playScreen}>
      <TopBar title={t('raceTitle')} aside={<KeyboardStatus status={kb} missing="keyboardMissing" />} />

      {phase === 'setup' && (
        <section className={styles.panel}>
          <p>{t('raceBlurb')}</p>
          <div className={styles.row}>
            <span className={styles.label}>{t('raceShow')}</span>
            <SegmentedControl
              size="sm"
              value={mode}
              onChange={(v) => setMode(v as RaceMode)}
              options={[
                { value: 'names', label: t('raceModeNames') },
                { value: 'staff', label: t('raceModeStaff') },
              ]}
            />
          </div>
          <div className={styles.row}>
            <span className={styles.label}>{t('level')}</span>
            <SegmentedControl
              size="sm"
              value={String(level)}
              onChange={(v) => setLevel(Number(v) as RaceLevel)}
              options={[1, 2, 3].map((l) => ({ value: String(l), label: t(levelNames[l]) }))}
            />
          </div>
          <p className={styles.hint}>{best !== undefined ? t('best', { score: best }) : t('noBest')}</p>
          <p className={styles.hint}>{t(mode === 'staff' ? 'raceStaffHint' : 'raceKeysHidden')}</p>
          <div>
            <Button onClick={start}>▶ {t('go')}</Button>
          </div>
        </section>
      )}

      {phase === 'run' && (
        <section className={styles.race} role="status" aria-live="polite">
          <span className={styles.raceFind}>{t('raceFind')}</span>
          {mode === 'staff' ? (
            <div key={score} className={styles.raceStaff}>
              <Staff notes={[[prompt, 1]]} current={-1} played={new Set()} ariaLabel={t('raceStaffAria')} bare />
            </div>
          ) : (
            <span key={score} className={styles.raceNote}>
              {label(prompt)}
            </span>
          )}
          <span className={styles.raceMeta}>
            <span className={styles.scoreWrap}>
              {t('raceScore', { score })}
              {score > 0 && (
                <span key={score} className={styles.plusOne} aria-hidden>
                  +1
                </span>
              )}
            </span>
            <span className={styles.raceClock} data-low={left < 5000 || undefined}>
              {Math.ceil(left / 1000)} s
            </span>
          </span>
        </section>
      )}

      {phase === 'result' && result && (
        <section className={styles.panel} role="status">
          <h2 className={styles.resultTitle}>{t('raceDone', { score: result.score })}</h2>
          {result.best && <p className={styles.newBest}>★ {t('newBest')}</p>}
          {result.wrong > 0 && <p className={styles.hint}>{t('raceWrong', { count: result.wrong })}</p>}
          <div className={styles.actions}>
            <Button onClick={start}>{t('playAgain')}</Button>
            <Button variant="outline" onClick={() => setPhase('setup')}>
              {t('changeLevel')}
            </Button>
            <Button variant="ghost" onClick={() => navigate({ name: 'door', door: 'challenges' }, { replace: true })}>
              {t('backToChallenges')}
            </Button>
          </div>
        </section>
      )}

      <div className={styles.keys}>
        <PlayKeyboard boxes={boxes} held={flash.right} targets={new Set()} wrong={flash.wrong} label={label} names={false} onPress={(p) => press(p, performance.now())} onRelease={() => {}} />
      </div>
    </main>
  )
}
