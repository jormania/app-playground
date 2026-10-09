import { useEffect, useState } from 'react'
import { Modal, Field, Button } from '../../ds'
import { testKey } from '../lib/generate'
import styles from './SettingsModal.module.css'

// One setting for now: the Anthropic key that lets today's scenario be written
// fresh. It stays on this device; nothing is sent anywhere but Anthropic.
export function SettingsModal({ open, onClose, apiKey, onSaveKey }) {
  const [draft, setDraft] = useState(apiKey)
  const [check, setCheck] = useState(null) // null | 'testing' | 'ok' | message
  useEffect(() => { if (open) { setDraft(apiKey); setCheck(null) } }, [open, apiKey])

  const dirty = draft.trim() !== apiKey
  async function test() {
    setCheck('testing')
    setCheck(await testKey(draft))
  }

  return (
    <Modal open={open} onClose={onClose} title="Settings">
      <section className={styles.section}>
        <h3 className={styles.heading}>Fresh scenarios</h3>
        <p className={styles.body}>
          With your own Anthropic API key, each day&rsquo;s scenario is newly written by Claude
          (Sonnet) when you open the app — a few seconds, about a cent, and only on days you
          play. Without one, the scenarios built into the app are used.
        </p>
        <Field
          label="Anthropic API key"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder="sk-ant-…"
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setCheck(null) }}
          hint="Kept on this device only. Create one at console.anthropic.com; a small monthly spend limit is a good idea."
        />
        <div className={styles.actions}>
          <Button disabled={!dirty} onClick={() => { onSaveKey(draft.trim()); onClose() }}>Save</Button>
          <Button variant="secondary" disabled={!draft.trim() || check === 'testing'} onClick={test}>
            {check === 'testing' ? 'Testing…' : 'Test the key'}
          </Button>
          {apiKey && (
            <Button variant="ghost" onClick={() => { onSaveKey(''); setDraft('') }}>Remove key</Button>
          )}
        </div>
        {check && check !== 'testing' && (
          <p role="status" className={check === 'ok' ? styles.ok : styles.problem}>
            {check === 'ok' ? 'The key works.' : check}
          </p>
        )}
      </section>
    </Modal>
  )
}
