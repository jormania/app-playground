import type {
  Comparison, Explanation, Feedback, FeedbackTargetType, ListeningEvent, ListeningKind, Programme, ProgrammeItem,
  ProgrammeOption, Reaction, Resource, Theme, ThemeExploration, WantMore, WeekKey, WeekRecord,
} from '../domain/types'
import { creditLine, newId } from '../domain/identity'
import { listeningState, latestFeedback } from '../domain/listening'
import { DEFAULT_TIME_ZONE, weekFromKey, weekOf, type ListeningWeek } from '../domain/week'
import type { Repo } from '../store/repo'
import type {
  CompareResponse, ContinuityResponse, CuratorClient, ExplainResponse, ProgrammeResponse, ResourcesResponse, TasteResponse, ThemesResponse,
} from './api'
import { buildContext } from './context'
import { threadDigest } from './continuity'
import { Ingest, comparisonOf, ingestProgramme } from './ingest'
import { applyTasteUpdate, pendingFeedback } from './taste'

export interface JourneyOptions {
  timeZone?: string
  now?: () => Date
}

/**
 * The listening journey, as operations. Screens call these; these call the
 * curator only when something new is genuinely needed, and persist whatever
 * the curator produced so it is never asked twice for the same thing:
 *
 * - a week's three directions are generated once, the first time the week is
 *   opened, and kept;
 * - a programme is generated once, when a direction is chosen, and is then an
 *   immutable snapshot — changing direction makes a second programme and keeps
 *   the first in the record;
 * - the continuity planner runs once per exploration, after its week ends;
 * - taste interpretation runs only over feedback not yet read;
 * - resources, a deeper note, a second interpretation: once each, on request,
 *   cached.
 */
export class Journey {
  readonly timeZone: string
  private readonly now: () => Date
  private static readonly inflight = new Map<string, Promise<unknown>>()

  constructor(readonly repo: Repo, readonly curator: CuratorClient, opts: JourneyOptions = {}) {
    this.timeZone = opts.timeZone ?? DEFAULT_TIME_ZONE
    this.now = opts.now ?? (() => new Date())
  }

  private stamp(): string {
    return this.now().toISOString()
  }

  currentWeek(): ListeningWeek {
    return weekOf(this.now(), this.timeZone)
  }

  /** One call per key at a time: React's double effects and a quick second tap don't double the bill. */
  private once<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const running = Journey.inflight.get(key) as Promise<T> | undefined
    if (running) return running
    const p = fn().finally(() => Journey.inflight.delete(key))
    Journey.inflight.set(key, p)
    return p
  }

  // ── the week ──────────────────────────────────────────────────────────

  /**
   * This week's record — generating the three directions if the week is new.
   * Before generating, the previous weeks are closed (continuity) and any
   * unread feedback is read (taste), so the new options see both. Either of
   * those failing never blocks the week: they are retried next time.
   */
  ensureWeek(requestedNext?: string): Promise<WeekRecord> {
    const week = this.currentWeek()
    return this.once(`week:${week.key}`, async () => {
      const existing = await this.repo.weeks.get(week.key)
      if (existing) return existing
      await this.repo.ensureMeta(this.stamp())
      await this.closeEndedExplorations().catch(() => {})
      await this.interpretPendingFeedback().catch(() => {})
      return this.generateWeek(week, requestedNext)
    })
  }

  private async generateWeek(week: ListeningWeek, requestedNext?: string): Promise<WeekRecord> {
    const context = await buildContext(this.repo, week, requestedNext)
    const res = await this.curator.call<ThemesResponse>('themes', {
      today: this.now().toISOString().slice(0, 10),
      week: { key: week.key, label: week.label },
      context,
    })
    const options: ProgrammeOption[] = res.options.map((o, i) => ({
      id: newId('opt'),
      weekKey: week.key,
      position: (i + 1) as 1 | 2 | 3,
      mood: o.mood,
      title: o.title,
      pitch: o.pitch,
      character: o.character,
      why: o.why,
      angle: o.angle,
      returning: o.returning,
      status: 'offered',
    }))
    const record: WeekRecord = {
      weekKey: week.key,
      startsOn: week.startsOn,
      endsOn: week.endsOn,
      createdAt: this.stamp(),
      optionIds: options.map((o) => o.id),
      setAsideProgrammeIds: [],
      promptVersion: res.promptVersion,
    }
    await this.repo.options.putMany(options)
    await this.repo.weeks.put(record)
    return record
  }

  /** Choose one of this week's three directions. */
  choose(optionId: string): Promise<Programme> {
    return this.once(`choose:${optionId}`, async () => {
      const week = await this.repo.weeks.require(this.currentWeek().key)
      if (week.programmeId) throw new Error('This week already has a programme — change direction instead.')
      const option = await this.repo.options.require(optionId)
      return this.startProgramme(week, option)
    })
  }

  /**
   * Choose a different direction this week. The programme already made is
   * kept as it was — set aside, not deleted — and only what was actually heard
   * of it counts towards its thread.
   */
  changeDirection(optionId: string): Promise<Programme> {
    return this.once(`choose:${optionId}`, async () => {
      const week = await this.repo.weeks.require(this.currentWeek().key)
      const option = await this.repo.options.require(optionId)
      return this.startProgramme(week, option)
    })
  }

  /** Take a path offered in an earlier week and not chosen then. */
  takeOpenPath(optionId: string): Promise<Programme> {
    return this.changeDirection(optionId)
  }

  private async startProgramme(week: WeekRecord, option: ProgrammeOption): Promise<Programme> {
    const now = this.stamp()
    const lw = weekFromKey(week.weekKey)

    const returningTheme = option.returning ? await this.repo.themes.get(option.returning.themeId) : undefined
    const theme: Theme = returningTheme ?? {
      id: newId('theme'),
      title: option.title,
      summary: option.pitch,
      firstIntroduced: week.weekKey,
      explorationIds: [],
      openQuestions: [],
      adjacentTopics: [],
      nextDirections: [],
      updatedAt: now,
    }
    const digest = returningTheme ? await threadDigest(this.repo, returningTheme.id, week.weekKey) : null
    const stage = digest?.nextStage ?? 1
    const context = await buildContext(this.repo, lw)

    const res = await this.curator.call<ProgrammeResponse>('programme', {
      today: now.slice(0, 10),
      week: { key: lw.key, label: lw.label },
      option: { title: option.title, pitch: option.pitch, angle: option.angle, mood: option.mood, character: option.character, why: option.why, continuityNote: option.returning?.note },
      thread: digest ? { ...digest, stage } : null,
      taste: context.taste,
      questions: context.questions,
      listenerNotes: context.listenerNotes,
      recentListening: context.recentListening,
    })

    // Nothing is written until the curator has answered: a failed call leaves
    // the week exactly as it was.
    const explorationId = newId('exp')
    const { programme, comparisons } = await ingestProgramme(this.repo, {
      weekKey: week.weekKey,
      optionId: option.id,
      themeId: theme.id,
      explorationId,
      stage,
      curated: res.programme,
      promptVersion: res.promptVersion,
      model: res.model,
      now,
    })
    const exploration: ThemeExploration = { id: explorationId, themeId: theme.id, weekKey: week.weekKey, stage, angle: option.angle, programmeId: programme.id }

    // Set aside the programme being replaced, if any.
    if (week.programmeId) {
      const previous = await this.repo.programmes.get(week.programmeId)
      if (previous) {
        const ex = await this.repo.explorations.get(previous.explorationId)
        if (ex) await this.repo.explorations.put({ ...ex, setAside: true })
        const prevOption = await this.repo.options.get(previous.optionId)
        if (prevOption) await this.repo.options.put({ ...prevOption, status: 'set-aside' })
      }
      week.setAsideProgrammeIds = [...week.setAsideProgrammeIds, week.programmeId]
    }

    await this.repo.comparisons.putMany(comparisons)
    await this.repo.addProgramme(programme)
    await this.repo.explorations.put(exploration)
    await this.repo.themes.put({ ...theme, explorationIds: [...theme.explorationIds, explorationId], updatedAt: now })

    const fromThisWeek = option.weekKey === week.weekKey
    await this.repo.options.put({ ...option, status: fromThisWeek ? 'chosen' : 'taken-later', takenInWeek: fromThisWeek ? undefined : week.weekKey })
    for (const id of week.optionIds) {
      if (id === option.id) continue
      const o = await this.repo.options.get(id)
      if (o && o.status === 'offered') await this.repo.options.put({ ...o, status: 'open' })
    }
    await this.repo.weeks.put({ ...week, chosenOptionId: option.id, chosenAt: now, programmeId: programme.id })
    return programme
  }

  // ── continuity ────────────────────────────────────────────────────────

  /** Close every exploration whose week has ended, so its thread knows how it landed. */
  async closeEndedExplorations(): Promise<number> {
    const current = this.currentWeek().key
    const open = (await this.repo.explorations.all()).filter((e) => e.weekKey < current && !e.closedAt && !e.setAside)
    let closed = 0
    for (const ex of open) {
      await this.once(`close:${ex.id}`, () => this.closeExploration(ex, current))
      closed++
    }
    return closed
  }

  private async closeExploration(ex: ThemeExploration, current: WeekKey): Promise<void> {
    const theme = await this.repo.themes.require(ex.themeId)
    const programme = await this.repo.programmes.require(ex.programmeId)
    const digest = await threadDigest(this.repo, theme.id, current)
    const events = await this.repo.events.all()
    const feedback = await this.repo.feedback.all()
    const res = await this.curator.call<ContinuityResponse>('continuity', {
      thread: digest,
      exploration: { weekKey: ex.weekKey, stage: ex.stage, angle: ex.angle },
      programme: {
        title: programme.title,
        items: programme.sections.flatMap((s) => s.items).map((i) => ({
          composer: i.proposed.composer,
          work: i.proposed.work,
          recording: creditLine(i.proposed),
          state: listeningState(events, i.recordingId),
          ...latestFeedback(feedback, i.recordingId),
        })),
        programmeFeedback: latestFeedback(feedback, programme.id),
      },
    })
    const now = this.stamp()
    await this.repo.themes.put({
      ...theme,
      reaction: res.reaction || theme.reaction,
      openQuestions: res.openQuestions,
      adjacentTopics: res.adjacentTopics,
      nextDirections: res.nextDirections,
      updatedAt: now,
    })
    await this.repo.explorations.put({ ...ex, closedAt: now, closingNote: res.closingNote })
  }

  // ── taste ─────────────────────────────────────────────────────────────

  /** Read any feedback not yet read into the taste profile. Cheap; safe to call often. */
  interpretPendingFeedback(): Promise<number> {
    return this.once('taste', async () => {
      const all = await this.repo.feedback.all()
      const pending = pendingFeedback(all)
      if (pending.length === 0) return 0
      const profile = await this.repo.taste()
      const describe = await this.describer()
      const res = await this.curator.call<TasteResponse>('taste', {
        profile: {
          observations: profile.observations.filter((o) => !o.supersededBy).map(({ id, facet, subject, statement, stance, confidence }) => ({ id, facet, subject, statement, stance, confidence })),
          questions: profile.questions,
        },
        listenerNotes: profile.notesToCurator,
        feedback: pending.map((f) => ({ id: f.id, at: f.at, about: describe(f.target.type, f.target.id), reaction: f.reaction, more: f.more, note: f.note })),
      })
      const now = this.stamp()
      await this.repo.saveTaste(applyTasteUpdate(profile, res, now))
      await this.repo.feedback.putMany(pending.map((f) => ({ ...f, interpretedAt: now })))
      return pending.length
    })
  }

  /** Words for what a piece of feedback is about, for the taste reader. */
  private async describer(): Promise<(type: FeedbackTargetType, id: string) => string> {
    const programmes = await this.repo.programmes.all()
    const themes = new Map((await this.repo.themes.all()).map((t) => [t.id, t.title]))
    const items = programmes.flatMap((p) => p.sections.flatMap((s) => s.items))
    const comparisons = await this.repo.comparisons.all()
    const perspectives = comparisons.flatMap((c) => c.perspectives)
    return (type, id) => {
      if (type === 'theme') return `the theme "${themes.get(id) ?? id}"`
      if (type === 'programme') return `the programme "${programmes.find((p) => p.id === id)?.title ?? id}"`
      if (type === 'work') {
        const i = items.find((x) => x.workId === id)
        return i ? `the work ${i.proposed.composer} — ${i.proposed.work}` : id
      }
      const i = items.find((x) => x.recordingId === id)
      const p = i?.proposed ?? perspectives.find((x) => x.recordingId === id)?.proposed
      if (!p) return id
      const what = `${p.composer} — ${p.work}, ${creditLine(p)}`
      return type === 'interpretation' ? `the interpretation in ${what}` : `the recording ${what}`
    }
  }

  // ── listening and feedback ────────────────────────────────────────────

  async markListening(item: Pick<ProgrammeItem, 'recordingId' | 'workId'>, kind: ListeningKind, programmeId?: string, source: ListeningEvent['source'] = 'manual'): Promise<ListeningEvent> {
    const e: ListeningEvent = { id: newId('ev'), at: this.stamp(), kind, recordingId: item.recordingId, workId: item.workId, programmeId, source }
    await this.repo.events.put(e)
    return e
  }

  async giveFeedback(input: { target: { type: FeedbackTargetType; id: string }; programmeId?: string; reaction?: Reaction; more?: WantMore; note?: string }): Promise<Feedback> {
    const note = input.note?.trim() || undefined
    const f: Feedback = {
      id: newId('fb'),
      at: this.stamp(),
      target: input.target,
      programmeId: input.programmeId,
      ...(input.reaction ? { reaction: input.reaction } : {}),
      ...(input.more ? { more: input.more } : {}),
      ...(note ? { note } : {}),
    }
    await this.repo.feedback.put(f)
    return f
  }

  // ── on-request curation, cached ───────────────────────────────────────

  resources(programmeId: string, opts: { again?: boolean } = {}): Promise<Resource[]> {
    return this.once(`resources:${programmeId}`, async () => {
      const mine = (await this.repo.resources.all()).filter((r) => r.programmeId === programmeId)
      const searched = await this.repo.marks.get(`resources:${programmeId}`)
      if ((mine.length || searched) && !opts.again) return mine
      const p = await this.repo.programmes.require(programmeId)
      const theme = await this.repo.themes.get(p.themeId)
      const res = await this.curator.call<ResourcesResponse>('resources', {
        programme: {
          title: p.title,
          dek: p.dek,
          theme: theme?.title,
          works: p.sections.flatMap((s) => s.items).map((i) => ({ composer: i.proposed.composer, title: i.proposed.work })),
        },
      })
      const now = this.stamp()
      const known = new Set(mine.map((r) => r.url))
      const fresh: Resource[] = res.resources
        .filter((r) => !known.has(r.url))
        .map((r) => ({ id: newId('res'), programmeId, foundAt: now, ...r }))
      await this.repo.resources.putMany(fresh)
      await this.repo.marks.put({ id: `resources:${programmeId}`, at: now })
      return [...mine, ...fresh]
    })
  }

  explain(programmeId: string, itemId: string, question?: string): Promise<Explanation> {
    const q = question?.trim()
    const id = `${programmeId}:${itemId}${q ? `:${newId('q')}` : ''}`
    return this.once(`explain:${programmeId}:${itemId}:${q ?? ''}`, async () => {
      if (!q) {
        const cached = await this.repo.explanations.get(id)
        if (cached) return cached
      }
      const p = await this.repo.programmes.require(programmeId)
      const item = p.sections.flatMap((s) => s.items).find((i) => i.id === itemId)
      if (!item) throw new Error('No such item.')
      const profile = await this.repo.taste()
      const res = await this.curator.call<ExplainResponse>('explain', {
        programme: { title: p.title, dek: p.dek },
        item: { composer: item.proposed.composer, workTitle: item.proposed.work, catalogue: item.proposed.catalogue, recording: creditLine(item.proposed) },
        question: q,
        taste: profile.observations.filter((o) => !o.supersededBy).map((o) => o.statement).slice(0, 12),
      })
      const e: Explanation = { id, heading: res.heading, body: res.body, createdAt: this.stamp(), promptVersion: res.promptVersion }
      await this.repo.explanations.put(e)
      return e
    })
  }

  /** A second interpretation of an item's work, set beside the one in the programme. */
  compare(programmeId: string, itemId: string): Promise<Comparison> {
    const id = `cmp:${programmeId}:${itemId}`
    return this.once(id, async () => {
      const cached = await this.repo.comparisons.get(id)
      if (cached) return cached
      const p = await this.repo.programmes.require(programmeId)
      const item = p.sections.flatMap((s) => s.items).find((i) => i.id === itemId)
      if (!item) throw new Error('No such item.')
      const recordingsOfWork = (await this.repo.recordings.all()).filter((r) => r.workId === item.workId && r.id !== item.recordingId)
      const allProposed = [
        ...(await this.repo.programmes.all()).flatMap((x) => x.sections.flatMap((s) => s.items)).map((i) => ({ rid: i.recordingId, p: i.proposed })),
        ...(await this.repo.comparisons.all()).flatMap((c) => c.perspectives.map((x) => ({ rid: x.recordingId, p: x.proposed }))),
      ]
      const alreadyHeard = recordingsOfWork
        .map((r) => allProposed.find((x) => x.rid === r.id)?.p)
        .filter((x): x is NonNullable<typeof x> => Boolean(x))
      const profile = await this.repo.taste()
      const res = await this.curator.call<CompareResponse>('compare', {
        work: { composer: item.proposed.composer, title: item.proposed.work, catalogue: item.proposed.catalogue },
        current: { ...item.proposed, soloists: item.proposed.soloists },
        alreadyHeard,
        taste: profile.observations.filter((o) => !o.supersededBy && (o.facet === 'interpretation' || o.facet === 'conductor' || o.facet === 'recording-era')).map((o) => o.statement),
      })
      const ingest = await new Ingest(this.repo).load()
      const cmp = await comparisonOf(ingest, {
        composer: item.proposed.composer,
        workTitle: item.proposed.work,
        catalogue: item.proposed.catalogue,
        framing: res.framing,
        whyBoth: res.whyBoth,
        perspectives: [
          { ...item.proposed, character: res.current.character, listenFor: res.current.listenFor },
          { ...res.other },
        ],
      }, 'on-request', this.stamp())
      await ingest.commit()
      const stored = { ...cmp, id }
      await this.repo.comparisons.put(stored)
      return stored
    })
  }
}
