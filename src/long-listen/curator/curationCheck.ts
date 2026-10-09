import { directCurator, type Send } from './curator'
import { DEFAULT_PREFERENCES, type ListenerPreferences } from '../domain/types'
import type { ProgrammeResponse, ThemesResponse } from '../curation/api'

/**
 * The curation check (roadmap item 6): a handful of listener profiles run
 * through the real prompts, on demand, before and after a prompt change — so a
 * change is judged in an afternoon, not by living with it for a week.
 *
 * For each profile: the week's three directions, then the programme for the
 * first of them. The report gives the checks' verdicts (how many attempts each
 * job took — a second means the first answer broke a rule — and the
 * programme's shape against the profile's preferences) and enough of the
 * writing to read: titles, pitches, the standfirst and opening, a few reasons.
 *
 * Runs with the owner's key, never in CI: `ANTHROPIC_API_KEY=… npm run
 * check:curation` (curator/curation.check.ts). A run is two Sonnet calls a
 * profile, three or four with retries.
 */
export interface Profile {
  name: string
  why: string
  preferences: Partial<ListenerPreferences>
  /** Extra context the directions see: a thread to return to, taste, a wish. */
  context?: Record<string, unknown>
}

export const PROFILES: Profile[] = [
  {
    name: 'Narrow and familiar',
    why: 'One focus, cornerstones: does it stay close without becoming a list of one composer’s hits?',
    preferences: { breadth: 1, familiarity: 1, timePerWeek: 'standard' },
  },
  {
    name: 'Broad and obscure',
    why: 'Centuries and rarities: does it travel and stay coherent, with real recordings?',
    preferences: { breadth: 5, familiarity: 5, timePerWeek: 'generous', pairs: true },
  },
  {
    name: 'A returning theme',
    why: 'A thread heard six weeks ago: does a return expand it, never restart it?',
    preferences: { breadth: 3, familiarity: 3 },
    context: {
      threads: [{
        themeId: 'theme_nordic', title: 'Northern Light: Sibelius and His Neighbours', firstIntroduced: '2026-W41', stage: 1, nextStage: 2,
        reaction: 'Strong response to Sibelius 5 and Tapiola; Nielsen 4 felt like too much struggle.',
        covered: { works: [{ composer: 'Jean Sibelius', title: 'Symphony No. 5' }, { composer: 'Jean Sibelius', title: 'Tapiola' }, { composer: 'Carl Nielsen', title: 'Symphony No. 4' }] },
        openQuestions: ['What did the next generation of Nordic composers do with Sibelius’s long lines?'],
        nextDirections: ['Nordic symphonists after Sibelius — Rautavaara, Nørgård, Aho'],
      }],
    },
  },
  {
    name: 'Romanian',
    why: 'Writing in Romanian with diacritics, titles in concert form.',
    preferences: { language: 'ro', breadth: 3, familiarity: 2 },
  },
]

export interface ProfileResult {
  profile: Profile
  themes?: ThemesResponse
  programme?: ProgrammeResponse
  attempts: Record<string, number>
  error?: string
}

/** Run every profile through the real prompts with `send`. */
export async function runCurationCheck(send: Send, profiles: Profile[] = PROFILES, today = new Date().toISOString().slice(0, 10)): Promise<ProfileResult[]> {
  const out: ProfileResult[] = []
  for (const profile of profiles) {
    const attempts: Record<string, number> = {}
    const counted: Send = async (body) => {
      const system = JSON.stringify(body.system ?? '')
      const op = /build this week's listening programme/.test(system) ? 'programme' : /propose this week's three possible directions/.test(system) ? 'themes' : 'other'
      attempts[op] = (attempts[op] ?? 0) + 1
      return send(body)
    }
    const curator = directCurator(() => '', { send: counted })
    const preferences = { ...DEFAULT_PREFERENCES, ...profile.preferences }
    const { nextRequest: _n, ...prefs } = preferences
    const result: ProfileResult = { profile, attempts }
    try {
      result.themes = await curator.call<ThemesResponse>('themes', {
        today,
        week: { key: '2026-W48', label: '23–29 November 2026' },
        context: { preferences: prefs, listenerNotes: '', taste: [], questions: [], threads: [], openPaths: [], recentWeeks: [], recentListening: [], alreadyProgrammed: [], alreadyKnown: [], secondHearings: [], ...profile.context },
        alsoOfferedThisWeek: [],
      })
      const o = result.themes.options[0]
      const thread = o.returning ? (profile.context?.threads as { themeId: string }[] | undefined)?.find((t) => t.themeId === o.returning!.themeId) : undefined
      result.programme = await curator.call<ProgrammeResponse>('programme', {
        today,
        week: { key: '2026-W48', label: '23–29 November 2026' },
        option: { title: o.title, pitch: o.pitch, angle: o.angle, mood: o.mood, character: o.character, why: o.why, continuityNote: o.returning?.note, form: o.form },
        thread: thread ?? null,
        preferences: prefs,
        alreadyProgrammed: [], alreadyKnown: [], taste: [], questions: [], listenerNotes: '', recentListening: [],
      })
    } catch (e) {
      result.error = e instanceof Error ? e.message : String(e)
    }
    out.push(result)
  }
  return out
}

const centuryOf = (composed?: string) => {
  const y = Number(/\b(1[0-9]{3}|20[0-9]{2})\b/.exec(composed ?? '')?.[1])
  return y ? Math.floor(y / 100) + 1 : undefined
}

/** The report, as Markdown: verdicts first, then the writing to read. */
export function curationReport(results: ProfileResult[], versions: Record<string, string>): string {
  const lines = ['# The Long Listen — curation check', '', `Prompts: ${Object.values(versions).join(' · ')}`, '']
  for (const r of results) {
    lines.push(`## ${r.profile.name}`, '', `_${r.profile.why}_`, '')
    if (r.error) { lines.push(`**Failed:** ${r.error}`, ''); continue }
    lines.push(`- Attempts: directions ${r.attempts.themes ?? 0}, programme ${r.attempts.programme ?? 0}${(r.attempts.themes ?? 0) > 1 || (r.attempts.programme ?? 0) > 1 ? ' — a retry means the first answer broke a rule' : ''}`)
    if (r.themes) {
      lines.push(`- Directions: ${r.themes.options.map((o) => `${o.mood}${o.form ? ` (${o.form})` : ''}${o.returning ? ', returning' : ''}`).join(' · ')}`)
    }
    const p = r.programme?.programme
    if (p) {
      const items = p.sections.flatMap((s) => s.items)
      const byComposer = new Map<string, number>()
      for (const i of items) byComposer.set(i.composer, (byComposer.get(i.composer) ?? 0) + 1)
      const centuries = [...new Set(items.map((i) => centuryOf(i.composed)).filter(Boolean))].sort()
      const unperformed = items.filter((i) => !i.conductor && !i.orchestra && !i.ensemble && !i.soloists.length).length
      lines.push(
        `- Programme: ${items.length} works in ${p.sections.length} sections (${p.sections.map((s) => s.heading).join(' · ')}); ${byComposer.size} composers, at most ${Math.max(...byComposer.values())} by one; centuries ${centuries.join(', ') || 'unknown'}; ${p.comparisons.length} pair(s)`,
        `- Every item names its performers: ${unperformed ? `no — ${unperformed} without` : 'yes'}${r.programme!.removedRepeats ? `; ${r.programme!.removedRepeats} unjustified repeat(s) removed` : ''}`,
        '',
        '### The writing',
        '',
      )
      for (const o of r.themes?.options ?? []) lines.push(`- **${o.title}** — ${o.pitch}`)
      lines.push('', `**${p.title}** — ${p.dek}`, '', p.introduction.split(/\n\s*\n/)[0], '')
      if (p.continuityNote) lines.push(`> ${p.continuityNote}`, '')
      for (const i of items.slice(0, 3)) lines.push(`- ${i.composer}, ${i.workTitle} — ${i.why}`)
      lines.push('')
    }
  }
  return lines.join('\n')
}
