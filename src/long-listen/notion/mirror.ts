import type { Comparison, Concert, Feedback, ListeningEvent, NotionDatabases, NotionSyncState, Programme, Recording, TasteProfile, Theme, ThemeExploration } from '../domain/types'
import { creditLine, displaySurname, sameWork } from '../domain/identity'
import { latestFeedback, listeningState, reactionLabel } from '../domain/listening'
import { weekFromKey } from '../domain/week'
import type { Repo } from '../store/repo'
import { notionProxy } from '../../shared/notionClient'
import type { ListenerPreferences } from '../domain/types'
import { observationsByStance } from '../curation/taste'
import { unplaced, whoPlays } from '../domain/concertSoloists'
import { heardAs, itemFeedback, standInsOf } from '../domain/standIns'
import { groupByComposer } from '../domain/composerGroups'
import { BREADTH, FAMILIARITY, TIME } from '../domain/exploration'
import { setAsideProgrammes } from '../domain/library'

/**
 * Notion as the listener's notebook: a human-readable mirror of the journey,
 * one way, app → Notion. The app's own database (IndexedDB) stays the source
 * of truth; Notion holds what a person would want to reread, in words —
 *
 *   Journal            one page per weekly programme: the curator's text,
 *                      written once (a programme is a snapshot), and below
 *                      it the further listening and reading, which arrives
 *                      later and is kept up to date; plus what was heard and
 *                      said, in the row's columns
 *   Listening threads  one page per theme: how it landed, open questions,
 *                      where it could go next
 *   Works & recordings one row per recording met: who plays it, a Spotify
 *                      link, where it stands, the reaction, the notes
 *   Musical taste      one page, rewritten from the taste observations
 *
 * Nothing internal crosses: no ids, prompt versions or match confidences.
 * Writes go through the shared /api/notion relay with the listener's own token.
 */
export type Call = { path: string; method: 'GET' | 'POST' | 'PATCH'; body?: unknown }

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

// ── who makes the calls ───────────────────────────────────────────────────

/** One Notion API call, made with the listener's own token through the shared /api/notion relay. */
export type NotionCall = <T = Record<string, unknown>>(call: Call) => Promise<T>

export function relayCaller(token: string): NotionCall {
  return async <T,>(c: Call) => (await notionProxy(token, c.path, c.method, c.body)) as T
}

/**
 * Notion's answer for a page or database that is no longer there to edit: the
 * listener deleted it (it sits archived in the trash), or it is gone for good.
 * Not a reason to stop: the row is written afresh.
 */
export function isGone(e: unknown): boolean {
  // Notion's own words, not a bare 404: the relay missing (the dev server) is not a deleted page.
  return /archived|could not find|object_not_found/i.test(e instanceof Error ? e.message : String(e))
}

// ── the notebook's shape ──────────────────────────────────────────────────

const STATE_LABEL: Record<string, string> = { 'not-started': 'Not started', listening: 'Started', heard: 'Heard', skipped: 'Skipped' }
const REACTION_NAMES = ['Loved it', 'Liked it', 'Interesting', 'Not for me', 'Too difficult']

export type DbRole = 'journal' | 'threads' | 'recordings' | 'composers' | 'concerts'

/**
 * Each database the notebook holds: the title it is found by (any title that
 * ENDS with this — "Journal", "The Long Listen — Journal" — counts, so a
 * duplicated Starter Template works as it is) and its columns.
 */
export const DATABASES: Record<DbRole, { title: string; properties: Record<string, unknown> }> = {
  journal: {
    title: 'Journal',
    properties: {
      Name: { title: {} },
      Week: { rich_text: {} },
      Theme: { rich_text: {} },
      Visit: { number: {} },
      Status: { select: { options: [{ name: 'This week' }, { name: 'Earlier' }, { name: 'Set aside' }] } },
      Heard: { rich_text: {} },
      Notes: { rich_text: {} },
    },
  },
  threads: {
    title: 'Listening threads',
    properties: {
      Name: { title: {} },
      'First explored': { rich_text: {} },
      Visits: { number: {} },
      'How it landed': { rich_text: {} },
      'Open questions': { rich_text: {} },
      'Where next': { rich_text: {} },
      Nearby: { rich_text: {} },
    },
  },
  recordings: {
    title: 'Works & recordings',
    properties: {
      Name: { title: {} },
      Composer: { rich_text: {} },
      Performers: { rich_text: {} },
      Spotify: { url: {} },
      Listening: { select: { options: Object.values(STATE_LABEL).map((name) => ({ name })) } },
      Reaction: { select: { options: REACTION_NAMES.map((name) => ({ name })) } },
      Notes: { rich_text: {} },
      Programme: { rich_text: {} },
    },
  },
  composers: {
    title: 'Composers',
    properties: {
      Name: { title: {} },
      Works: { rich_text: {} },
      Recordings: { rich_text: {} },
      'First met': { rich_text: {} },
      'How it went': { rich_text: {} },
    },
  },
  concerts: {
    title: 'Concerts',
    properties: {
      Name: { title: {} },
      Date: { date: {} },
      Venue: { rich_text: {} },
      Performers: { rich_text: {} },
      Works: { rich_text: {} },
      Notes: { rich_text: {} },
    },
  },
}
export const TASTE_PAGE_TITLE = 'Musical taste'

function titleProp(text: string) { return { title: richText(text) } }
function textProp(text: string) { return { rich_text: richText(text.slice(0, 1900)) } }
function selectProp(name?: string) { return { select: name ? { name } : null } }

const endsWith = (title: string, wanted: string) => title.trim().toLowerCase().endsWith(wanted.toLowerCase())

export interface Discovered {
  databases: Partial<Record<DbRole, string>>
  tastePage?: string
}

/** Find the notebook's databases and taste page among the page's children, by title. */
export async function discover(call: NotionCall, pageId: string): Promise<Discovered> {
  const out: Discovered = { databases: {} }
  let cursor: string | undefined
  for (let page = 0; page < 5; page++) {
    const res = await call<{ results?: Record<string, any>[]; has_more?: boolean; next_cursor?: string }>({
      path: `blocks/${pageId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`,
      method: 'GET',
    })
    for (const b of res.results ?? []) {
      if (b.type === 'child_database') {
        const title = String(b.child_database?.title ?? '')
        for (const role of Object.keys(DATABASES) as DbRole[]) {
          if (!out.databases[role] && endsWith(title, DATABASES[role].title)) out.databases[role] = b.id
        }
      } else if (b.type === 'child_page' && !out.tastePage && endsWith(String(b.child_page?.title ?? ''), TASTE_PAGE_TITLE)) {
        out.tastePage = b.id
      }
    }
    if (!res.has_more || !res.next_cursor) break
    cursor = res.next_cursor
  }
  return out
}

export interface NotebookCheck {
  ok: boolean
  message: string
  found: DbRole[]
  missing: DbRole[]
  tastePage: boolean
  /** Columns a found database lacks: "Journal: Visit". */
  missingColumns: string[]
}

const ROLE_LABEL: Record<DbRole, string> = { journal: 'Journal', threads: 'Listening threads', recordings: 'Works & recordings', composers: 'Composers', concerts: 'Concerts' }

/** Settings → "Test Notion": reads, never writes. */
export async function checkNotebook(call: NotionCall, pageId: string): Promise<NotebookCheck> {
  if (!pageId) return { ok: false, message: 'Add the link to your notebook page first.', found: [], missing: [], tastePage: false, missingColumns: [] }
  try {
    await call({ path: `pages/${pageId}`, method: 'GET' })
  } catch (e) {
    return { ok: false, message: `Notion couldn’t open that page: ${(e as Error).message}. Is it shared with your integration (••• → Connections)?`, found: [], missing: [], tastePage: false, missingColumns: [] }
  }
  const d = await discover(call, pageId)
  const found = (Object.keys(DATABASES) as DbRole[]).filter((r) => d.databases[r])
  const missing = (Object.keys(DATABASES) as DbRole[]).filter((r) => !d.databases[r])
  const missingColumns: string[] = []
  for (const role of found) {
    try {
      const db = await call<{ properties?: Record<string, unknown>; title?: unknown }>({ path: `databases/${d.databases[role]}`, method: 'GET' })
      const have = new Set(Object.keys(db.properties ?? {}))
      for (const name of Object.keys(DATABASES[role].properties)) {
        if (name !== 'Name' && !have.has(name)) missingColumns.push(`${ROLE_LABEL[role]}: ${name}`)
      }
    } catch {
      missingColumns.push(`${ROLE_LABEL[role]}: can’t be read`)
    }
  }
  const ok = missingColumns.length === 0
  const message = !ok
    ? `Connected, but some columns are missing — ${missingColumns.join(', ')}.`
    : missing.length === 0
      ? 'Connected. Your notebook is ready.'
      : `Connected. ${missing.map((m) => ROLE_LABEL[m]).join(', ')} ${missing.length === 1 ? 'isn’t' : 'aren’t'} there yet — the first update creates ${missing.length === 1 ? 'it' : 'them'}.`
  return { ok, message, found, missing, tastePage: Boolean(d.tastePage), missingColumns }
}

/** The notebook's databases on this page — found, or created where missing. */
export async function ensureSetup(call: NotionCall, repo: Repo, pageId: string): Promise<NotionDatabases & { composers: string; concerts: string }> {
  const mark = await repo.marks.get('notion:setup')
  const cached = mark?.value as (NotionDatabases & { composers: string; concerts: string; pageId: string }) | undefined
  // A setup from before a database was added (Composers, then Concerts) is looked at again, and the new one made.
  if (cached && cached.pageId === pageId && cached.composers && cached.concerts) return cached
  // Another notebook than the one written to: every row's state points into the old one, and with its hash
  // unchanged nothing would be written here — the new notebook would stay empty while edits went to the old.
  // Forgotten, every row (and the taste page) is written afresh into this one.
  if (cached && cached.pageId !== pageId) {
    for (const st of await repo.notion.all()) await repo.notion.delete(st.key)
  }

  const parent = { type: 'page_id', page_id: pageId }
  const d = await discover(call, pageId)
  const ids = {} as Record<DbRole, string>
  for (const role of Object.keys(DATABASES) as DbRole[]) {
    ids[role] = d.databases[role] ?? (await call<{ id: string }>({
      path: 'databases',
      method: 'POST',
      body: { parent, title: richText(DATABASES[role].title), properties: DATABASES[role].properties },
    })).id
  }
  const tastePage = d.tastePage ?? (await call<{ id: string }>({
    path: 'pages',
    method: 'POST',
    body: { parent, properties: { title: { title: richText(TASTE_PAGE_TITLE) } } },
  })).id

  const dbs = { ...ids, tastePage, pageId }
  await repo.marks.put({ id: 'notion:setup', at: new Date().toISOString(), value: dbs })
  return dbs
}

// ── page content ──────────────────────────────────────────────────────────

type ResourceLike = { kind: string; title: string; url: string; source: string; purpose: string }

/** A programme's page: the curator's text, then the further reading. */
export function programmeBlocks(p: Programme, resources: ResourceLike[]): unknown[] {
  return [...programmeTextBlocks(p), ...furtherBlocks(resources)]
}

/** The curator's text — fixed once written, like the programme itself. */
export function programmeTextBlocks(p: Programme): unknown[] {
  const blocks: unknown[] = []
  if (p.dek) blocks.push(quote(p.dek))
  if (p.continuityNote) blocks.push(para(p.continuityNote, { italic: true }))
  blocks.push(...paragraphs(p.introduction))
  if (p.whyNow) blocks.push(h3('Why this, now'), para(p.whyNow))
  if (p.historicalPlace) blocks.push(h3('Where it sits'), para(p.historicalPlace))
  if (p.howTheyRelate) blocks.push(h3('How they connect'), para(p.howTheyRelate))
  for (const s of p.sections) {
    blocks.push(divider(), h2(s.heading))
    if (s.note) blocks.push(para(s.note, { italic: true }))
    for (const i of s.items) {
      blocks.push(h3(`${i.proposed.composer} — ${i.proposed.work}`), para(creditLine(i.proposed), { italic: true }), para(i.why))
      if (i.whyThisRecording) blocks.push(para(`Why this recording: ${i.whyThisRecording}`))
      for (const l of i.listenFor) blocks.push(bullet(`Listen for: ${l}`))
    }
  }
  return blocks
}

export const FURTHER_HEADING = 'Further listening and reading'

/** The part of a programme page that changes after it is first written: resources found later. */
export function furtherBlocks(resources: ResourceLike[], insteads: string[] = []): unknown[] {
  // What Spotify played where it lacked the curator's recording: the page's text names the curator's, written
  // once, so this part — rewritten as it changes — says what was really heard ("Debussy — La mer: Martinon · …").
  const instead = insteads.length ? [divider(), h3('Heard on Spotify instead'), ...insteads.map((t) => bullet(t))] : []
  if (!resources.length) return instead
  return [
    ...instead,
    divider(),
    h2(FURTHER_HEADING),
    ...resources.map((r) => bullet(`${r.kind[0].toUpperCase()}${r.kind.slice(1)} — ${r.title} (${r.source}). ${r.purpose}`, httpUrl(r.url))),
  ]
}

/** Each work of a programme that was heard through a stand-in, as one line. */
export function standInLines(p: Programme, comparisons: Comparison[]): string[] {
  return p.sections.flatMap((sec) => sec.items).flatMap((i) => {
    const c = comparisons.find((x) => x.standIn && x.id === `cmp:${p.id}:${i.id}`)
    const played = c?.perspectives[1]?.proposed
    return played ? [`${i.proposed.composer} — ${i.proposed.work}: ${creditLine(played)}`] : []
  })
}

/** Only web links go into Notion. */
function httpUrl(u: string): string | undefined {
  // Notion refuses a link with a space in it, and one over 2000 characters — refusing the whole sync with it.
  // Such a link is written as the URL parser escapes it; any other as it was, so its block isn't rewritten.
  try {
    const url = new URL(u)
    const out = /\s/.test(u) ? url.href : u
    return ['http:', 'https:'].includes(url.protocol) && out.length <= 2000 ? out : undefined
  } catch { return undefined }
}

const PREF_WORDS = {
  depth: { concise: 'short notes', standard: 'notes of usual length', deeper: 'a little more context and history' },
  recordingEra: { any: 'any era of recording', 'historic-welcome': 'great older recordings welcome, mono included', 'modern-sound': 'recordings from about 1980 on', 'period-practice': 'historically informed performances where they exist' },
} as const

/** What the listener told the curator, in words. */
export function preferenceLines(p: ListenerPreferences): string[] {
  return [
    `Time: ${TIME[p.timePerWeek].words}.`,
    `Range: ${BREADTH[p.breadth].words}.`,
    `Music: ${FAMILIARITY[p.familiarity].words}.`,
    `Pairs: ${p.pairs ? 'now and then, one work heard in two recordings side by side' : 'each work once a week, no side-by-side recordings'}.`,
    `Writing: ${PREF_WORDS.depth[p.depth]}${p.language === 'ro' ? ', in Romanian' : ''}.`,
    `Recordings: ${PREF_WORDS.recordingEra[p.recordingEra]}.`,
    `Repertoire: ${p.includeVoices ? 'works with voices welcome' : 'no works with singers'}; ${p.includeConcertos ? 'concertos welcome' : 'no concertos'}.`,
  ]
}

export function tasteBlocks(t: TasteProfile, prefs?: ListenerPreferences): unknown[] {
  const groups = observationsByStance(t)
  const out: unknown[] = [para('What the curator has come to understand about your listening. Written in words on purpose: taste is not a score.', { italic: true })]
  const titles: Record<string, string> = { 'drawn-to': 'Drawn to', 'curious-about': 'Curious about', mixed: 'Mixed feelings', 'wary-of': 'Wary of' }
  for (const [stance, list] of Object.entries(groups)) {
    if (!list.length) continue
    out.push(h2(titles[stance]))
    // As the Notebook sets it: the firmer lines first, single remarks gathered under their own small heading.
    const firm = list.filter((o) => o.confidence !== 'tentative')
    const first = list.filter((o) => o.confidence === 'tentative')
    for (const o of firm) out.push(bullet(o.statement))
    if (first.length && firm.length) out.push(h3('First impressions'))
    for (const o of first) out.push(bullet(firm.length ? o.statement : `${o.statement} (a first impression)`))
  }
  if (t.questions.length) {
    out.push(h2('Questions you seem to be asking'))
    for (const q of t.questions) out.push(bullet(q))
  }
  if (prefs) {
    out.push(h2('What you’ve told the curator'))
    for (const line of preferenceLines(prefs)) out.push(bullet(line))
  }
  if (t.notesToCurator) out.push(h2('Your notes to the curator'), ...paragraphs(t.notesToCurator))
  return out
}

/**
 * Append blocks (in chunks of 90 — Notion takes 100 at most) and return the
 * new blocks' ids. With `after`, they go in right after that block, in order,
 * instead of at the end of the page.
 */
async function append(call: NotionCall, blockId: string, children: unknown[], after?: string): Promise<string[]> {
  const ids: string[] = []
  let anchor = after
  for (let i = 0; i < children.length; i += 90) {
    const res = await call<{ results?: { id: string }[] }>({
      path: `blocks/${blockId}/children`,
      method: 'PATCH',
      body: { children: children.slice(i, i + 90), ...(anchor ? { after: anchor } : {}) },
    })
    const got = (res.results ?? []).map((b) => b.id).filter(Boolean)
    ids.push(...got)
    if (anchor && got.length) anchor = got[got.length - 1]
  }
  return ids
}

/** Every child block of a page, first-level, up to a sane limit. */
async function childrenOf(call: NotionCall, blockId: string): Promise<Record<string, any>[]> {
  const out: Record<string, any>[] = []
  let cursor: string | undefined
  for (let page = 0; page < 10; page++) {
    const res = await call<{ results?: Record<string, any>[]; has_more?: boolean; next_cursor?: string }>({
      path: `blocks/${blockId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`,
      method: 'GET',
    })
    out.push(...(res.results ?? []))
    if (!res.has_more || !res.next_cursor) break
    cursor = res.next_cursor
  }
  return out
}

const plainText = (b: Record<string, any>): string => ((b[b.type]?.rich_text ?? []) as { plain_text?: string; text?: { content?: string } }[]).map((t) => t.plain_text ?? t.text?.content ?? '').join('')

/**
 * Programme pages written before the body was tracked: find the further
 * reading section the app wrote (its divider, heading and bullets) and the
 * block just before it, so it can be replaced in place. Without one, the new
 * section goes at the end.
 */
async function legacyFurther(call: NotionCall, pageId: string): Promise<{ anchor?: string; old: string[] }> {
  const blocks = await childrenOf(call, pageId)
  const at = blocks.findIndex((b) => b.type === 'heading_2' && plainText(b) === FURTHER_HEADING)
  if (at < 0) return { anchor: undefined, old: [] }
  const start = at > 0 && blocks[at - 1].type === 'divider' ? at - 1 : at
  let end = at + 1
  while (end < blocks.length && blocks[end].type === 'bulleted_list_item') end++
  return { anchor: start > 0 ? blocks[start - 1].id : undefined, old: blocks.slice(start, end).map((b) => b.id) }
}

/**
 * One programme's journal page. The row's columns are rewritten when they
 * change. The page body has two parts: the curator's text, written once when
 * the page is created and never touched again; and the further reading,
 * which can arrive later — so its blocks are remembered, and when the list
 * changes exactly those blocks are replaced, in place, after the text.
 * Anything the listener wrote on the page in Notion is left alone.
 */
async function syncProgrammePage(call: NotionCall, repo: Repo, databaseId: string, p: Programme, properties: Record<string, unknown>, resources: ResourceLike[], insteads: string[] = []): Promise<boolean> {
  const key = `programme:${p.id}`
  const state = await repo.notion.get(key)
  try {
    return await writeProgrammePage(call, repo, databaseId, p, properties, resources, state, insteads)
  } catch (e) {
    // The listener deleted the page in Notion: write it afresh, text and all,
    // as for a new programme, rather than failing every sync after. The old
    // state is replaced only once the new page exists.
    if (!state || !isGone(e)) throw e
    return writeProgrammePage(call, repo, databaseId, p, properties, resources, undefined, insteads)
  }
}

async function writeProgrammePage(
  call: NotionCall, repo: Repo, databaseId: string, p: Programme, properties: Record<string, unknown>, resources: ResourceLike[],
  state: NotionSyncState | undefined, insteads: string[] = [],
): Promise<boolean> {
  const key = `programme:${p.id}`
  const propsHash = hash(properties)
  const further = furtherBlocks(resources, insteads)
  const bodyHash = hash(further)
  const at = new Date().toISOString()

  if (!state) {
    const page = await call<{ id: string }>({ path: 'pages', method: 'POST', body: { parent: { database_id: databaseId }, properties } })
    // Remembered at once, so a failure in what follows is finished next time rather than making a second page.
    const made = { key, pageId: page.id, hash: propsHash, bodyHash: '', bodyBlockIds: [] as string[], textPending: true, syncedAt: at }
    await repo.notion.put(made)
    const text = await append(call, page.id, programmeTextBlocks(p))
    // The text is in: said at once, so a failure with the further reading doesn't write the text twice next time.
    const written = { ...made, anchorBlockId: text[text.length - 1], textPending: false }
    await repo.notion.put(written)
    const bodyBlockIds = further.length ? await append(call, page.id, further) : []
    await repo.notion.put({ ...written, bodyHash, bodyBlockIds })
    return true
  }

  let written = false
  const next = { ...state }
  if (state.textPending) {
    const text = await append(call, state.pageId, programmeTextBlocks(p))
    next.anchorBlockId = text[text.length - 1]
    next.textPending = false
    next.bodyHash = ''
    next.bodyBlockIds = []
    await repo.notion.put({ ...next, syncedAt: at })
    written = true
  }
  if (state.hash !== propsHash) {
    await call({ path: `pages/${state.pageId}`, method: 'PATCH', body: { properties } })
    next.hash = propsHash
    written = true
  }
  if (next.bodyHash !== bodyHash) {
    let anchor = next.anchorBlockId
    let old = next.bodyBlockIds ?? []
    if (next.bodyHash === undefined) ({ anchor, old } = await legacyFurther(call, state.pageId))
    for (const id of old) {
      // Already gone (the listener deleted it in Notion) is fine.
      await call({ path: `blocks/${id}`, method: 'PATCH', body: { archived: true } }).catch(() => undefined)
    }
    let ids: string[] = []
    if (further.length) {
      // If the block it went after has been deleted, fall back to the end of the page.
      ids = await append(call, state.pageId, further, anchor).catch(() => append(call, state.pageId, further))
    }
    next.bodyHash = bodyHash
    next.bodyBlockIds = ids
    next.anchorBlockId = anchor
    if (old.length || ids.length) written = true
    else await repo.notion.put({ ...next, syncedAt: at }) // nothing to write, but remember the page is in step
  }
  if (written) await repo.notion.put({ ...next, syncedAt: at })
  return written
}

/**
 * Journal rows still marked "This week" that aren't this week's programmes are
 * set to "Earlier". Every page the app tracks is put right by its own sync; this
 * is for a row it no longer tracks — one left by a restore or a lost sync
 * state — which would otherwise say "This week" for ever (2026-10-23: week 41's
 * row beside week 43's). Status is the app's column, so correcting it is safe.
 */
async function settleStaleThisWeek(call: NotionCall, repo: Repo, databaseId: string, current: Programme[]): Promise<number> {
  const norm = (id: string) => id.replace(/-/g, '').toLowerCase()
  const keep = new Set<string>()
  for (const p of current) {
    const st = await repo.notion.get(`programme:${p.id}`)
    if (st) keep.add(norm(st.pageId))
  }
  const found = await call<{ results?: { id: string }[] }>({
    path: `databases/${databaseId}/query`, method: 'POST',
    body: { filter: { property: 'Status', select: { equals: 'This week' } }, page_size: 100 },
  })
  let fixed = 0
  for (const row of found?.results ?? []) {
    if (!row?.id || keep.has(norm(row.id))) continue
    await call({ path: `pages/${row.id}`, method: 'PATCH', body: { properties: { Status: selectProp('Earlier') } } })
    fixed++
  }
  return fixed
}

/** A database row with no body: create it, or rewrite its columns when they change. */
async function upsert(call: NotionCall, repo: Repo, key: string, databaseId: string, properties: Record<string, unknown>): Promise<boolean> {
  const h = hash(properties)
  const state = await repo.notion.get(key)
  if (state?.hash === h) return false
  if (state) {
    try {
      await call({ path: `pages/${state.pageId}`, method: 'PATCH', body: { properties } })
      await repo.notion.put({ key, pageId: state.pageId, hash: h, syncedAt: new Date().toISOString() })
      return true
    } catch (e) {
      // The listener deleted this row in Notion. Throwing here would stop every
      // later row on every sync for good; the app still holds it, so it is made again.
      if (!isGone(e)) throw e
    }
  }
  const page = await call<{ id: string }>({ path: 'pages', method: 'POST', body: { parent: { database_id: databaseId }, properties } })
  await repo.notion.put({ key, pageId: page.id, hash: h, syncedAt: new Date().toISOString() })
  return true
}

// ── sync ──────────────────────────────────────────────────────────────────

export interface SyncReport { written: number }

export async function syncToNotion(call: NotionCall, repo: Repo, pageId: string, currentWeek: string): Promise<SyncReport> {
  try {
    return await syncOnce(call, repo, pageId, currentWeek)
  } catch (e) {
    // A database or the taste page deleted in Notion leaves the remembered setup
    // pointing at nothing, and every sync after would fail the same way. Look
    // for the notebook's pages again (making what is missing) and try once more.
    if (!isGone(e) || !(await repo.marks.get('notion:setup'))) throw e
    await repo.marks.delete('notion:setup')
    return syncOnce(call, repo, pageId, currentWeek)
  }
}

async function syncOnce(unguarded: NotionCall, repo: Repo, pageId: string, currentWeek: string): Promise<SyncReport> {
  // A fresh start or a restore while this runs (it can take minutes): stop before the next write,
  // rather than write the journey just cleared away back into Notion.
  const generation = repo.generation
  const call: NotionCall = (req) => {
    if (repo.generation !== generation) return Promise.reject(new Error('The journey changed while Notion was being updated; it will be brought up to date next time.'))
    return unguarded(req)
  }
  const dbs = await ensureSetup(call, repo, pageId)
  const [programmes, themes, explorations, recordings, events, feedback, resources, weeks, taste, prefs, comparisons, concerts] = await Promise.all([
    repo.programmes.all(), repo.themes.all(), repo.explorations.all(), repo.recordings.all(), repo.events.all(), repo.feedback.all(), repo.resources.all(), repo.weeks.all(), repo.taste(), repo.preferences(), repo.comparisons.all(), repo.concerts.all(),
  ])
  // Set aside as the Library reads it: a sitting or "More of this theme" joined to a replaced programme goes with it.
  const setAside = setAsideProgrammes(weeks, explorations, programmes)
  const themeTitle = new Map(themes.map((t) => [t.id, t.title]))
  // A work heard through a stand-in was heard: its listening and what was said sit under the stand-in.
  const standIns = standInsOf(comparisons)
  let written = 0

  for (const p of programmes.sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    written += Number(await syncProgrammePage(call, repo, dbs.journal, p, journalProps(p, themeTitle.get(p.themeId) ?? '', events, feedback, setAside.has(p.id), currentWeek, standIns),
      resources.filter((r) => r.programmeId === p.id), standInLines(p, comparisons)))
  }
  // Once a week is enough: a row goes stale only when a week turns. An unchanged notebook still costs no calls.
  if (!(await repo.marks.get(`notion:settled:${currentWeek}`))) {
    written += await settleStaleThisWeek(call, repo, dbs.journal, programmes.filter((p) => p.weekKey === currentWeek && !setAside.has(p.id)))
    await repo.marks.put({ id: `notion:settled:${currentWeek}`, at: new Date().toISOString() })
  }
  for (const t of themes) {
    written += Number(await upsert(call, repo, `theme:${t.id}`, dbs.threads, threadProps(t, explorations)))
  }
  const recById = new Map(recordings.map((r) => [r.id, r]))
  const met: Met = new Map()
  for (const p of programmes) for (const i of p.sections.flatMap((s) => s.items)) if (!met.has(i.recordingId)) met.set(i.recordingId, { proposed: i.proposed, programme: p })
  // What was actually played when the named recording was missing ("On Spotify instead"), and the
  // second recording of a side-by-side pair: each belongs to the programme that holds its work.
  const programmeOf = (c: Comparison) => programmes.find((p) => c.id.startsWith(`cmp:${p.id}:`) || p.comparisonIds.includes(c.id))
  for (const c of comparisons) {
    const p = programmeOf(c)
    if (!p) continue
    for (const x of c.perspectives) if (!met.has(x.recordingId)) met.set(x.recordingId, { proposed: x.proposed, programme: p, note: c.standIn ? 'On Spotify instead' : 'Side by side' })
  }
  for (const [rid, { proposed, programme }] of met) {
    written += Number(await upsert(call, repo, `recording:${rid}`, dbs.recordings, recordingProps(proposed, recById.get(rid), programme, events, feedback, met.get(rid)?.note)))
  }
  // One row per composer however the curator wrote the name (domain/composerGroups.ts),
  // keyed by the name as first written so the rows already in Notion are kept.
  for (const [name, entries] of groupByComposer([...met].map(([rid, v]) => ({ rid, ...v })), (e) => e.proposed.composer)) {
    written += Number(await upsert(call, repo, `composer:${name}`, dbs.composers, composerProps(name, entries, events, feedback)))
  }

  for (const c of concerts) {
    written += Number(await upsert(call, repo, `concert:${c.id}`, dbs.concerts, concertProps(c)))
  }
  // A concert removed in the app: its row goes to Notion's trash. One already gone there is done too.
  const keptConcerts = new Set(concerts.map((c) => `concert:${c.id}`))
  for (const st of await repo.notion.all()) {
    if (!st.key.startsWith('concert:') || keptConcerts.has(st.key)) continue
    await call({ path: `pages/${st.pageId}`, method: 'PATCH', body: { archived: true } }).catch((e: unknown) => { if (!isGone(e)) throw e })
    await repo.notion.delete(st.key)
    written++
  }

  // The taste page belongs to the app: it is rewritten whole when it changes.
  const { nextRequest: _n, ...shownPrefs } = prefs
  // `v`: the page's layout — bumped when tasteBlocks sets it differently, so the page is rewritten once.
  const tasteHash = hash({ v: 2, o: taste.observations.filter((o) => !o.supersededBy).map((o) => [o.statement, o.stance, o.confidence]), q: taste.questions, n: taste.notesToCurator, p: shownPrefs })
  const tasteState = await repo.notion.get('taste')
  if (tasteState?.hash !== tasteHash) {
    for (const b of await childrenOf(call, dbs.tastePage)) await call({ path: `blocks/${b.id}`, method: 'PATCH', body: { archived: true } })
    await append(call, dbs.tastePage, tasteBlocks(taste, prefs))
    await repo.notion.put({ key: 'taste', pageId: dbs.tastePage, hash: tasteHash, syncedAt: new Date().toISOString() })
    written++
  }
  await repo.marks.put({ id: 'notion:last-sync', at: new Date().toISOString() })
  return { written }
}

/**
 * Before a fresh start: move every page the app wrote into Notion's trash
 * (recoverable there for 30 days) and empty the taste page, so the notebook
 * starts as clean as the app. The databases themselves stay, for the next
 * journey. Best effort: a page already gone is fine.
 */
export async function archiveNotebook(call: NotionCall, repo: Repo, only?: NotionSyncState[]): Promise<number> {
  const trashed: NotionSyncState[] = []
  let failed = 0
  // `only`: a restore's leavers (repo.notionLeaving) — the rest of the notebook stays, and so does the taste page.
  for (const st of only ?? await repo.notion.all()) {
    if (st.key === 'taste') continue
    try {
      await call({ path: `pages/${st.pageId}`, method: 'PATCH', body: { archived: true } })
      trashed.push(st)
    } catch (e) {
      // Already archived, or deleted in Notion, is done. Anything else (offline, rate-limited) is not.
      if (!/could not find|archived/i.test(e instanceof Error ? e.message : String(e))) failed++
    }
  }
  if (failed) {
    // A fresh start forgets which pages it wrote: one left behind would never be cleaned up, so stop here instead.
    // The journey stays, so the pages already in the trash must come back: unmatched, the next sync writes them afresh.
    for (const st of trashed) await repo.notion.put({ ...st, hash: '' })
    throw new Error(only ? 'Notion didn’t take some pages to its trash, so nothing was restored. Try again in a minute.' : 'Notion didn’t take some pages to its trash, so nothing was cleared. Try again in a minute.')
  }
  if (only) return trashed.length
  // Best effort: the next sync rewrites the taste page anyway, from a taste that is now empty.
  const setup = (await repo.marks.get('notion:setup'))?.value as { tastePage?: string } | undefined
  if (setup?.tastePage) {
    for (const b of await childrenOf(call, setup.tastePage).catch(() => [])) {
      await call({ path: `blocks/${b.id}`, method: 'PATCH', body: { archived: true } }).catch(() => undefined)
    }
  }
  return trashed.length
}

export function journalProps(
  p: Programme, theme: string, events: ListeningEvent[], feedback: Feedback[], setAside: boolean, currentWeek: string,
  /** `standInsOf(comparisons)`: an item heard through a stand-in is read through it too. Without it, only the curator's recording. */
  standIns: Map<string, string> = new Map(),
) {
  const items = p.sections.flatMap((s) => s.items)
  // The curator's recording and its stand-in read as one (domain/standIns.ts), and
  // what was said about the work beside what was said about the recording — the
  // row once said a work heard and loved through a stand-in was never heard.
  const heard = items.filter((i) => listeningState(events, heardAs(i, p.id, standIns)) === 'heard').map((i) => `${displaySurname(i.proposed.composer)} — ${i.proposed.work}`)
  const notes = [...latestFeedback(feedback, p.id).notes, ...items.flatMap((i) => itemFeedback(feedback, heardAs(i, p.id, standIns), i.workId).notes)]
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

export function recordingProps(proposed: Programme['sections'][number]['items'][number]['proposed'], r: Recording | undefined, programme: Programme, events: ListeningEvent[], feedback: Feedback[], role?: string) {
  const rid = r?.id ?? ''
  const fb = latestFeedback(feedback, rid)
  // Only a confirmed recording gets a link: a near miss waiting for the listener is not a fact yet.
  const link = r?.verification === 'verified' && r.spotify?.trackIds[0] ? `https://open.spotify.com/track/${r.spotify.trackIds[0]}` : null
  return {
    Name: titleProp(`${proposed.composer} — ${proposed.work}`),
    Composer: textProp(proposed.composer),
    Performers: textProp(creditLine(proposed)),
    Spotify: { url: link },
    Listening: selectProp(STATE_LABEL[listeningState(events, rid)]),
    Reaction: selectProp(reactionLabel(fb.reaction)),
    Notes: textProp(fb.notes.join(' / ')),
    Programme: textProp(`${programme.title} (${programme.weekKey})${role ? ` · ${role}` : ''}`),
  }
}

export function concertProps(c: Concert) {
  return {
    Name: titleProp(`${c.venue} — ${c.date}`),
    Date: { date: { start: c.date } },
    Venue: textProp([c.venue, c.hall].filter(Boolean).join(', ')),
    // Soloists are named with the works they play in (below); here only those no
    // work claims, as the concert page shows them — not every soloist on the evening.
    Performers: textProp([c.orchestra, c.conductor, ...unplaced(c).map((s) => (s.instrument ? `${s.name} (${s.instrument})` : s.name))].filter(Boolean).join('; ')),
    Works: textProp(c.works.map((w) => { const who = whoPlays(c, w); return `${w.composer} — ${w.title}${w.catalogue ? `, ${w.catalogue}` : ''}${who.length ? ` (with ${who.map((s) => s.name).join(', ')})` : ''}` }).join('; ')),
    Notes: textProp(c.note ?? ''),
  }
}

type Met = Map<string, { proposed: Programme['sections'][number]['items'][number]['proposed']; programme: Programme; note?: string }>

export function composerProps(name: string, entries: { rid: string; proposed: Programme['sections'][number]['items'][number]['proposed']; programme: Programme }[], events: ListeningEvent[], feedback: Feedback[]) {
  // One work however the curator spelled it from one programme to the next.
  const works: string[] = []
  for (const e of entries) if (!works.some((w) => sameWork({ composer: e.proposed.composer, title: w }, { composer: e.proposed.composer, title: e.proposed.work }))) works.push(e.proposed.work)
  const first = [...entries].sort((a, b) => a.programme.weekKey.localeCompare(b.programme.weekKey))[0]
  const how = entries
    .map((e) => {
      const r = reactionLabel(latestFeedback(feedback, e.rid).reaction)
      const st = listeningState(events, e.rid)
      return r ? `${e.proposed.work}: ${r.toLowerCase()}` : st === 'heard' ? `${e.proposed.work}: heard` : ''
    })
    .filter(Boolean)
  return {
    Name: titleProp(name),
    Works: textProp(works.join('; ')),
    Recordings: textProp(entries.map((e) => `${e.proposed.work} — ${creditLine(e.proposed)}`).join('; ')),
    'First met': textProp(first ? `${first.programme.title}, ${weekFromKey(first.programme.weekKey).label}` : ''),
    'How it went': textProp(how.join('; ')),
  }
}
