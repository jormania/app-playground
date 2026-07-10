import { useState } from 'react'
import { Button } from '../../ds'
import Settings from './Settings'
import MoonGlyph from './MoonGlyph'
import styles from './Home.module.css'

// The home is as close to empty as it gets: the glyph, a line, and Begin.
// Everything configurable lives behind the glyph itself — tap 夜 to adjust — so
// nothing else clutters the screen at bedtime.
export default function Home({ settings, onChange, onBegin }) {
  const [settingsOpen, setSettingsOpen] = useState(false)

  // The hero pulses in the rhythm of the chosen breath — one full cycle of the
  // pattern as it begins (a lengthening exhale is ~10s; 4·7·8 is ~19s). With
  // breathwork off there's no breath to follow, so it drifts on a slow default.
  const breathCycle = settings.breathwork === false ? 14 : settings.breath === '478' ? 19 : 10

  const openSettings = () => {
    setSettingsOpen(true)
    if (!settings.hintSeen) onChange({ hintSeen: true })
  }

  return (
    <main className={styles.home}>
      <span className={styles.heroWrap}>
        <button
          type="button"
          className={styles.hero}
          lang="ja"
          aria-label="Yoru — settings"
          style={{ '--breath-cycle': `${breathCycle}s` }}
          onClick={openSettings}
        >
          夜
        </button>
        {/* A quiet teaser of tonight's real moon phase. */}
        <span className={styles.phaseGlyph}>
          <MoonGlyph />
        </span>
      </span>
      <p className={styles.tagline}>put the day down</p>
      {!settings.hintSeen && <p className={styles.hint}>tap 夜 to adjust</p>}

      <Button className={styles.begin} onClick={onBegin}>
        Begin
      </Button>

      {settingsOpen && (
        <Settings settings={settings} onChange={onChange} onClose={() => setSettingsOpen(false)} />
      )}
    </main>
  )
}
