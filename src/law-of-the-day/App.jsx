import { useState } from 'react'
import laws from './data/laws.json'
import { getDailyStatus, recordAnswer } from './lib/rotation'
import { buildOptions, gradeAnswer } from './lib/quiz'
import { useTheme } from './lib/themeContext'
import { IconButton } from '../ds'
import { IconGuide } from './components/icons'
import { ScenarioView } from './components/ScenarioView'
import { RevealView } from './components/RevealView'
import { LockedView } from './components/LockedView'
import { Disclaimer } from './components/Disclaimer'
import styles from './App.module.css'

export default function App() {
  const { theme, toggle } = useTheme()
  const [status, setStatus] = useState(() => getDailyStatus(laws))
  const [options] = useState(() =>
    status.law ? buildOptions(status.law, laws) : []
  )
  const [reveal, setReveal] = useState(null)

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
              aria-label={`Theme: ${theme === 'dark' ? 'Dark' : 'Light'} (tap to switch)`}
              title={`Theme: ${theme === 'dark' ? 'Dark' : 'Light'}`}
              onClick={toggle}
            >
              {theme === 'dark' ? '☾' : '☀'}
            </IconButton>
          </div>
        </div>
        {status.phase === 'quiz' && !reveal && (
          <ScenarioView law={status.law} options={options} onAnswer={handleAnswer} />
        )}
        {status.phase === 'quiz' && reveal && (
          <RevealView law={status.law} correct={reveal.correct} onContinue={handleContinue} />
        )}
        {status.phase === 'locked' && (
          <LockedView law={status.law} lastResult={status.lastResult} streak={status.streak} />
        )}
        <Disclaimer />
      </div>
    </div>
  )
}
