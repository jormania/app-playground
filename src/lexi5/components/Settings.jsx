import React, { useState } from 'react'
import { SettingsToggle } from '../../ds'
import { Button } from '../../ds/components/Button'
import { Modal } from '../../ds/components/Modal'
import { ConfirmModal } from '../../ds/components/Dialogs'
import { Field } from '../../ds/components/Field'
import { SegmentedControl } from '../../ds'
import { getWordProgress } from '../lib/gameState'
import styles from './Settings.module.css'

export function Settings({ open, onClose, config, updateConfig, resetStats, gameState }) {
  const [showCurate, setShowCurate] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [curating, setCurating] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showRecurateConfirm, setShowRecurateConfirm] = useState(false)

  const hasCustomDict = !!localStorage.getItem('lexi5_custom_dict')
  const customProgress = hasCustomDict && gameState
    ? getWordProgress('custom', gameState.date, gameState.iteration)
    : null

  const runCurate = async () => {
    setCurating(true)
    try {
      const res = await fetch('/api/anthropic-proxy/v1/messages', {
        method: 'POST',
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
      words = words.map(w => w.toLowerCase()).filter(w => w.length === 5 && /^[a-z]+$/.test(w))
      
      if (words.length === 0) throw new Error("AI did not return any valid 5-letter words.")
      
      localStorage.setItem('lexi5_custom_dict', JSON.stringify(words))
      alert(`Successfully curated ${words.length} new words! You can now select "Custom (AI Curated)" in the dictionary list.`)
      updateConfig({ dictionary: 'custom' })
      setShowCurate(false)
    } catch (err) {
      alert('Failed to curate: ' + err.message)
    } finally {
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
          <div className={styles.dictionaryDesc}>
            <p>Choose the word list for new games:</p>
            <ul>
              <li><strong>Standard:</strong> Official curated list</li>
              <li><strong>Expanded:</strong> More variety, some plurals</li>
              <li><strong>Expert:</strong> Massive list, very obscure</li>
            </ul>
          </div>
          <div className={styles.selectWrapper}>
            <select 
              value={config.dictionary} 
              onChange={e => updateConfig({ dictionary: e.target.value })}
              className={styles.dropdown}
            >
              <option value="standard">Standard (2,309 words)</option>
              <option value="expanded">Expanded (5,757 words)</option>
              <option value="expert">Expert (13,106 words)</option>
              <option value="custom">Custom (AI Curated)</option>
            </select>
          </div>
        </div>

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
        
        <div className={styles.dictionarySection}>
          <label className={styles.dictionaryLabel}>Theme</label>
          <SegmentedControl
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
              Provide an Anthropic API key to re-curate the daily answers list using Claude 4.5 Haiku.
              (Note: For security, keys are never saved to the server).
              Words are shown in a shuffled order so none repeats until every word in the list has
              been used, then it starts a fresh cycle.
            </p>
            {customProgress && (
              <p className={styles.curateDesc}>
                Current list: {customProgress.total} words — {customProgress.position} used so far
                this cycle.
              </p>
            )}
            <Field
              label="API Key"
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
            />
            <Button onClick={handleCurate} disabled={curating || !apiKey}>
              {curating ? 'Curating...' : hasCustomDict ? 'Refresh Word List' : 'Start Curation'}
            </Button>
          </div>
        )}
        
        <Button variant="ghost" onClick={() => setShowResetConfirm(true)} style={{color: 'var(--red, #f44336)'}}>
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
          alert('Statistics reset.')
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
