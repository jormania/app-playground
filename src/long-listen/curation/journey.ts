import type {
  Comparison, Concert, Explanation, Feedback, FeedbackTargetType, ListeningEvent, ListeningKind, Programme, ProgrammeItem,
  ProgrammeOption, Reaction, Resource, Sitting, Theme, ThemeExploration, WantMore, WeekKey, WeekMood, WeekRecord,
} from '../domain/types'
import { creditLine, fold, newId, sameWork } from '../domain/identity'
import { termMark } from '../domain/glossary'
import { forgetPlaceBefore } from '../app/place'
import { goingKey, type Going } from '../domain/going'
import type { LiveEvent } from '../live/live'
import { listeningState, latestFeedback } from '../domain/listening'
import { DEFAULT_TIME_ZONE, isoDateIn, weekFromKey, weekOf, type ListeningWeek } from '../domain/week'
import { NotFound, type Repo } from '../store/repo'
import type {
  CompanionResponse, TagsResponse, DefineResponse, PrepareResponse, PortraitResponse, CompareResponse, ConcertResponse, ContinuityResponse, CuratorClient, ExplainResponse, ProgrammeResponse, ResourcesResponse, SeasonResponse, TasteResponse, ThemesResponse,
} from './api'
import { season as seasonOf, seasonNumberAt, type Season } from '../domain/season'
import { seasonContext } from './season'
import { buildContext } from './context'
import { directionChanges, type DirectionChange } from '../domain/directionChanges'
import { feedbackOnAny, heardAs, playedProposed, standInPlayersOf, standInsOf, threadDigest } from './continuity'
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

/**
 * "Three others" after a setting or the week's tuning changed: the three on
 * offer, sent back to be reworked for what changed rather than replaced.
 */
interface Rework {
  changed: DirectionChange[]
  directions: { mood: string; title: string; pitch: string; angle: string; form: string; returningThemeId: string }[]
}

export class Journey {
  readonly timeZone: string
  private readonly now: () => Date
  private static readonly inflight = new Map<string, Promise<unknown>>()
  /** Per store, the tail of each queue of jobs that must not overlap (see `serial`). */
  private static readonly queues = new WeakMap<Repo, Map<string, Promise<unknown>>>()

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

  /**
   * One job at a time per key, in the order asked: each waits for the one before
   * to finish, failed or not. `once` only shares a call with an identical one;
   * this is for different jobs on the same record — choosing, a sitting, three
   * other directions — that each read the week, wait a minute on the curator,
   * and write it back, so that run together the last to answer undid the others.
   * Keyed per store, since that is what they share. A job must never wait on
   * its own queue from inside it.
   */
  private serial<T>(key: string, fn: () => Promise<T>): Promise<T> {
    let queues = Journey.queues.get(this.repo)
    if (!queues) Journey.queues.set(this.repo, queues = new Map())
    const run = (queues.get(key) ?? Promise.resolve()).then(fn, fn)
    const tail = run.then(() => {}, () => {})
    queues.set(key, tail)
    void tail.then(() => { if (queues.get(key) === tail) queues.delete(key) })
    return run
  }

  /** The queue every job that writes a week's record goes through. */
  private weekJob<T>(weekKey: WeekKey, fn: () => Promise<T>): Promise<T> {
    return this.serial(`week:${weekKey}`, fn)
  }

  /**
   * Refuse to write a curator's answer into a journey that was started afresh
   * while the curator thought: what it answered was about the journey cleared,
   * and writing it would bring that journey back in pieces.
   */
  private stillCurrent(generation: number): void {
    if (this.repo.generation !== generation) throw new Error('The journey was started afresh meanwhile, so that answer was not kept.')
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
      // A week begun without directions (a path from Threads, a sitting) whose
      // programme never came — the curator failed — has nothing to choose
      // from and nothing to listen to: it gets its directions now, or it would
      // stay empty for good.
      if (existing && !existing.programmeId && existing.optionIds.length && !existing.madeWith) return this.noteMadeWithNow(existing)
      if (existing && (existing.programmeId || existing.optionIds.length)) return existing
      await this.repo.ensureMeta(this.stamp())
      // Independent of each other, so side by side: the week waits for the slower one, not the sum.
      await Promise.all([
        this.closeEndedExplorations().catch(() => {}),
        this.interpretPendingFeedback().catch(() => {}),
      ])
      return this.weekJob(week.key, async () => {
        // Looked at again in the queue: a sitting may have given the week its programme meanwhile.
        const now = await this.repo.weeks.get(week.key)
        if (now && (now.programmeId || now.optionIds.length)) return now
        return this.generateWeek(week, requestedNext)
      })
    })
  }

  /**
   * A week offered before its record kept what its three were made with: take
   * the settings as they are now as that, from here on. A change made before
   * this can't be seen, but every change after it can — so "three others" on
   * this week reworks the three for a later change instead of never.
   */
  private async noteMadeWithNow(week: WeekRecord): Promise<WeekRecord> {
    const { nextRequest: _, ...preferences } = await this.repo.preferences()
    return this.updateWeek(week.weekKey, (latest = week) => (latest.madeWith ? latest : { ...latest, madeWith: { preferences, ...(latest.mood?.length ? { mood: latest.mood } : {}) } }))
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
  private async generateWeek(week: ListeningWeek, requestedNext?: string, alsoOfferedThisWeek: string[] = [], rework?: Rework): Promise<WeekRecord> {
    const generation = this.repo.generation
    const context = await buildContext(this.repo, week, requestedNext, this.timeZone, this.today())
    const res = await this.curator.call<ThemesResponse>('themes', {
      today: this.today(),
      week: { key: week.key, label: week.label },
      context,
      alsoOfferedThisWeek,
      ...(rework ? { rework } : {}),
    })
    this.stillCurrent(generation)
    // A wish for next week is read once, at the start of a week. Clear it only
    // after it reached the curator — and only the wish that did: one written in
    // the Notebook while the curator thought was never sent, so it stays.
    const prefs = await this.repo.preferences()
    if (requestedNext === undefined && prefs.nextRequest && prefs.nextRequest.trim() === (context.requestedNext ?? '')) {
      await this.repo.savePreferences({ ...prefs, nextRequest: '' })
    }
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
    // What these three were made with, exactly as the curator was told it — so a
    // later "three others" can tell a change of settings from a wish to go elsewhere.
    const madeWith = { preferences: context.preferences, ...(context.thisWeek ? { mood: context.thisWeek } : {}) }
    // A week already stored (one begun without directions, or asked again) keeps
    // what it holds — its mood, its programme, what was set aside — and gains
    // only the new directions; callers that replace more say so themselves.
    await this.repo.options.putMany(options)
    return this.updateWeek(week.key, (stored) => (stored ? { ...stored, optionIds: options.map((o) => o.id), promptVersion: res.promptVersion, madeWith } : {
      weekKey: week.key,
      startsOn: week.startsOn,
      endsOn: week.endsOn,
      createdAt: this.stamp(),
      optionIds: options.map((o) => o.id),
      setAsideProgrammeIds: [],
      promptVersion: res.promptVersion,
      madeWith,
    }))
  }

  /** "This week, differently": set this week's mood. Read by every curator job about the week from now on. */
  async setWeekMood(mood: WeekMood[]): Promise<WeekRecord> {
    const key = this.currentWeek().key
    // Read and written as one step against the other writers of the week's
    // record (see `updateWeek`), so a choice landing at the same moment neither
    // loses this mood nor has its programme undone by it.
    return this.updateWeek(key, (week) => {
      if (!week) throw new NotFound(`week ${key} not found`)
      return { ...week, mood: mood.length ? mood : undefined }
    })
  }

  /**
   * Read the week's record as it is now and write it back changed, as one step:
   * every such read-and-write of one week waits for the one before, so two that
   * land together (a mood chip and a choice finishing) can't each write back a
   * copy missing the other's change. Short — no curator call is ever made in
   * here; the minute-long jobs use `weekJob`, and only their final write comes here.
   */
  private updateWeek(key: WeekKey, change: (week: WeekRecord | undefined) => WeekRecord): Promise<WeekRecord> {
    return this.serial(`week-record:${key}`, async () => {
      const record = change(await this.repo.weeks.get(key))
      await this.repo.weeks.put(record)
      return record
    })
  }

  /**
   * Ask for three others, optionally saying what you're in the mood for. Only
   * before choosing — afterwards it's "change direction".
   *
   * What it means depends on what moved since the three were offered. Nothing:
   * none of them appeal, so three that differ clearly, and the three set aside
   * stay as open paths, not rejections. A setting, or the week's tuning: the
   * listener is adjusting, not leaving — the same three come back reworked for
   * it, each keeping its ground (its theme, its thread, its route in), and the
   * earlier versions are kept as offered but not as open paths, since their
   * reworked selves are on the page.
   */
  offerOtherDirections(request?: string): Promise<WeekRecord> {
    const lw = this.currentWeek()
    return this.once(`week:${lw.key}:again`, () => this.weekJob(lw.key, async () => {
      const week = await this.repo.weeks.require(lw.key)
      if (week.programmeId) throw new Error('This week already has a programme — change direction instead.')
      const current = await this.repo.options.many(week.optionIds)
      const changed = directionChanges(week.madeWith, await this.repo.preferences(), week.mood)
      const rework: Rework | undefined = changed.length && current.length ? {
        changed,
        directions: current.map((o) => ({ mood: o.mood, title: o.title, pitch: o.pitch, angle: o.angle, form: o.form ?? 'theme', returningThemeId: o.returning?.themeId ?? '' })),
      } : undefined
      const fresh = rework
        ? await this.generateWeek(lw, request ?? '', [], rework)
        : await this.generateWeek(lw, request ?? '', current.map((o) => o.title))
      // Only now that the curator has answered do the three before stop being on
      // offer — read again, as they are now, so a failed call leaves them offered.
      const before = await this.repo.options.many(week.optionIds)
      await this.repo.options.putMany(before.filter((o) => o.status === 'offered').map((o) => ({ ...o, status: rework ? 'reworked' as const : 'open' as const })))
      // The week as it is now, not as it was a minute ago: a mood set meanwhile stays.
      return this.updateWeek(lw.key, (latest = fresh) => ({
        ...latest, optionIds: fresh.optionIds, promptVersion: fresh.promptVersion, createdAt: week.createdAt,
        earlierOptionIds: [...(week.earlierOptionIds ?? []), ...week.optionIds],
      }))
    }))
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
    return this.once(`week:${lw.key}:more`, () => this.weekJob(lw.key, async () => {
      const week = await this.repo.weeks.require(lw.key)
      const seen = (await this.repo.options.many([...(week.earlierOptionIds ?? []), ...week.optionIds])).map((o) => o.title)
      const fresh = await this.generateWeek(lw, request ?? '', seen)
      // Directions still on offer become open paths once the new ones exist, read as they are now.
      const current = await this.repo.options.many(week.optionIds)
      await this.repo.options.putMany(current.filter((o) => o.status === 'offered').map((o) => ({ ...o, status: 'open' as const })))
      // The week as it is now — its programme, mood and set-aside list — gaining only the new directions.
      return this.updateWeek(lw.key, (latest = week) => ({
        ...latest,
        optionIds: fresh.optionIds,
        earlierOptionIds: [...(week.earlierOptionIds ?? []), ...week.optionIds],
        promptVersion: fresh.promptVersion,
      }))
    }))
  }

  /**
   * "More of this theme": the listener has heard the week's programme and
   * wants more on the same thread. A companion programme, its own snapshot,
   * continuing the same exploration — the curator is told everything the
   * thread has covered, this week included, so nothing comes back. It counts
   * towards the thread like the week's programme does.
   */
  extendProgramme(programmeId: string, wish?: string): Promise<Programme> {
    const w = wish?.trim() || undefined
    // Keyed by the wish too: a second tap shares the call, a different wish is its own.
    return this.once(`extend:${programmeId}:${w ?? ''}`, () => this.companion_(programmeId, { extension: { wish: w } }))
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
    // Keyed by what was asked: a double tap shares the call, another evening asked for meanwhile is its own.
    return this.once(`sitting:${lw.key}:${hours}:${sitting.request}`, async () => {
      // Outside the week's queue: it may be ensureWeek's call, which queues there itself.
      await this.weekWithoutDirections()
      return this.weekJob(lw.key, async () => {
        // Read in the queue: a direction chosen a moment ago is the programme this evening joins.
        const week = await this.repo.weeks.require(lw.key)
        if (week.programmeId) return this.companion_(week.programmeId, { sitting })
        const now = this.stamp()
        // The evening's own direction, from the listener's words: the curator's title replaces it once written.
        // Not stored here: startProgramme stores it with the programme, so a failed call leaves no orphan "Tonight".
        const option: ProgrammeOption = {
          id: newId('opt'), weekKey: lw.key, position: 1, mood: 'immersive', title: 'Tonight', pitch: sitting.request || 'An evening of music',
          character: [], why: 'Asked for on the day.', angle: 'one evening, as asked', status: 'offered',
        }
        return this.startProgramme(week, option, sitting, now)
      })
    })
  }

  /** A programme beside an existing one, on its thread: "More of this theme", or a sitting for tonight. */
  private async companion_(programmeId: string, ask: { extension?: { wish?: string }; sitting?: Sitting }): Promise<Programme> {
    const generation = this.repo.generation
    const base = await this.repo.programmes.require(programmeId)
    const root = base.extends ? await this.repo.programmes.require(base.extends) : base
    const option = await this.repo.options.require(root.optionId)
    const exploration = await this.repo.explorations.require(root.explorationId)
    const lw = weekFromKey(root.weekKey)
    const digest = await threadDigest(this.repo, root.themeId, root.weekKey)
    const context = await buildContext(this.repo, lw, undefined, this.timeZone, this.today())
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
    this.stillCurrent(generation)
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
    // Read again: while the curator wrote, another companion may have joined the
    // thread, or a change of direction set it aside — both are kept.
    const latest = (await this.repo.explorations.get(root.explorationId)) ?? exploration
    await this.repo.explorations.put({ ...latest, extraProgrammeIds: [...(latest.extraProgrammeIds ?? []), programme.id] })
    return programme
  }

  /**
   * This week's record, for a choice made on it. A page left open across
   * Monday midnight still shows last week's three: said in words, not as a
   * missing record, and the page loads the new week.
   */
  private async weekNow(key: WeekKey): Promise<WeekRecord> {
    const week = await this.repo.weeks.get(key)
    if (!week) throw new Error('A new week has begun since this page opened — here are its directions.')
    return week
  }

  /** Choose one of this week's three directions. */
  choose(optionId: string): Promise<Programme> {
    const key = this.currentWeek().key
    return this.once(`choose:${optionId}`, () => this.weekJob(key, async () => {
      const week = await this.weekNow(key)
      if (week.programmeId) throw new Error('This week already has a programme — change direction instead.')
      const option = await this.repo.options.require(optionId)
      return this.startProgramme(week, option)
    }))
  }

  /**
   * Choose a different direction this week. The programme already made is
   * kept as it was — set aside, not deleted — and only what was actually heard
   * of it counts towards its thread.
   */
  changeDirection(optionId: string): Promise<Programme> {
    const key = this.currentWeek().key
    return this.once(`choose:${optionId}`, () => this.weekJob(key, async () => {
      const week = await this.weekNow(key)
      const option = await this.repo.options.require(optionId)
      // Taken a moment ago by a job ahead in the queue: nothing to change to.
      if (week.chosenOptionId === optionId && week.programmeId) return this.repo.programmes.require(week.programmeId)
      return this.startProgramme(week, option)
    }))
  }

  /** Take a path offered in an earlier week and not chosen then. */
  takeOpenPath(optionId: string): Promise<Programme> {
    return this.changeDirection(optionId)
  }

  private async startProgramme(week: WeekRecord, option: ProgrammeOption, sitting?: Sitting, at?: string): Promise<Programme> {
    const generation = this.repo.generation
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
    const context = await buildContext(this.repo, lw, undefined, this.timeZone, this.today())

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
      // The work id is for matching the answer (below), not for the curator to read.
      secondHearings: context.secondHearings.length ? context.secondHearings.map(({ workId: _w, ...h }) => h) : undefined,
      thisWeek: context.thisWeek,
      ...(sitting ? { sitting } : {}),
    })
    this.stillCurrent(generation)

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

    // The week as it is now, not as it was before the curator's minute: a
    // sitting, or another choice, may have given it a programme meanwhile, and
    // that is the one this replaces. (A mood set meanwhile stays too.)
    const current = (await this.repo.weeks.get(week.weekKey)) ?? week

    // Set aside the programme being replaced, if any.
    let setAsideProgrammeIds = current.setAsideProgrammeIds
    if (current.programmeId) {
      const previous = await this.repo.programmes.get(current.programmeId)
      if (previous) {
        const ex = await this.repo.explorations.get(previous.explorationId)
        if (ex) await this.repo.explorations.put({ ...ex, setAside: true })
        const prevOption = await this.repo.options.get(previous.optionId)
        if (prevOption) await this.repo.options.put({ ...prevOption, status: 'set-aside' })
      }
      setAsideProgrammeIds = [...setAsideProgrammeIds, current.programmeId]
    }

    await this.repo.comparisons.putMany(comparisons)
    await this.repo.addProgramme(programme)
    await this.repo.explorations.put(exploration)
    // A second hearing offered in this programme isn't offered again. Matched by
    // the work, not the curator's spelling: taken up as "Symphony No. 4, Op. 29
    // “The Inextinguishable”" it is still the "Symphony No. 4" offered, and with
    // no mark it came back as a second hearing every week.
    for (const i of programme.sections.flatMap((s) => s.items)) {
      const offered = context.secondHearings.some((h) => h.workId === i.workId
        || sameWork({ composer: h.composer, title: h.work }, { composer: i.proposed.composer, title: i.proposed.work, catalogue: i.proposed.catalogue }))
      if (offered) await this.repo.marks.put({ id: `again:${i.workId}`, at: now })
    }
    // A returning thread as it is now, not as it was before the curator's
    // minute: a visit closing meanwhile rewrote its open questions and next
    // directions, and writing the old copy back undid them.
    const themeNow = returningTheme ? ((await this.repo.themes.get(theme.id)) ?? theme) : theme
    await this.repo.themes.put({ ...themeNow, explorationIds: [...themeNow.explorationIds, explorationId], updatedAt: now })

    const fromThisWeek = option.weekKey === week.weekKey
    await this.repo.options.put({
      ...option,
      // A week begun by a sitting is listed under the evening the curator wrote, not "Tonight".
      ...(sitting ? { title: programme.title } : {}),
      status: fromThisWeek ? 'chosen' : 'taken-later',
      takenInWeek: fromThisWeek ? undefined : week.weekKey,
    })
    for (const id of current.optionIds) {
      if (id === option.id) continue
      const o = await this.repo.options.get(id)
      if (o && o.status === 'offered') await this.repo.options.put({ ...o, status: 'open' })
    }
    // Read once more for the write itself: a mood set during the writes above stays.
    await this.updateWeek(week.weekKey, (latest = current) => ({ ...latest, setAsideProgrammeIds, chosenOptionId: option.id, chosenAt: now, programmeId: programme.id }))
    return programme
  }

  // ── continuity ────────────────────────────────────────────────────────

  /** Close every exploration whose week has ended, so its thread knows how it landed. */
  async closeEndedExplorations(): Promise<number> {
    const current = this.currentWeek().key
    const open = (await this.repo.explorations.all()).filter((e) => e.weekKey < current && !e.closedAt && !e.setAside)
    // Threads side by side, but one thread's visits in order, oldest first:
    // each closing rewrites the thread's open questions and next directions,
    // so the latest visit must have the last word — and each sees the one
    // before it closed. One failing doesn't stop the others; it is retried next time.
    const byTheme = new Map<string, ThemeExploration[]>()
    for (const ex of [...open].sort((a, b) => a.weekKey.localeCompare(b.weekKey))) byTheme.set(ex.themeId, [...(byTheme.get(ex.themeId) ?? []), ex])
    const counts = await Promise.all([...byTheme.values()].map(async (visits) => {
      let closed = 0
      for (const ex of visits) {
        try {
          await this.once(`close:${ex.id}`, () => this.closeExploration(ex, current))
          closed++
        } catch {
          // Left open, retried next time; the visits after it still close.
        }
      }
      return closed
    }))
    return counts.reduce((a, b) => a + b, 0)
  }

  private async closeExploration(ex: ThemeExploration, current: WeekKey): Promise<void> {
    const generation = this.repo.generation
    const theme = await this.repo.themes.require(ex.themeId)
    const programme = await this.repo.programmes.require(ex.programmeId)
    // "More of this theme" belongs to the same week of the thread: its listening counts too.
    const extras = (await this.repo.programmes.many(ex.extraProgrammeIds ?? [])).filter(Boolean)
    const digest = await threadDigest(this.repo, theme.id, current)
    const events = await this.repo.events.all()
    const feedback = await this.repo.feedback.all()
    // A work heard through a stand-in was heard: its listening and reactions are filed under the stand-in.
    const comparisons = await this.repo.comparisons.all()
    const standIns = standInsOf(comparisons)
    const players = standInPlayersOf(comparisons)
    const { language } = await this.repo.preferences()
    const res = await this.curator.call<ContinuityResponse>('continuity', {
      language,
      thread: digest,
      exploration: { weekKey: ex.weekKey, stage: ex.stage, angle: ex.angle },
      programme: {
        title: programme.title,
        items: [programme, ...extras].flatMap((x) => x.sections.flatMap((s) => s.items).map((i) => ({ i, x, ids: heardAs(i, x.id, standIns) }))).map(({ i, x, ids }) => ({
          composer: i.proposed.composer,
          work: i.proposed.work,
          // Credited to who played: heard through a stand-in, the stand-in's performers.
          recording: creditLine(playedProposed(i, x.id, players, events, feedback)),
          state: listeningState(events, ids),
          ...feedbackOnAny(feedback, ids),
        })),
        programmeFeedback: latestFeedback(feedback, programme.id),
      },
    })
    this.stillCurrent(generation)
    const now = this.stamp()
    // Read again: the thread may have changed while the curator thought (a visit begun, a title written).
    const latest = (await this.repo.themes.get(ex.themeId)) ?? theme
    await this.repo.themes.put({
      ...latest,
      reaction: res.reaction || latest.reaction,
      openQuestions: res.openQuestions,
      adjacentTopics: res.adjacentTopics,
      nextDirections: res.nextDirections,
      updatedAt: now,
    })
    const exNow = (await this.repo.explorations.get(ex.id)) ?? ex
    await this.repo.explorations.put({ ...exNow, closedAt: now, closingNote: res.closingNote })
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
      const generation = this.repo.generation
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
      this.stillCurrent(generation)
      const now = this.stamp()
      // The profile as it is now: a note to the curator saved in the Notebook while it answered stays.
      await this.repo.saveTaste(applyTasteUpdate(await this.repo.taste(), res, now))
      // Each record as it is now, marked read and nothing else: the copies read
      // before the call are stale (the stand-in repair may have moved one
      // meanwhile), and writing them back would undo that.
      const latest = await this.repo.feedback.many(pending.map((f) => f.id))
      await this.repo.feedback.putMany(latest.map((f) => ({ ...f, interpretedAt: now })))
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
    // Heard through: where it was left is no longer a place to resume (app/place.ts).
    if (kind === 'heard') {
      const ids = (await this.repo.recordings.get(item.recordingId))?.spotify?.trackIds
      if (ids?.length) forgetPlaceBefore(ids, Date.parse(e.at))
    }
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
    if (!first) throw new NotFound('No seasons yet.')
    const s = seasonOf(first, n, this.currentWeek().key)
    const mark = await this.repo.marks.get(this.seasonKey(s))
    return { season: s, review: mark?.value as SeasonResponse | undefined }
  }

  /**
   * Write a season in review — once per finished season, once a week for one
   * under way, and never for one with fewer than two weeks behind it (or none,
   * a season still to come): there would be nothing to read back, and it costs.
   */
  writeSeasonReview(n: number): Promise<SeasonResponse> {
    return this.once(`season:${n}`, async () => {
      const { season: s, review } = await this.seasonReview(n)
      if (review) return review
      if (!s.complete && s.weeksSoFar < 2) throw new Error(s.weeksSoFar === 0 ? 'This season hasn’t begun.' : 'A season is read back once two weeks are behind it.')
      const generation = this.repo.generation
      const res = await this.curator.call<SeasonResponse>('season', await seasonContext(this.repo, s, this.currentWeek().key, this.timeZone))
      // A season of a journey started afresh meanwhile is not kept for the new one.
      this.stillCurrent(generation)
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
    // Today, not only its year: a programme without a year, read across New Year, belongs to the nearer one.
    return this.curator.call<ConcertResponse>('concert', { image, year: Number(this.today().slice(0, 4)), today: this.today() })
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
      const generation = this.repo.generation
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
      // Like every curator job that writes: nothing kept for a journey cleared meanwhile.
      this.stillCurrent(generation)
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
   * "More context" on an item (cached, once), or an answer to the
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
      const generation = this.repo.generation
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
      this.stillCurrent(generation)
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
      const generation = this.repo.generation
      const p = await this.repo.programmes.require(programmeId)
      const items = p.sections.flatMap((s) => s.items)
      // Each item's stand-in, read by the one rule every reader uses (domain/standIns.ts):
      // a comparison marked standIn with a second perspective.
      const comparisons = await this.repo.comparisons.many(items.map((i) => `cmp:${programmeId}:${i.id}`))
      const players = standInPlayersOf(comparisons)
      const perspectiveOf = new Map(comparisons.map((c) => [c.id, c.perspectives[1]]))
      const wanted = [
        ...items.map((i) => ({ rid: i.recordingId, proposed: i.proposed, listenFor: i.listenFor })),
        ...items.flatMap((i) => {
          const s = players.get(`cmp:${programmeId}:${i.id}`)
          const x = perspectiveOf.get(`cmp:${programmeId}:${i.id}`)
          return s && x ? [{ rid: s.recordingId, proposed: s.proposed, listenFor: x.listenFor ? [x.listenFor] : [] }] : []
        }),
      ]
      const recordings = new Map((await this.repo.recordings.many(wanted.map((w) => w.rid))).map((r) => [r.id, r]))
      // Notes belong to one division of the work into tracks: a recording re-matched to another album is written for afresh.
      const tracksOf = (rid: string) => (recordings.get(rid)?.spotify?.trackNames ?? []).join('\u241e')
      const marks = new Map((await this.repo.marks.many(wanted.map((w) => `companion:${w.rid}`))).map((m) => [m.id.slice('companion:'.length), m.value as { tracks?: string; movements?: string[]; counted?: boolean }]))
      // Done: written for these tracks — and one note per track, or already asked again for the missing ones
      // (`counted`). Notes kept before that check, a note short, are written once more.
      const done = (rid: string) => {
        const m = marks.get(rid)
        if (!m || (m.tracks !== undefined && m.tracks !== tracksOf(rid))) return false
        return m.counted || (m.movements?.length ?? 0) === (recordings.get(rid)?.spotify?.trackNames?.length ?? 0)
      }
      const todo = wanted.filter((w, i) => wanted.findIndex((x) => x.rid === w.rid) === i && !done(w.rid) && (recordings.get(w.rid)?.spotify?.trackNames?.length ?? 0) > 0 && recordings.get(w.rid)?.verification === 'verified')
      if (!todo.length) return 0
      const { language } = await this.repo.preferences()
      // Short keys: a long recording id echoed back wrong would leave its notes unwritten and paid for again.
      const asked = todo.map((w, i) => ({ key: `w${i + 1}`, composer: w.proposed.composer, work: w.proposed.work, recording: creditLine(w.proposed), tracks: recordings.get(w.rid)!.spotify!.trackNames!, listenFor: w.listenFor }))
      const res = await this.curator.call<CompanionResponse>('companion', { language, programme: { title: p.title, dek: p.dek }, works: asked })
      this.stillCurrent(generation)
      const byKey = new Map(res.works.map((w) => [w.key, w.movements]))
      // One note per track, or the notes slide: a note left out in the middle puts every later one under
      // the wrong movement, and the last goes without. Such a work is asked about once more, on its own.
      const short = asked.filter((w) => byKey.get(w.key)?.length !== w.tracks.length)
      if (short.length) {
        const again = await this.curator.call<CompanionResponse>('companion', { language, programme: { title: p.title, dek: p.dek }, works: short }).catch(() => null)
        this.stillCurrent(generation)
        for (const w of again?.works ?? []) {
          const want = short.find((x) => x.key === w.key)
          if (want && w.movements.length === want.tracks.length) byKey.set(w.key, w.movements)
        }
      }
      const now = this.stamp()
      // Every recording asked about is marked, notes or not, so none is asked about again until its tracks change.
      await this.repo.marks.putMany(todo.map((w, i) => ({ id: `companion:${w.rid}`, at: now, value: { movements: byKey.get(`w${i + 1}`) ?? [], tracks: tracksOf(w.rid), counted: true, promptVersion: res.promptVersion } })))
      return res.works.length
    })
  }

  /**
   * "Listen for" tied to its movement, for a programme written before the
   * curator was asked to (programme@2026-10-14.1): one short call on the
   * cheaper model, for every work in it not yet tagged, saved into the
   * programme. Every work asked about keeps an answer, all "" if need be, so it
   * is never asked twice. Returns how many works were tagged.
   */
  tagListenFor(programmeId: string): Promise<number> {
    return this.once(`tags:${programmeId}`, async () => {
      const generation = this.repo.generation
      const p = await this.repo.programmes.require(programmeId)
      const todo = p.sections.flatMap((s) => s.items).filter((i) => i.listenFor.length > 0 && !i.listenForAt)
      if (!todo.length) return 0
      const recordings = new Map((await this.repo.recordings.many(todo.map((i) => i.recordingId))).map((r) => [r.id, r]))
      const { language } = await this.repo.preferences()
      const res = await this.curator.call<TagsResponse>('tags', {
        language,
        programme: { title: p.title },
        works: todo.map((i, k) => ({ key: `w${k + 1}`, composer: i.proposed.composer, work: i.proposed.work, tracks: recordings.get(i.recordingId)?.spotify?.trackNames ?? [], listenFor: i.listenFor })),
      })
      this.stillCurrent(generation)
      const byKey = new Map(res.works.map((w) => [w.key, w.movements]))
      const tags = new Map(todo.map((i, k) => [i.id, i.listenFor.map((_, n) => byKey.get(`w${k + 1}`)?.[n] ?? '')]))
      // Read again and changed as one step: only the tags are written, onto the programme as it is now.
      const fresh = await this.repo.programmes.require(programmeId)
      await this.repo.programmes.put({
        ...fresh,
        sections: fresh.sections.map((s) => ({ ...s, items: s.items.map((i) => (tags.has(i.id) && !i.listenForAt ? { ...i, listenForAt: tags.get(i.id) } : i)) })),
      })
      return todo.length
    })
  }

  // ── release four: words on tap, before and after a concert, a composer ──

  /**
   * A term from the notes, defined in two lines (Haiku) — once per term and
   * language, kept (`term:<lang>:<term>`) and shown wherever it recurs.
   * `sentence` is where it was tapped, so the sense meant is chosen.
   */
  define(term: string, sentence: string): Promise<string> {
    const t = term.trim().toLowerCase()
    return this.once(`define:${t}`, async () => {
      const { language } = await this.repo.preferences()
      const id = termMark(t, language)
      const kept = (await this.repo.marks.get(id))?.value as { definition?: string } | undefined
      if (kept?.definition) return kept.definition
      const generation = this.repo.generation
      const res = await this.curator.call<DefineResponse>('define', { language, term: t, sentence })
      this.stillCurrent(generation)
      await this.repo.marks.put({ id, at: this.stamp(), value: { definition: res.definition, promptVersion: res.promptVersion } })
      return res.definition
    })
  }

  /** A term's definition if it was ever asked for: shown without a call. */
  async definition(term: string): Promise<string | undefined> {
    const { language } = await this.repo.preferences()
    return ((await this.repo.marks.get(termMark(term, language)))?.value as { definition?: string } | undefined)?.definition
  }

  /** Mark a concert from Live in Bucharest as one the listener is going to — or take the mark back. */
  async goingTo(event: LiveEvent, on: boolean): Promise<void> {
    const key = goingKey(event)
    if (!on) { await this.repo.marks.delete(`going:${key}`); return }
    const was = await this.repo.marks.get(`going:${key}`)
    const going: Going = { key, event, markedAt: (was?.value as Going | undefined)?.markedAt ?? this.stamp() }
    await this.repo.marks.put({ id: `going:${key}`, at: this.stamp(), value: going })
  }

  /** Every concert marked as one the listener is going to, soonest first. */
  async goings(): Promise<Going[]> {
    return (await this.repo.marks.all())
      .filter((m) => m.id.startsWith('going:'))
      .map((m) => m.value as Going)
      .filter((g) => g?.event?.date)
      .sort((a, b) => a.event.date.localeCompare(b.event.date))
  }

  /** The preparation for a marked concert, if it was ever written. */
  async preparation(key: string): Promise<PrepareResponse | undefined> {
    return (await this.repo.marks.get(`prepare:${key}`))?.value as PrepareResponse | undefined
  }

  /**
   * Before a concert: its programme read from the hall's listing, a few lines
   * on each work, a recording to hear first, and what to listen for in the
   * hall (Sonnet, once per concert, kept as `prepare:<key>`). The same reading
   * fills the concert entry afterwards.
   */
  prepare(key: string): Promise<PrepareResponse> {
    return this.once(`prepare:${key}`, async () => {
      const kept = await this.preparation(key)
      if (kept) return kept
      const going = (await this.repo.marks.get(`going:${key}`))?.value as Going | undefined
      if (!going) throw new NotFound(`no concert marked ${key}`)
      const generation = this.repo.generation
      const [programmes, events, profile, { language }] = await Promise.all([this.repo.programmes.all(), this.repo.events.all(), this.repo.taste(), this.repo.preferences()])
      const heard = new Set(events.filter((e) => e.kind === 'heard').map((e) => e.workId))
      const met = new Map<string, { composer: string; work: string }>()
      for (const i of programmes.flatMap((p) => p.sections.flatMap((x) => x.items))) if (heard.has(i.workId)) met.set(i.workId, { composer: i.proposed.composer, work: i.proposed.work })
      const { venue, title, date, time, hall, description } = going.event
      const res = await this.curator.call<PrepareResponse>('prepare', {
        language,
        event: { venue, title, date, time, hall, description },
        heardBefore: [...met.values()].slice(-40),
        taste: profile.observations.filter((o) => !o.supersededBy).map((o) => o.statement).slice(0, 12),
      })
      this.stillCurrent(generation)
      await this.repo.marks.put({ id: `prepare:${key}`, at: this.stamp(), value: res })
      return res
    })
  }

  /** The concert kept from a marked one: the mark has done its work, and its card goes. */
  async concertKept(key: string, concertId: string): Promise<void> {
    const m = await this.repo.marks.get(`going:${key}`)
    if (m) await this.repo.marks.put({ ...m, value: { ...(m.value as Going), concertId } })
  }

  /** A composer's portrait, if it was ever written. */
  async portraitOf(composer: string): Promise<PortraitResponse | undefined> {
    const { language } = await this.repo.preferences()
    return (await this.repo.marks.get(`portrait:${language}:${fold(composer)}`))?.value as PortraitResponse | undefined
  }

  /** A composer's portrait for their page (Haiku), written once per composer and language and kept. */
  portrait(composer: string, met: string[]): Promise<PortraitResponse> {
    return this.once(`portrait:${fold(composer)}`, async () => {
      const kept = await this.portraitOf(composer)
      if (kept) return kept
      const { language } = await this.repo.preferences()
      const generation = this.repo.generation
      const res = await this.curator.call<PortraitResponse>('portrait', { language, composer, met: met.slice(0, 20) })
      this.stillCurrent(generation)
      await this.repo.marks.put({ id: `portrait:${language}:${fold(composer)}`, at: this.stamp(), value: res })
      return res
    })
  }

  /** A second interpretation of an item's work, set beside the one in the programme. */
  compare(programmeId: string, itemId: string, opts: { mustBeOnSpotify?: boolean; spotifyCandidates?: SpotifyCandidate[] } = {}): Promise<Comparison> {
    const id = `cmp:${programmeId}:${itemId}`
    return this.once(id, async () => {
      const cached = await this.repo.comparisons.get(id)
      if (cached) return cached
      const generation = this.repo.generation
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
      // A second perspective on a journey cleared meanwhile would bring its work and recordings back.
      this.stillCurrent(generation)
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
