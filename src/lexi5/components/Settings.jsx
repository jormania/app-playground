import React, { useState, useEffect } from 'react'
import { SettingsToggle } from '../../ds'
import { Button } from '../../ds/components/Button'
import { Modal } from '../../ds/components/Modal'
import { ConfirmModal } from '../../ds/components/Dialogs'
import { Field } from '../../ds/components/Field'
import { SegmentedControl } from '../../ds'
import {
  getWordProgress,
  hasCustomDictionary,
  getCustomDictionarySize,
  BUILTIN_DICTIONARY_ORDER,
  DICTIONARY_SIZES,
  DICTIONARY_LABELS
} from '../lib/gameState'
import styles from './Settings.module.css'

const CURATE_TIMEOUT_MS = 30000

export function Settings({ open, onClose, config, updateConfig, onDictionaryChange, resetStats, gameState, onToast, initialShowCurate = false }) {
  const [showCurate, setShowCurate] = useState(initialShowCurate)
  const [apiKey, setApiKey] = useState('')
  const [curating, setCurating] = useState(false)
  const [curateError, setCurateError] = useState(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showRecurateConfirm, setShowRecurateConfirm] = useState(false)

  // The Modal delays its own mount by an animation frame or two, so a plain
  // useState(initialShowCurate) can miss the value if it arrives right as the
  // modal is opening — react to it explicitly instead of relying on mount timing.
  useEffect(() => {
    if (open && initialShowCurate) setShowCurate(true)
  }, [open, initialShowCurate])

  const hasCustomDict = hasCustomDictionary()
  const customProgress = hasCustomDict && gameState
    ? getWordProgress('custom', gameState.date, gameState.iteration)
    : null

  const runCurate = async () => {
    setCurating(true)
    setCurateError(null)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), CURATE_TIMEOUT_MS)

    try {
      const res = await fetch('/api/anthropic-proxy/v1/messages', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 4096,
          messages: [{ role: 'user', content: 'Generate a JSON array of 500 interesting 5-letter English words for a word game. Only output the raw JSON array of strings, nothing else.' }]
        })
      })
      if (!res.ok) {
        const errText = await res.text().catch(() => 'Unknown error')
        throw new Error(`Status ${res.status}: ${errText}`)
      }
      const data = await res.json()
      const text = data.content[0].text
      const match = text.match(/\[([\s\S]*?)\]/)

      let words
      if (match) {
        words = JSON.parse(match[0])
      } else {
        // Response likely got truncated before the closing bracket — recover
        // whatever complete quoted words were returned instead of failing outright.
        words = [...text.matchAll(/"([a-zA-Z]+)"/g)].map(m => m[1])
        if (words.length === 0) {
          throw new Error("Could not parse JSON array from AI response. AI said: " + text.substring(0, 150) + (text.length > 150 ? '...' : ''))
        }
      }
      words = [...new Set(words.map(w => w.toLowerCase()))].filter(w => w.length === 5 && /^[a-z]+$/.test(w))

      if (words.length === 0) throw new Error("AI did not return any valid 5-letter words.")

      localStorage.setItem('lexi5_custom_dict', JSON.stringify(words))
      setShowCurate(false)
      onDictionaryChange('custom')
      onToast(`Custom list curated with ${words.length} words — new word ready!`)
    } catch (err) {
      const message = err.name === 'AbortError'
        ? 'Curation timed out after 30s. Please try again.'
        : err.message
      setCurateError(message)
    } finally {
      clearTimeout(timeout)
      setCurating(false)
    }
  }

  const handleCurate = () => {
    if (!apiKey) return
    if (hasCustomDict) {
      setShowRecurateConfirm(true)
      return
    }
    runCurate()
  }

  return (
    <Modal open={open} onClose={onClose} title="Settings">
      <div className={styles.settingsList}>
        <div className={styles.dictionarySection}>
          <label className={styles.dictionaryLabel}>Word Dictionary</label>
          <p className={styles.dictionaryDesc}>
            Easiest to hardest, left to right. Switching deals a fresh word immediately, no penalty.
          </p>
          <div className={styles.selectWrapper}>
            <select
              value={config.dictionary}
              onChange={e => onDictionaryChange(e.target.value)}
              className={styles.dropdown}
            >
              {BUILTIN_DICTIONARY_ORDER.map(key => (
                <option key={key} value={key}>
                  {DICTIONARY_LABELS[key]} ({DICTIONARY_SIZES[key].toLocaleString()} words)
                </option>
              ))}
              <option value="custom" disabled={!hasCustomDict}>
                {DICTIONARY_LABELS.custom}{hasCustomDict ? ` (${getCustomDictionarySize().toLocaleString()} words)` : ' — curate one below first'}
              </option>
            </select>
          </div>
        </div>

        <div className={styles.tightToggle}>
          <SettingsToggle
            label="Hard Mode"
            description="Any revealed hints must be used in subsequent guesses"
            checked={config.difficulty === 'hard'}
            onChange={(e) => updateConfig({ difficulty: e.target.checked ? 'hard' : 'normal' })}
          />

          <SettingsToggle
            label="Smart Keyboard"
            description="Show dots on yellow keys for positions you've already tried"
            checked={config.smartKeyboard === true}
            onChange={(e) => updateConfig({ smartKeyboard: e.target.checked })}
          />
        </div>

        <div className={styles.dictionarySection}>
          <label className={styles.dictionaryLabel}>Theme</label>
          <SegmentedControl
            size="sm"
            options={[
              { label: 'System', value: 'system' },
              { label: 'Light', value: 'light' },
              { label: 'Dark', value: 'dark' },
            ]}
            value={config.theme || 'system'}
            onChange={(val) => updateConfig({ theme: val === 'system' ? null : val })}
          />
        </div>
      </div>

      <div className={styles.advanced}>
        <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
          <Button variant="ghost" onClick={() => setShowCurate(!showCurate)}>
            Advanced: Dictionary Curation
          </Button>
          {config.dictionary === 'custom' && hasCustomDict && (
            <span className={styles.activePill}>Active</span>
          )}
        </div>

        {showCurate && (
          <div className={styles.curateCard}>
            <p className={styles.curateDesc}>
              Paste an Anthropic API key to curate a list with Claude Haiku (key never saved).
              {customProgress && ` Current list: ${customProgress.position}/${customProgress.total} words used this cycle.`}
            </p>
            {curateError && (
              <p className={styles.curateError}>{curateError}</p>
            )}
            <Field
              label="API Key"
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
              autoComplete="off"
            />
            <Button size="sm" onClick={handleCurate} disabled={curating || !apiKey}>
              {curating ? 'Curating...' : hasCustomDict ? 'Refresh Word List' : 'Start Curation'}
            </Button>
          </div>
        )}

        <Button variant="ghost" onClick={() => setShowResetConfirm(true)} className={styles.dangerButton}>
          Reset Statistics
        </Button>
      </div>

      <ConfirmModal
        isOpen={showResetConfirm}
        onCancel={() => setShowResetConfirm(false)}
        title="Reset Statistics"
        message="Are you sure you want to permanently erase all your gameplay statistics? This action cannot be undone."
        confirmText="Confirm Reset"
        variant="danger"
        onConfirm={() => {
          resetStats()
          setShowResetConfirm(false)
          onToast('Statistics reset.')
        }}
      />

      <ConfirmModal
        isOpen={showRecurateConfirm}
        onCancel={() => setShowRecurateConfirm(false)}
        title="Refresh Word List"
        message="This replaces your existing custom word list with a brand new one. The old list's no-repeat cycle progress will be lost. Continue?"
        confirmText="Refresh"
        variant="danger"
        onConfirm={() => {
          setShowRecurateConfirm(false)
          runCurate()
        }}
      />
    </Modal>
  )
}
