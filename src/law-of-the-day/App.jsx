import { useEffect, useState } from 'react'
import laws from './data/laws.json'
import { getDailyStatus, recordAnswer } from './lib/rotation'
import { buildOptions, gradeAnswer } from './lib/quiz'
import { fetchFreshContent } from './lib/fetchFreshContent'
import { loadHistory } from './lib/storage'
import { computeStats } from './lib/stats'
import { useTheme } from './lib/themeContext'
import { IconButton } from '../ds'
import { IconGuide, IconStats } from './components/icons'
import { ScenarioView } from './components/ScenarioView'
import { RevealView } from './components/RevealView'
import { LockedView } from './components/LockedView'
import { StatsModal } from './components/StatsModal'
import { Disclaimer } from './components/Disclaimer'
import styles from './App.module.css'

export default function App() {
  const { theme, toggle } = useTheme()
  const [status, setStatus] = useState(() => getDailyStatus(laws))
  const [options] = useState(() =>
    status.law ? buildOptions(status.law, laws) : []
  )
  const [reveal, setReveal] = useState(null)
  const [contentOverride, setContentOverride] = useState(null)
  const [statsOpen, setStatsOpen] = useState(false)
  const stats = computeStats(laws, loadHistory())

  // Progressive enhancement: try to swap in a fresher, cron-generated
  // scenario/explanation for today's law before the user answers. Never
  // blocks the initial render — the static bundled text is already showing.
  const lawId = status.law?.id
  useEffect(() => {
    if (status.phase !== 'quiz' || reveal || !lawId) return
    let cancelled = false
    fetchFreshContent(lawId).then((fresh) => {
      if (!cancelled && fresh) setContentOverride(fresh)
    })
    return () => {
      cancelled = true
    }
  }, [lawId, status.phase, reveal])

  const displayLaw = status.law && contentOverride
    ? { ...status.law, scenarioText: contentOverride.scenarioText, explanationText: contentOverride.explanationText }
    : status.law

  function handleAnswer(selectedId) {
    const correct = gradeAnswer(selectedId, status.law.id)
    const { streak } = recordAnswer(status.law.id, correct)
    setReveal({ correct })
    setStatus((prev) => ({ ...prev, streak }))
  }

  function handleContinue() {
    setStatus((prev) => ({ ...prev, phase: 'locked', lastResult: reveal }))
  }

  return (
    <div className={styles.shell}>
      <div className={styles.content}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>Law of the Day</h1>
          <div className={styles.titleGroup}>
            <IconButton
              size="sm"
              aria-label="Open the guide"
              title="Guide"
              onClick={() => window.open('/law-of-the-day-guide.html', '_blank', 'noopener')}
            >
              <IconGuide />
            </IconButton>
            <IconButton
              size="sm"
              aria-label="View your stats"
              title="Stats"
              onClick={() => setStatsOpen(true)}
            >
              <IconStats />
            </IconButton>
            <IconButton
              size="sm"
              aria-label={`Theme: ${theme === 'dark' ? 'Dark' : 'Light'} (tap to switch)`}
              title={`Theme: ${theme === 'dark' ? 'Dark' : 'Light'}`}
              onClick={toggle}
            >
              {theme === 'dark' ? '☾' : '☀'}
            </IconButton>
          </div>
        </div>
        {status.phase === 'quiz' && !reveal && (
          <ScenarioView law={displayLaw} options={options} onAnswer={handleAnswer} />
        )}
        {status.phase === 'quiz' && reveal && (
          <RevealView law={displayLaw} correct={reveal.correct} onContinue={handleContinue} />
        )}
        {status.phase === 'locked' && (
          <LockedView law={status.law} lastResult={status.lastResult} streak={status.streak} />
        )}
        <Disclaimer />
      </div>
      <StatsModal
        open={statsOpen}
        onClose={() => setStatsOpen(false)}
        streak={status.streak}
        stats={stats}
      />
    </div>
  )
}
