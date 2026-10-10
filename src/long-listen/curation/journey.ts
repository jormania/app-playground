import type {
  Comparison, Concert, Explanation, Feedback, FeedbackTargetType, ListeningEvent, ListeningKind, Programme, ProgrammeItem,
  ProgrammeOption, Reaction, Resource, Sitting, Theme, ThemeExploration, WantMore, WeekKey, WeekMood, WeekRecord,
} from '../domain/types'
import { creditLine, newId } from '../domain/identity'
import { listeningState, latestFeedback } from '../domain/listening'
import { DEFAULT_TIME_ZONE, isoDateIn, weekFromKey, weekOf, type ListeningWeek } from '../domain/week'
import type { Repo } from '../store/repo'
import type {
  CompanionResponse, CompareResponse, ConcertResponse, ContinuityResponse, CuratorClient, ExplainResponse, ProgrammeResponse, ResourcesResponse, SeasonResponse, TasteResponse, ThemesResponse,
} from './api'
import { season as seasonOf, seasonNumberAt, type Season } from '../domain/season'
import { seasonContext } from './season'
import { buildContext } from './context'
import { threadDigest } from './continuity'
import { Ingest, comparisonOf, ingestProgramme } from './ingest'
import { applyTasteUpdate, pendingFeedback } from './taste'
import { isConfirmed, type SpotifyCandidate } from '../spotify/verify'

/** A concert as the form holds it, before it's kept. */
export interface ConcertDraft {
  venue: string
  hall?: string
  date: string
  time?: string
  orchestra?: string
  conductor?: string
  soloists: { name: string; instrument?: string }[]
  /** `soloists`: who of the evening's soloists plays in this work, by name; absent when nobody said. */
  works: { composer: string; title: string; catalogue?: string; soloists?: string[] }[]
  note?: string
  source: 'screenshot' | 'typed'
}

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

  /** Today, in the listener's time zone — what the curator is told, never the UTC date. */
  today(): string {
    return isoDateIn(this.now(), this.timeZone)
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
   * The week's record without asking the curator for directions — for a path
   * taken from Threads before this week began, which needs a week to sit in
   * but no three directions to choose from (each would be paid for, unread).
   */
  weekWithoutDirections(): Promise<WeekRecord> {
    const week = this.currentWeek()
    return this.once(`week:${week.key}`, async () => {
      const existing = await this.repo.weeks.get(week.key)
      if (existing) return existing
      await this.repo.ensureMeta(this.stamp())
      await Promise.all([
        this.closeEndedExplorations().catch(() => {}),
        this.interpretPendingFeedback().catch(() => {}),
      ])
      const record: WeekRecord = {
        weekKey: week.key, startsOn: week.startsOn, endsOn: week.endsOn, createdAt: this.stamp(),
        optionIds: [], setAsideProgrammeIds: [], promptVersion: '',
      }
      await this.repo.weeks.put(record)
      return record
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
      today: this.today(),
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
      form: o.form && o.form !== 'theme' ? o.form : undefined,
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
      // The mood may have changed while the curator thought: keep the latest.
      const latest = await this.repo.weeks.get(lw.key)
      const record: WeekRecord = { ...fresh, createdAt: week.createdAt, mood: latest?.mood ?? week.mood, earlierOptionIds: [...(week.earlierOptionIds ?? []), ...week.optionIds] }
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
    return this.once(`extend:${programmeId}`, () => this.companion_(programmeId, { extension: { wish: wish?.trim() || undefined } }))
  }

  /**
   * "A sitting for tonight": one evening's music, asked for on the day in the
   * listener's words, for an hour or two. With a programme this week it joins
   * that programme's thread, like "More of this theme" — nothing it covered
   * comes back. Without one, it becomes the week's programme and begins its
   * thread. Either way it is recorded where the rest of the listening is.
   */
  sitting(request: string, hours: 1 | 2): Promise<Programme> {
    const lw = this.currentWeek()
    const sitting = { request: request.trim(), hours }
    return this.once(`sitting:${lw.key}`, async () => {
      const week = await this.weekWithoutDirections()
      if (week.programmeId) return this.companion_(week.programmeId, { sitting })
      const now = this.stamp()
      // The evening's own direction, from the listener's words: the curator's title replaces it once written.
      const option: ProgrammeOption = {
        id: newId('opt'), weekKey: lw.key, position: 1, mood: 'immersive', title: 'Tonight', pitch: sitting.request || 'An evening of music',
        character: [], why: 'Asked for on the day.', angle: 'one evening, as asked', status: 'offered',
      }
      await this.repo.options.put(option)
      return this.startProgramme(week, option, sitting, now)
    })
  }

  /** A programme beside an existing one, on its thread: "More of this theme", or a sitting for tonight. */
  private async companion_(programmeId: string, ask: { extension?: { wish?: string }; sitting?: Sitting }): Promise<Programme> {
    const base = await this.repo.programmes.require(programmeId)
    const root = base.extends ? await this.repo.programmes.require(base.extends) : base
    const option = await this.repo.options.require(root.optionId)
    const exploration = await this.repo.explorations.require(root.explorationId)
    const lw = weekFromKey(root.weekKey)
    const digest = await threadDigest(this.repo, root.themeId, root.weekKey)
    const context = await buildContext(this.repo, lw)
    const now = this.stamp()
    const res = await this.curator.call<ProgrammeResponse>('programme', {
      today: this.today(),
      week: { key: lw.key, label: lw.label },
      option: { title: option.title, pitch: option.pitch, angle: option.angle, mood: option.mood, character: option.character, why: option.why, form: option.form },
      ...(ask.extension ? { extension: { of: root.title, dek: root.dek, wish: ask.extension.wish } } : {}),
      ...(ask.sitting ? { sitting: ask.sitting } : {}),
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
    const ingested = await ingestProgramme(this.repo, {
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
    const programme: Programme = ask.sitting ? { ...ingested.programme, sitting: ask.sitting } : ingested.programme
    await this.repo.comparisons.putMany(ingested.comparisons)
    await this.repo.addProgramme(programme)
    await this.repo.explorations.put({ ...exploration, extraProgrammeIds: [...(exploration.extraProgrammeIds ?? []), programme.id] })
    return programme
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

  private async startProgramme(week: WeekRecord, option: ProgrammeOption, sitting?: Sitting, at?: string): Promise<Programme> {
    const now = at ?? this.stamp()
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
      today: this.today(),
      week: { key: lw.key, label: lw.label },
      option: { title: option.title, pitch: option.pitch, angle: option.angle, mood: option.mood, character: option.character, why: option.why, continuityNote: option.returning?.note, form: option.form },
      thread: digest ? { ...digest, stage } : null,
      preferences: context.preferences,
      alreadyProgrammed: context.alreadyProgrammed,
      alreadyKnown: context.alreadyKnown,
      taste: context.taste,
      questions: context.questions,
      listenerNotes: context.listenerNotes,
      recentListening: context.recentListening,
      secondHearings: context.secondHearings.length ? context.secondHearings : undefined,
      thisWeek: context.thisWeek,
      ...(sitting ? { sitting } : {}),
    })

    // Nothing is written until the curator has answered: a failed call leaves
    // the week exactly as it was.
    const explorationId = newId('exp')
    const ingested = await ingestProgramme(this.repo, {
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
    const { comparisons } = ingested
    const programme: Programme = sitting ? { ...ingested.programme, sitting } : ingested.programme
    // A thread begun by a sitting is named by the evening the curator wrote, not by "Tonight".
    if (sitting && !returningTheme) Object.assign(theme, { title: programme.title, summary: programme.dek || theme.summary })
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
    // A second hearing offered in this programme isn't offered again.
    for (const i of programme.sections.flatMap((s) => s.items)) {
      if (context.secondHearings.some((h) => h.composer === i.proposed.composer && h.work === i.proposed.work)) {
        await this.repo.marks.put({ id: `again:${i.workId}`, at: now })
      }
    }
    await this.repo.themes.put({ ...theme, explorationIds: [...theme.explorationIds, explorationId], updatedAt: now })

    const fromThisWeek = option.weekKey === week.weekKey
    await this.repo.options.put({ ...option, status: fromThisWeek ? 'chosen' : 'taken-later', takenInWeek: fromThisWeek ? undefined : week.weekKey })
    for (const id of week.optionIds) {
      if (id === option.id) continue
      const o = await this.repo.options.get(id)
      if (o && o.status === 'offered') await this.repo.options.put({ ...o, status: 'open' })
    }
    // Written over the week as it is now, not as it was before the curator's minute: a mood set meanwhile stays.
    const latest = await this.repo.weeks.get(week.weekKey)
    await this.repo.weeks.put({ ...week, mood: latest ? latest.mood : week.mood, chosenOptionId: option.id, chosenAt: now, programmeId: programme.id })
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
    // "More of this theme" belongs to the same week of the thread: its listening counts too.
    const extras = (await this.repo.programmes.many(ex.extraProgrammeIds ?? [])).filter(Boolean)
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
        items: [programme, ...extras].flatMap((x) => x.sections.flatMap((s) => s.items)).map((i) => ({
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
    const concerts = await this.repo.concerts.all()
    return (type, id) => {
      if (type === 'theme') return `the theme "${themes.get(id) ?? id}"`
      if (type === 'concert') {
        const c = concerts.find((x) => x.id === id)
        return c ? `a concert heard live at ${c.venue} on ${c.date}: ${c.works.map((w) => `${w.composer} — ${w.title}`).join('; ')}` : 'a concert heard live'
      }
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
   * Reactions and notes left on a curator's recording that Spotify never had,
   * where a stand-in played in its place: they were about the stand-in, which
   * is what was heard — so they move to it. (The programme page filed them
   * under the curator's recording until 2026-10-10.) Once per device; returns
   * how many moved.
   */
  async repairStandInFeedback(): Promise<number> {
    const done = 'repair:stand-in-feedback'
    if (await this.repo.marks.get(done)) return 0
    const standIns = (await this.repo.comparisons.all()).filter((c) => c.standIn && c.perspectives.length > 1)
    const recordings = new Map((await this.repo.recordings.many(standIns.map((c) => c.perspectives[0].recordingId))).map((r) => [r.id, r]))
    const moveTo = new Map<string, string>()
    for (const c of standIns) {
      const curator = c.perspectives[0].recordingId
      if (!isConfirmed(recordings.get(curator))) moveTo.set(curator, c.perspectives[1].recordingId)
    }
    const wrong = (await this.repo.feedback.all()).filter((f) => f.target.type === 'recording' && moveTo.has(f.target.id))
    await Promise.all(wrong.map((f) => this.repo.feedback.put({ ...f, target: { ...f.target, id: moveTo.get(f.target.id)! } })))
    await this.repo.marks.put({ id: done, at: this.stamp(), value: { moved: wrong.length } })
    return wrong.length
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

  // ── seasons ───────────────────────────────────────────────────────────

  /** The first listening week with anything in it: where season one starts. */
  private async firstWeek(): Promise<WeekKey | undefined> {
    const keys = (await this.repo.weeks.all()).filter((w) => w.programmeId || w.optionIds.length).map((w) => w.weekKey).sort()
    return keys[0]
  }

  /**
   * The seasons there are to read, newest first: every finished one, and the
   * one under way once it has two weeks behind it ("so far").
   */
  async seasons(): Promise<Season[]> {
    const first = await this.firstWeek()
    if (!first) return []
    const now = this.currentWeek().key
    const out: Season[] = []
    for (let n = 1; n <= seasonNumberAt(first, now); n++) {
      const s = seasonOf(first, n, now)
      if (s.complete || s.weeksSoFar >= 2) out.push(s)
    }
    return out.reverse()
  }

  /** A season's review if one was written: for a season under way, only this week's. */
  async seasonReview(n: number): Promise<{ season: Season; review?: SeasonResponse }> {
    const first = await this.firstWeek()
    if (!first) throw new Error('No seasons yet.')
    const s = seasonOf(first, n, this.currentWeek().key)
    const mark = await this.repo.marks.get(this.seasonKey(s))
    return { season: s, review: mark?.value as SeasonResponse | undefined }
  }

  /** Write a season in review — once per finished season, once a week for one under way. */
  writeSeasonReview(n: number): Promise<SeasonResponse> {
    return this.once(`season:${n}`, async () => {
      const { season: s, review } = await this.seasonReview(n)
      if (review) return review
      const res = await this.curator.call<SeasonResponse>('season', await seasonContext(this.repo, s, this.currentWeek().key))
      await this.repo.marks.put({ id: this.seasonKey(s), at: this.stamp(), value: res })
      return res
    })
  }

  private seasonKey(s: Season): string {
    return s.complete ? `season:${s.number}` : `season:${s.number}:sofar:${this.currentWeek().key}`
  }

  // ── concerts ──────────────────────────────────────────────────────────

  /** A hall's programme, read from a screenshot into a draft for the listener to check. */
  readConcert(image: { mediaType: string; data: string }): Promise<ConcertResponse> {
    return this.curator.call<ConcertResponse>('concert', { image, year: Number(this.today().slice(0, 4)) })
  }

  /**
   * Keep a concert, as checked or typed by the listener. Its works become
   * Works in the Library (one Work per piece, however it was met); a line on
   * how it was is kept as feedback on the concert, so it reaches taste with
   * everything else said.
   */
  async saveConcert(draft: ConcertDraft, id?: string): Promise<Concert> {
    const ingest = await new Ingest(this.repo).load()
    const soloistNames = new Set(draft.soloists.map((s) => s.name.trim()).filter(Boolean))
    const works = draft.works
      .filter((w) => w.composer.trim() && w.title.trim())
      .map((w) => {
        const work = ingest.work(w.composer.trim(), w.title.trim(), w.catalogue?.trim() ? { catalogue: w.catalogue.trim() } : {})
        return {
          workId: work.id, composer: w.composer.trim(), title: w.title.trim(), ...(w.catalogue?.trim() ? { catalogue: w.catalogue.trim() } : {}),
          // Who plays in it, among the soloists still named (a renamed or removed soloist drops out).
          ...(w.soloists ? { soloists: w.soloists.map((n) => n.trim()).filter((n) => soloistNames.has(n)) } : {}),
        }
      })
    if (!draft.venue.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(draft.date) || !works.length) throw new Error('A concert needs a venue, a date and at least one work.')
    await ingest.commit()
    const previous = id ? await this.repo.concerts.get(id) : undefined
    const concert: Concert = {
      id: id ?? newId('concert'),
      venue: draft.venue.trim(),
      ...(draft.hall?.trim() ? { hall: draft.hall.trim() } : {}),
      date: draft.date,
      ...(draft.time?.trim() ? { time: draft.time.trim() } : {}),
      ...(draft.orchestra?.trim() ? { orchestra: draft.orchestra.trim() } : {}),
      ...(draft.conductor?.trim() ? { conductor: draft.conductor.trim() } : {}),
      soloists: draft.soloists.filter((s) => s.name.trim()).map((s) => ({ name: s.name.trim(), ...(s.instrument?.trim() ? { instrument: s.instrument.trim() } : {}) })),
      works,
      ...(draft.note?.trim() ? { note: draft.note.trim() } : {}),
      source: draft.source,
      createdAt: previous?.createdAt ?? this.stamp(),
    }
    await this.repo.concerts.put(concert)
    // What was said about it, once per change of words: read into taste with the rest.
    if (concert.note && concert.note !== previous?.note) await this.giveFeedback({ target: { type: 'concert', id: concert.id }, note: concert.note })
    return concert
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

  /**
   * "A little more context" on an item (cached, once), or an answer to the
   * listener's own question about it — asked from the listening view, with
   * the recording and the movement sounding as context. Answers are kept
   * under the item (`${programmeId}:${itemId}:q_…`) and read back by
   * `answers()`; each question is asked once.
   */
  explain(programmeId: string, itemId: string, question?: string, nowPlaying?: { recording: string; movement?: string }): Promise<Explanation> {
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
        nowPlaying: q && nowPlaying ? nowPlaying : undefined,
        taste: profile.observations.filter((o) => !o.supersededBy).map((o) => o.statement).slice(0, 12),
      })
      const e: Explanation = {
        id, heading: res.heading, body: res.body, createdAt: this.stamp(), promptVersion: res.promptVersion,
        ...(q ? { question: q, ...(nowPlaying?.movement ? { movement: nowPlaying.movement } : {}) } : {}),
      }
      await this.repo.explanations.put(e)
      return e
    })
  }

  /** The listener's questions about an item and their answers, oldest first. */
  async answers(programmeId: string, itemId: string): Promise<Explanation[]> {
    const prefix = `${programmeId}:${itemId}:`
    return (await this.repo.explanations.all()).filter((e) => e.id.startsWith(prefix)).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  /**
   * The listening companion: a note per movement for every confirmed
   * recording in a programme (stand-ins included) that hasn't one yet — in one
   * call, on the cheaper model, kept per recording (`companion:<recordingId>`)
   * so it's written once. Returns how many recordings got notes.
   */
  companion(programmeId: string): Promise<number> {
    return this.once(`companion:${programmeId}`, async () => {
      const p = await this.repo.programmes.require(programmeId)
      const items = p.sections.flatMap((s) => s.items)
      const standIns = (await this.repo.comparisons.many(items.map((i) => `cmp:${programmeId}:${i.id}`))).filter((c) => c.standIn)
      const wanted = [
        ...items.map((i) => ({ rid: i.recordingId, proposed: i.proposed, listenFor: i.listenFor })),
        ...standIns.flatMap((c) => c.perspectives.slice(1).map((x) => ({ rid: x.recordingId, proposed: x.proposed, listenFor: x.listenFor ? [x.listenFor] : [] }))),
      ]
      const recordings = new Map((await this.repo.recordings.many(wanted.map((w) => w.rid))).map((r) => [r.id, r]))
      // Notes belong to one division of the work into tracks: a recording re-matched to another album is written for afresh.
      const tracksOf = (rid: string) => (recordings.get(rid)?.spotify?.trackNames ?? []).join('\u241e')
      const marks = new Map((await this.repo.marks.many(wanted.map((w) => `companion:${w.rid}`))).map((m) => [m.id.slice('companion:'.length), m.value as { tracks?: string }]))
      const done = (rid: string) => { const m = marks.get(rid); return Boolean(m && (m.tracks === undefined || m.tracks === tracksOf(rid))) }
      const todo = wanted.filter((w, i) => wanted.findIndex((x) => x.rid === w.rid) === i && !done(w.rid) && (recordings.get(w.rid)?.spotify?.trackNames?.length ?? 0) > 0 && recordings.get(w.rid)?.verification === 'verified')
      if (!todo.length) return 0
      const { language } = await this.repo.preferences()
      // Short keys: a long recording id echoed back wrong would leave its notes unwritten and paid for again.
      const res = await this.curator.call<CompanionResponse>('companion', {
        language,
        programme: { title: p.title, dek: p.dek },
        works: todo.map((w, i) => ({ key: `w${i + 1}`, composer: w.proposed.composer, work: w.proposed.work, recording: creditLine(w.proposed), tracks: recordings.get(w.rid)!.spotify!.trackNames, listenFor: w.listenFor })),
      })
      const now = this.stamp()
      const byKey = new Map(res.works.map((w) => [w.key, w.movements]))
      // Every recording asked about is marked, notes or not, so none is asked about again until its tracks change.
      await this.repo.marks.putMany(todo.map((w, i) => ({ id: `companion:${w.rid}`, at: now, value: { movements: byKey.get(`w${i + 1}`) ?? [], tracks: tracksOf(w.rid), promptVersion: res.promptVersion } })))
      return res.works.length
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
        spotifyCandidates: opts.spotifyCandidates?.length ? opts.spotifyCandidates.map(({ albumId: _id, ...c }) => c) : undefined,
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
