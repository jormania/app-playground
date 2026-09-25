import type { FitMode, FitOption, Hand } from '../../engine'
import { useApp } from '../context'
import styles from './songs.module.css'

interface Props {
  options: FitOption[]
  value: FitMode
  onChange: (mode: FitMode) => void
  /** Notes past the keyboard as written. */
  outside: number
  /** At "Add a song": say it can be changed later, from the ⋯ menu. */
  atImport?: boolean
}

/**
 * What to do with a song's notes that are past the 61 keys: each choice with
 * what it would change, so it can be picked knowing the cost. At "Add a song",
 * and again from the song's ⋯ menu.
 */
export function FitChoice({ options, value, onChange, outside, atImport = false }: Props) {
  const { t } = useApp()
  const octaves = (semitones: number) => Math.abs(semitones) / 12
  const handMove = (hand: Hand, semitones: number) =>
    t(semitones > 0 ? 'fitUp' : 'fitDown', { hand: t(hand === 'right' ? 'fitHandRight' : 'fitHandLeft'), octaves: octaves(semitones) })
  const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

  const label = (o: FitOption) => {
    switch (o.mode) {
      case 'moveSong':
        return t(o.shift.right > 0 ? 'fitSongUp' : 'fitSongDown', { octaves: octaves(o.shift.right) })
      case 'moveHands':
        return t('fitHands')
      case 'moveNotes':
        return t('fitNotes')
      case 'dropNotes':
        return t('fitDrop')
    }
  }
  const hint = (o: FitOption) => {
    switch (o.mode) {
      case 'moveSong':
        return t('fitSongHint')
      case 'moveHands':
        return `${sentence((['right', 'left'] as Hand[]).filter((h) => o.shift[h] !== 0).map((h) => handMove(h, o.shift[h])).join(', '))}. ${t('fitHandsHint')}`
      case 'moveNotes':
        return `${t('fitNotesHint', { count: o.moved })}${o.dropped ? ` ${t('fitNotesMerged', { count: o.dropped })}` : ''}`
      case 'dropNotes':
        return t('fitDropHint', { count: o.dropped })
    }
  }

  return (
    <fieldset className={styles.fit}>
      <legend className={styles.fitTitle}>{t('fitTitle')}</legend>
      <p className={styles.hint}>
        {t('fitIntro', { count: outside })}
        {atImport && ` ${t('fitLater')}`}
      </p>
      {options.map((o) => (
        <label key={o.mode} className={styles.fitOption} data-on={value === o.mode || undefined}>
          <input type="radio" name="fit" value={o.mode} checked={value === o.mode} onChange={() => onChange(o.mode)} />
          <span className={styles.fitText}>
            <span className={styles.fitLabel}>{label(o)}</span>
            <span className={styles.fitHint}>{hint(o)}</span>
          </span>
        </label>
      ))}
    </fieldset>
  )
}
