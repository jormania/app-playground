// A minimal, read-only MCP server over Streamable HTTP, stateless: each POST
// carries one JSON-RPC message and gets one JSON answer. No sessions, no SSE, no
// SDK — the protocol surface a tools-only server needs is five methods.
//
// Claude adds it as a custom connector at
//   https://coneofcold.vercel.app/api/health-mcp/<GOOGLE_HEALTH_MCP_KEY>
// (vercel.json rewrites that to /api/google-health?mode=mcp&key=…). The key in the
// path is the whole of the auth, which is how a single-person connector without
// an OAuth server of its own has to work; rotate it by changing the env var.
import * as defaultQueries from './queries.js'
import { HealthError } from './client.js'
import { DATA_KINDS } from './normalize.js'

export const SUPPORTED_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26']
const SERVER_INFO = { name: 'google-health', title: 'Google Health (Fitbit)', version: '1.0.0' }

const INSTRUCTIONS = `Read-only access to one person's Google Health data, recorded by a Fitbit Inspire 3 (no GPS, no ECG).
Dates are the person's local calendar days (Europe/Bucharest), YYYY-MM-DD, inclusive. Times are RFC 3339.
A night of sleep is dated by the morning it ended. Start with get_daily_summary or get_sleep for trends; use get_heart_rate or get_window for a specific stretch of time.
Data reaches Google only when the phone syncs, so the last few hours may be missing. These are wellness readings, not medical measurements: describe patterns, do not diagnose.`

const DATE = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'YYYY-MM-DD (local calendar day)' }
const INSTANT = { type: 'string', description: 'RFC 3339 timestamp, e.g. 2026-11-03T18:00:00+02:00' }
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }

export const TOOLS = [
  {
    name: 'get_sleep',
    title: 'Sleep',
    description: 'Sleep sessions whose wake-up date falls in [from, to] (max 90 days): bedtime, sleep onset, wake time, minutes asleep/awake, deep/light/REM minutes, number of wakes, and whether it was the main sleep or a nap.',
    inputSchema: { type: 'object', properties: { from: DATE, to: DATE }, required: ['from', 'to'] },
    annotations: READ_ONLY,
    run: (q, a) => q.getSleep(a.from, a.to),
  },
  {
    name: 'get_daily_summary',
    title: 'Daily summary',
    description: 'One row per day in [from, to] (max 90 days): steps, distance (km), floors, Active Zone Minutes, resting heart rate, and overnight HRV (RMSSD, ms; also the deep-sleep RMSSD).',
    inputSchema: { type: 'object', properties: { from: DATE, to: DATE }, required: ['from', 'to'] },
    annotations: READ_ONLY,
    run: (q, a) => q.getDaily(a.from, a.to),
  },
  {
    name: 'get_exercises',
    title: 'Exercises',
    description: 'Logged or auto-detected exercise sessions that started in [from, to] (max 90 days): type, start/end, active minutes, steps, distance, average heart rate, Active Zone Minutes, calories.',
    inputSchema: { type: 'object', properties: { from: DATE, to: DATE }, required: ['from', 'to'] },
    annotations: READ_ONLY,
    run: (q, a) => q.getExercises(a.from, a.to),
  },
  {
    name: 'get_window',
    title: 'Activity in a time window',
    description: 'Totals for one stretch of time up to 24 h (a walk, a workout, an evening): steps, distance, floors, and average/min/max heart rate.',
    inputSchema: { type: 'object', properties: { start: INSTANT, end: INSTANT }, required: ['start', 'end'] },
    annotations: READ_ONLY,
    run: (q, a) => q.getWindow(a.start, a.end),
  },
  {
    name: 'get_heart_rate',
    title: 'Heart rate over time',
    description: 'Heart rate rolled up into windows of window_minutes (default 15) between start and end (max 14 days, max 2000 windows): avg/min/max bpm per window.',
    inputSchema: { type: 'object', properties: { start: INSTANT, end: INSTANT, window_minutes: { type: 'number', minimum: 1 } }, required: ['start', 'end'] },
    annotations: READ_ONLY,
    run: (q, a) => q.getHeartRate(a.start, a.end, a.window_minutes ?? 15),
  },
  {
    name: 'get_steps',
    title: 'Steps over time',
    description: 'Steps rolled up into windows of window_minutes (default 60) between start and end (max 14 days, max 2000 windows).',
    inputSchema: { type: 'object', properties: { start: INSTANT, end: INSTANT, window_minutes: { type: 'number', minimum: 1 } }, required: ['start', 'end'] },
    annotations: READ_ONLY,
    run: (q, a) => q.getSteps(a.start, a.end, a.window_minutes ?? 60),
  },
  {
    name: 'get_raw_data',
    title: 'Raw data points',
    description: 'Raw Google Health data points for any supported type, for questions the other tools do not cover (e.g. daily-oxygen-saturation, daily-respiratory-rate, respiratory-rate-sleep-summary, daily-sleep-temperature-derivations, weight, vo2-max). Max 90 days (2 for heart-rate); limit defaults to 200, max 1000. Field names follow the API; int64 values are strings.',
    inputSchema: {
      type: 'object',
      properties: { data_type: { type: 'string', enum: Object.keys(DATA_KINDS) }, from: DATE, to: DATE, limit: { type: 'number', minimum: 1, maximum: 1000 } },
      required: ['data_type', 'from', 'to'],
    },
    annotations: READ_ONLY,
    run: (q, a) => q.getRaw(a.data_type, a.from, a.to, a.limit ?? 200),
  },
]

const publicTool = ({ run: _run, ...t }) => t

function result(id, value) {
  return { jsonrpc: '2.0', id, result: value }
}

function error(id, code, message) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } }
}

/**
 * Answer one JSON-RPC message. Returns the response object, or null for a
 * notification (which gets a bare 202).
 */
export async function handleMcpMessage(msg, queries = defaultQueries) {
  if (!msg || typeof msg !== 'object' || Array.isArray(msg) || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
    return error(msg && msg.id, -32600, 'Invalid Request')
  }
  const isNotification = msg.id === undefined || msg.id === null
  if (isNotification) return null

  const { id, method, params = {} } = msg
  switch (method) {
    case 'initialize': {
      const asked = params.protocolVersion
      return result(id, {
        protocolVersion: SUPPORTED_VERSIONS.includes(asked) ? asked : SUPPORTED_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      })
    }
    case 'ping':
      return result(id, {})
    case 'tools/list':
      return result(id, { tools: TOOLS.map(publicTool) })
    case 'tools/call': {
      const tool = TOOLS.find((t) => t.name === params.name)
      if (!tool) return error(id, -32602, `Unknown tool: ${params.name}`)
      const args = params.arguments && typeof params.arguments === 'object' ? params.arguments : {}
      const missing = tool.inputSchema.required.filter((k) => args[k] === undefined || args[k] === '')
      if (missing.length) {
        return result(id, { content: [{ type: 'text', text: `Missing argument(s): ${missing.join(', ')}` }], isError: true })
      }
      try {
        const data = await tool.run(queries, args)
        return result(id, { content: [{ type: 'text', text: JSON.stringify(data) }] })
      } catch (err) {
        // A tool failure is a result the model can read and recover from, not a
        // protocol error — say what went wrong in its own words.
        const text = err instanceof HealthError ? err.message : `Unexpected error: ${err && err.message}`
        return result(id, { content: [{ type: 'text', text }], isError: true })
      }
    }
    default:
      return error(id, -32601, `Method not found: ${method}`)
  }
}
