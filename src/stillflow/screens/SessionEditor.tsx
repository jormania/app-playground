import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Button, Field, SegmentedControl, TextAreaField } from '../../ds'
import { SelectField } from '../../ds/components/SelectField'
import { hrefOf, navigate } from '../app/router'
import { useStillflow } from '../app/state'
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
  const { byId, sessions, preferences, upsertSessions, toast, ready, seriesDefs } = useStillflow()
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
      classificationConfidence: d.confidence,
      classificationSource: d.source,
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
        <p className={s.kicker}>Catalogue</p>
        <h1 className={s.pageTitle}>{existing ? 'Edit session' : 'Add a session'}</h1>
        <p className={s.lede}>Fill in what you know and leave the rest empty. Empty fields show as “not set” rather than a guess.</p>
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
          <div className={s.twoCol}>
            <Field label="Length (minutes, or mm:ss)" required value={d.duration} onChange={(e) => set('duration', e.target.value)} inputMode="numeric" />
            <Field label="Instructor" value={d.instructor} onChange={(e) => set('instructor', e.target.value)} />
          </div>
          <TextAreaField label="Description" rows={4} value={d.description} onChange={(e) => set('description', e.target.value)} />
        </div>
      </section>

      <section className={s.panel}>
        <SegmentedControl label="Intensity" value={d.intensity} onChange={(v) => set('intensity', v)} wrap
          options={[{ value: '0', label: 'Not sure' }, ...INTENSITY_LABELS.map((l, i) => ({ value: String(i + 1), label: l }))]} />
        <div style={{ height: 'var(--space-lg)' }} />
        <ChipGroup label="Style" options={STYLES} selected={d.styles} onChange={(v) => set('styles', v)} />
        <ChipGroup label="Body area" options={PHYSICAL_FOCUS} selected={d.physicalFocus} onChange={(v) => set('physicalFocus', v)} />
        <ChipGroup label="Goal" options={OBJECTIVES} selected={d.objectives} onChange={(v) => set('objectives', v)} />
        <ChipGroup label="Energy and mood" options={ENERGY} selected={d.energy} onChange={(v) => set('energy', v)} />
        <ChipGroup label="Level" options={EXPERIENCE} selected={d.experienceLevel} onChange={(v) => set('experienceLevel', v)} />
        <ChipGroup label="Time of day" options={TIME_OF_DAY} selected={d.timeOfDay} onChange={(v) => set('timeOfDay', v)} />
        <ChipGroup label="Equipment" options={EQUIPMENT} selected={d.equipment} onChange={(v) => set('equipment', v)} />
        <div className={s.stack}>
          <div className={s.twoCol}>
            <Field label="Series or programme" value={d.series} onChange={(e) => set('series', e.target.value)} placeholder="e.g. MOVE" list="sf-series-names" />
            <Field label="Day in the series" type="number" inputMode="numeric" min={1} value={d.seriesDay} onChange={(e) => set('seriesDay', e.target.value)} hint="Puts it on that day of the series" />
          </div>
          <datalist id="sf-series-names">{seriesDefs.map((x) => <option key={x.id} value={x.name} />)}</datalist>
          <Field label="Posted on YouTube" type="date" value={d.publishedDate} onChange={(e) => set('publishedDate', e.target.value)} hint="Filled in automatically for videos read from the channel" />
          <Field label="Tags" value={d.tags} onChange={(e) => set('tags', e.target.value)} hint="Separate with commas" />
          <div className={s.twoCol}>
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
        </div>
      </section>

      <div className={s.row} style={{ justifyContent: 'flex-end' }}>
        <Button variant="secondary" onClick={() => window.history.back()}>Cancel</Button>
        <Button onClick={() => void save()} disabled={saving}>{existing ? 'Save changes' : 'Add to library'}</Button>
      </div>
    </div>
  )
}
