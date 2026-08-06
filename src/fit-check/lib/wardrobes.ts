/**
 * Wardrobes — the places clothes live. Any number of them, named by Nora,
 * switchable on and off, stored in Notion so they follow her between devices.
 *
 * WHY A RELATION, NOT A SELECT
 * The first design made this a `select` on Garments with a closed vocabulary
 * (`Home A | Home B | Both`) and display names kept on the device. That worked
 * but carried two costs: renaming was per-device, and renaming the Notion
 * option itself would have been actively dangerous — writing a name Notion no
 * longer knows returns 400 and rejects the ENTIRE property patch.
 *
 * A relation removes the whole problem. Relations reference page ids, so a
 * wardrobe's name is ordinary data: renaming it is a title edit, every garment
 * still points at the same id, and no write can ever be invalidated by it.
 * Adding a seventh wardrobe needs no schema change either.
 *
 * MEMBERSHIP IS MANY-TO-MANY
 * `Both` is gone, and nothing replaces it: a garment simply relates to as many
 * wardrobes as it lives in. Two wardrobes is the old `Both`. Zero is allowed —
 * see the visibility rules below for why that is a state worth supporting
 * rather than preventing.
 */
import type { Garment } from './types.ts'

export interface Wardrobe {
  id: string
  name: string
  /** False = faded out of the app everywhere, but nothing is deleted. */
  active: boolean
  /** Display order; lower first. Ties break on name. */
  order: number
}

/** Display order: by `order`, then name, then id so it is always stable. */
export function sortWardrobes(wardrobes: Wardrobe[]): Wardrobe[] {
  return [...wardrobes].sort((a, b) =>
    a.order - b.order ||
    a.name.localeCompare(b.name) ||
    a.id.localeCompare(b.id),
  )
}

export function activeWardrobes(wardrobes: Wardrobe[]): Wardrobe[] {
  return sortWardrobes(wardrobes).filter((w) => w.active)
}

/** The order value a newly added wardrobe should take: after everything else. */
export function nextOrder(wardrobes: Wardrobe[]): number {
  return wardrobes.reduce((max, w) => Math.max(max, w.order), 0) + 1
}

/**
 * Is this garment hidden by wardrobe state?
 *
 * Hidden iff it belongs to at least one wardrobe THAT EXISTS, and every
 * existing wardrobe it belongs to is switched off. That is the literal reading
 * of "an inactive wardrobe fades away, and its clothes with it".
 *
 * Three cases the rule is deliberately shaped around, each of which would
 * otherwise make clothes disappear with no way to get them back:
 *
 *  · A garment in BOTH an active and an inactive wardrobe stays visible. It is
 *    still reachable through a wardrobe Nora is using, and hiding it would make
 *    switching one wardrobe off silently empty another.
 *
 *  · A garment in NO wardrobe is never hidden. Reachable by deleting a
 *    wardrobe; `unassignedGarments` surfaces these for re-filing.
 *
 *  · A garment whose wardrobes don't RESOLVE is never hidden either — it is
 *    effectively unfiled. This case matters more than it looks: the Wardrobes
 *    database id is its own Settings field, so anyone who configures Garments
 *    first would otherwise open the app to a completely empty grid with no
 *    explanation. Requiring an existing wardrobe before anything can hide makes
 *    that impossible. (Found by a test asserting the opposite of a sibling
 *    test — both couldn't be right, and this is the safe one.)
 */
export function isGarmentHidden(garment: Garment, wardrobes: Wardrobe[]): boolean {
  const byId = new Map(wardrobes.map((w) => [w.id, w]))
  const existing = garment.wardrobeIds
    .map((id) => byId.get(id))
    .filter((w): w is Wardrobe => Boolean(w))
  if (existing.length === 0) return false
  return !existing.some((w) => w.active)
}

/** Garments belonging to no wardrobe at all — surfaced so they can be re-filed. */
export function unassignedGarments(garments: Garment[]): Garment[] {
  return garments.filter((g) => g.wardrobeIds.length === 0)
}

/**
 * Resolve the stored filter to something that still makes sense.
 *
 * The selected wardrobe id lives on the device, so it can easily outlive the
 * wardrobe itself — deleted here, deleted on another device, or switched off
 * since. Any of those falls back to "All" rather than showing an empty grid
 * with no explanation.
 */
export function resolveFilter(filterId: string | null, wardrobes: Wardrobe[]): string | null {
  if (!filterId) return null
  const match = wardrobes.find((w) => w.id === filterId)
  if (!match || !match.active) return null
  return filterId
}

/**
 * The garments to show, given the wardrobe filter.
 *
 * `null` filter means "All": everything except what inactive wardrobes hide.
 * A specific wardrobe means exactly its members.
 */
export function visibleGarments(
  garments: Garment[],
  wardrobes: Wardrobe[],
  filterId: string | null,
): Garment[] {
  const resolved = resolveFilter(filterId, wardrobes)
  if (resolved) return garments.filter((g) => g.wardrobeIds.includes(resolved))
  return garments.filter((g) => !isGarmentHidden(g, wardrobes))
}

/** The wardrobes a garment belongs to, in display order. */
export function wardrobesForGarment(garment: Garment, wardrobes: Wardrobe[]): Wardrobe[] {
  return sortWardrobes(wardrobes.filter((w) => garment.wardrobeIds.includes(w.id)))
}

/** How many garments a wardrobe holds — the number the delete confirmation needs. */
export function garmentCount(wardrobeId: string, garments: Garment[]): number {
  return garments.filter((g) => g.wardrobeIds.includes(wardrobeId)).length
}

export interface NameCheck {
  ok: boolean
  /** Blocks saving. */
  error?: string
  /** Worth mentioning, but saving proceeds. */
  warning?: string
}

/**
 * Validate a wardrobe name.
 *
 * An empty name is refused: the name is the only thing distinguishing one
 * wardrobe from another in the UI, and a blank chip is unusable. A duplicate
 * only warns — two wardrobes really can share a name (they have distinct ids
 * and Nora may genuinely have two places called "Nan's"), so this is her call,
 * not the app's.
 */
export function checkWardrobeName(
  name: string,
  existing: Wardrobe[],
  selfId?: string,
): NameCheck {
  const trimmed = name.trim()
  if (!trimmed) return { ok: false, error: 'Give it a name first.' }
  if (trimmed.length > 60) return { ok: false, error: 'That name is a bit long.' }
  const clash = existing.some(
    (w) => w.id !== selfId && w.name.trim().toLowerCase() === trimmed.toLowerCase(),
  )
  if (clash) return { ok: true, warning: 'You already have one with that name.' }
  return { ok: true }
}

/**
 * What deleting this wardrobe would do, phrased for a confirmation dialog.
 *
 * Deleting is allowed even when it holds clothes — refusing would strand Nora
 * with a wardrobe she can't get rid of — but the confirmation has to say
 * plainly what happens, and the clothes are never deleted with it.
 */
export function describeDeletion(
  wardrobe: Wardrobe,
  garments: Garment[],
): { count: number; message: string } {
  const count = garmentCount(wardrobe.id, garments)
  if (count === 0) {
    return { count, message: `Delete “${wardrobe.name}”? It's empty, so nothing else changes.` }
  }
  const things = count === 1 ? '1 thing' : `${count} things`
  return {
    count,
    message:
      `Delete “${wardrobe.name}”? ${things} live there. ` +
      `They'll stay in your wardrobe but won't belong anywhere until you file them again.`,
  }
}

/**
 * Would switching this wardrobe off leave nothing active?
 *
 * Not blocked — Nora may genuinely want everything off for a moment — but the
 * UI uses this to explain the resulting empty app instead of leaving her
 * staring at nothing.
 */
export function isLastActive(wardrobeId: string, wardrobes: Wardrobe[]): boolean {
  const active = activeWardrobes(wardrobes)
  return active.length === 1 && active[0].id === wardrobeId
}
