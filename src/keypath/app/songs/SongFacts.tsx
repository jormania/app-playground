import { SegmentedControl } from '../../../ds'
import type { Song } from '../../engine'
import { useApp } from '../context'
import type { StringKey } from '../i18n'
import { levelOf, type Level } from './level'
import styles from './songs.module.css'

export const LEVEL_NAME: Record<Level, StringKey> = { 1: 'levelEasy', 2: 'levelMedium', 3: 'levelHard' }

/** One hand or two: whether the song has notes for both. */
export const handCount = (song: Song): 1 | 2 => (new Set(song.notes.map((n) => n.hand)).size > 1 ? 2 : 1)

/** A length as minutes and seconds: 0:32, 3:05. */
export function clock(ms: number): string {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** A song at a glance: how hard, one hand or two, how long at its own tempo. */
export function SongFacts({ song, showLevel = true }: { song: Song; showLevel?: boolean }) {
  const { t } = useApp()
  const level = levelOf(song)
  const hands = handCount(song)
  return (
    <span className={styles.songFacts}>
      {showLevel && (
        <span className={styles.songLevel} data-level={level}>
          {t(LEVEL_NAME[level])}
        </span>
      )}
      {song.easy && <span className={styles.songEasy}>{t('easyMark')}</span>}
      <span className={styles.songHands} data-hands={hands}>
        {t(hands === 2 ? 'twoHands' : 'oneHand')}
      </span>
      <span aria-label={t('songLength', { time: clock(song.durationMs) })}>{clock(song.durationMs)}</span>
    </span>
  )
}
/** Easy, Medium or Harder for an added song: the rating from its notes, or the one she chooses. */
export function LevelPick({ level, rated, onChange }: { level: Level; rated: Level; onChange: (level: Level) => void }) {
  const { t } = useApp()
  return (
    <div className={styles.levelPick}>
      <span className={styles.levelPickLabel}>{t('level')}</span>
      <SegmentedControl size="sm" value={String(level)} onChange={(v) => onChange(Number(v) as Level)} options={([1, 2, 3] as const).map((l) => ({ value: String(l), label: t(LEVEL_NAME[l]) }))} />
      <p className={styles.hint}>{t('levelRated', { level: t(LEVEL_NAME[rated]) })}</p>
    </div>
  )
}

/** An added song as its easy version or as written: at "Add a song", and again from its ⋯ menu. */
export function EasyPick({ easy, suggested, onChange }: { easy: boolean; suggested: boolean; onChange: (easy: boolean) => void }) {
  const { t } = useApp()
  return (
    <div className={styles.levelPick}>
      <span className={styles.levelPickLabel}>{t('easyTitle')}</span>
      <SegmentedControl
        size="sm"
        value={easy ? 'easy' : 'written'}
        onChange={(v) => onChange(v === 'easy')}
        options={[
          { value: 'easy', label: t('easyOn') },
          { value: 'written', label: t('easyOff') },
        ]}
      />
      <p className={styles.hint}>
        {t('easyHint')}
        {suggested && ` ${t('easySuggested')}`}
      </p>
    </div>
  )
}
