// Notion access, always through our stateless relay (api/notion.js). The browser can't
// call api.notion.com directly (CORS); the relay forwards each request using the token
// the client supplies per call and stores nothing. The token never leaves the device
// except as a per-request header to our own relay.
//
// We use the classic, long-stable Notion API (the relay pins Notion-Version 2022-06-28):
// `databases/{id}/query` to read and `parent.database_id` to write. The practical upshot
// is that the user only needs a **database link** — the ID is right there in the URL —
// so Settings accepts either a pasted URL or a bare ID and normalizes it.
//
// The request-shaping is split into PURE builders (unit-tested, no network) and one thin
// async caller, so the wiring is verifiable without hitting Notion.

import type { Settings } from './settings'
import {
  buildCreateOdysseyProperties,
  buildDraftOdysseyProperties,
  nextOdysseyNumber,
  type CharterDraft,
} from './charter'
import { buildCheckinProperties, type CheckinDraft, type CheckinRecord } from './checkins'
import {
  buildReflectionProperties,
  type Fit,
  type ReflectionDraft,
  type ReflectionRecord,
} from './reflections'
import { buildHarvestProperties, type Outcome } from './harvest'

export const RELAY_ENDPOINT = '/api/notion'

export type NotionMethod = 'GET' | 'POST' | 'PATCH'

export interface NotionRequest {
  path: string
  method?: NotionMethod
  body?: unknown
}

export interface OdysseyRef {
  id: string
  title: string
}

/** The Odyssey's charter, read back from a Notion page — drives the Overview readout. */
export interface OdysseyDetail extends OdysseyRef {
  number: number | null
  status: string
  startDate: string
  endDate: string
  behaviour: string
  identity: string
  tinyVersion: string
  anchor: string
  ifThen: string
  outcomePicture: string
  pairing: string
  dailySuccess: string
  whyValue: string
  /** Optional forfeit-on-lapse contract (commitment device). Empty when unset or the column is
   *  absent. */
  commitment: string
  /** Set at harvest. */
  outcome: string
  notes: string
}

/** Extract a Notion object ID (32 hex chars) from a pasted URL or a bare/hyphenated ID.
 *  Returns '' if no plausible ID is present. A Notion database URL looks like
 *  `https://www.notion.so/workspace/Title-<32hex>?v=<view>` — the ID is the LAST 32-hex
 *  run before the query string (the `?v=` view ID is ignored). */
export function normalizeNotionId(input: string): string {
  const withoutQuery = (input || '').trim().split(/[?#]/)[0]
  const compact = withoutQuery.replace(/-/g, '')
  const runs = compact.match(/[0-9a-fA-F]{32}/g)
  return runs ? runs[runs.length - 1].toLowerCase() : ''
}

/** Pure: shape the `fetch` init for a relay call. (No version header — the relay's
 *  default Notion-Version applies, shared with the other apps.) */
export function buildRelayInit(token: string, req: NotionRequest): RequestInit {
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-notion-token': token,
    },
    body: JSON.stringify({
      path: req.path,
      method: req.method ?? 'POST',
      body: req.body,
    }),
  }
}

/** Pure: the Notion query that returns the Active Odyssey row(s). Accepts a database URL
 *  or ID; throws if no ID can be parsed. */
export function activeOdysseysQuery(database: string): NotionRequest {
  const id = normalizeNotionId(database)
  if (!id) throw new Error('That doesn’t look like a Notion database link or ID.')
  return {
    path: `databases/${id}/query`,
    method: 'POST',
    body: {
      filter: { property: 'Status', select: { equals: 'Active' } },
      page_size: 50,
    },
  }
}

/** Pure: map a Notion query response → full Odyssey details. Tolerant of missing fields. */
export function parseOdysseyList(json: unknown): OdysseyDetail[] {
  const results = (json as { results?: unknown })?.results
  if (!Array.isArray(results)) return []
  return results.map((page) => {
    const props = (page as { properties?: Record<string, unknown> })?.properties ?? {}
    return {
      id: String((page as { id?: unknown })?.id ?? ''),
      title: extractTitle(page) || '(untitled Odyssey)',
      number: numberProp(props, 'Odyssey Number'),
      status: selectProp(props, 'Status'),
      startDate: dateProp(props, 'Start Date'),
      endDate: dateProp(props, 'End Date'),
      behaviour: textProp(props, 'Behaviour'),
      identity: textProp(props, 'Identity Statement'),
      tinyVersion: textProp(props, 'Tiny Version'),
      anchor: textProp(props, 'Anchor'),
      ifThen: textProp(props, 'If-Then'),
      outcomePicture: textProp(props, 'Outcome Picture'),
      pairing: textProp(props, 'Pairing'),
      dailySuccess: textProp(props, 'Daily Success'),
      whyValue: textProp(props, 'Why / Value'),
      commitment: textProp(props, 'Commitment'),
      outcome: selectProp(props, 'Outcome'),
      notes: textProp(props, 'Notes'),
    }
  })
}

function extractTitle(page: unknown): string {
  const title = (page as { properties?: { Name?: { title?: unknown } } })?.properties?.Name
    ?.title
  return joinRich(title)
}

function joinRich(arr: unknown): string {
  if (!Array.isArray(arr)) return ''
  return arr
    .map((t) => (t as { plain_text?: string })?.plain_text ?? '')
    .join('')
    .trim()
}

function textProp(props: Record<string, unknown>, name: string): string {
  return joinRich((props[name] as { rich_text?: unknown })?.rich_text)
}
function numberProp(props: Record<string, unknown>, name: string): number | null {
  const n = (props[name] as { number?: unknown })?.number
  return typeof n === 'number' ? n : null
}
function selectProp(props: Record<string, unknown>, name: string): string {
  return String((props[name] as { select?: { name?: unknown } })?.select?.name ?? '')
}
function dateProp(props: Record<string, unknown>, name: string): string {
  return String((props[name] as { date?: { start?: unknown } })?.date?.start ?? '')
}
function checkboxProp(props: Record<string, unknown>, name: string): boolean {
  return (props[name] as { checkbox?: unknown })?.checkbox === true
}

/** Pure: turn a relay/Notion error into a calm, user-facing sentence (never red-scary). */
export function friendlyError(status: number, data: unknown): string {
  const message = (data as { message?: string })?.message
  if (status === 401) return 'Notion rejected the token. Double-check it in Settings.'
  if (status === 404) {
    return 'Notion couldn’t find that database. Check the Odysseys link, and that the integration is shared with it.'
  }
  if (status === 400 && message) return `Notion rejected the request: ${message}`
  if (message) return message
  return `Couldn’t reach Notion (status ${status}).`
}

/** Pure: a page-create request (classic API: parent.database_id + properties). */
export function createPageRequest(dbId: string, properties: Record<string, unknown>): NotionRequest {
  const id = normalizeNotionId(dbId)
  if (!id) throw new Error('That doesn’t look like a Notion database link or ID.')
  return {
    path: 'pages',
    method: 'POST',
    body: { parent: { database_id: id }, properties },
  }
}

/** Pure: all Odysseys, newest first — powers the Stats screen's archive. */
export function allOdysseysQuery(database: string): NotionRequest {
  const id = normalizeNotionId(database)
  if (!id) throw new Error('That doesn’t look like a Notion database link or ID.')
  return {
    path: `databases/${id}/query`,
    method: 'POST',
    body: { sorts: [{ property: 'Odyssey Number', direction: 'descending' }], page_size: 100 },
  }
}

/** Read every Odyssey (any status) for the archive. */
export async function listAllOdysseys(
  settings: Pick<Settings, 'token' | 'dsOdysseys'>,
  fetchImpl: typeof fetch = fetch,
): Promise<OdysseyDetail[]> {
  if (!settings.token.trim()) throw new Error('Add your Notion token in Settings first.')
  if (!settings.dsOdysseys.trim()) {
    throw new Error('Add the Odysseys database link in Settings first.')
  }
  const data = await callRelay(settings.token, allOdysseysQuery(settings.dsOdysseys), fetchImpl)
  return parseOdysseyList(data)
}

/** Pure: a cheap "does any completed (harvested) Odyssey exist" probe — one row, filtered to rows
 *  with an Outcome set (which is exactly the harvested ones). Powers the Stats nav gate without
 *  loading the whole archive on every boot. */
export function hasCompletedOdysseyQuery(database: string): NotionRequest {
  const id = normalizeNotionId(database)
  if (!id) throw new Error('That doesn’t look like a Notion database link or ID.')
  return {
    path: `databases/${id}/query`,
    method: 'POST',
    body: { filter: { property: 'Outcome', select: { is_not_empty: true } }, page_size: 1 },
  }
}

/** True if at least one completed (harvested) Odyssey exists. */
export async function fetchHasCompleted(
  settings: Pick<Settings, 'token' | 'dsOdysseys'>,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!settings.token.trim() || !settings.dsOdysseys.trim()) return false
  const data = await callRelay(settings.token, hasCompletedOdysseyQuery(settings.dsOdysseys), fetchImpl)
  const results = (data as { results?: unknown })?.results
  return Array.isArray(results) && results.length > 0
}

/** Pure: query for the single highest existing Odyssey Number. Filters to rows that HAVE a number
 *  so a numberless Planning draft can't be mistaken for the max — and can't flip the "first vs
 *  next" home copy (`fetchNextOdysseyInfo().hasPrior`) before it's ever activated. */
export function maxOdysseyNumberQuery(database: string): NotionRequest {
  const id = normalizeNotionId(database)
  if (!id) throw new Error('That doesn’t look like a Notion database link or ID.')
  return {
    path: `databases/${id}/query`,
    method: 'POST',
    body: {
      filter: { property: 'Odyssey Number', number: { is_not_empty: true } },
      sorts: [{ property: 'Odyssey Number', direction: 'descending' }],
      page_size: 1,
    },
  }
}

/** Pure: read the top `Odyssey Number` from a query response (null if none/blank). */
export function parseMaxOdysseyNumber(json: unknown): number | null {
  const results = (json as { results?: unknown })?.results
  if (!Array.isArray(results) || results.length === 0) return null
  const n = (results[0] as { properties?: { 'Odyssey Number'?: { number?: unknown } } })
    ?.properties?.['Odyssey Number']?.number
  return typeof n === 'number' ? n : null
}

export interface NextOdysseyInfo {
  /** Whether any Odyssey (any status) already exists — i.e. this wouldn't be the first. */
  hasPrior: boolean
  /** The number the next Odyssey will take. */
  nextNumber: number
}

/** Whether the user has run Odysseys before, and the next number — drives "first" vs "next" copy
 *  on the empty home, independent of how many are currently Active. */
export async function fetchNextOdysseyInfo(
  settings: Pick<Settings, 'token' | 'dsOdysseys'>,
  fetchImpl: typeof fetch = fetch,
): Promise<NextOdysseyInfo> {
  if (!settings.token.trim() || !settings.dsOdysseys.trim()) return { hasPrior: false, nextNumber: 1 }
  const data = await callRelay(settings.token, maxOdysseyNumberQuery(settings.dsOdysseys), fetchImpl)
  const results = (data as { results?: unknown })?.results
  return {
    hasPrior: Array.isArray(results) && results.length > 0,
    nextNumber: nextOdysseyNumber(parseMaxOdysseyNumber(data)),
  }
}

/** Shared async caller: POST a request through the relay, returning parsed JSON or throwing a
 *  calm, specific error (token guard, relay-unreachable, or a mapped Notion error). */
async function callRelay(
  token: string,
  req: NotionRequest,
  fetchImpl: typeof fetch,
): Promise<unknown> {
  if (!token.trim()) throw new Error('Add your Notion token in Settings first.')
  const res = await fetchImpl(RELAY_ENDPOINT, buildRelayInit(token, req))

  // The relay always answers with JSON. Non-JSON means we never reached it — almost always
  // a local `vite dev` server, where the /api/notion serverless function isn't running.
  let data: unknown = {}
  let parsed = false
  try {
    data = await res.json()
    parsed = true
  } catch {
    /* not JSON */
  }
  if (!parsed) {
    throw new Error(
      'Couldn’t reach the Notion relay (/api/notion). If you’re on a local dev server, that ' +
        'serverless function isn’t running — deploy to Vercel (or run `vercel dev`) to test.',
    )
  }
  if (!res.ok) throw new Error(friendlyError(res.status, data))
  return data
}

/** List the Active Odysseys end-to-end via the relay. */
export async function listActiveOdysseys(
  settings: Pick<Settings, 'token' | 'dsOdysseys'>,
  fetchImpl: typeof fetch = fetch,
): Promise<OdysseyDetail[]> {
  if (!settings.token.trim()) throw new Error('Add your Notion token in Settings first.')
  if (!settings.dsOdysseys.trim()) {
    throw new Error('Add the Odysseys database link in Settings first.')
  }
  const data = await callRelay(settings.token, activeOdysseysQuery(settings.dsOdysseys), fetchImpl)
  return parseOdysseyList(data)
}

/** Create a new Active Odyssey from a charter draft, enforcing the one-active law. */
export async function createActiveOdyssey(
  settings: Settings,
  draft: CharterDraft,
  fetchImpl: typeof fetch = fetch,
): Promise<OdysseyRef> {
  if (!settings.dsOdysseys.trim()) {
    throw new Error('Add the Odysseys database link in Settings first.')
  }

  // Law I — only one Odyssey may be Active at a time.
  const active = await listActiveOdysseys(settings, fetchImpl)
  if (active.length > 0) {
    throw new Error(
      'You already have an active Odyssey. Finish or retire it before starting another.',
    )
  }

  // Number the new Odyssey one past the highest that exists.
  const maxData = await callRelay(settings.token, maxOdysseyNumberQuery(settings.dsOdysseys), fetchImpl)
  const number = nextOdysseyNumber(parseMaxOdysseyNumber(maxData))

  const properties = buildCreateOdysseyProperties(draft, settings, number)
  const created = await callRelay(
    settings.token,
    createPageRequest(settings.dsOdysseys, properties),
    fetchImpl,
  )
  return {
    id: String((created as { id?: unknown })?.id ?? ''),
    title: extractTitle(created) || `Odyssey ${number}`,
  }
}

// ── Planning (draft) Odysseys ─────────────────────────────────────────────────────────────────
// A Charter can be prepared ahead of time as a Planning draft: a real Odyssey row with
// Status='Planning' and no Odyssey Number. It can be edited/resumed, can sit alongside an Active
// Odyssey, and is promoted to Active by an explicit "Begin" (activatePlanningOdyssey). At most one
// draft exists at a time, so the wizard upserts into it.

/** Pure: the single Planning (draft) Odyssey, if any. */
export function planningOdysseyQuery(database: string): NotionRequest {
  const id = normalizeNotionId(database)
  if (!id) throw new Error('That doesn’t look like a Notion database link or ID.')
  return {
    path: `databases/${id}/query`,
    method: 'POST',
    body: {
      filter: { property: 'Status', select: { equals: 'Planning' } },
      page_size: 1,
    },
  }
}

/** Pure: a page-archive request (moves the page to Notion Trash, recoverable for 30 days). */
export function archivePageRequest(pageId: string): NotionRequest {
  return { path: `pages/${pageId}`, method: 'PATCH', body: { archived: true } }
}

/** Read the current Planning draft, or null if there isn't one. */
export async function listPlanningOdyssey(
  settings: Pick<Settings, 'token' | 'dsOdysseys'>,
  fetchImpl: typeof fetch = fetch,
): Promise<OdysseyDetail | null> {
  if (!settings.token.trim()) throw new Error('Add your Notion token in Settings first.')
  if (!settings.dsOdysseys.trim()) {
    throw new Error('Add the Odysseys database link in Settings first.')
  }
  const data = await callRelay(settings.token, planningOdysseyQuery(settings.dsOdysseys), fetchImpl)
  return parseOdysseyList(data)[0] ?? null
}

/** Upsert the Planning draft: PATCH the existing draft row if `existingId` is given, else POST a
 *  new one. Partial drafts are allowed. */
export async function savePlanningDraft(
  settings: Settings,
  draft: CharterDraft,
  existingId?: string,
  fetchImpl: typeof fetch = fetch,
): Promise<OdysseyRef> {
  if (!settings.dsOdysseys.trim()) {
    throw new Error('Add the Odysseys database link in Settings first.')
  }
  const properties = buildDraftOdysseyProperties(draft, settings)
  const req = existingId
    ? updatePageRequest(existingId, properties)
    : createPageRequest(settings.dsOdysseys, properties)
  const saved = await callRelay(settings.token, req, fetchImpl)
  return {
    id: String((saved as { id?: unknown })?.id ?? ''),
    title: extractTitle(saved) || 'Planned Odyssey',
  }
}

/** Promote a Planning draft to Active. Enforces Law I (no other Active Odyssey) and assigns the
 *  next Odyssey Number now (drafts are numberless until this point). */
export async function activatePlanningOdyssey(
  settings: Settings,
  draftId: string,
  draft: CharterDraft,
  fetchImpl: typeof fetch = fetch,
): Promise<OdysseyDetail> {
  // Law I — only one Odyssey may be Active at a time.
  const active = await listActiveOdysseys(settings, fetchImpl)
  if (active.length > 0) {
    throw new Error(
      'You already have an active Odyssey. Finish or retire it before starting another.',
    )
  }
  // Number it one past the highest real (numbered) Odyssey.
  const maxData = await callRelay(settings.token, maxOdysseyNumberQuery(settings.dsOdysseys), fetchImpl)
  const number = nextOdysseyNumber(parseMaxOdysseyNumber(maxData))

  const properties = buildCreateOdysseyProperties(draft, settings, number)
  const saved = await callRelay(settings.token, updatePageRequest(draftId, properties), fetchImpl)
  return parseOdysseyList({ results: [saved] })[0]
}

/** Discard a Planning draft — archives the row to Notion Trash (recoverable 30 days). */
export async function discardPlanningDraft(
  settings: Pick<Settings, 'token'>,
  draftId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  await callRelay(settings.token, archivePageRequest(draftId), fetchImpl)
}

// ── Commitment device (forfeit-on-lapse contract) ────────────────────────────────────────────
// An optional pre-Day-1 pledge stored in a `Commitment` rich-text property on the Odysseys DB.
// Written on its own (never folded into create/activate/save) so a missing column can never break
// creating an Odyssey — and if the column is absent, the error explains exactly how to add it.

/** Save (or clear) the forfeit-on-lapse contract on an Odyssey. */
export async function writeCommitment(
  settings: Pick<Settings, 'token'>,
  odysseyId: string,
  contract: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const properties = { Commitment: { rich_text: contract.trim() ? [{ text: { content: contract.trim() } }] : [] } }
  try {
    await callRelay(settings.token, updatePageRequest(odysseyId, properties), fetchImpl)
  } catch (err) {
    const message = err instanceof Error ? err.message : ''
    // Notion 400s with a message naming the property when the column doesn't exist yet.
    if (/Commitment/i.test(message) && /(does not exist|is not a property|property)/i.test(message)) {
      throw new Error(
        'Add a “Commitment” text property to your Odysseys database in Notion to save your safety line.',
      )
    }
    throw err
  }
}

// ── Check-ins (the daily loop) ──────────────────────────────────────────────────────────────

/** Pure: PATCH an existing page's properties (classic API). */
export function updatePageRequest(pageId: string, properties: Record<string, unknown>): NotionRequest {
  return { path: `pages/${pageId}`, method: 'PATCH', body: { properties } }
}

/** Pure: all check-ins for one Odyssey, oldest first (one read powers Today + Tracker + streak). */
export function checkinsForOdysseyQuery(database: string, odysseyId: string): NotionRequest {
  const id = normalizeNotionId(database)
  if (!id) throw new Error('That doesn’t look like a Notion database link or ID.')
  return {
    path: `databases/${id}/query`,
    method: 'POST',
    body: {
      filter: { property: 'Odyssey', relation: { contains: odysseyId } },
      sorts: [{ property: 'Date', direction: 'ascending' }],
      page_size: 100,
    },
  }
}

/** Pure: a single Notion page → CheckinRecord. */
export function parseCheckinPage(page: unknown): CheckinRecord {
  const props = (page as { properties?: Record<string, unknown> })?.properties ?? {}
  return {
    id: String((page as { id?: unknown })?.id ?? ''),
    date: dateProp(props, 'Date'),
    dayIndex: numberProp(props, 'Day Index') ?? 0,
    done: checkboxProp(props, 'Done'),
    oneLine: textProp(props, 'One Line'),
    friction: textProp(props, 'Friction'),
    sentToBuddy: checkboxProp(props, 'Sent To Buddy'),
  }
}

/** Pure: a query response → CheckinRecord[]. */
export function parseCheckins(json: unknown): CheckinRecord[] {
  const results = (json as { results?: unknown })?.results
  if (!Array.isArray(results)) return []
  return results.map(parseCheckinPage)
}

/** Read all check-ins for an Odyssey via the relay. */
export async function listCheckins(
  settings: Pick<Settings, 'token' | 'dsCheckins'>,
  odysseyId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<CheckinRecord[]> {
  if (!settings.token.trim()) throw new Error('Add your Notion token in Settings first.')
  if (!settings.dsCheckins.trim()) throw new Error('Add the Check-ins database link in Settings first.')
  const data = await callRelay(settings.token, checkinsForOdysseyQuery(settings.dsCheckins, odysseyId), fetchImpl)
  return parseCheckins(data)
}

export interface UpsertCheckinArgs {
  odysseyId: string
  odysseyNumber: number
  dateISO: string
  dayIndex: number
  /** The id of today's existing check-in, if there is one (→ PATCH; otherwise POST). */
  existingId?: string
  draft: CheckinDraft
}

/** Open today's check-in: update it if it exists, else create it (one row per date). */
export async function upsertCheckin(
  settings: Pick<Settings, 'token' | 'dsCheckins'>,
  args: UpsertCheckinArgs,
  fetchImpl: typeof fetch = fetch,
): Promise<CheckinRecord> {
  if (!settings.dsCheckins.trim()) throw new Error('Add the Check-ins database link in Settings first.')
  const properties = buildCheckinProperties(
    args.odysseyId,
    args.draft,
    args.dateISO,
    args.dayIndex,
    args.odysseyNumber,
  )
  const req = args.existingId
    ? updatePageRequest(args.existingId, properties)
    : createPageRequest(settings.dsCheckins, properties)
  const saved = await callRelay(settings.token, req, fetchImpl)
  return parseCheckinPage(saved)
}

// ── Weekly reflections ──────────────────────────────────────────────────────────────────────

/** Pure: all reflections for one Odyssey, by week ascending. */
export function reflectionsForOdysseyQuery(database: string, odysseyId: string): NotionRequest {
  const id = normalizeNotionId(database)
  if (!id) throw new Error('That doesn’t look like a Notion database link or ID.')
  return {
    path: `databases/${id}/query`,
    method: 'POST',
    body: {
      filter: { property: 'Odyssey', relation: { contains: odysseyId } },
      sorts: [{ property: 'Week Index', direction: 'ascending' }],
      page_size: 100,
    },
  }
}

export function parseReflectionPage(page: unknown): ReflectionRecord {
  const props = (page as { properties?: Record<string, unknown> })?.properties ?? {}
  return {
    id: String((page as { id?: unknown })?.id ?? ''),
    weekIndex: numberProp(props, 'Week Index') ?? 0,
    date: dateProp(props, 'Date'),
    daysDone: numberProp(props, 'Days Done') ?? 0,
    breakPoints: textProp(props, 'Break Points'),
    fit: (selectProp(props, 'Fit') || '') as Fit | '',
    oneAdjustment: textProp(props, 'One Adjustment'),
    riskPlan: textProp(props, 'Risk + Plan'),
    temperature: numberProp(props, 'Temperature') ?? 0,
    buddyReflected: checkboxProp(props, 'Buddy Reflected'),
  }
}

export function parseReflections(json: unknown): ReflectionRecord[] {
  const results = (json as { results?: unknown })?.results
  if (!Array.isArray(results)) return []
  return results.map(parseReflectionPage)
}

export async function listReflections(
  settings: Pick<Settings, 'token' | 'dsReflections'>,
  odysseyId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ReflectionRecord[]> {
  if (!settings.token.trim()) throw new Error('Add your Notion token in Settings first.')
  if (!settings.dsReflections.trim()) {
    throw new Error('Add the Weekly Reflections database link in Settings first.')
  }
  const data = await callRelay(
    settings.token,
    reflectionsForOdysseyQuery(settings.dsReflections, odysseyId),
    fetchImpl,
  )
  return parseReflections(data)
}

export interface UpsertReflectionArgs {
  odysseyId: string
  odysseyNumber: number
  weekIndex: number
  dateISO: string
  existingId?: string
  draft: ReflectionDraft
}

/** One reflection per (Odyssey, Week): PATCH the existing one, else POST a new one. */
export async function upsertReflection(
  settings: Pick<Settings, 'token' | 'dsReflections'>,
  args: UpsertReflectionArgs,
  fetchImpl: typeof fetch = fetch,
): Promise<ReflectionRecord> {
  if (!settings.dsReflections.trim()) {
    throw new Error('Add the Weekly Reflections database link in Settings first.')
  }
  const properties = buildReflectionProperties(
    args.odysseyId,
    args.draft,
    args.weekIndex,
    args.dateISO,
    args.odysseyNumber,
  )
  const req = args.existingId
    ? updatePageRequest(args.existingId, properties)
    : createPageRequest(settings.dsReflections, properties)
  const saved = await callRelay(settings.token, req, fetchImpl)
  return parseReflectionPage(saved)
}

// ── Harvest ─────────────────────────────────────────────────────────────────────────────────

export interface HarvestArgs {
  odysseyId: string
  outcome: Outcome
  verdict: string
}

/** Harvest the Odyssey: set Outcome + Status (+ the "what installed" verdict in Notes). A direct
 *  write — harvest changes Status (the one-active rule) and is a deliberate end-of-cycle action,
 *  so it is intentionally not routed through the offline queue. */
export async function harvestOdyssey(
  settings: Pick<Settings, 'token'>,
  args: HarvestArgs,
  fetchImpl: typeof fetch = fetch,
): Promise<OdysseyDetail> {
  const properties = buildHarvestProperties(args.outcome, args.verdict)
  const saved = await callRelay(settings.token, updatePageRequest(args.odysseyId, properties), fetchImpl)
  return parseOdysseyList({ results: [saved] })[0]
}
