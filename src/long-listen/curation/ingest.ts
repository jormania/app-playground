import type {
  Artist, ArtistKind, Comparison, Programme, ProgrammeItem, ProgrammeSection, ProposedRecording, Recording, Work,
} from '../domain/types'
import { artistId, newId, recordingId as makeRecordingId, sameWork, workId as makeWorkId } from '../domain/identity'
import type { Repo } from '../store/repo'
import type { CuratedComparison, CuratedItem, CuratedPerformers, CuratedProgramme } from './api'

/**
 * Turn the curator's answer into the knowledge model.
 *
 * A Work the listener met in March and meets again in October is one Work; a
 * Boulez recording proposed twice is one Recording, with its listening history
 * intact. New things are added; nothing already known is rewritten except to
 * fill a gap (a catalogue number or a date the first proposal left out). The
 * Programme itself is a new, immutable snapshot every time.
 */
export class Ingest {
  private works: Work[] = []
  private readonly newWorks = new Map<string, Work>()
  private readonly artists = new Map<string, Artist>()
  private readonly recordings = new Map<string, Recording>()

  constructor(private readonly repo: Repo) {}

  async load(): Promise<this> {
    this.works = await this.repo.works.all()
    return this
  }

  private artist(kind: ArtistKind, name: string, instrument?: string): string {
    const id = artistId(kind, name)
    if (!this.artists.has(id)) this.artists.set(id, { id, name, kind, instrument })
    return id
  }

  /** Find the work this names, or make it. */
  work(composer: string, title: string, extra: Partial<Work> = {}): Work {
    const composerId = this.artist('composer', composer)
    const pool = [...this.works, ...this.newWorks.values()]
    // Composer ids are derived from the folded name, so one composer is one id.
    const existing = pool.find((w) =>
      w.composerId === composerId
      && sameWork({ composer, title: w.title, catalogue: w.catalogue }, { composer, title, catalogue: extra.catalogue }))
    if (existing) {
      const filled: Work = {
        ...existing,
        catalogue: existing.catalogue ?? extra.catalogue,
        composed: existing.composed ?? extra.composed,
        form: existing.form ?? extra.form,
        context: existing.context ?? extra.context,
      }
      this.newWorks.set(filled.id, filled)
      return filled
    }
    const w: Work = { id: makeWorkId(composer, title), composerId, title, ...strip(extra) }
    this.newWorks.set(w.id, w)
    return w
  }

  async recording(work: Work, p: CuratedPerformers, character: string[]): Promise<Recording> {
    const id = makeRecordingId(work.id, p)
    const pending = this.recordings.get(id) ?? (await this.repo.recordings.get(id))
    if (pending) {
      this.recordings.set(id, pending)
      return pending
    }
    const r: Recording = {
      id,
      workId: work.id,
      conductorId: p.conductor ? this.artist('conductor', p.conductor) : undefined,
      orchestraId: p.orchestra ? this.artist('orchestra', p.orchestra) : undefined,
      ensembleId: p.ensemble ? this.artist('ensemble', p.ensemble) : undefined,
      soloistIds: p.soloists.map((s) => this.artist('soloist', s.name, s.instrument)),
      proposedYear: p.year,
      character,
      verification: 'unchecked',
    }
    this.recordings.set(id, r)
    return r
  }

  /** Write everything gathered. Existing artists are left as they are. */
  async commit(): Promise<void> {
    const existingArtists = new Set((await this.repo.artists.all()).map((a) => a.id))
    await this.repo.artists.putMany([...this.artists.values()].filter((a) => !existingArtists.has(a.id)))
    await this.repo.works.putMany([...this.newWorks.values()])
    await this.repo.recordings.putMany([...this.recordings.values()])
  }
}

function strip<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '')) as T
}

export function proposedOf(composer: string, work: string, catalogue: string | undefined, p: CuratedPerformers): ProposedRecording {
  return strip({
    composer,
    work,
    catalogue,
    conductor: p.conductor,
    orchestra: p.orchestra,
    ensemble: p.ensemble,
    soloists: p.soloists.map((s) => strip({ name: s.name, instrument: s.instrument })),
    year: p.year,
  }) as ProposedRecording
}

export interface IngestProgrammeInput {
  weekKey: string
  optionId: string
  themeId: string
  explorationId: string
  stage: number
  /** "More of this theme": the week's programme this one continues. */
  extendsId?: string
  curated: CuratedProgramme
  promptVersion: string
  model: string
  now: string
}

async function itemOf(ingest: Ingest, c: CuratedItem): Promise<ProgrammeItem> {
  const work = ingest.work(c.composer, c.workTitle, { catalogue: c.catalogue, composed: c.composed, form: c.form, context: c.workContext })
  const rec = await ingest.recording(work, c, c.character)
  return strip({
    id: newId('item'),
    workId: work.id,
    recordingId: rec.id,
    proposed: proposedOf(c.composer, c.workTitle, c.catalogue, c),
    why: c.why,
    whyThisRecording: c.whyThisRecording,
    listenFor: c.listenFor,
    revisitReason: c.revisitReason,
  }) as ProgrammeItem
}

export async function comparisonOf(
  ingest: Ingest,
  c: CuratedComparison,
  origin: Comparison['origin'],
  now: string,
): Promise<Comparison> {
  const work = ingest.work(c.composer, c.workTitle, { catalogue: c.catalogue })
  const perspectives = []
  for (const p of c.perspectives) {
    const rec = await ingest.recording(work, p, p.character ? [p.character] : [])
    perspectives.push(strip({ recordingId: rec.id, proposed: proposedOf(c.composer, c.workTitle, c.catalogue, p), character: p.character, listenFor: p.listenFor }))
  }
  return { id: newId('cmp'), workId: work.id, framing: c.framing, whyBoth: c.whyBoth, perspectives: perspectives as Comparison['perspectives'], origin, createdAt: now }
}

/** Ingest a curated programme. Returns the snapshot and its comparisons; writes nothing yet but entities. */
export async function ingestProgramme(repo: Repo, input: IngestProgrammeInput): Promise<{ programme: Programme; comparisons: Comparison[] }> {
  const ingest = await new Ingest(repo).load()
  const sections: ProgrammeSection[] = []
  for (const s of input.curated.sections) {
    const items: ProgrammeItem[] = []
    for (const c of s.items) items.push(await itemOf(ingest, c))
    sections.push(strip({ id: newId('sec'), role: s.role, heading: s.heading, note: s.note, items }) as ProgrammeSection)
  }
  const comparisons: Comparison[] = []
  for (const c of input.curated.comparisons) comparisons.push(await comparisonOf(ingest, c, 'programme', input.now))
  await ingest.commit()

  const programme: Programme = strip({
    id: newId('prog'),
    weekKey: input.weekKey,
    optionId: input.optionId,
    themeId: input.themeId,
    explorationId: input.explorationId,
    stage: input.stage,
    title: input.curated.title,
    dek: input.curated.dek,
    introduction: input.curated.introduction,
    whyNow: input.curated.whyNow,
    historicalPlace: input.curated.historicalPlace,
    howTheyRelate: input.curated.howTheyRelate,
    continuityNote: input.curated.continuityNote,
    extends: input.extendsId,
    sections,
    comparisonIds: comparisons.map((c) => c.id),
    createdAt: input.now,
    promptVersion: input.promptVersion,
    model: input.model,
  }) as Programme
  return { programme, comparisons }
}
