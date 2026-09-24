import type { Door, LogRecord } from '../log'

// Progress: the engagement log read back as answers to the taster's own
// questions (KEYPATH_TUTOR.md §6): which door does she open first, where does
// she stay longest, what does she finish and what does she abandon, and does
// she come back the next day. Pure: records in, numbers out.

const DOORS: Door[] = ['songs', 'journey', 'challenges', 'studio']

export interface SongStats {
  songId: string
  started: number
  finished: number
  abandoned: number
  /** Best stars from a finished run; null if never finished. */
  bestStars: number | null
}

export interface DoorStats {
  opens: number
  /** Sessions in which this was the first door opened. */
  firstOpens: number
  /**
   * Roughly how long she spent there: from opening the door until the next
   * door, or the end of the session. Time back on Home is counted in it,
   * because the log records opening a door, not leaving one.
   */
  minutes: number
}

export interface ProgressSummary {
  /** Local dates (YYYY-MM-DD) of the first and last event. */
  from: string | null
  to: string | null
  sessions: number
  minutes: number
  /** Local dates with at least one session. */
  days: string[]
  /** Active days followed by another active day: "does she come back the next day?" */
  cameBackNextDay: number
  doors: Record<Door, DoorStats>
  songs: { started: number; finished: number; abandoned: number; added: number; listened: number; bySong: SongStats[] }
  journey: { practices: number; checksPassed: number; checksFailed: number; testOuts: number; left: number }
  challenges: { race: number; staff: number; echo: number; chord: number; left: number }
  studio: { opened: number; recorded: number; kept: number; played: number }
  suggestions: { accepted: number; declined: number }
  settingsChanged: { key: string; from: unknown; to: unknown; at: string }[]
  keyboard: { setupsDone: number; setupsLeft: number; lostMidSong: number }
}

/** A local calendar date, the phone's own time zone. */
export const localDate = (iso: string) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const nextDay = (date: string) => {
  const [y, m, d] = date.split('-').map(Number)
  return localDate(new Date(y, m - 1, d + 1, 12).toISOString())
}

const minutes = (ms: number) => Math.round((ms / 60000) * 10) / 10

export function summarise(records: readonly LogRecord[]): ProgressSummary {
  const doors = Object.fromEntries(DOORS.map((d) => [d, { opens: 0, firstOpens: 0, minutes: 0 }])) as Record<Door, DoorStats>
  const songs = new Map<string, SongStats>()
  const song = (id: string) => {
    if (!songs.has(id)) songs.set(id, { songId: id, started: 0, finished: 0, abandoned: 0, bestStars: null })
    return songs.get(id)!
  }
  const s: ProgressSummary = {
    from: records.length ? localDate(records[0].at) : null,
    to: records.length ? localDate(records[records.length - 1].at) : null,
    sessions: 0,
    minutes: 0,
    days: [],
    cameBackNextDay: 0,
    doors,
    songs: { started: 0, finished: 0, abandoned: 0, added: 0, listened: 0, bySong: [] },
    journey: { practices: 0, checksPassed: 0, checksFailed: 0, testOuts: 0, left: 0 },
    challenges: { race: 0, staff: 0, echo: 0, chord: 0, left: 0 },
    studio: { opened: 0, recorded: 0, kept: 0, played: 0 },
    suggestions: { accepted: 0, declined: 0 },
    settingsChanged: [],
    keyboard: { setupsDone: 0, setupsLeft: 0, lostMidSong: 0 },
  }
  const days = new Set<string>()
  let sessionMs = 0
  let firstDoorTaken = true
  let open: { door: Door; since: number } | null = null
  const closeDoor = (at: number) => {
    if (open) doors[open.door].minutes += (at - open.since) / 60000
    open = null
  }

  for (const r of records) {
    const t = Date.parse(r.at)
    switch (r.type) {
      case 'session_start':
        closeDoor(t)
        s.sessions++
        days.add(localDate(r.at))
        firstDoorTaken = false
        break
      case 'session_end':
        closeDoor(t)
        sessionMs += r.durationMs
        break
      case 'door_opened':
        closeDoor(t)
        doors[r.door].opens++
        if (!firstDoorTaken) doors[r.door].firstOpens++
        firstDoorTaken = true
        open = { door: r.door, since: t }
        break
      case 'song_started':
        s.songs.started++
        song(r.songId).started++
        break
      case 'song_finished': {
        s.songs.finished++
        const x = song(r.songId)
        x.finished++
        x.bestStars = Math.max(x.bestStars ?? 0, r.stars)
        break
      }
      case 'song_abandoned':
        s.songs.abandoned++
        song(r.songId).abandoned++
        break
      case 'song_added':
        s.songs.added++
        break
      case 'song_listened':
        s.songs.listened++
        break
      case 'journey_started':
        if (r.mode === 'practice') s.journey.practices++
        if (r.testOut) s.journey.testOuts++
        break
      case 'journey_finished':
        if (r.mode === 'check') {
          if (r.passed) s.journey.checksPassed++
          else s.journey.checksFailed++
        }
        break
      case 'journey_left':
        s.journey.left++
        break
      case 'challenge_finished':
        s.challenges[r.game]++
        break
      case 'challenge_left':
        s.challenges.left++
        break
      case 'studio_opened':
        s.studio.opened++
        break
      case 'studio_recorded':
        s.studio.recorded++
        break
      case 'studio_kept':
        s.studio.kept++
        break
      case 'studio_played':
        s.studio.played++
        break
      case 'suggestion':
        if (r.accepted) s.suggestions.accepted++
        else s.suggestions.declined++
        break
      case 'setting_changed':
        s.settingsChanged.push({ key: r.key, from: r.from, to: r.to, at: r.at })
        break
      case 'keyboard_setup':
        if (r.outcome === 'done') s.keyboard.setupsDone++
        else s.keyboard.setupsLeft++
        break
      case 'keyboard_lost':
        s.keyboard.lostMidSong++
        break
    }
  }
  // A session still open (the app is on screen now) counts up to its last event.
  if (records.length) closeDoor(Date.parse(records[records.length - 1].at))

  for (const d of DOORS) doors[d].minutes = Math.round(doors[d].minutes * 10) / 10
  s.minutes = minutes(sessionMs)
  s.days = [...days].sort()
  s.cameBackNextDay = s.days.filter((d) => days.has(nextDay(d))).length
  s.songs.bySong = [...songs.values()].sort((a, b) => b.started + b.finished - (a.started + a.finished) || a.songId.localeCompare(b.songId))
  return s
}
