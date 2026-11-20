export type { PracticeEntry, SeriesDef, SeriesProgress, Session } from '../domain/types'
import type { PracticeEntry, SeriesDef, SeriesProgress, Session } from '../domain/types'

/** The parts of the store's snapshot the migrations read. */
export interface Snapshotish {
  sessions: Session[]
  history: PracticeEntry[]
  seriesProgress: Record<string, SeriesProgress>
  customSeries: SeriesDef[]
}
