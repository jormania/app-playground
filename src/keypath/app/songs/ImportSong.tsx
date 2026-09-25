import { useMemo, useRef, useState } from 'react'
import { Button, Field } from '../../../ds'
import { SelectField } from '../../../ds/components/SelectField'
import { useApp } from '../context'
import { navigate } from '../router'
import { TopBar } from '../screens/TopBar'
import { SPLIT_RANGE, type FitMode } from '../../engine'
import { FitChoice } from './FitChoice'
import { noteLabel } from '../i18n'
import { buildImport, choosePart, draftFromFile, SongLibrary, type ImportDraft, type ImportProblem } from './library'
import styles from './songs.module.css'

const PROBLEM_TEXT = { 'not-midi': 'importNotMidi', unsupported: 'importUnsupported', 'no-notes': 'importNoNotes' } as const

/** "Add a song": pick a MIDI file, confirm which part is which hand, save it to this phone. */
export function ImportSong() {
  const { t, store, log, profile, settings } = useApp()
  const library = useMemo(() => new SongLibrary(store), [store])
  const fileInput = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState<ImportDraft | null>(null)
  const [problem, setProblem] = useState<ImportProblem | null>(null)
  const [title, setTitle] = useState('')
  /** How notes past the keyboard are handled; null is the best choice for this song. */
  const [fit, setFit] = useState<FitMode | null>(null)

  const pick = async (file: File | undefined) => {
    if (!file) return
    const result = draftFromFile(await file.arrayBuffer(), file.name)
    if (typeof result === 'string') {
      setProblem(result)
      setDraft(null)
      return
    }
    setProblem(null)
    setFit(null)
    setDraft(result)
    setTitle(result.title)
  }

  const choose = (hand: 'right' | 'left', key: string) => {
    if (!draft) return
    setDraft(choosePart(draft, hand, key))
  }

  // What saving would produce, shown before saving: notes past the keyboard
  // are offered their choices while the parts are still being chosen.
  const preview = useMemo(() => (draft?.right ? buildImport(draft, title, fit) : null), [draft, title, fit])

  const save = async () => {
    if (!preview) return
    await library.add(preview.song)
    if (profile) await log.add(profile.id, { type: 'song_added' })
    navigate({ name: 'play', songId: preview.song.id }, { replace: true })
  }

  /** A key by name and octave, middle C marked: C4 (middle C). */
  const keyName = (p: number) => `${noteLabel(p, settings.noteNames, settings.language)}${Math.floor(p / 12) - 1}${p === 60 ? ` (${t('middleCShort')})` : ''}`

  const partSelect = (hand: 'right' | 'left') => (
    <SelectField label={t(hand === 'right' ? 'rightHand' : 'leftHand')} value={draft?.[hand]?.key ?? ''} onChange={(e) => choose(hand, e.target.value)}>
      {hand === 'left' && <option value="">{t('noPart')}</option>}
      {draft?.parts.map((p) => (
        <option key={p.key} value={p.key}>
          {p.name} · {t('notesCount', { count: p.noteCount })}
        </option>
      ))}
    </SelectField>
  )

  return (
    <main className={styles.screen}>
      <TopBar title={t('addSong')} />
      <section className={styles.panel}>
        <p className={styles.hint}>{t('addSongHint')}</p>
        <div>
          <Button onClick={() => fileInput.current?.click()}>{t('chooseFile')}</Button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".mid,.midi,.kar,audio/midi,audio/x-midi"
          hidden
          onChange={(e) => {
            void pick(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        {problem && (
          <p className={styles.problem} role="alert">
            {t(PROBLEM_TEXT[problem])}
          </p>
        )}
      </section>
      {draft && (
        <section className={styles.panel}>
          <Field label={t('songTitle')} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
          <h2 className={styles.h2}>{t('whichPart')}</h2>
          {partSelect('right')}
          {partSelect('left')}
          {draft.right && !draft.left && (draft.splitSuggested !== null || (draft.right.low < 60 && draft.right.high >= 60)) && (
            <div className={styles.split}>
              <label className={styles.splitToggle}>
                <input type="checkbox" checked={draft.split !== null} onChange={(e) => setDraft({ ...draft, split: e.target.checked ? (draft.splitSuggested ?? 60) : null })} />
                <span>{t('splitHands')}</span>
              </label>
              {draft.splitSuggested !== null && <p className={styles.hint}>{t('splitHint')}</p>}
              {draft.split !== null && (
                <>
                  <SelectField label={t('splitAt')} value={String(draft.split)} onChange={(e) => setDraft({ ...draft, split: Number(e.target.value) })}>
                    {Array.from({ length: SPLIT_RANGE.high - SPLIT_RANGE.low + 1 }, (_, i) => SPLIT_RANGE.low + i).map((p) => (
                      <option key={p} value={p}>
                        {keyName(p)}
                      </option>
                    ))}
                  </SelectField>
                  {preview && (
                    <p className={styles.hint}>
                      {t('splitCounts', { left: preview.song.notes.filter((n) => n.hand === 'left').length, right: preview.song.notes.filter((n) => n.hand === 'right').length })}
                    </p>
                  )}
                </>
              )}
            </div>
          )}
          {preview && preview.options.length > 0 && <FitChoice options={preview.options} value={preview.song.fit ?? preview.options[0].mode} onChange={setFit} outside={preview.outside} atImport />}
          <div>
            <Button onClick={save} disabled={!preview}>
              {t('addToSongs')}
            </Button>
          </div>
        </section>
      )}
    </main>
  )
}
