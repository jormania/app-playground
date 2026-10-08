import type { Feedback, ListeningEvent, NotionDatabases, Programme, Recording, TasteProfile, Theme, ThemeExploration } from '../domain/types'
import { creditLine } from '../domain/identity'
import { latestFeedback, listeningState, reactionLabel } from '../domain/listening'
import { weekFromKey } from '../domain/week'
import type { Repo } from '../store/repo'
import type { CuratorClient } from '../curation/api'
import { observationsByStance } from '../curation/taste'

/**
 * Notion as the listener's notebook: a human-readable mirror of the journey,
 * one way, app → Notion. The app's own database (IndexedDB) stays the source
 * of truth; Notion holds what a person would want to reread, in words —
 *
 *   Journal            one page per weekly programme, written once, as the
 *                      curator wrote it, plus what was heard and said
 *   Listening threads  one page per theme: how it landed, open questions,
 *                      where it could go next
 *   Works & recordings one row per recording met: who plays it, a Spotify
 *                      link, where it stands, the reaction, the notes
 *   Musical taste      one page, rewritten from the taste observations
 *
 * Nothing internal crosses: no ids, prompt versions or match confidences.
 * Writes go through /api/long-listen's Notion route, which holds the token and
 * only allows these shapes under the one configured page.
 */
type Call = { path: string; method: 'GET' | 'POST' | 'PATCH'; body?: unknown }

async function notion<T = Record<string, unknown>>(curator: CuratorClient, call: Call): Promise<T> {
  return curator.call<T>('notion', call)
}

// ── Notion block helpers ──────────────────────────────────────────────────

/** Notion caps a rich-text item at 2000 characters. */
export function richText(text: string, opts: { italic?: boolean; bold?: boolean; link?: string } = {}) {
  const chunks: string[] = []
  for (let i = 0; i < text.length; i += 1900) chunks.push(text.slice(i, i + 1900))
  return (chunks.length ? chunks : ['']).map((content) => ({
    type: 'text',
    text: { content, ...(opts.link ? { link: { url: opts.link } } : {}) },
    annotations: { italic: Boolean(opts.italic), bold: Boolean(opts.bold) },
  }))
}

const para = (text: string, opts?: { italic?: boolean }) => ({ object: 'block', type: 'paragraph', paragraph: { rich_text: richText(text, opts) } })
const h2 = (text: string) => ({ object: 'block', type: 'heading_2', heading_2: { rich_text: richText(text) } })
const h3 = (text: string) => ({ object: 'block', type: 'heading_3', heading_3: { rich_text: richText(text) } })
const bullet = (text: string, link?: string) => ({ object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: richText(text, { link }) } })
const quote = (text: string) => ({ object: 'block', type: 'quote', quote: { rich_text: richText(text) } })
const divider = () => ({ object: 'block', type: 'divider', divider: {} })

const paragraphs = (text: string) => text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map((p) => para(p))

/** Short stable hash, to skip rewriting what hasn't changed. */
export function hash(value: unknown): string {
  const s = JSON.stringify(value)
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

// ── setup ─────────────────────────────────────────────────────────────────

const STATE_LABEL: Record<string, string> = { 'not-started': 'Not started', listening: 'Listening', heard: 'Heard', skipped: 'Skipped' }

function titleProp(text: string) { return { title: richText(text) } }
function textProp(text: string) { return { rich_text: richText(text.slice(0, 1900)) } }
function selectProp(name?: string) { return { select: name ? { name } : null } }

export async function ensureSetup(curator: CuratorClient, repo: Repo, pageId: string): Promise<NotionDatabases> {
  const mark = await repo.marks.get('notion:setup')
  const existing = mark?.value as (NotionDatabases & { pageId: string }) | undefined
  if (existing && existing.pageId === pageId) return existing

  const parent = { type: 'page_id', page_id: pageId }
  const db = async (title: string, properties: Record<string, unknown>) =>
    (await notion<{ id: string }>(curator, { path: 'databases', method: 'POST', body: { parent, title: richText(title), properties } })).id

  const journal = await db('The Long Listen — Journal', {
    Name: { title: {} },
    Week: { rich_text: {} },
    Theme: { rich_text: {} },
    Visit: { number: {} },
    Status: { select: { options: [{ name: 'This week' }, { name: 'Earlier' }, { name: 'Set aside' }] } },
    Heard: { rich_text: {} },
    Notes: { rich_text: {} },
  })
  const threads = await db('The Long Listen — Listening threads', {
    Name: { title: {} },
    'First explored': { rich_text: {} },
    Visits: { number: {} },
    'How it landed': { rich_text: {} },
    'Open questions': { rich_text: {} },
    'Where next': { rich_text: {} },
    Nearby: { rich_text: {} },
  })
  const recordings = await db('The Long Listen — Works & recordings', {
    Name: { title: {} },
    Composer: { rich_text: {} },
    Performers: { rich_text: {} },
    Spotify: { url: {} },
    Listening: { select: { options: Object.values(STATE_LABEL).map((name) => ({ name })) } },
    Reaction: { select: { options: ['Loved it', 'Liked it', 'Interesting', 'Not for me', 'Too difficult'].map((name) => ({ name })) } },
    Notes: { rich_text: {} },
    Programme: { rich_text: {} },
  })
  const tastePage = (await notion<{ id: string }>(curator, {
    path: 'pages',
    method: 'POST',
    body: { parent, properties: { title: { title: richText('The Long Listen — Musical taste') } } },
  })).id

  const dbs = { journal, threads, recordings, tastePage, pageId }
  await repo.marks.put({ id: 'notion:setup', at: new Date().toISOString(), value: dbs })
  return dbs
}

// ── page content ──────────────────────────────────────────────────────────

export function programmeBlocks(p: Programme, resources: { kind: string; title: string; url: string; source: string; purpose: string }[]): unknown[] {
  const blocks: unknown[] = []
  if (p.dek) blocks.push(quote(p.dek))
  if (p.continuityNote) blocks.push(para(p.continuityNote, { italic: true }))
  blocks.push(...paragraphs(p.introduction))
  if (p.whyNow) blocks.push(h3('Why this, now'), para(p.whyNow))
  if (p.historicalPlace) blocks.push(h3('Where it sits'), para(p.historicalPlace))
  if (p.howTheyRelate) blocks.push(h3('How the works speak to each other'), para(p.howTheyRelate))
  for (const s of p.sections) {
    blocks.push(divider(), h2(s.heading))
    if (s.note) blocks.push(para(s.note, { italic: true }))
    for (const i of s.items) {
      blocks.push(h3(`${i.proposed.composer} — ${i.proposed.work}`), para(creditLine(i.proposed), { italic: true }), para(i.why))
      if (i.whyThisRecording) blocks.push(para(`Why this recording: ${i.whyThisRecording}`))
      for (const l of i.listenFor) blocks.push(bullet(`Listen for: ${l}`))
    }
  }
  if (resources.length) {
    blocks.push(divider(), h2('Further listening and reading'))
    for (const r of resources) blocks.push(bullet(`${r.kind[0].toUpperCase()}${r.kind.slice(1)} — ${r.title} (${r.source}). ${r.purpose}`, r.url))
  }
  return blocks
}

export function tasteBlocks(t: TasteProfile): unknown[] {
  const groups = observationsByStance(t)
  const out: unknown[] = [para('What the curator has come to understand about your listening. Written in words on purpose: taste is not a score.', { italic: true })]
  const titles: Record<string, string> = { 'drawn-to': 'Drawn to', 'curious-about': 'Curious about', mixed: 'Mixed feelings', 'wary-of': 'Wary of' }
  for (const [stance, list] of Object.entries(groups)) {
    if (!list.length) continue
    out.push(h2(titles[stance]))
    for (const o of list) out.push(bullet(`${o.statement}${o.confidence === 'tentative' ? ' (a first impression)' : ''}`))
  }
  if (t.questions.length) {
    out.push(h2('Questions you seem to be asking'))
    for (const q of t.questions) out.push(bullet(q))
  }
  if (t.notesToCurator) out.push(h2('Your notes to the curator'), ...paragraphs(t.notesToCurator))
  return out
}

async function append(curator: CuratorClient, blockId: string, children: unknown[]) {
  for (let i = 0; i < children.length; i += 90) {
    await notion(curator, { path: `blocks/${blockId}/children`, method: 'PATCH', body: { children: children.slice(i, i + 90) } })
  }
}

async function upsert(curator: CuratorClient, repo: Repo, key: string, databaseId: string, properties: Record<string, unknown>, body?: () => unknown[]): Promise<boolean> {
  const h = hash(properties)
  const state = await repo.notion.get(key)
  if (state?.hash === h) return false
  if (state) {
    await notion(curator, { path: `pages/${state.pageId}`, method: 'PATCH', body: { properties } })
  } else {
    const page = await notion<{ id: string }>(curator, { path: 'pages', method: 'POST', body: { parent: { database_id: databaseId }, properties } })
    if (body) await append(curator, page.id, body())
    await repo.notion.put({ key, pageId: page.id, hash: h, syncedAt: new Date().toISOString() })
    return true
  }
  await repo.notion.put({ key, pageId: state.pageId, hash: h, syncedAt: new Date().toISOString() })
  return true
}

// ── sync ──────────────────────────────────────────────────────────────────

export interface SyncReport { written: number }

export async function syncToNotion(curator: CuratorClient, repo: Repo, pageId: string, currentWeek: string): Promise<SyncReport> {
  const dbs = await ensureSetup(curator, repo, pageId)
  const [programmes, themes, explorations, recordings, events, feedback, resources, weeks, taste] = await Promise.all([
    repo.programmes.all(), repo.themes.all(), repo.explorations.all(), repo.recordings.all(), repo.events.all(), repo.feedback.all(), repo.resources.all(), repo.weeks.all(), repo.taste(),
  ])
  const setAside = new Set(weeks.flatMap((w) => w.setAsideProgrammeIds))
  const themeTitle = new Map(themes.map((t) => [t.id, t.title]))
  let written = 0

  for (const p of programmes.sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    written += Number(await upsert(curator, repo, `programme:${p.id}`, dbs.journal, journalProps(p, themeTitle.get(p.themeId) ?? '', events, feedback, setAside.has(p.id), currentWeek),
      () => programmeBlocks(p, resources.filter((r) => r.programmeId === p.id))))
  }
  for (const t of themes) {
    written += Number(await upsert(curator, repo, `theme:${t.id}`, dbs.threads, threadProps(t, explorations)))
  }
  const recById = new Map(recordings.map((r) => [r.id, r]))
  const met = new Map<string, { proposed: Programme['sections'][number]['items'][number]['proposed']; programme: Programme }>()
  for (const p of programmes) for (const i of p.sections.flatMap((s) => s.items)) if (!met.has(i.recordingId)) met.set(i.recordingId, { proposed: i.proposed, programme: p })
  for (const [rid, { proposed, programme }] of met) {
    written += Number(await upsert(curator, repo, `recording:${rid}`, dbs.recordings, recordingProps(proposed, recById.get(rid), programme, events, feedback)))
  }

  // The taste page is rewritten whole when it changes.
  const tasteHash = hash({ o: taste.observations.filter((o) => !o.supersededBy).map((o) => [o.statement, o.stance, o.confidence]), q: taste.questions, n: taste.notesToCurator })
  const tasteState = await repo.notion.get('taste')
  if (tasteState?.hash !== tasteHash) {
    const children = await notion<{ results: { id: string }[] }>(curator, { path: `blocks/${dbs.tastePage}/children?page_size=100`, method: 'GET' })
    for (const b of children.results ?? []) await notion(curator, { path: `blocks/${b.id}`, method: 'PATCH', body: { archived: true } })
    await append(curator, dbs.tastePage, tasteBlocks(taste))
    await repo.notion.put({ key: 'taste', pageId: dbs.tastePage, hash: tasteHash, syncedAt: new Date().toISOString() })
    written++
  }
  await repo.marks.put({ id: 'notion:last-sync', at: new Date().toISOString() })
  return { written }
}

export function journalProps(p: Programme, theme: string, events: ListeningEvent[], feedback: Feedback[], setAside: boolean, currentWeek: string) {
  const items = p.sections.flatMap((s) => s.items)
  const heard = items.filter((i) => listeningState(events, i.recordingId) === 'heard').map((i) => `${i.proposed.composer.split(' ').slice(-1)[0]} — ${i.proposed.work}`)
  const notes = [...latestFeedback(feedback, p.id).notes, ...items.flatMap((i) => latestFeedback(feedback, i.recordingId).notes)]
  return {
    Name: titleProp(p.title),
    Week: textProp(`${p.weekKey} · ${weekFromKey(p.weekKey).label}`),
    Theme: textProp(theme),
    Visit: { number: p.stage },
    Status: selectProp(setAside ? 'Set aside' : p.weekKey === currentWeek ? 'This week' : 'Earlier'),
    Heard: textProp(heard.join('; ')),
    Notes: textProp(notes.join(' / ')),
  }
}

export function threadProps(t: Theme, explorations: ThemeExploration[]) {
  const visits = explorations.filter((e) => e.themeId === t.id && !e.setAside).length
  return {
    Name: titleProp(t.title),
    'First explored': textProp(weekFromKey(t.firstIntroduced).label),
    Visits: { number: visits },
    'How it landed': textProp(t.reaction ?? ''),
    'Open questions': textProp(t.openQuestions.join(' / ')),
    'Where next': textProp(t.nextDirections.join(' / ')),
    Nearby: textProp(t.adjacentTopics.join(' / ')),
  }
}

export function recordingProps(proposed: Programme['sections'][number]['items'][number]['proposed'], r: Recording | undefined, programme: Programme, events: ListeningEvent[], feedback: Feedback[]) {
  const rid = r?.id ?? ''
  const fb = latestFeedback(feedback, rid)
  const link = r?.spotify?.trackIds[0] ? `https://open.spotify.com/track/${r.spotify.trackIds[0]}` : null
  return {
    Name: titleProp(`${proposed.composer} — ${proposed.work}`),
    Composer: textProp(proposed.composer),
    Performers: textProp(creditLine(proposed)),
    Spotify: { url: link },
    Listening: selectProp(STATE_LABEL[listeningState(events, rid)]),
    Reaction: selectProp(reactionLabel(fb.reaction)),
    Notes: textProp(fb.notes.join(' / ')),
    Programme: textProp(`${programme.title} (${programme.weekKey})`),
  }
}
