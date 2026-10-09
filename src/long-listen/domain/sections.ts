import type { ProgrammeSection } from './types'

/**
 * A heading for each kind of section, used when the curator's own heading
 * says nothing: "Then" or "Next" only means "after the last one", and in the
 * running order, read on its own, it means less than that.
 */
const ROLE_TITLE: Record<string, string> = {
  start: 'Start here',
  then: 'Where it leads',
  context: 'Where it came from',
  contrast: 'A change of light',
  compare: 'Another angle',
  deeper: 'Go deeper',
  coda: 'To close',
}

const EMPTY = /^(then|next|after(wards)?|and then|next up|after that|continue|more)\.?$/i

/** The section's heading as shown: the curator's, unless it's a bare connective. */
export function sectionTitle(section: Pick<ProgrammeSection, 'heading' | 'role'>): string {
  const h = section.heading?.trim() ?? ''
  if (h && !EMPTY.test(h)) return h
  return ROLE_TITLE[section.role] ?? ROLE_TITLE.then
}
