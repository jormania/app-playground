/**
 * The Underground graph layout — a hand-rolled, deterministic layout, not
 * force-directed physics (SILVA.md: "this is the graph layer, and it
 * exists from v1 because loci give it a stable node set"). Loci clusters
 * are arranged on a ring; each cluster's members sit in a smaller ring
 * around its center. No new dependency (no d3-force) — "exists from v1"
 * doesn't require a real physics engine, and a proper one is a real
 * possible future refinement.
 */

import type { Thing } from './notion'
import type { Locus } from './loci'
import type { Path } from './paths'
import { cosineSimilarity } from './embeddings'

export const CANVAS_SIZE = 600
const CENTER = CANVAS_SIZE / 2
const CLUSTER_RING_RADIUS = 210
const NODE_RING_MIN_RADIUS = 28
const NODE_RING_PER_MEMBER = 5
const NODE_RING_MAX_RADIUS = 90

export interface GraphNode {
  thing: Thing
  x: number
  y: number
  clusterId: string
}

export interface GraphCluster {
  id: string
  /** The locus name, or 'Unclustered' for things in no locus. */
  label: string
  x: number
  y: number
  /** Radius of this cluster's own ring of members. The label has to clear
   *  it, so it can't be a constant: a busy cluster's ring reaches 90 while
   *  the old fixed label rise was 70, and the topmost node sat right on top
   *  of the caption. */
  nodeRadius: number
}

export interface GraphEdge {
  fromId: string
  toId: string
}

export interface GraphLayout {
  clusters: GraphCluster[]
  nodes: GraphNode[]
}

const UNCLUSTERED = 'unclustered'

/**
 * Groups Kept things into locus clusters (a thing in several loci clusters
 * under its *first* locus id — simplest tie-break, stated plainly rather
 * than hidden) plus one 'Unclustered' bucket, then arranges clusters on a
 * ring and each cluster's members on a smaller ring around it.
 */
export function computeGraphLayout(things: Thing[], loci: Locus[]): GraphLayout {
  const kept = things.filter((t) => t.state === 'Kept')

  const lociById = new Map(loci.map((l) => [l.id, l]))

  const membersByCluster = new Map<string, Thing[]>()
  for (const thing of kept) {
    // Resolved against the loci that actually exist, not just `lociIds[0]`.
    // A locus deleted straight out of Notion leaves its id behind on every
    // member, and keying on that dead id built a *second* cluster which
    // then fell back to the label 'Unclustered' — so the graph drew two
    // separate rings both captioned "Unclustered", with no hint that a
    // clearing had gone missing. A thing whose loci are all gone is simply
    // unclustered, which is the truth.
    const clusterId = thing.lociIds.find((id) => lociById.has(id)) ?? UNCLUSTERED
    const list = membersByCluster.get(clusterId) ?? []
    list.push(thing)
    membersByCluster.set(clusterId, list)
  }

  return ringLayout(membersByCluster, (id) =>
    id === UNCLUSTERED ? 'Unclustered' : (lociById.get(id)?.name ?? 'Unclustered'),
  )
}

/**
 * Clusters on a ring, each cluster's members on a smaller ring around it.
 *
 * Shared by both drawings in the app — the crossing (clustered by locus) and
 * the rootstock (clustered by source) — so the two are the *same picture*
 * with a different grouping, rather than two diagrams that merely resemble
 * each other and drift apart at the first change to either.
 */
function ringLayout(
  membersByCluster: Map<string, Thing[]>,
  labelFor: (clusterId: string) => string,
): GraphLayout {
  const clusterIds = [...membersByCluster.keys()]

  const clusters: GraphCluster[] = clusterIds.map((id, i) => {
    const angle = clusterIds.length > 1 ? (2 * Math.PI * i) / clusterIds.length : 0
    const radius = clusterIds.length > 1 ? CLUSTER_RING_RADIUS : 0
    const members = membersByCluster.get(id) ?? []
    return {
      id,
      label: labelFor(id),
      x: CENTER + radius * Math.cos(angle),
      y: CENTER + radius * Math.sin(angle),
      nodeRadius: nodeRingRadius(members.length),
    }
  })
  const clusterById = new Map(clusters.map((c) => [c.id, c]))

  const nodes: GraphNode[] = []
  for (const [clusterId, members] of membersByCluster) {
    const cluster = clusterById.get(clusterId)!
    members.forEach((thing, i) => {
      const angle = (2 * Math.PI * i) / members.length
      nodes.push({
        thing,
        clusterId,
        x: cluster.x + cluster.nodeRadius * Math.cos(angle),
        y: cluster.y + cluster.nodeRadius * Math.sin(angle),
      })
    })
  }

  return { clusters, nodes }
}

function nodeRingRadius(memberCount: number): number {
  return memberCount <= 1
    ? 0
    : Math.min(NODE_RING_MAX_RADIUS, NODE_RING_MIN_RADIUS + memberCount * NODE_RING_PER_MEMBER)
}

/**
 * The rootstock: kept things gathered under the source each came from.
 *
 * The same ring layout as the crossing, grouped by `sourceId` instead of
 * locus — so where the crossing answers "what have I connected to what",
 * this answers "what grew from where".
 *
 * ── Why there is no "No source" cluster ──────────────────────────────────
 * Deliberately unlike the crossing, which does give the unplaced their own
 * 'Unclustered' ring. Two reasons, and the second is the real one:
 *
 *   1. Scale. A source is optional and most things never get one — an
 *      observation, a question, anything of your own. So "No source" would
 *      reliably be the largest cluster in the drawing, and since every
 *      cluster is allotted the same ring, one enormous bucket squashes the
 *      actual roots into the margin. The picture would be mostly the thing
 *      it isn't about.
 *   2. It isn't a root. The crossing draws the whole forest, where being
 *      unplaced is a genuine state of a thing. This view is about
 *      provenance, and a thing with no source didn't come from somewhere
 *      unnamed — it has no root at all. Drawing one would invent a place
 *      that doesn't exist, which is the filing move the app avoids
 *      everywhere else. It would also contradict the list below it, which
 *      already shows only sources something was kept from.
 */
export function computeRootstockLayout(
  things: Thing[],
  sources: { id: string; title: string }[],
): GraphLayout {
  const titleById = new Map(sources.map((s) => [s.id, s.title]))

  const membersByCluster = new Map<string, Thing[]>()
  for (const thing of things) {
    if (thing.state !== 'Kept') continue
    // Resolved against the sources that actually exist, for the same reason
    // the crossing resolves loci: a source deleted straight out of Notion
    // leaves its id behind on every thing that came from it, and a dead id
    // would build a cluster with no name to put on it.
    if (!thing.sourceId || !titleById.has(thing.sourceId)) continue
    const list = membersByCluster.get(thing.sourceId) ?? []
    list.push(thing)
    membersByCluster.set(thing.sourceId, list)
  }

  return ringLayout(membersByCluster, (id) => titleById.get(id) ?? '')
}

const VIEWBOX_PADDING = 40
/** Clear air between a cluster's outermost node and its caption. */
const CLUSTER_LABEL_GAP = 22
const MIN_VIEWBOX_SIZE = 220

/** Longest caption drawn before it is elided. A source title can be a full
 *  subtitled book name; past this it stops being a label and starts being a
 *  sentence lying across the drawing. */
const CLUSTER_LABEL_MAX_CHARS = 24
/** Rough advance width per character, as a fraction of the caption's font
 *  size, for the small-caps face in graphs.module.css. An estimate is the
 *  right tool here: the exact width needs a laid-out DOM, the layout is
 *  pure and runs before any of that, and erring wide only ever adds a
 *  little slack at the edge. */
const CLUSTER_LABEL_CHAR_RATIO = 0.55

/**
 * Caption size, in user units, for a given drawing.
 *
 * ── Why this isn't just a CSS font-size ──────────────────────────────────
 * An SVG font-size is in *user units*, so what reaches the screen is that
 * size times the viewBox scale — and the two drawings fit their boxes to
 * their own content, so their scales differ. A flat 13px in the stylesheet
 * therefore rendered the crossing's captions at ~17px and the rootstock's
 * at ~15px: the same declaration, two visibly different sizes, and it would
 * drift again with any forest whose layout happened to be a different
 * shape. Scaling the size *with* the box cancels the viewBox scale out, so
 * captions land at one apparent size everywhere. The constant is chosen to
 * keep the crossing looking exactly as it did — it is the baseline here.
 */
const CLUSTER_LABEL_BASE = 15

export function clusterLabelFontSize(viewBoxWidth: number): number {
  return (CLUSTER_LABEL_BASE * viewBoxWidth) / CANVAS_SIZE
}

/** The caption as drawn — elided rather than allowed to run off. */
export function clusterLabelText(cluster: GraphCluster): string {
  return cluster.label.length > CLUSTER_LABEL_MAX_CHARS
    ? `${cluster.label.slice(0, CLUSTER_LABEL_MAX_CHARS - 1)}…`
    : cluster.label
}

/**
 * Where a cluster's caption sits — above its own ring, not a fixed distance
 * above its centre. Exported so the SVG and the view-box maths can't drift
 * apart, and so both drawings place their labels identically.
 */
export function clusterLabelY(cluster: GraphCluster): number {
  return cluster.y - cluster.nodeRadius - CLUSTER_LABEL_GAP
}

/**
 * Half the caption's drawn width. Captions are `text-anchor: middle`, so a
 * cluster near the edge of the drawing throws its label out *sideways* by
 * this much in each direction — which the view box used to know nothing
 * about, having only ever been told the label's height. A long title on an
 * edge cluster was simply sliced off by the SVG boundary.
 */
export function clusterLabelHalfWidth(cluster: GraphCluster, fontSize: number): number {
  return (clusterLabelText(cluster).length * fontSize * CLUSTER_LABEL_CHAR_RATIO) / 2
}

export interface ViewBox {
  minX: number
  minY: number
  width: number
  height: number
}

/**
 * A tight bounding box around the actual layout (nodes plus cluster labels,
 * which sit above their cluster), padded and floored to a minimum size —
 * so a handful of things doesn't render as a few dots lost in a fixed
 * 600×600 canvas. Falls back to the full canvas when the layout is empty.
 */
/**
 * The extent of a list of coordinates.
 *
 * `Math.min(...xs)` reads better and is what this used to do, but spreading
 * an array into a call passes one *argument* per element — and a forest with
 * enough kept things to draw eventually passes the engine's argument limit
 * and throws a RangeError rather than drawing anything. The crossing is the
 * one view whose input grows without bound, so it is the one place that has
 * to fold instead of spread.
 */
function extent(values: number[]): { min: number; max: number } {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (const value of values) {
    if (value < min) min = value
    if (value > max) max = value
  }
  return { min, max }
}

export function computeViewBox(layout: GraphLayout): ViewBox {
  if (layout.nodes.length === 0) {
    return { minX: 0, minY: 0, width: CANVAS_SIZE, height: CANVAS_SIZE }
  }

  const xs = layout.nodes.map((n) => n.x)
  const ys = layout.nodes.map((n) => n.y)
  if (layout.clusters.length > 1) {
    // The caption size depends on the box, and the box depends on how wide
    // the captions are — so size them against the nodes-only extent first.
    // One pass, deterministic, and the box only ever grows from here, so
    // the estimate errs generous rather than tight.
    const nodesExtent = extent(xs)
    const provisionalWidth = nodesExtent.max - nodesExtent.min + VIEWBOX_PADDING * 2
    const fontSize = clusterLabelFontSize(Math.max(MIN_VIEWBOX_SIZE, provisionalWidth))
    for (const c of layout.clusters) {
      // Both ends of the caption, not just its centre — a centred label on
      // an edge cluster reaches sideways well past the node ring, and
      // measuring only `c.x` is what let a long title get sliced off by the
      // SVG boundary.
      const half = clusterLabelHalfWidth(c, fontSize)
      xs.push(c.x - half, c.x + half)
      ys.push(clusterLabelY(c))
    }
  }

  const xExtent = extent(xs)
  const yExtent = extent(ys)
  const minX = xExtent.min - VIEWBOX_PADDING
  const maxX = xExtent.max + VIEWBOX_PADDING
  const minY = yExtent.min - VIEWBOX_PADDING
  const maxY = yExtent.max + VIEWBOX_PADDING

  const width = Math.max(MIN_VIEWBOX_SIZE, maxX - minX)
  const height = Math.max(MIN_VIEWBOX_SIZE, maxY - minY)
  // Center the floored minimum size on the content rather than anchoring
  // to its top-left corner.
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2

  return { minX: centerX - width / 2, minY: centerY - height / 2, width, height }
}

export function pathsToEdges(paths: Path[]): GraphEdge[] {
  return paths
    .filter((p): p is Path & { fromId: string; toId: string } => Boolean(p.fromId && p.toId))
    .map((p) => ({ fromId: p.fromId, toId: p.toId }))
}

// Same bar as provocations.ts's NEAR_NEIGHBOUR_THRESHOLD — a graph fiber
// and a Near-neighbours provocation are the same underlying relationship,
// just shown in two different places.
export const MYCORRHIZA_THRESHOLD = 0.55

function pairKey(aId: string, bId: string): string {
  return [aId, bId].sort().join('::')
}

export interface MycorrhizaFiber {
  aId: string
  bId: string
  similarity: number
}

/** Faint, unclickable connections above the similarity threshold — never
 *  for a pair already connected by a real Path (that's not latent, it's
 *  already asserted). Only ever computed from vectors the caller already
 *  has in hand (peeked from cache) — this module never touches the model. */
/** Same reasoning and same number as provocations.ts's MAX_PAIRWISE_THINGS:
 *  this is an O(n²) cosine sweep that runs inside a render, so it works over
 *  the most recently kept slice rather than the whole forest. The graph is a
 *  picture of the live collection, not an audit of it. */
export const MAX_MYCORRHIZA_THINGS = 300

export function computeMycorrhiza(
  things: Thing[],
  vectorsById: Map<string, Float32Array>,
  paths: Path[],
): MycorrhizaFiber[] {
  const eligible = things.filter((t) => t.state === 'Kept' && vectorsById.has(t.id))
  const kept = eligible.length <= MAX_MYCORRHIZA_THINGS
    ? eligible
    : [...eligible].sort((a, b) => (b.kept || '').localeCompare(a.kept || '')).slice(0, MAX_MYCORRHIZA_THINGS)
  const connected = new Set(
    paths.filter((p) => p.fromId && p.toId).map((p) => pairKey(p.fromId!, p.toId!)),
  )

  const fibers: MycorrhizaFiber[] = []
  for (let i = 0; i < kept.length; i++) {
    for (let j = i + 1; j < kept.length; j++) {
      const a = kept[i]
      const b = kept[j]
      if (connected.has(pairKey(a.id, b.id))) continue
      const similarity = cosineSimilarity(vectorsById.get(a.id)!, vectorsById.get(b.id)!)
      if (similarity < MYCORRHIZA_THRESHOLD) continue
      fibers.push({ aId: a.id, bId: b.id, similarity })
    }
  }
  return fibers
}
