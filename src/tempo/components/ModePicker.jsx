import { useState } from 'react'
import { Card, IconButton } from '../../ds'
import { MODES, DEFAULT_ORDER, reconcileOrder } from '../lib/modes'
import { loadModeConfig, loadOrder, saveOrder, loadLastOpened, recordOpened } from '../lib/storage'
import { formatRelativeTime } from '../lib/relativeTime'
import { useTheme } from '../lib/themeContext'
import { usePreferences } from '../lib/preferencesContext'
import { SettingsModal } from './SettingsModal'
import { TempoMark, IconReorder, IconArrowUp, IconArrowDown, IconGuide, IconSettings } from './icons'
import styles from './ModePicker.module.css'

export function ModePicker({ onSelect }) {
  const { resolved, cycle } = useTheme()
  const themeLabel = resolved === 'dark' ? 'Dark' : 'Light'
  const { preferences, updatePreferences } = usePreferences()
  const [order, setOrder] = useState(() => reconcileOrder(loadOrder(DEFAULT_ORDER)))
  const [editing, setEditing] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [lastOpened] = useState(() => loadLastOpened())

  function handleSelect(id) {
    recordOpened(id)
    onSelect(id)
  }

  function move(index, dir) {
    setOrder((prev) => {
      const target = index + dir
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      saveOrder(next)
      return next
    })
  }

  function summaryFor(mode) {
    return mode.summarize(loadModeConfig(mode.id, null))
  }

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <div className={styles.topActions}>
          <IconButton aria-label="Settings" title="Settings" onClick={() => setSettingsOpen(true)}>
            <IconSettings />
          </IconButton>
          <IconButton
            aria-label="Open the guide"
            title="Guide"
            onClick={() => window.open('/tempo-guide.html', '_blank', 'noopener')}
          >
            <IconGuide />
          </IconButton>
          <IconButton
            selected={editing}
            aria-label={editing ? 'Done reordering' : 'Reorder timers'}
            title="Reorder"
            onClick={() => setEditing((e) => !e)}
          >
            <IconReorder />
          </IconButton>
          <IconButton
            aria-label={`Theme: ${themeLabel} (tap to switch)`}
            title={`Theme: ${themeLabel}`}
            onClick={cycle}
          >
            {resolved === 'dark' ? '☾' : '☀'}
          </IconButton>
        </div>
      </header>

      <div className={styles.heading}>
        <div className={styles.brand}>
          <TempoMark className={styles.mark} />
          <h1 className={styles.title}>Tempo</h1>
        </div>
        <p className={styles.subtitle}>Gentle timers for movement, focus, and breath.</p>
      </div>

      <div className={styles.grid}>
        {order.map((id, index) => {
          const mode = MODES[id]
          if (!mode) return null
          const Icon = mode.Icon
          const Icon2 = mode.Icon2
          const summary = summaryFor(mode)
          const opened = lastOpened[id]
          const content = (
            <>
              <span className={styles.iconWrap} data-mode={mode.id}>
                <Icon />
                {Icon2 && (
                  <>
                    <span className={styles.iconArrow} aria-hidden>→</span>
                    <Icon2 />
                  </>
                )}
              </span>
              <h2 className={styles.cardTitle}>{mode.name}</h2>
              <p className={styles.cardBlurb}>{mode.tagline}</p>
              {summary && <p className={styles.lastUsed}>{summary}</p>}
              {opened?.last && (
                <p className={styles.lastOpened}>
                  opened {opened.count > 1 ? `${opened.count}× · ` : ''}
                  {formatRelativeTime(opened.last)}
                </p>
              )}
            </>
          )

          if (editing) {
            return (
              <div key={id} className={styles.cardStatic}>
                {content}
                <div className={styles.reorder}>
                  <IconButton size="sm" aria-label="Move up" disabled={index === 0} onClick={() => move(index, -1)}>
                    <IconArrowUp />
                  </IconButton>
                  <IconButton
                    size="sm"
                    aria-label="Move down"
                    disabled={index === order.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <IconArrowDown />
                  </IconButton>
                </div>
              </div>
            )
          }

          return (
            <Card key={id} onClick={() => handleSelect(id)}>
              {content}
            </Card>
          )
        })}
      </div>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        preferences={preferences}
        onChange={updatePreferences}
      />
    </div>
  )
}
