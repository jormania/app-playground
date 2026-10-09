import type {
  Comparison, Explanation, Feedback, FeedbackTargetType, ListeningEvent, ListeningKind, Programme, ProgrammeItem,
  ProgrammeOption, Reaction, Resource, Theme, ThemeExploration, WantMore, WeekKey, WeekMood, WeekRecord,
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
import type { SpotifyCandidate } from '../spotify/verify'

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
      // Independent of each other, so side by side: the week waits for the slower one, not the sum.
      await Promise.all([
        this.closeEndedExplorations().catch(() => {}),
        this.interpretPendingFeedback().catch(() => {}),
      ])
      return this.generateWeek(week, requestedNext)
    })
  }

  /**
   * Three directions. `requestedNext` undefined means "the start of a week":
   * the listener's wish for next week is read, and cleared once it reached
   * the curator. Any string — even '' — is a request made now, and the wish
   * for next week is left for next week.
   */
  private async generateWeek(week: ListeningWeek, requestedNext?: string, alsoOfferedThisWeek: string[] = []): Promise<WeekRecord> {
    const context = await buildContext(this.repo, week, requestedNext)
    const res = await this.curator.call<ThemesResponse>('themes', {
      today: this.now().toISOString().slice(0, 10),
      week: { key: week.key, label: week.label },
      context,
      alsoOfferedThisWeek,
    })
    // A wish for next week is read once, at the start of a week. Clear it only after it reached the curator.
    const prefs = await this.repo.preferences()
    if (requestedNext === undefined && prefs.nextRequest) await this.repo.savePreferences({ ...prefs, nextRequest: '' })
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

  /** "This week, differently": set this week's mood. Read by every curator job about the week from now on. */
  async setWeekMood(mood: WeekMood[]): Promise<WeekRecord> {
    const week = await this.repo.weeks.require(this.currentWeek().key)
    const record: WeekRecord = { ...week, mood: mood.length ? mood : undefined }
    await this.repo.weeks.put(record)
    return record
  }

  /**
   * None of the three appeal: ask for three others, optionally saying what
   * you're in the mood for. Only before choosing — afterwards it's "change
   * direction". The three set aside stay as open paths, not rejections.
   */
  offerOtherDirections(request?: string): Promise<WeekRecord> {
    const lw = this.currentWeek()
    return this.once(`week:${lw.key}:again`, async () => {
      const week = await this.repo.weeks.require(lw.key)
      if (week.programmeId) throw new Error('This week already has a programme — change direction instead.')
      const current = await this.repo.options.many(week.optionIds)
      await this.repo.options.putMany(current.map((o) => ({ ...o, status: 'open' as const })))
      const fresh = await this.generateWeek(lw, request ?? '', current.map((o) => o.title))
      const record: WeekRecord = { ...fresh, createdAt: week.createdAt, mood: week.mood, earlierOptionIds: [...(week.earlierOptionIds ?? []), ...week.optionIds] }
      await this.repo.weeks.put(record)
      return record
    })
  }

  /**
   * Three new directions after a week's programme has been chosen — for a
   * listener who has run out of music and wants to go somewhere else. The
   * programme they have stays the week's programme until they take one of
   * the new directions (which sets it aside, as a change of direction does).
   * Directions offered before stay as open paths.
   */
  moreDirections(request?: string): Promise<WeekRecord> {
    const lw = this.currentWeek()
    return this.once(`week:${lw.key}:more`, async () => {
      const week = await this.repo.weeks.require(lw.key)
      const current = await this.repo.options.many(week.optionIds)
      await this.repo.options.putMany(current.filter((o) => o.status === 'offered').map((o) => ({ ...o, status: 'open' as const })))
      const seen = (await this.repo.options.many([...(week.earlierOptionIds ?? []), ...week.optionIds])).map((o) => o.title)
      const fresh = await this.generateWeek(lw, request ?? '', seen)
      const record: WeekRecord = {
        ...week,
        optionIds: fresh.optionIds,
        earlierOptionIds: [...(week.earlierOptionIds ?? []), ...week.optionIds],
        promptVersion: fresh.promptVersion,
      }
      await this.repo.weeks.put(record)
      return record
    })
  }

  /**
   * "More of this theme": the listener has heard the week's programme and
   * wants more on the same thread. A companion programme, its own snapshot,
   * continuing the same exploration — the curator is told everything the
   * thread has covered, this week included, so nothing comes back. It counts
   * towards the thread like the week's programme does.
   */
  extendProgramme(programmeId: string, wish?: string): Promise<Programme> {
    return this.once(`extend:${programmeId}`, async () => {
      const base = await this.repo.programmes.require(programmeId)
      const root = base.extends ? await this.repo.programmes.require(base.extends) : base
      const option = await this.repo.options.require(root.optionId)
      const exploration = await this.repo.explorations.require(root.explorationId)
      const lw = weekFromKey(root.weekKey)
      const digest = await threadDigest(this.repo, root.themeId, root.weekKey)
      const context = await buildContext(this.repo, lw)
      const now = this.stamp()
      const res = await this.curator.call<ProgrammeResponse>('programme', {
        today: now.slice(0, 10),
        week: { key: lw.key, label: lw.label },
        option: { title: option.title, pitch: option.pitch, angle: option.angle, mood: option.mood, character: option.character, why: option.why },
        extension: { of: root.title, dek: root.dek, wish: wish?.trim() || undefined },
        thread: { ...digest, stage: exploration.stage },
        preferences: context.preferences,
        alreadyProgrammed: context.alreadyProgrammed,
        alreadyKnown: context.alreadyKnown,
        taste: context.taste,
        questions: context.questions,
        listenerNotes: context.listenerNotes,
        recentListening: context.recentListening,
        thisWeek: context.thisWeek,
      })
      const { programme, comparisons } = await ingestProgramme(this.repo, {
        weekKey: root.weekKey,
        optionId: root.optionId,
        themeId: root.themeId,
        explorationId: root.explorationId,
        stage: exploration.stage,
        extendsId: root.id,
        curated: res.programme,
        promptVersion: res.promptVersion,
        model: res.model,
        now,
      })
      await this.repo.comparisons.putMany(comparisons)
      await this.repo.addProgramme(programme)
      await this.repo.explorations.put({ ...exploration, extraProgrammeIds: [...(exploration.extraProgrammeIds ?? []), programme.id] })
      return programme
    })
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
      preferences: context.preferences,
      alreadyProgrammed: context.alreadyProgrammed,
      alreadyKnown: context.alreadyKnown,
      taste: context.taste,
      questions: context.questions,
      listenerNotes: context.listenerNotes,
      recentListening: context.recentListening,
      thisWeek: context.thisWeek,
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
    // Each thread is closed on its own; one failing doesn't stop the others, and is retried next time.
    const results = await Promise.allSettled(open.map((ex) => this.once(`close:${ex.id}`, () => this.closeExploration(ex, current))))
    return results.filter((r) => r.status === 'fulfilled').length
  }

  private async closeExploration(ex: ThemeExploration, current: WeekKey): Promise<void> {
    const theme = await this.repo.themes.require(ex.themeId)
    const programme = await this.repo.programmes.require(ex.programmeId)
    const digest = await threadDigest(this.repo, theme.id, current)
    const events = await this.repo.events.all()
    const feedback = await this.repo.feedback.all()
    const { language } = await this.repo.preferences()
    const res = await this.curator.call<ContinuityResponse>('continuity', {
      language,
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

  private tasteTimer: ReturnType<typeof setTimeout> | undefined

  /**
   * Feedback is read into taste in batches, not per save: each reading resends
   * the taste profile, so five saves in a sitting were five requests. This waits
   * until no feedback has been given for `quietMs` (default three minutes), then
   * reads everything pending in one request. Feedback left when the page closes
   * is read on the next open (services), at the start of a week (ensureWeek),
   * or at once from the Notebook.
   */
  scheduleTasteReading(onDone?: () => void, quietMs = 180_000): void {
    clearTimeout(this.tasteTimer)
    this.tasteTimer = setTimeout(() => {
      this.tasteTimer = undefined
      this.interpretPendingFeedback().then((n) => { if (n) onDone?.() }).catch(() => {})
    }, quietMs)
  }

  /** Read any feedback not yet read into the taste profile, in one request. */
  interpretPendingFeedback(): Promise<number> {
    return this.once('taste', async () => {
      const all = await this.repo.feedback.all()
      const pending = pendingFeedback(all)
      if (pending.length === 0) return 0
      const profile = await this.repo.taste()
      const describe = await this.describer()
      const { language } = await this.repo.preferences()
      const res = await this.curator.call<TasteResponse>('taste', {
        language,
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

  /**
   * "I knew this already" on a work — or taking it back. Familiarity, not a
   * reaction: it doesn't touch the listening state or the taste profile; it
   * tells the curator what isn't a discovery for this listener.
   */
  async markKnown(workId: string, known: boolean, programmeId?: string): Promise<Feedback> {
    const f: Feedback = { id: newId('fb'), at: this.stamp(), target: { type: 'work', id: workId }, programmeId, known }
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
      const { language } = await this.repo.preferences()
      const res = await this.curator.call<ResourcesResponse>('resources', {
        language,
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
      const { nextRequest: _n, ...preferences } = await this.repo.preferences()
      const res = await this.curator.call<ExplainResponse>('explain', {
        preferences,
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
  compare(programmeId: string, itemId: string, opts: { mustBeOnSpotify?: boolean; spotifyCandidates?: SpotifyCandidate[] } = {}): Promise<Comparison> {
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
      const { nextRequest: _n, ...preferences } = await this.repo.preferences()
      const res = await this.curator.call<CompareResponse>('compare', {
        preferences,
        mustBeOnSpotify: Boolean(opts.mustBeOnSpotify),
        spotifyCandidates: opts.spotifyCandidates?.length ? opts.spotifyCandidates : undefined,
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
      const stored: Comparison = { ...cmp, id, ...(opts.mustBeOnSpotify ? { standIn: true } : {}) }
      await this.repo.comparisons.put(stored)
      return stored
    })
  }
}
