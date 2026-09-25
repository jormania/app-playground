import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../context'
import type { StringKey } from '../i18n'
import { navigate } from '../router'
import { TopBar } from '../screens/TopBar'
import { RecordRepo, type ChallengeRecords } from './records'
import styles from './challenges.module.css'

export const RACE_LEVEL_NAME: Record<number, StringKey> = { 1: 'raceLevel1', 2: 'raceLevel2', 3: 'raceLevel3' }
export const STAFF_LEVEL_NAME: Record<number, StringKey> = { 1: 'raceLevel1', 2: 'staffLevel2', 3: 'staffLevel3' }
export const ECHO_LEVEL_NAME: Record<number, StringKey> = { 1: 'echoLevel1', 2: 'echoLevel2', 3: 'echoLevel3' }
export const CHORD_LEVEL_NAME: Record<number, StringKey> = { 1: 'chordLevel1', 2: 'chordLevel2', 3: 'chordLevel3' }

/** The Challenges door: three short games, each with this player's bests. */
export function ChallengesHome() {
  const { t, store, profile } = useApp()
  const repo = useMemo(() => new RecordRepo(store), [store])
  const [records, setRecords] = useState<ChallengeRecords | null>(null)
  useEffect(() => {
    if (profile) void repo.get(profile.id).then(setRecords)
  }, [repo, profile])
  if (!records) return null

  const parts = (table: Partial<Record<number, number>>, names: Record<number, StringKey>) =>
    [1, 2, 3].filter((l) => table[l] !== undefined).map((l) => `${t(names[l])} ${table[l]}`)
  const bests = (table: Partial<Record<number, number>>, names: Record<number, StringKey>) => {
    const p = parts(table, names)
    return p.length ? t('best', { score: p.join(' · ') }) : t('noBest')
  }
  // The race read off a staff keeps its own bests; shown beside the named ones once there are any.
  const staff = parts(records.staff, STAFF_LEVEL_NAME)

  return (
    <main className={styles.screen}>
      <TopBar title={t('doorChallenges')} />
      <p className={styles.intro}>{t('challengesIntro')}</p>
      <div className={styles.games}>
      <button type="button" className={styles.game} onClick={() => navigate({ name: 'challenge', game: 'race' })}>
        <span className={styles.gameIcon} aria-hidden>
          🏁
        </span>
        <span className={styles.gameTitle}>{t('raceTitle')}</span>
        <span className={styles.gameBlurb}>{t('raceBlurb')}</span>
        <span className={styles.gameBest}>
          {bests(records.race, RACE_LEVEL_NAME)}
          {staff.length > 0 && ` · 🎼 ${staff.join(' · ')}`}
        </span>
      </button>
      <button type="button" className={styles.game} onClick={() => navigate({ name: 'challenge', game: 'echo' })}>
        <span className={styles.gameIcon} aria-hidden>
          🥁
        </span>
        <span className={styles.gameTitle}>{t('echoTitle')}</span>
        <span className={styles.gameBlurb}>{t('echoBlurb')}</span>
        <span className={styles.gameBest}>{bests(records.echo, ECHO_LEVEL_NAME)}</span>
      </button>
      <button type="button" className={styles.game} onClick={() => navigate({ name: 'challenge', game: 'chord' })}>
        <span className={styles.gameIcon} aria-hidden>
          🎹
        </span>
        <span className={styles.gameTitle}>{t('chordTitle')}</span>
        <span className={styles.gameBlurb}>{t('chordBlurb')}</span>
        <span className={styles.gameBest}>{bests(records.chord, CHORD_LEVEL_NAME)}</span>
      </button>
      </div>
    </main>
  )
}
