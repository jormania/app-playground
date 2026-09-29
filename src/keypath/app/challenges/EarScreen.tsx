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
import { morph } from '../morph'
import { navigate } from '../router'
import { TopBar } from '../screens/TopBar'
import { useOutput } from '../studio/output'
import { Playback, realClock } from '../studio/playback'
import { keyBoxes, widenRange } from '../songs/keyGeometry'
import { PlayKeyboard } from '../songs/PlayKeyboard'
import { useWide, WIDE_OCTAVES } from '../songs/useWide'
import { EAR_LEVEL_NAME } from './ChallengesHome'
import { EarTrain, type EarLevel } from './earTrain'
import { RecordRepo, type ChallengeRecords } from './records'
import { SCREEN_KEYS } from './chordCatch'
import styles from './challenges.module.css'
import setup from '../setup.module.css'

type Phase = 'setup' | 'listen' | 'find' | 'result'
const FLASH_MS = 350
/** How long a found note (or the shown answer) stays on screen before the next question. */
const RESOLVED_MS = 1100
/** The two notes: the first, a pause, the second. */
const NOTE_MS = 700
const SECOND_AT_MS = 1000

/** Ear check: a note is played and shown, another is played; find the second by ear. Five to a round. */
export function EarScreen() {
  const { t, store, profile, log, settings } = useApp()
  const repo = useMemo(() => new RecordRepo(store), [store])
  const [records, setRecords] = useState<ChallengeRecords | null>(null)
  const [level, setLevel] = useState<EarLevel>(1)
  const [phase, setPhase] = useState<Phase>('setup')
  const [number, setNumber] = useState(1)
  const [score, setScore] = useState(0)
  const [note, setNote] = useState<'hint-higher' | 'hint-lower' | 'right' | 'shown' | null>(null)
  const [held, setHeld] = useState<ReadonlySet<number>>(new Set())
  const [wrong, setWrong] = useState<ReadonlySet<number>>(new Set())
  const [shown, setShown] = useState<number | null>(null)
  const [result, setResult] = useState<{ score: number; wrong: number; best: boolean } | null>(null)
  const game = useRef<EarTrain | null>(null)
  const startedAt = useRef(0)
  const playback = useRef<Playback | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const phaseRef = useRef<Phase>('setup')
  const profileId = profile?.id ?? null

  useEffect(() => {
    if (profileId) void repo.get(profileId).then(setRecords)
  }, [repo, profileId])

  const label = useCallback((p: number) => noteLabel(p, settings.noteNames, settings.language), [settings.noteNames, settings.language])

  const pressRef = useRef<(pitch: number) => void>(() => {})
  const onMidi = useCallback((e: MidiEvent) => {
    if ((e.type !== 'noteon' && e.type !== 'noteoff') || !isPlayerChannel(e.channel)) return
    if (e.type === 'noteoff') return setHeld((h) => { const s = new Set(h); s.delete(e.note); return s })
    if (e.velocity >= MIN_VELOCITY) pressRef.current(e.note)
  }, [])
  const kb = useKeyboard(onMidi)
  const output = useOutput(kb)
  const outputRef = useRef(output)
  outputRef.current = output

  /** Play the question's two notes; then she may answer. */
  const hear = useCallback(() => {
    const g = game.current
    if (!g) return
    playback.current?.stop()
    const { root, target } = g.current
    const p = new Playback(
      {
        ms: SECOND_AT_MS + NOTE_MS + 200,
        notes: [
          { pitch: root, velocity: 90, startMs: 0, durationMs: NOTE_MS },
          { pitch: target, velocity: 90, startMs: SECOND_AT_MS, durationMs: NOTE_MS },
        ],
        pedal: [],
      },
      outputRef.current.sink(),
      realClock,
      () => setPhase((ph) => (ph === 'listen' ? 'find' : ph)),
    )
    playback.current = p
    p.start()
  }, [])

  const start = () =>
    morph(() => {
      const g = new EarTrain(level)
      game.current = g
      startedAt.current = performance.now()
      setNumber(1)
      setScore(0)
      setNote(null)
      setShown(null)
      setResult(null)
      setHeld(new Set())
      setPhase('listen')
      hear()
      if (profileId) void log.add(profileId, { type: 'challenge_started', game: 'ear', level })
    })

  const finish = useCallback(async () => {
    const g = game.current
    if (!g || !profileId) return
    game.current = null
    const best = await repo.offer(profileId, 'ear', g.level, g.score)
    setRecords(await repo.get(profileId))
    morph(() => {
      setResult({ score: g.score, wrong: g.wrong, best })
      setPhase('result')
    })
    if (best) celebrate('newBest')
    void log.add(profileId, { type: 'challenge_finished', game: 'ear', level: g.level, score: g.score, best, wrong: g.wrong, ms: Math.round(performance.now() - startedAt.current) })
  }, [repo, profileId, log])

  const press = useCallback(
    (pitch: number) => {
      setHeld((h) => new Set(h).add(pitch))
      const g = game.current
      // Only once the two notes have been heard: a key struck while they play is not an answer.
      if (!g || g.isResolved || phaseRef.current !== 'find') return
      const outcome = g.press(pitch)
      if (!outcome) return
      if (outcome === 'wrong') {
        setNote(g.hint === 'higher' ? 'hint-higher' : 'hint-lower')
        setWrong((w) => new Set(w).add(pitch))
        setTimeout(() => setWrong((w) => { const s = new Set(w); s.delete(pitch); return s }), FLASH_MS)
        return
      }
      if (outcome === 'missed') setWrong((w) => new Set(w).add(pitch))
      setScore(g.score)
      setNote(outcome === 'right' ? 'right' : 'shown')
      setShown(g.current.target)
      // A moment to take it in, then the next question, or the end.
      timer.current = setTimeout(() => {
        g.next()
        if (g.finished) return void finish()
        setNumber(g.number)
        setNote(null)
        setShown(null)
        setWrong(new Set())
        setPhase('listen')
        hear()
      }, RESOLVED_MS)
    },
    [finish, hear],
  )
  pressRef.current = press
  const release = useCallback((pitch: number) => setHeld((h) => { const s = new Set(h); s.delete(pitch); return s }), [])

  useEffect(
    () => () => {
      clearTimeout(timer.current)
      playback.current?.stop()
      const g = game.current
      if (g && profileId) void log.add(profileId, { type: 'challenge_left', game: 'ear', level: g.level, ms: Math.round(performance.now() - startedAt.current) })
    },
    [log, profileId],
  )

  const wide = useWide()
  const boxes = useMemo(() => {
    const r = wide ? widenRange(SCREEN_KEYS, WIDE_OCTAVES) : SCREEN_KEYS
    return keyBoxes(r.low, r.high)
  }, [wide])
  const best = records?.ear[level]
  const g = game.current
  phaseRef.current = phase
  const running = phase === 'listen' || phase === 'find'
  // The first note is lit; the second stays dark until it is found, or given up on.
  const lit = new Set<number>(running && g ? [g.current.root, ...(shown !== null ? [shown] : [])] : [])

  return (
    <main className={styles.playScreen}>
      <TopBar title={t('earTitle')} compact={running} aside={<KeyboardStatus status={kb} missing="keyboardMissing" compact={running} />} />

      {phase === 'setup' && (
        <section className={setup.bar}>
          <p className={setup.lead}>{t('earBlurb')}</p>
          <div className={setup.field}>
            <span className={setup.label}>{t('level')}</span>
            <SegmentedControl size="sm" value={String(level)} onChange={(v) => setLevel(Number(v) as EarLevel)} options={[1, 2, 3].map((l) => ({ value: String(l), label: t(EAR_LEVEL_NAME[l]) }))} />
          </div>
          <div className={setup.go}>
            <Button onClick={start}>▶ {t('go')}</Button>
            <span className={setup.note} data-inline>
              {best !== undefined ? t('best', { score: best }) : t('noBest')}
            </span>
            <span className={setup.note} data-inline>
              {t('earHintPlain')}
            </span>
          </div>
          {output.phoneMuted && <p className={setup.note}>{t('studioPhoneMuted')}</p>}
        </section>
      )}

      {running && g && (
        <section className={styles.race} role="status" aria-live="polite">
          <span className={styles.raceFind}>{t('earQuestion', { n: number })}</span>
          <span key={number + phase} className={styles.raceNote} data-caught={note === 'right' || undefined}>
            {phase === 'listen' ? '🎧' : note === 'right' ? '✓' : '?'}
          </span>
          <span className={styles.chordNotes}>
            {phase === 'listen'
              ? t('earListen')
              : note === 'hint-higher'
                ? t('earHigher')
                : note === 'hint-lower'
                  ? t('earLower')
                  : note === 'right'
                    ? t('earRight')
                    : note === 'shown'
                      ? `${t('earShown')} ${shown !== null ? label(shown) : ''}`
                      : t('earFind')}
          </span>
          <span className={styles.raceMeta}>
            <span className={styles.scoreWrap}>{t('earScore', { score })}</span>
            {phase === 'find' && (note === null || note === 'hint-higher' || note === 'hint-lower') && (
              <Button size="sm" variant="ghost" onClick={() => { setPhase('listen'); hear() }}>
                🎧 {t('earAgain')}
              </Button>
            )}
          </span>
        </section>
      )}

      {phase === 'result' && result && (
        <section className={styles.panel} role="status">
          <h2 className={styles.resultTitle}>{result.score > 0 ? t('earDone', { score: result.score }) : t('earNone')}</h2>
          {result.best && <p className={styles.newBest}>★ {t('newBest')}</p>}
          {result.wrong > 0 && <p className={styles.hint}>{t('earWrong', { count: result.wrong })}</p>}
          <div className={styles.actions}>
            <Button onClick={start}>{t('playAgain')}</Button>
            <Button variant="outline" onClick={() => morph(() => setPhase('setup'))}>
              {t('changeLevel')}
            </Button>
            <Button variant="ghost" onClick={() => navigate({ name: 'door', door: 'challenges' }, { replace: true })}>
              {t('backToChallenges')}
            </Button>
          </div>
        </section>
      )}

      <div className={styles.keys}>
        <PlayKeyboard sound={!kb.connected} boxes={boxes} held={held} targets={lit} wrong={wrong} label={label} names={settings.keyNames} onPress={(p) => press(p)} onRelease={release} />
      </div>
    </main>
  )
}
