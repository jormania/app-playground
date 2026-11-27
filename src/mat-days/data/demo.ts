import type { Session } from '../domain/types'
import { searchUrl } from '../lib/youtube'

/**
 * Demonstration records, offered once on a fresh device so every screen has
 * something to show. They are deliberately NOT real videos: Mat Days never
 * invents a video id or a title it hasn't verified. Each one is marked
 * `isDemo`, titled "Demo ·", classified `inferred`/`low`, and its Start
 * Practice opens a YouTube *search* for the kind of session it stands for.
 * Delete them all from Settings → Catalogue once a real catalogue is imported.
 */

const ADDED = '2026-11-20T00:00:00.000Z'

interface DemoSpec {
  slug: string
  title: string
  query: string
  minutes: number
  styles: string[]
  intensity: number
  focus: string[]
  objectives: string[]
  energy: string[]
  level?: string[]
  time?: string[]
  equipment?: string[]
  series?: string
  tags?: string[]
}

const specs: DemoSpec[] = [
  { slug: 'morning-wake', title: 'Morning wake-up flow', query: 'morning yoga', minutes: 12, styles: ['Morning Yoga', 'Vinyasa'], intensity: 2, focus: ['Full body', 'Back'], objectives: ['Energy', 'Mobility'], energy: ['Energising'], time: ['Morning'] },
  { slug: 'core-strength', title: 'Core strength', query: 'yoga for core strength', minutes: 25, styles: ['Vinyasa', 'Power Yoga'], intensity: 4, focus: ['Core'], objectives: ['Strength', 'Stability'], energy: ['Focused', 'Energising'], level: ['Intermediate'] },
  { slug: 'hips-release', title: 'Hip release', query: 'yoga for hips', minutes: 22, styles: ['Hatha', 'Slow Flow'], intensity: 2, focus: ['Hips', 'Hip flexors', 'Lower back'], objectives: ['Flexibility', 'Mobility'], energy: ['Grounding'], equipment: ['Mat only', 'Blocks'] },
  { slug: 'lower-back', title: 'Lower back care', query: 'yoga for lower back', minutes: 16, styles: ['Gentle Yoga'], intensity: 1, focus: ['Lower back', 'Hips'], objectives: ['Recovery', 'Mobility'], energy: ['Calming', 'Restorative'] },
  { slug: 'bedtime', title: 'Bedtime wind-down', query: 'bedtime yoga', minutes: 20, styles: ['Restorative', 'Evening Yoga'], intensity: 1, focus: ['Full body', 'Neck'], objectives: ['Relaxation', 'Stress reduction'], energy: ['Calming', 'Restorative'], time: ['Before bed'], equipment: ['Mat only', 'Blanket'] },
  { slug: 'power-flow', title: 'Power flow', query: 'power yoga', minutes: 40, styles: ['Power Yoga', 'Vinyasa'], intensity: 5, focus: ['Full body', 'Arms', 'Legs'], objectives: ['Strength', 'Coordination'], energy: ['Energising'], level: ['Advanced'] },
  { slug: 'neck-shoulders', title: 'Neck and shoulders', query: 'yoga for neck and shoulders', minutes: 14, styles: ['Gentle Yoga'], intensity: 1, focus: ['Neck', 'Shoulders', 'Upper back'], objectives: ['Posture', 'Recovery'], energy: ['Calming'], time: ['Midday', 'Any time'] },
  { slug: 'balance', title: 'Balance and stability', query: 'yoga for balance', minutes: 28, styles: ['Hatha'], intensity: 3, focus: ['Legs', 'Ankles', 'Feet', 'Core'], objectives: ['Balance', 'Stability'], energy: ['Focused', 'Grounding'] },
  { slug: 'yin-hips', title: 'Yin for hips and hamstrings', query: 'yin yoga hips', minutes: 45, styles: ['Yin Yoga'], intensity: 1, focus: ['Hips', 'Hamstrings'], objectives: ['Flexibility', 'Relaxation'], energy: ['Meditative', 'Grounding'], time: ['Evening'], equipment: ['Bolster', 'Blocks', 'Blanket'] },
  { slug: 'breath', title: 'Breath practice', query: 'yoga breathing practice', minutes: 8, styles: ['Breathwork', 'Meditation'], intensity: 1, focus: ['Chest'], objectives: ['Mindfulness', 'Stress reduction'], energy: ['Calming', 'Focused'], time: ['Any time'] },
  { slug: 'nidra', title: 'Yoga nidra rest', query: 'yoga nidra', minutes: 30, styles: ['Yoga Nidra', 'Meditation'], intensity: 1, focus: ['Full body'], objectives: ['Relaxation', 'Recovery'], energy: ['Meditative', 'Restorative'], time: ['Before bed'], equipment: ['Blanket'] },
  { slug: 'full-body-60', title: 'Long full-body flow', query: 'full body yoga 60 minutes', minutes: 62, styles: ['Vinyasa', 'Hatha'], intensity: 3, focus: ['Full body'], objectives: ['Strength', 'Flexibility', 'Mobility'], energy: ['Grounding', 'Energising'], level: ['Intermediate'] },
  { slug: 'wrists', title: 'Wrist and forearm care', query: 'yoga for wrists', minutes: 9, styles: ['Gentle Yoga'], intensity: 1, focus: ['Wrists', 'Arms'], objectives: ['Mobility', 'Recovery'], energy: ['Calming'], time: ['Midday'] },
  { slug: 'glutes-legs', title: 'Strong legs and glutes', query: 'yoga for legs and glutes', minutes: 30, styles: ['Vinyasa'], intensity: 4, focus: ['Glutes', 'Quadriceps', 'Legs'], objectives: ['Strength', 'Stability'], energy: ['Energising', 'Playful'] },
  { slug: 'posture', title: 'Posture reset', query: 'yoga for posture', minutes: 18, styles: ['Hatha'], intensity: 2, focus: ['Upper back', 'Chest', 'Shoulders'], objectives: ['Posture', 'Mobility'], energy: ['Focused'] },
  { slug: 'challenge-day', title: 'Challenge day, slow flow', query: 'yoga 30 day challenge', minutes: 33, styles: ['Slow Flow', 'Vinyasa'], intensity: 3, focus: ['Full body', 'Core'], objectives: ['Mindfulness', 'Strength'], energy: ['Grounding'], series: 'Demo challenge', tags: ['challenge'] },
]

export const DEMO_SESSIONS: Session[] = specs.map((s) => ({
  id: `demo-${s.slug}`,
  title: `Demo · ${s.title}`,
  description:
    'Demonstration record, not a real video. Start Practice opens a YouTube search for this kind of session. ' +
    'Import your own catalogue and delete the demo records from Settings.',
  instructor: 'Yoga With Adriene',
  youtubeUrl: searchUrl(`Yoga With Adriene ${s.query}`),
  youtubeVideoId: '',
  durationMinutes: s.minutes,
  styles: s.styles,
  intensity: s.intensity,
  physicalFocus: s.focus,
  objectives: s.objectives,
  energy: s.energy,
  experienceLevel: s.level ?? ['All levels'],
  timeOfDay: s.time ?? ['Any time'],
  equipment: s.equipment ?? ['Mat only'],
  series: s.series,
  tags: ['demo', ...(s.tags ?? [])],
  classificationConfidence: 'low',
  classificationSource: 'inferred',
  dateAdded: ADDED,
  isDemo: true,
}))
