import { useEffect, useState } from 'react'
import type { OptionMood, WeekMood } from '../domain/types'
import { WEEK_MOODS } from '../domain/types'
import { SHAPE_SLOTS, SHAPE_WHERE, shapedSlots, type ShapeWhere, type WeekShape } from '../domain/shaping'
import { useServices } from '../app/services'
import { CharCount, MAX_ASK, NeedsKey, messageOf } from './common'
import { MOOD_WORD } from './OpenPaths'
import s from '../styles/editorial.module.css'

/**
 * "Shape next week": once most of this week's programme is heard, a light hand
 * on next week's three before they are written. Where to go and how it should
 * feel are said with a tap; a wish to chase or avoid is the Notebook's wish for
 * next week, the same words. Then three sketches, one per slot — nudged,
 * swapped, or one left to the curator, a surprise on the day (the default). When
 * the week begins, its three are written from what stands (domain/shaping.ts).
 */
export function ShapeNextWeek() {
  const { journey, repo, curatorReady, say } = useServices()
  const next = journey.nextWeek()
  const [shape, setShape] = useState<WeekShape | null>(null)
  const [wish, setWish] = useState('')
  const [keptWish, setKeptWish] = useState('')
  // One request to the curator at a time: 'sketch', or the slot being nudged or swapped.
  const [busy, setBusy] = useState<string | null>(null)
  const [nudging, setNudging] = useState<OptionMood | null>(null)
  const [nudge, setNudge] = useState('')

  useEffect(() => {
    let live = true
    void Promise.all([journey.shapeFor(next.key), repo.preferences()]).then(([sh, prefs]) => {
      if (!live) return
      setShape(sh ?? null)
      setWish(prefs.nextRequest ?? '')
      setKeptWish(prefs.nextRequest ?? '')
    })
    return () => { live = false }
  }, [journey, repo, next.key])

  async function run(key: string, job: () => Promise<WeekShape>) {
    setBusy(key)
    try {
      setShape(await job())
    } catch (e) {
      say(messageOf(e), 'danger')
    } finally {
      setBusy(null)
    }
  }

  const set = (patch: Partial<Pick<WeekShape, 'where' | 'mood' | 'leftToCurator'>>) => void journey.setShape(patch).then(setShape)

  async function keepWish() {
    const prefs = await repo.preferences()
    await repo.savePreferences({ ...prefs, nextRequest: wish.trim() })
    setKeptWish(wish.trim())
    say(wish.trim() ? 'Kept for next week. The sketches will draw on it.' : 'Cleared.', 'success')
  }

  /** One slot to the curator: the one it held before now needs a sketch of its own. */
  async function leave(mood: OptionMood | null) {
    await journey.setShape({ leftToCurator: mood })
    await run('sketch', () => journey.sketchNextWeek())
  }

  const where = shape?.where ?? 'either'
  const mood = shape?.mood ?? []
  const left = shape ? shape.leftToCurator : 'adventurous'
  const sketches = shape?.sketches ?? []
  const shaped = shape ? shapedSlots(shape) : shapedSlots({ leftToCurator: 'adventurous' })
  const drafted = shaped.every((m) => sketches.some((k) => k.mood === m))
  const held = busy !== null || !curatorReady

  return (
    <div>
      <p className={s.quiet}>
        Before next week’s three directions are written ({next.label}), say where it should go. Sketch it if you like: what stands when the week begins is what the curator writes from. Nothing here is required.
      </p>

      <p className={`${s.eyebrow} ${s.mtSm}`}>Where next week goes</p>
      <div className={s.chipRow} role="radiogroup" aria-label="Where next week goes">
        {SHAPE_WHERE.map((w) => (
          <button key={w.value} type="button" role="radio" aria-checked={where === w.value} className={`${s.chip} ${where === w.value ? s.chipOn : ''}`} onClick={() => set({ where: w.value as ShapeWhere })}>
            {w.label}
          </button>
        ))}
      </div>

      <p className={`${s.eyebrow} ${s.mtSm}`}>How it should feel</p>
      <div className={s.chipRow} role="group" aria-label="How next week should feel">
        {WEEK_MOODS.map((m) => {
          const on = mood.includes(m.value)
          return (
            <button key={m.value} type="button" aria-pressed={on} className={`${s.chip} ${on ? s.chipOn : ''}`} onClick={() => set({ mood: on ? mood.filter((x) => x !== m.value) : [...mood, m.value as WeekMood] })}>
              {m.label}
            </button>
          )
        })}
      </div>

      <p className={`${s.eyebrow} ${s.mtSm}`}>Something to chase or avoid</p>
      {/* The Notebook's wish for next week: one set of words, wherever it is written. */}
      <form className={s.cardForm} onSubmit={(e) => { e.preventDefault(); void keepWish() }}>
        <label className={s.visuallyHidden} htmlFor="shape-wish">Something to chase or avoid next week</label>
        <input id="shape-wish" className={s.input} maxLength={MAX_ASK} placeholder="more Sibelius · no opera" value={wish} onChange={(e) => setWish(e.target.value)} />
        <CharCount value={wish} />
        {wish.trim() !== keptWish && <button type="submit" className={`${s.outlineButton} ${s.smallButton}`}>Keep it</button>}
      </form>

      <p className={`${s.eyebrow} ${s.mtSm}`}>The sketches</p>
      {!curatorReady && <NeedsKey to="sketch next week" />}
      {!sketches.length && (
        <div className={s.actions}>
          <button type="button" className={s.outlineButton} onClick={() => void run('sketch', () => journey.sketchNextWeek())} disabled={held}>
            {busy === 'sketch' ? 'The curator is sketching…' : 'Sketch next week'}
          </button>
        </div>
      )}
      {(sketches.length > 0 || busy === 'sketch') && (
        <ul className={s.entries} aria-label="Next week’s sketches">
          {SHAPE_SLOTS.map((m) => {
            const k = sketches.find((x) => x.mood === m)
            if (m === left) {
              return (
                <li key={m} className={s.entry}>
                  <p className={`${s.eyebrow} ${s.flush}`}>{MOOD_WORD[m]} · left to the curator</p>
                  <p className={s.quiet}>A surprise, chosen when the week begins.</p>
                  <div className={s.actions}>
                    <button type="button" className={`${s.textButton} ${s.quietButton}`} onClick={() => void leave(null)} disabled={held}>Sketch this one too</button>
                  </div>
                </li>
              )
            }
            return (
              <li key={m} className={s.entry}>
                <p className={`${s.eyebrow} ${s.flush}`}>{MOOD_WORD[m]}{k?.from ? ` · ${k.from}` : ''}</p>
                {k ? (
                  <>
                    <h4 className={s.nextOption}>{k.title}</h4>
                    <p className={s.quiet}>{k.line}</p>
                    {k.nudge && <p className={s.faint}>Nudged: “{k.nudge}”</p>}
                  </>
                ) : (
                  <p className={s.quiet}>{busy === 'sketch' ? 'The curator is sketching…' : 'Not sketched yet.'}</p>
                )}
                {k && nudging === m ? (
                  <form className={s.cardForm} onSubmit={(e) => {
                    e.preventDefault()
                    if (!nudge.trim() || held) return
                    void run(m, () => journey.nudgeSketch(m, nudge)).then(() => { setNudging(null); setNudge('') })
                  }}>
                    <label className={s.visuallyHidden} htmlFor={`nudge-${m}`}>How should it move?</label>
                    <input id={`nudge-${m}`} className={s.input} maxLength={MAX_ASK} placeholder="less Germanic · more choral" value={nudge} onChange={(e) => setNudge(e.target.value)} disabled={busy !== null} autoFocus />
                    <div className={s.actions}>
                      <button type="submit" className={`${s.outlineButton} ${s.smallButton}`} disabled={held || !nudge.trim()}>{busy === m ? 'The curator is redrafting…' : 'Move it'}</button>
                      <button type="button" className={`${s.textButton} ${s.quietButton}`} onClick={() => { setNudging(null); setNudge('') }}>Never mind</button>
                    </div>
                  </form>
                ) : k && (
                  <div className={s.actions}>
                    <button type="button" className={`${s.textButton} ${s.quietButton}`} onClick={() => setNudging(m)} disabled={held}>Nudge</button>
                    {' · '}
                    <button type="button" className={`${s.textButton} ${s.quietButton}`} onClick={() => void run(m, () => journey.swapSketch(m))} disabled={held}>{busy === m ? 'The curator is sketching…' : 'Another'}</button>
                    {' · '}
                    <button type="button" className={`${s.textButton} ${s.quietButton}`} onClick={() => void leave(m)} disabled={held}>Leave to the curator</button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {sketches.length > 0 && drafted && (
        <p className={s.faint}>
          These stand until the week begins; then its three directions are written from them, with whatever you hear and say before then.{' '}
          <button type="button" className={`${s.textButton} ${s.quietButton}`} onClick={() => void journey.clearShape().then(() => setShape(null))} disabled={busy !== null}>Start again</button>
        </p>
      )}
    </div>
  )
}

