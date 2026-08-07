import React, { useState } from 'react'
import { Modal, SettingsToggle, Button, Field, SegmentedControl } from '../../ds'
import { ChevronRight } from 'lucide-react'
import styles from './Settings.module.css'

export function Settings({ open, onClose, config, updateConfig, resetStats }) {
  const [showCurate, setShowCurate] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [curating, setCurating] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  const handleCurate = async () => {
    if (!apiKey) return
    setCurating(true)
    try {
      const res = await fetch('https://corsproxy.io/?' + encodeURIComponent('https://api.anthropic.com/v1/messages'), {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1500,
          messages: [{ role: 'user', content: 'Generate a JSON array of 500 interesting 5-letter English words for a word game. Only output the raw JSON array of strings, nothing else.' }]
        })
      })
      if (!res.ok) throw new Error('API request failed')
      const data = await res.json()
      const text = data.content[0].text
      const match = text.match(/\[([\s\S]*?)\]/)
      if (match) {
        let words = JSON.parse(match[0])
        words = words.map(w => w.toLowerCase()).filter(w => w.length === 5 && /^[a-z]+$/.test(w))
        if (words.length > 0) {
          localStorage.setItem('lexi5_custom_dict', JSON.stringify(words))
          alert(`Successfully curated ${words.length} new words! You can now select "Custom (AI Curated)" in the dictionary list.`)
          updateConfig({ dictionary: 'custom' })
          setShowCurate(false)
        }
      }
    } catch (err) {
      alert('Failed to curate: ' + err.message)
    } finally {
      setCurating(false)
    }
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
        <Button variant="ghost" onClick={() => setShowCurate(!showCurate)}>
          Advanced: Dictionary Curation
        </Button>
        
        {showCurate && (
          <div className={styles.curateCard}>
            <p className={styles.curateDesc}>
              Provide an Anthropic API key to re-curate the daily answers list using Claude 3 Haiku. 
              (Note: For security, keys are never saved to the server).
            </p>
            <Field 
              label="API Key"
              type="password" 
              value={apiKey} 
              onChange={e => setApiKey(e.target.value)} 
              placeholder="sk-ant-..."
            />
            <Button onClick={handleCurate} disabled={curating || !apiKey}>
              {curating ? 'Curating...' : 'Start Curation'}
            </Button>
          </div>
        )}
        
        <Button variant="ghost" onClick={() => setShowResetConfirm(true)} style={{color: 'var(--red, #f44336)'}}>
          Reset Statistics
        </Button>
      </div>

      <Modal open={showResetConfirm} onClose={() => setShowResetConfirm(false)} title="Reset Statistics">
        <p style={{textAlign: 'center', marginBottom: '24px', fontSize: '1.1rem'}}>
          Are you sure you want to permanently erase all your gameplay statistics?
          <br />
          <span style={{color: 'var(--text-subtle)', fontSize: '0.9rem'}}>This action cannot be undone.</span>
        </p>
        <div style={{display: 'flex', gap: '12px', justifyContent: 'center'}}>
          <Button variant="ghost" onClick={() => setShowResetConfirm(false)}>
            Cancel
          </Button>
          <Button variant="primary" style={{backgroundColor: 'var(--red, #f44336)', borderColor: 'var(--red, #f44336)'}} onClick={() => {
            resetStats()
            setShowResetConfirm(false)
            alert('Statistics reset.')
          }}>
            Confirm Reset
          </Button>
        </div>
      </Modal>
    </Modal>
  )
}
