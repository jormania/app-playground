import { useEffect, useState } from 'react'
import { Button } from '../../../ds'
import type { Highlight, OnWrong, Report, Timing } from '../../engine'
import { celebrate } from '../celebrate/celebrate'
import { useCountUp } from '../celebrate/useCountUp'
import { useApp } from '../context'
import type { StringKey } from '../i18n'
import styles from './songs.module.css'

const ON_WRONG_LABEL: Record<OnWrong, StringKey> = { keepGoing: 'onWrongKeepGoing', show: 'onWrongShow', wait: 'onWrongWait' }
const TIMING_LABEL: Record<Timing, StringKey> = { relaxed: 'timingRelaxed', normal: 'timingNormal', strict: 'timingStrict' }

interface Props {
  report: Report
  songId: string
  onPlayAgain: () => void
  onAnotherSong: () => void
  /** Studio with this song's tune: play it over a Style, or invent an ending. */
  onMakeItYours: () => void
  /** Loop one bar (0-based) until it's clean. */
  onPractiseBar?: (bar: number) => void
  /** A bar as printed, for a song from a score; counted from 1 otherwise. */
  barLabel?: (bar: number) => string
  /** The song to try after this one, when there is one. */
  next?: { title: string; onOpen: () => void } | null
}

/**
 * The end of a song: stars, what went well (always first), at most what the
 * report setting allows to work on, and a harder setting offered, never applied.
 * Bars are counted from 1 here; the engine counts from 0.
 */
export function ReportView({ report, songId, onPlayAgain, onAnotherSong, onMakeItYours, onPractiseBar, next, barLabel = (b) => String(b + 1) }: Props) {
  const { t, profile, log, updateSetting } = useApp()
  const [answered, setAnswered] = useState(false)
  const notes = report.highlights.find((h) => h.kind === 'notes')
  const hitShown = useCountUp(notes?.kind === 'notes' ? notes.hit : 0)

  // Finishing a song is always worth a cheer; three stars get the big one.
  useEffect(() => {
    if (report.stars > 0) celebrate(report.stars === 3 ? 'threeStars' : 'finished')
  }, [report.stars])

  const line = (h: Highlight): string => {
    switch (h.kind) {
      case 'finished':
        return t('hlFinished')
      case 'notes':
        return t('hlNotes', { hit: hitShown, total: h.total })
      case 'streak':
        return t('hlStreak', { count: h.count })
      case 'onTime':
        return t('hlOnTime', { count: h.count })
      case 'cleanBars':
        return t('hlCleanBars', { bars: h.bars.map(barLabel).join(', ') })
    }
  }

  const s = report.suggestion
  const answer = async (accepted: boolean) => {
    if (!s) return
    setAnswered(true)
    if (profile) await log.add(profile.id, { type: 'suggestion', setting: s.setting, to: s.to, accepted, songId })
    if (!accepted) return
    if (s.setting === 'onWrong') await updateSetting('onWrong', s.to)
    else await updateSetting('timing', s.to)
  }

  return (
    <section className={`${styles.panel} ${styles.report}`} aria-labelledby="report-title">
      <div className={styles.reportHead}>
        <h2 className={styles.h2} id="report-title">
          {t('howItWent')}
        </h2>
        <p className={styles.stars} aria-label={`${report.stars} / 3`}>
          {[0, 1, 2].map((i) => (
            <span key={i} data-lit={i < report.stars || undefined} style={{ '--i': i } as React.CSSProperties}>
              ★
            </span>
          ))}
        </p>
        <div className={`${styles.actions} ${styles.reportActions}`}>
          <Button onClick={onPlayAgain}>{t('playAgain')}</Button>
          <Button variant="outline" onClick={onAnotherSong}>
            {t('anotherSong')}
          </Button>
          {report.stars > 0 && (
            <Button variant="outline" onClick={onMakeItYours}>
              🎨 {t('makeItYours')}
            </Button>
          )}
        </div>
      </div>
      <div className={styles.reportBody}>
        <ul className={styles.highlights}>
          {report.highlights.map((h, i) => (
            <li key={h.kind} style={{ '--i': i } as React.CSSProperties}>
              {line(h)}
            </li>
          ))}
        </ul>
        {report.toWorkOn.map((b) => (
          <div key={b.bar} className={styles.workOn}>
            <p className={styles.hint}>{t('workOnBar', { bar: barLabel(b.bar) })}</p>
            {onPractiseBar && (
              <Button size="sm" variant="outline" onClick={() => onPractiseBar(b.bar)}>
                🔁 {t('practiseBar', { bar: barLabel(b.bar) })}
              </Button>
            )}
          </div>
        ))}
        {next && report.stars > 0 && (
          <div className={styles.workOn}>
            <p className={styles.hint}>{t('tryNext')}</p>
            <Button size="sm" variant="outline" onClick={next.onOpen}>
              ▶ {next.title}
            </Button>
          </div>
        )}
        {s && !answered && (
          <div className={styles.suggestion}>
            <p>
              {s.setting === 'onWrong'
                ? t('suggestOnWrong', { mode: t(ON_WRONG_LABEL[s.to]) })
                : t('suggestTiming', { timing: t(TIMING_LABEL[s.to]).toLowerCase() })}
            </p>
            <div className={styles.actions}>
              <Button size="sm" onClick={() => void answer(true)}>
                {t('yesChange')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void answer(false)}>
                {t('notNow')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
