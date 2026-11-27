import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Button, Field, TextAreaField } from '../../ds'
import { SelectField } from '../../ds/components/SelectField'
import { cx } from '../../ds/lib/cx'
import { hrefOf, navigate } from '../app/router'
import { useMatDays } from '../app/state'
import { ChipGroup, Empty, Thumb } from '../components/ui'
import type { ClassificationSource, Confidence, Session } from '../domain/types'
import {
  ENERGY, EQUIPMENT, EXPERIENCE, INTENSITY_LABELS, OBJECTIVES, PHYSICAL_FOCUS, STYLES, TIME_OF_DAY,
} from '../domain/vocabulary'
import { normaliseRecord } from '../lib/importExport'
import { parseVideoId, thumbnailUrl } from '../lib/youtube'
import s from './screens.module.css'

interface Draft {
  url: string
  title: string
  description: string
  instructor: string
  duration: string
  intensity: string
  styles: string[]
  physicalFocus: string[]
  objectives: string[]
  energy: string[]
  experienceLevel: string[]
  timeOfDay: string[]
  equipment: string[]
  series: string
  seriesDay: string
  publishedDate: string
  tags: string
  confidence: Confidence
  source: ClassificationSource
}

/** True when a session that was only a title guess had its classification changed by hand. */
function reviewedGuess(existing: Session | undefined, d: Draft): boolean {
  if (!existing || existing.classificationSource !== 'inferred') return false
  if (d.source !== 'inferred' || d.confidence !== existing.classificationConfidence) return false
  const before = toDraft(existing, '')
  const keys: (keyof Draft)[] = ['styles', 'physicalFocus', 'objectives', 'energy', 'experienceLevel', 'timeOfDay', 'equipment', 'intensity', 'series', 'seriesDay']
  return keys.some((k) => JSON.stringify(before[k]) !== JSON.stringify(d[k]))
}

/** Five equal steps, the chosen level named underneath; tap the chosen one again to clear it. */
function IntensityPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className={s.intensityPick}>
      <span className={s.intensityLegend} id="sf-intensity">Intensity</span>
      <div className={s.intensitySteps} role="radiogroup" aria-labelledby="sf-intensity">
        {INTENSITY_LABELS.map((label, i) => {
          const n = i + 1
          return (
            <button key={label} type="button" role="radio" aria-checked={value === n} aria-label={label}
              className={cx(s.intensityStep, value >= n && s.intensityOn, value === n && s.intensityChosen)}
              onClick={() => onChange(value === n ? 0 : n)}>
              <span className={s.intensityBar} style={{ height: `${8 + n * 5}px` }} />
              <span className={s.intensityNum}>{n}</span>
            </button>
          )
        })}
      </div>
      <span className={s.intensityCaption} aria-live="polite">
        {value ? INTENSITY_LABELS[value - 1] : 'Not set: tap a step, from very gentle to very challenging'}
      </span>
    </div>
  )
}

function toDraft(x: Session | undefined, instructor: string): Draft {
  return {
    url: x?.youtubeUrl ?? '',
    title: x?.title ?? '',
    description: x?.description ?? '',
    instructor: x?.instructor ?? instructor,
    duration: x ? String(x.durationMinutes) : '',
    intensity: String(x?.intensity ?? 0),
    styles: x?.styles ?? [],
    physicalFocus: x?.physicalFocus ?? [],
    objectives: x?.objectives ?? [],
    energy: x?.energy ?? [],
    experienceLevel: x?.experienceLevel ?? [],
    timeOfDay: x?.timeOfDay ?? [],
    equipment: x?.equipment ?? [],
    series: x?.series ?? '',
    seriesDay: x?.seriesDay ? String(x.seriesDay) : '',
    publishedDate: x?.publishedDate?.slice(0, 10) ?? '',
    tags: (x?.tags ?? []).join(', '),
    // Something you type in yourself is a manual classification.
    confidence: x?.classificationConfidence ?? 'high',
    source: x?.classificationSource ?? 'manual',
  }
}

export function SessionEditor({ id }: { id?: string }) {
  const { byId, sessions, preferences, upsertSessions, toast, ready, seriesDefs } = useMatDays()
  const existing = id ? byId.get(id) : undefined
  const [d, setD] = useState<Draft>(() => toDraft(existing, preferences.defaultInstructor))
  const [errors, setErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  if (id && !existing) return ready ? <Empty title="Session not found"><a className={s.textLink} href="#/settings">Settings</a></Empty> : null

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((cur) => ({ ...cur, [k]: v }))
  const videoId = parseVideoId(d.url)
  const clash = videoId ? sessions.find((x) => x.youtubeVideoId === videoId && x.id !== existing?.id) : undefined

  const save = async () => {
    const { session, errors: errs } = normaliseRecord({
      id: existing?.id,
      title: d.title,
      description: d.description,
      instructor: d.instructor,
      youtubeUrl: existing?.isDemo && !videoId ? existing.youtubeUrl : d.url,
      isDemo: existing?.isDemo && !videoId ? true : undefined,
      durationMinutes: d.duration,
      intensity: d.intensity,
      styles: d.styles, physicalFocus: d.physicalFocus, objectives: d.objectives, energy: d.energy,
      experienceLevel: d.experienceLevel, timeOfDay: d.timeOfDay, equipment: d.equipment,
      series: d.series,
      seriesDay: d.seriesDay,
      tags: [
        ...d.tags.split(',').map((t) => t.trim()).filter(Boolean),
        // Your own series/day is never overwritten by the channel title reader.
        ...(existing && (d.series !== (existing.series ?? '') || d.seriesDay !== (existing.seriesDay ? String(existing.seriesDay) : '')) &&
          !d.tags.includes('series-by-hand') ? ['series-by-hand'] : []),
      ],
      // Changing the style, body area, intensity or series of a guess is reviewing it:
      // it becomes yours, unless you also set how sure you are yourself.
      ...(reviewedGuess(existing, d) ? { classificationConfidence: 'high', classificationSource: 'manual' } : {
        classificationConfidence: d.confidence,
        classificationSource: d.source,
      }),
      dateAdded: existing?.dateAdded,
      publishedDate: d.publishedDate,
      thumbnailUrl: existing?.thumbnailUrl && existing.youtubeVideoId === videoId ? existing.thumbnailUrl : undefined,
      extra: existing?.extra,
    }, new Date().toISOString(), preferences.defaultInstructor)
    const all = [...errs, ...(clash ? [`This video is already in your library as “${clash.title}”`] : [])]
    setErrors(all)
    if (!session || all.length) { window.scrollTo({ top: 0, behavior: 'smooth' }); return }
    // A demo record given a real link stops being a demo.
    const final: Session = videoId ? { ...session, isDemo: undefined } : session
    if (!final.isDemo) delete final.isDemo
    setSaving(true)
    try {
      await upsertSessions([final])
      toast(existing ? 'Session saved' : 'Session added', 'success')
      navigate({ name: 'session', id: final.id }, { replace: true })
    } catch (e) {
      console.error(e)
      toast('The session could not be saved.', 'danger')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={s.editor}>
      <a className={s.back} href={existing ? hrefOf({ name: 'session', id: existing.id }) : '#/settings'}><ArrowLeft size={16} /> {existing ? 'Back to session' : 'Settings'}</a>
      <header>
        <p className={s.kicker}>Library</p>
        <h1 className={s.pageTitle}>{existing ? 'Edit session' : 'Add a session'}</h1>
        <p className={s.lede}>Fill in what you know and leave the rest empty: anything empty simply isn’t shown.</p>
      </header>

      {errors.length > 0 && (
        <div className={s.demoNote} role="alert" style={{ background: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)' }}>
          {errors.map((e) => <p key={e}>{e}</p>)}
        </div>
      )}

      <section className={s.panel}>
        <div className={s.stack}>
          <Field label="YouTube link" required value={d.url} onChange={(e) => set('url', e.target.value)} placeholder="https://www.youtube.com/watch?v=…"
            error={d.url && !videoId && !existing?.isDemo ? 'Not a YouTube video link' : undefined} />
          {videoId && (
            <div className={s.urlPreview}>
              <Thumb session={{ ...(existing ?? ({} as Session)), thumbnailUrl: thumbnailUrl(videoId), durationMinutes: Number(d.duration) || 0, styles: d.styles, intensity: Number(d.intensity) } as Session} />
              <span className={s.muted}>Video id {videoId}{clash ? ` · already in library as “${clash.title}”` : ''}</span>
            </div>
          )}
          <Field label="Title" required value={d.title} onChange={(e) => set('title', e.target.value)} placeholder="As it appears on YouTube" />
          <Field label="Length" required value={d.duration} onChange={(e) => set('duration', e.target.value)} inputMode="numeric" hint="Minutes, like 28 or 28:30" />
          <Field label="Instructor" value={d.instructor} onChange={(e) => set('instructor', e.target.value)} />
          <TextAreaField label="Description" rows={4} value={d.description} onChange={(e) => set('description', e.target.value)} />
        </div>
      </section>

      <section className={s.panel}>
        <IntensityPicker value={Number(d.intensity)} onChange={(v) => set('intensity', String(v))} />
        <ChipGroup label="Style" options={STYLES} selected={d.styles} onChange={(v) => set('styles', v)} />
        <ChipGroup label="Body area" options={PHYSICAL_FOCUS} selected={d.physicalFocus} onChange={(v) => set('physicalFocus', v)} />
        <ChipGroup label="Goal" options={OBJECTIVES} selected={d.objectives} onChange={(v) => set('objectives', v)} />
        <ChipGroup label="Energy and mood" options={ENERGY} selected={d.energy} onChange={(v) => set('energy', v)} />
        <ChipGroup label="Level" options={EXPERIENCE} selected={d.experienceLevel} onChange={(v) => set('experienceLevel', v)} />
        <ChipGroup label="Time of day" options={TIME_OF_DAY} selected={d.timeOfDay} onChange={(v) => set('timeOfDay', v)} />
        <ChipGroup label="Equipment" options={EQUIPMENT} selected={d.equipment} onChange={(v) => set('equipment', v)} />
        <div className={s.stack}>
          <Field label="Series" value={d.series} onChange={(e) => set('series', e.target.value)} placeholder="e.g. MOVE" list="sf-series-names" />
          <Field label="Day in the series" type="number" inputMode="numeric" min={1} value={d.seriesDay} onChange={(e) => set('seriesDay', e.target.value)} placeholder="e.g. 8" />
          <datalist id="sf-series-names">{seriesDefs.map((x) => <option key={x.id} value={x.name} />)}</datalist>
        </div>
        <details className={s.moreDetails}>
          <summary>More details <span className={s.muted}>· posted date, tags, how sure</span></summary>
          <div className={s.stack} style={{ marginTop: 'var(--space-md)' }}>
            <Field label="Posted on YouTube" type="date" value={d.publishedDate} onChange={(e) => set('publishedDate', e.target.value)} hint="Filled in for videos read from YouTube" />
            <Field label="Tags" value={d.tags} onChange={(e) => set('tags', e.target.value)} hint="Separate with commas" />
            <SelectField label="How sure are these details?" value={d.confidence} onChange={(e) => set('confidence', e.target.value as Confidence)}>
              <option value="high">Sure: I’ve checked them</option>
              <option value="medium">Fairly sure</option>
              <option value="low">A guess: needs a look</option>
            </SelectField>
            <SelectField label="Where they came from" value={d.source} onChange={(e) => set('source', e.target.value as ClassificationSource)}>
              <option value="manual">I entered them</option>
              <option value="verified">Checked against the video</option>
              <option value="inferred">Read from the title</option>
            </SelectField>
          </div>
        </details>
      </section>

      <div className={s.row} style={{ justifyContent: 'flex-end' }}>
        <Button variant="secondary" onClick={() => window.history.back()}>Cancel</Button>
        <Button onClick={() => void save()} disabled={saving}>{existing ? 'Save changes' : 'Add to library'}</Button>
      </div>
    </div>
  )
}
