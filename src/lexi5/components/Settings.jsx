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
  markCustomDictionaryCurated,
  removeCustomDictionary,
  isValidGuess,
  BUILTIN_DICTIONARY_ORDER,
  DICTIONARY_SIZES,
  DICTIONARY_LABELS
} from '../lib/gameState'
import { SelectField } from '../../ds/components/SelectField'
import styles from './Settings.module.css'

const CURATE_TIMEOUT_MS = 30000

export function Settings({ open, onClose, config, updateConfig, onDictionaryChange, resetStats, gameState, onToast, initialShowCurate = false }) {
  const [showCurate, setShowCurate] = useState(initialShowCurate)
  const [apiKey, setApiKey] = useState('')
  const [curating, setCurating] = useState(false)
  const [curateError, setCurateError] = useState(null)
  const [wordCount, setWordCount] = useState(500)
  const [model, setModel] = useState('claude-haiku-4-5-20251001')
  const [showClearConfirm, setShowClearConfirm] = useState(false)
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
      let exclusions = ''
      if (hasCustomDict) {
        try {
          const existing = JSON.parse(localStorage.getItem('lexi5_custom_dict'))
          if (existing && existing.length > 0) {
            exclusions = ` Do not include any of the following words: ${existing.join(', ')}.`
          }
        } catch (_e) {}
      }

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
          model,
          max_tokens: 4096,
          messages: [{ role: 'user', content: `Generate a JSON array of ${wordCount} interesting 5-letter English words for a word game.${exclusions} Only output the raw JSON array of strings, nothing else.` }]
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

      const validWords = words.filter(w => isValidGuess(w))
      const discardedCount = words.length - validWords.length
      words = validWords

      if (words.length === 0) throw new Error("AI did not return any valid 5-letter words.")

      localStorage.setItem('lexi5_custom_dict', JSON.stringify(words))
      markCustomDictionaryCurated()
      setShowCurate(false)
      onDictionaryChange('custom')
      
      let toastMsg = `Custom list curated with ${words.length} words — new word ready!`
      if (discardedCount > 0) {
        toastMsg = `Curated ${words.length} words (${discardedCount} invalid words discarded) — new word ready!`
      }
      onToast(toastMsg)
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

        <div className={styles.themeRow}>
          <SegmentedControl
            size="sm"
            options={[
              { label: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>, value: 'system' },
              { label: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>, value: 'light' },
              { label: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>, value: 'dark' },
            ]}
            value={config.theme || 'system'}
            onChange={(val) => updateConfig({ theme: val === 'system' ? null : val })}
          />
        </div>
      </div>

      <div className={styles.advanced}>
        <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
          <Button variant="ghost" onClick={() => setShowCurate(!showCurate)}>
            AI Curation
          </Button>
          {config.dictionary === 'custom' && hasCustomDict && (
            <span className={styles.activePill}>Active</span>
          )}
        </div>

        {showCurate && (
          <div className={styles.curateCard}>
            <p className={styles.curateDesc}>
              Paste an Anthropic API key to curate a list with Claude.
              {customProgress && ` Current list: ${customProgress.position}/${customProgress.total} words used this cycle.`}
            </p>
            {curateError && (
              <p className={styles.curateError}>{curateError}</p>
            )}
            <SelectField
              label="Model"
              value={model}
              onChange={e => setModel(e.target.value)}
            >
              <option value="claude-haiku-4-5-20251001">Claude 3.5 Haiku (Fast)</option>
              <option value="claude-sonnet-3-5-1022">Claude 3.5 Sonnet (Smart)</option>
            </SelectField>
            <Field
              label="Word Count"
              type="number"
              value={wordCount}
              onChange={e => setWordCount(Number(e.target.value))}
              min="10"
              max="1000"
            />
            <Field
              label="API Key"
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
              autoComplete="off"
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <Button size="sm" onClick={handleCurate} disabled={curating || !apiKey}>
                {curating ? 'Curating...' : hasCustomDict ? 'Refresh Word List' : 'Start Curation'}
              </Button>
              {hasCustomDict && (
                <Button size="sm" variant="ghost" className={styles.dangerButton} onClick={() => setShowClearConfirm(true)}>
                  Clear List
                </Button>
              )}
            </div>
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

      <ConfirmModal
        isOpen={showClearConfirm}
        onCancel={() => setShowClearConfirm(false)}
        title="Clear Custom List"
        message="Are you sure you want to delete your custom word list? You will be returned to the Standard dictionary."
        confirmText="Clear List"
        variant="danger"
        onConfirm={() => {
          removeCustomDictionary()
          if (config.dictionary === 'custom') {
            onDictionaryChange('standard')
          }
          setShowClearConfirm(false)
          setShowCurate(false)
          onToast('Custom list cleared.')
        }}
      />
    </Modal>
  )
}
