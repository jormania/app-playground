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
import type { Language, NoteNames } from '../profiles'
import { navigate } from '../router'
import { TopBar } from '../screens/TopBar'
import { keyBoxes, widenRange } from '../songs/keyGeometry'
import { useWide, WIDE_OCTAVES } from '../songs/useWide'
import { PlayKeyboard } from '../songs/PlayKeyboard'
import { CHORD_LEVEL_NAME } from './ChallengesHome'
import { ChordCatch, SCREEN_KEYS, shows, voicingOf, type ChordDef, type ChordLevel } from './chordCatch'
import { RecordRepo, type ChallengeRecords } from './records'
import styles from './challenges.module.css'

type Phase = 'setup' | 'run' | 'result'
const FLASH_MS = 300
const TOGETHER_MS = 1200

/** A chord's name as this player reads notes: C, Am in letters; Do, Lam in solfège. */
export function chordLabel(c: ChordDef, names: NoteNames, lang: Language): string {
  const scheme = names === 'auto' ? (lang === 'ro' ? 'solfege' : 'letters') : names
  const one = (s: 'letters' | 'solfege') => noteLabel(60 + c.root, s, lang) + (c.minor ? 'm' : '')
  return scheme === 'both' ? `${one('letters')} / ${one('solfege')}` : one(scheme)
}

/** Chord catch: a chord is named, play its keys together; as many as she can in 45 seconds. */
export function ChordCatchScreen() {
  const { t, store, profile, log, settings } = useApp()
  const repo = useMemo(() => new RecordRepo(store), [store])
  const [records, setRecords] = useState<ChallengeRecords | null>(null)
  const [level, setLevel] = useState<ChordLevel>(1)
  const [phase, setPhase] = useState<Phase>('setup')
  const [prompt, setPrompt] = useState<ChordDef | null>(null)
  const [caught, setCaught] = useState(false)
  const [score, setScore] = useState(0)
  const [left, setLeft] = useState(0)
  const [together, setTogether] = useState(false)
  const [held, setHeld] = useState<ReadonlySet<number>>(new Set())
  const [wrong, setWrong] = useState<ReadonlySet<number>>(new Set())
  const [result, setResult] = useState<{ score: number; wrong: number; spread: number; best: boolean } | null>(null)
  const game = useRef<ChordCatch | null>(null)
  const startedAt = useRef(0)
  const profileId = profile?.id ?? null

  useEffect(() => {
    if (profileId) void repo.get(profileId).then(setRecords)
  }, [repo, profileId])

  const label = useCallback((p: number) => noteLabel(p, settings.noteNames, settings.language), [settings.noteNames, settings.language])

  const start = () => {
    const g = new ChordCatch(level, settings.timing)
    const now = performance.now()
    g.start(now)
    game.current = g
    startedAt.current = now
    setPrompt(g.prompt)
    setCaught(false)
    setScore(0)
    setLeft(g.durationMs)
    setResult(null)
    setHeld(new Set())
    setPhase('run')
    if (profileId) void log.add(profileId, { type: 'challenge_started', game: 'chord', level })
  }

  const finish = useCallback(async () => {
    const g = game.current
    if (!g || !profileId) return
    game.current = null
    const best = await repo.offer(profileId, 'chord', g.level, g.score)
    setRecords(await repo.get(profileId))
    setResult({ score: g.score, wrong: g.wrong, spread: g.spread, best })
    if (best) celebrate('newBest')
    setPhase('result')
    void log.add(profileId, { type: 'challenge_finished', game: 'chord', level: g.level, score: g.score, best, wrong: g.wrong, ms: g.durationMs })
  }, [repo, profileId, log])

  useEffect(() => {
    if (phase !== 'run') return
    const id = setInterval(() => {
      const g = game.current
      if (!g) return
      const now = performance.now()
      setLeft(g.remaining(now))
      if (g.finished(now)) void finish()
    }, 100)
    return () => clearInterval(id)
  }, [phase, finish])

  // "Together!" stays up a moment after a chord came in spread out, then goes.
  const togetherTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(togetherTimer.current), [])

  const press = useCallback((pitch: number, at: number) => {
    setHeld((h) => new Set(h).add(pitch))
    const g = game.current
    if (!g) return
    const outcome = g.press(pitch, at)
    if (outcome === 'wrong') {
      setWrong((w) => new Set(w).add(pitch))
      setTimeout(() => setWrong((w) => { const s = new Set(w); s.delete(pitch); return s }), FLASH_MS)
    }
    if (outcome === 'spread') {
      setTogether(true)
      clearTimeout(togetherTimer.current)
      togetherTimer.current = setTimeout(() => setTogether(false), TOGETHER_MS)
    }
    if (outcome === 'right') {
      setScore(g.score)
      setCaught(true)
      setTogether(false)
    }
  }, [])

  const release = useCallback((pitch: number) => {
    setHeld((h) => { const s = new Set(h); s.delete(pitch); return s })
    const g = game.current
    if (!g) return
    g.release(pitch)
    setCaught(g.caught)
    setPrompt(g.prompt)
  }, [])

  const onMidi = useCallback(
    (e: MidiEvent) => {
      if ((e.type !== 'noteon' && e.type !== 'noteoff') || !isPlayerChannel(e.channel)) return
      if (e.type === 'noteoff') release(e.note)
      else if (e.velocity >= MIN_VELOCITY) press(e.note, e.time)
    },
    [press, release],
  )
  const kb = useKeyboard(onMidi)

  useEffect(
    () => () => {
      const g = game.current
      if (g && profileId) void log.add(profileId, { type: 'challenge_left', game: 'chord', level: g.level, ms: Math.round(performance.now() - startedAt.current) })
    },
    [log, profileId],
  )

  const wide = useWide()
  // Wider in landscape; the lit chords stay inside SCREEN_KEYS either way.
  const boxes = useMemo(() => {
    const r = wide ? widenRange(SCREEN_KEYS, WIDE_OCTAVES) : SCREEN_KEYS
    return keyBoxes(r.low, r.high)
  }, [wide])
  const best = records?.chord[level]
  const lit = phase === 'run' && prompt && !caught && shows(level) ? new Set(voicingOf(prompt)) : new Set<number>()
  const notes = prompt ? voicingOf(prompt) : []

  return (
    <main className={styles.playScreen}>
      <TopBar title={t('chordTitle')} aside={<KeyboardStatus status={kb} missing="keyboardMissing" />} />

      {phase === 'setup' && (
        <section className={styles.panel}>
          <p>{t('chordBlurb')}</p>
          <div className={styles.row}>
            <span className={styles.label}>{t('level')}</span>
            <SegmentedControl
              size="sm"
              value={String(level)}
              onChange={(v) => setLevel(Number(v) as ChordLevel)}
              options={[1, 2, 3].map((l) => ({ value: String(l), label: t(CHORD_LEVEL_NAME[l]) }))}
            />
          </div>
          <p className={styles.hint}>{best !== undefined ? t('best', { score: best }) : t('noBest')}</p>
          <p className={styles.hint}>{t(shows(level) ? 'chordHintShown' : 'chordHintNamed')}</p>
          <div>
            <Button onClick={start}>▶ {t('go')}</Button>
          </div>
        </section>
      )}

      {phase === 'run' && prompt && (
        <section className={styles.race} role="status" aria-live="polite">
          <span className={styles.raceFind}>{t('chordPlay')}</span>
          <span key={prompt.id + score} className={`${styles.raceNote} ${styles.chordName}`} data-caught={caught || undefined}>
            {caught ? '✓' : chordLabel(prompt, settings.noteNames, settings.language)}
          </span>
          <span className={styles.chordNotes}>
            {together ? t('chordTogether') : caught ? t('chordLetGo') : shows(level) ? t('chordNotes', { note: label(notes[0]), note2: label(notes[1]), note3: label(notes[2]) }) : ' '}
          </span>
          <span className={styles.raceMeta}>
            <span className={styles.scoreWrap}>
              {t('chordScore', { score })}
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
          <h2 className={styles.resultTitle}>{t('chordDone', { score: result.score })}</h2>
          {result.best && <p className={styles.newBest}>★ {t('newBest')}</p>}
          {result.spread > 0 && <p className={styles.hint}>{t('chordSpread', { count: result.spread })}</p>}
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
        <PlayKeyboard sound={!kb.connected} boxes={boxes} held={held} targets={lit} wrong={wrong} label={label} names={settings.keyNames} onPress={(p) => press(p, performance.now())} onRelease={release} />
      </div>
    </main>
  )
}
