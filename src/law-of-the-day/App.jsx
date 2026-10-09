import { useEffect, useState } from 'react'
import laws from './data/laws.json'
import { getDailyStatus, recordAnswer, getTodayKey } from './lib/rotation'
import { buildOptions, gradeAnswer } from './lib/quiz'
import { generateFresh } from './lib/generate'
import {
  loadHistory, loadBestStreak, loadDifficulty, saveDifficulty, loadSeasonsCompleted,
  loadAnthropicKey, saveAnthropicKey, loadFreshContent, saveFreshContent,
} from './lib/storage'
import { computeStats } from './lib/stats'
import {
  normalizeDifficulty,
  nextDifficulty,
  difficultyLevel,
  difficultyLabel,
} from './lib/difficulty'
import { useTheme } from './lib/themeContext'
import { IconButton } from '../ds'
import { IconGuide, IconStats, IconDifficulty, IconTheme, IconSettings } from './components/icons'
import { ScenarioView } from './components/ScenarioView'
import { RevealView } from './components/RevealView'
import { LockedView } from './components/LockedView'
import { StatsModal } from './components/StatsModal'
import { SettingsModal } from './components/SettingsModal'
import { WritingView } from './components/WritingView'
import { Disclaimer } from './components/Disclaimer'
import styles from './App.module.css'

export default function App() {
  const { pref: themePref, label: themeLabel, cycle: cycleTheme } = useTheme()
  const [status, setStatus] = useState(() => getDailyStatus(laws))
  const [difficulty, setDifficulty] = useState(() => normalizeDifficulty(loadDifficulty()))
  const [options, setOptions] = useState(() =>
    status.law ? buildOptions(status.law, laws, { difficulty, history: loadHistory() }) : []
  )
  const [reveal, setReveal] = useState(null)
  const [statsOpen, setStatsOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [apiKey, setApiKey] = useState(() => loadAnthropicKey())
  const stats = computeStats(laws, loadHistory(), loadSeasonsCompleted())
  const bestStreak = loadBestStreak()

  // Today's scenario, written fresh by Claude when a key is set (lib/generate.js).
  // Kept for the day, so reopening the app shows the same text without a second
  // request. While it's being written the scenario's place shows WritingView;
  // on any failure, or with no key, the bundled text is used.
  const lawId = status.law?.id
  const todayKey = getTodayKey()
  const [fresh, setFresh] = useState(() => (lawId ? loadFreshContent(todayKey, lawId) : null))
  const [writing, setWriting] = useState(false)
  useEffect(() => {
    if (status.phase !== 'quiz' || reveal || !lawId || !apiKey || fresh) return
    let cancelled = false
    const controller = new AbortController()
    // A request that hangs shouldn't hold the quiz hostage: after 45 s, the bundled text.
    const timer = setTimeout(() => controller.abort(), 45_000)
    setWriting(true)
    generateFresh(apiKey, status.law, laws, { signal: controller.signal }).then((content) => {
      clearTimeout(timer)
      if (cancelled) return
      if (content) {
        saveFreshContent(todayKey, lawId, content)
        setFresh(content)
      }
      setWriting(false)
    })
    return () => {
      cancelled = true
      clearTimeout(timer)
      controller.abort()
      setWriting(false)
    }
  }, [lawId, todayKey, status.phase, status.law, reveal, apiKey, fresh])

  const displayLaw = status.law && fresh
    ? { ...status.law, scenarioText: fresh.scenarioText, explanationText: fresh.explanationText }
    : status.law

  // Cycle the difficulty tier. If the user hasn't answered yet, rebuild today's
  // distractors at the new tier so the change takes effect immediately.
  function cycleDifficulty() {
    const next = nextDifficulty(difficulty)
    setDifficulty(next)
    saveDifficulty(next)
    if (status.phase === 'quiz' && !reveal && status.law) {
      setOptions(buildOptions(status.law, laws, { difficulty: next, history: loadHistory() }))
    }
  }

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
              onClick={() => {
                // Plain new-tab open (no window-features string): passing 'noopener'
                // as features makes desktop browsers treat this as a *popup* and
                // silently block it, so the guide never opened on desktop. Sever
                // opener ourselves instead — same security intent, opens as a real tab.
                const w = window.open('/law-of-the-day-guide.html', '_blank')
                if (w) w.opener = null
              }}
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
              aria-label={`Difficulty: ${difficultyLabel(difficulty)} (tap to change)`}
              title={`Difficulty: ${difficultyLabel(difficulty)}`}
              onClick={cycleDifficulty}
            >
              <IconDifficulty level={difficultyLevel(difficulty)} />
            </IconButton>
            <IconButton
              size="sm"
              aria-label={`Theme: ${themeLabel} (tap to change)`}
              title={`Theme: ${themeLabel}`}
              onClick={cycleTheme}
            >
              <IconTheme pref={themePref} />
            </IconButton>
            <IconButton
              size="sm"
              aria-label="Settings"
              title="Settings"
              onClick={() => setSettingsOpen(true)}
            >
              <IconSettings />
            </IconButton>
          </div>
        </div>
        {status.phase === 'quiz' && !reveal && writing && <WritingView />}
        {status.phase === 'quiz' && !reveal && !writing && (
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
        bestStreak={bestStreak}
        stats={stats}
      />
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        apiKey={apiKey}
        onSaveKey={(key) => { saveAnthropicKey(key); setApiKey(key) }}
      />
    </div>
  )
}
