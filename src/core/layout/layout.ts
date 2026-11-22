import type { BBox } from '@/core/geometry/bbox'
import { mulberry32, type Prng } from '@/core/layout/prng'
import {
  LAYOUT_ANCHOR_FRACTIONS_LANDSCAPE,
  LAYOUT_ANCHOR_FRACTIONS_PORTRAIT,
  LAYOUT_ANCHOR_FRACTIONS_SQUARE,
  LAYOUT_LANDSCAPE_ASPECT_THRESHOLD,
  LAYOUT_PORTRAIT_ASPECT_THRESHOLD,
  LAYOUT_MAIN_MAX_MAIN_OVERLAP_RATIO,
  LAYOUT_MAIN_MIN_VISIBLE_RATIO,
  LAYOUT_MAX_OBJECT_FRAME_AREA_RATIO,
  LAYOUT_VIOLATION_PENALTY,
  LAYOUT_VISIBILITY_SAMPLE_GRID,
  LAYOUT_CANDIDATE_COUNT,
  LAYOUT_CENTER_BALANCE_TOLERANCE_RATIO,
  LAYOUT_COVERAGE_TARGET_MAX,
  LAYOUT_COVERAGE_TARGET_MIN,
  LAYOUT_DENSITY_BASE_COUNT,
  LAYOUT_JITTER_RADIUS_RATIO,
  LAYOUT_MAIN_EDGE_MARGIN_RATIO,
  LAYOUT_MAIN_OBSCURED_AREA_RATIO,
  LAYOUT_MAX_DENSITY_SCALE,
  LAYOUT_MAX_ROTATION_DEG,
  LAYOUT_MIN_CENTER_DISTANCE_RATIO,
  LAYOUT_MIN_DENSITY_SCALE,
  LAYOUT_OVERLAP_PAIR_RATIO_MAX,
  LAYOUT_OVERLAP_PAIR_RATIO_MIN,
  LAYOUT_SCORE_WEIGHTS,
} from '@/core/layout/constants'
import { resolveObjectScale } from '@/core/layout/object-scale'
import { resolveFormat, type FormatDefinition } from '@/shared/formats'
import type { CanvasSize, Format, ObjectState, Size } from '@/shared/types'

interface Point {
  x: number
  y: number
}

export interface LayoutItemInput {
  objectId: string
  state: ObjectState
  bbox: BBox
}

export interface LayoutRequest {
  items: LayoutItemInput[]
  format: Format
  customSize?: CanvasSize | undefined
  size: Size
  objectScale?: number | undefined
  seed: number
}

export interface LayoutPlacement {
  objectId: string
  state: ObjectState
  x: number
  y: number
  rotation: number
  flipX: boolean
}

interface CandidateItem {
  input: LayoutItemInput
  x: number
  y: number
  rotation: number
  worldBBox: BBox
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length
}

function allPairs<T>(items: T[]): Array<[T, T]> {
  const pairs: Array<[T, T]> = []
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i]
      const b = items[j]
      if (a !== undefined && b !== undefined) pairs.push([a, b])
    }
  }
  return pairs
}

function intersectionArea(a: BBox, b: BBox): number {
  const x1 = Math.max(a.x, b.x)
  const y1 = Math.max(a.y, b.y)
  const x2 = Math.min(a.x + a.width, b.x + b.width)
  const y2 = Math.min(a.y + a.height, b.y + b.height)
  if (x2 <= x1 || y2 <= y1) return 0
  return (x2 - x1) * (y2 - y1)
}

function worldBBoxOf(bbox: BBox, x: number, y: number, rotationDeg: number): BBox {
  const halfW = bbox.width / 2
  const halfH = bbox.height / 2
  const corners: Point[] = [
    { x: -halfW, y: -halfH },
    { x: halfW, y: -halfH },
    { x: halfW, y: halfH },
    { x: -halfW, y: halfH },
  ]
  const angle = (rotationDeg * Math.PI) / 180
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const worldCorners = corners.map((corner) => ({
    x: x + corner.x * cos - corner.y * sin,
    y: y + corner.x * sin + corner.y * cos,
  }))
  const xs = worldCorners.map((corner) => corner.x)
  const ys = worldCorners.map((corner) => corner.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

function stableOrderByState(items: LayoutItemInput[]): LayoutItemInput[] {
  const background = items.filter((item) => item.state === 'bg')
  const main = items.filter((item) => item.state === 'main')
  return [...background, ...main]
}

export function computeLayoutDensityScale(format: FormatDefinition, itemCount: number): number {
  if (itemCount <= 0) return 1
  const countFactor = Math.sqrt(LAYOUT_DENSITY_BASE_COUNT / itemCount)
  const aspectRatio = format.height > 0 ? format.width / format.height : 1
  const elongation = aspectRatio >= 1 ? aspectRatio : 1 / aspectRatio
  const aspectFactor = clamp(Math.sqrt(elongation), 1, 1.25)
  return clamp(countFactor * aspectFactor, LAYOUT_MIN_DENSITY_SCALE, LAYOUT_MAX_DENSITY_SCALE)
}

function anchorFractionsFor(format: FormatDefinition): typeof LAYOUT_ANCHOR_FRACTIONS_SQUARE {
  const aspectRatio = format.height > 0 ? format.width / format.height : 1
  if (aspectRatio >= LAYOUT_LANDSCAPE_ASPECT_THRESHOLD) return LAYOUT_ANCHOR_FRACTIONS_LANDSCAPE
  if (aspectRatio <= LAYOUT_PORTRAIT_ASPECT_THRESHOLD) return LAYOUT_ANCHOR_FRACTIONS_PORTRAIT
  return LAYOUT_ANCHOR_FRACTIONS_SQUARE
}

function buildAnchors(format: FormatDefinition): Point[] {
  return anchorFractionsFor(format).map(([fx, fy]) => ({
    x: fx * format.width,
    y: fy * format.height,
  }))
}

function generateCandidate(
  rng: Prng,
  items: LayoutItemInput[],
  anchors: Point[],
  jitterRadius: number,
): CandidateItem[] {
  return items.map((input) => {
    const anchorIndex = Math.min(anchors.length - 1, Math.floor(rng() * anchors.length))
    const anchor = anchors[anchorIndex]
    const jitterAngle = rng() * 2 * Math.PI
    const jitterDistance = rng() * jitterRadius
    const rotation = (rng() * 2 - 1) * LAYOUT_MAX_ROTATION_DEG
    const x = (anchor?.x ?? 0) + Math.cos(jitterAngle) * jitterDistance
    const y = (anchor?.y ?? 0) + Math.sin(jitterAngle) * jitterDistance
    return { input, x, y, rotation, worldBBox: worldBBoxOf(input.bbox, x, y, rotation) }
  })
}

function rangeScore(value: number, min: number, max: number): number {
  if (value >= min && value <= max) return 1
  const span = max - min
  if (span <= 0) return 1
  const distance = value < min ? min - value : value - max
  return clamp(1 - distance / span, 0, 1)
}

function mainVisibilityScore(
  item: CandidateItem,
  laterItems: CandidateItem[],
  format: FormatDefinition,
): number {
  const margin = Math.min(format.width, format.height) * LAYOUT_MAIN_EDGE_MARGIN_RATIO
  const withinFrame =
    item.x >= margin &&
    item.x <= format.width - margin &&
    item.y >= margin &&
    item.y <= format.height - margin
  const edgeScore = withinFrame ? 1 : 0.3

  const area = item.worldBBox.width * item.worldBBox.height
  const obscuredArea = laterItems.reduce(
    (sum, later) => sum + intersectionArea(item.worldBBox, later.worldBBox),
    0,
  )
  const obscuredRatio = area > 0 ? Math.min(obscuredArea / area, 1) : 0
  const obscuredScore = obscuredRatio >= LAYOUT_MAIN_OBSCURED_AREA_RATIO ? 0 : 1 - obscuredRatio

  return (edgeScore + obscuredScore) / 2
}

function contains(bbox: BBox, x: number, y: number): boolean {
  return x >= bbox.x && x <= bbox.x + bbox.width && y >= bbox.y && y <= bbox.y + bbox.height
}

/** Share of the item's bbox that lies inside the frame and is not covered by later items (grid-sampled). */
export function visibleAreaRatio(item: BBox, later: BBox[], frame: BBox): number {
  const grid = LAYOUT_VISIBILITY_SAMPLE_GRID
  let visible = 0
  for (let row = 0; row < grid; row++) {
    for (let col = 0; col < grid; col++) {
      const x = item.x + ((col + 0.5) / grid) * item.width
      const y = item.y + ((row + 0.5) / grid) * item.height
      if (!contains(frame, x, y)) continue
      if (later.some((other) => contains(other, x, y))) continue
      visible++
    }
  }
  return visible / (grid * grid)
}

export function exceedsFrameAreaLimit(item: BBox, frame: BBox): boolean {
  const frameArea = frame.width * frame.height
  return frameArea > 0 && (item.width * item.height) / frameArea > LAYOUT_MAX_OBJECT_FRAME_AREA_RATIO
}

function countReadabilityViolations(candidate: CandidateItem[], frame: BBox): number {
  let violations = 0
  candidate.forEach((item, index) => {
    if (exceedsFrameAreaLimit(item.worldBBox, frame)) violations += 0.25
    if (item.input.state !== 'main') return
    const later = candidate.slice(index + 1).map((other) => other.worldBBox)
    if (visibleAreaRatio(item.worldBBox, later, frame) < LAYOUT_MAIN_MIN_VISIBLE_RATIO) violations++
    const area = item.worldBBox.width * item.worldBBox.height
    const otherMainOverlap = candidate
      .filter((other) => other !== item && other.input.state === 'main')
      .reduce((sum, other) => sum + intersectionArea(item.worldBBox, other.worldBBox), 0)
    if (area > 0 && otherMainOverlap / area > LAYOUT_MAIN_MAX_MAIN_OVERLAP_RATIO) violations++
  })
  return violations
}

function scoreCandidate(
  candidate: CandidateItem[],
  format: FormatDefinition,
  avgObjectSpan: number,
): number {
  const canvasRect: BBox = { x: 0, y: 0, width: format.width, height: format.height }
  const canvasArea = format.width * format.height
  const pairs = allPairs(candidate)

  const coverageRatio =
    canvasArea > 0
      ? candidate.reduce((sum, item) => sum + intersectionArea(item.worldBBox, canvasRect), 0) /
        canvasArea
      : 0
  const coverageScore = rangeScore(
    coverageRatio,
    LAYOUT_COVERAGE_TARGET_MIN,
    LAYOUT_COVERAGE_TARGET_MAX,
  )

  const meanX = average(candidate.map((item) => item.x))
  const meanY = average(candidate.map((item) => item.y))
  const centerDrift = Math.hypot(meanX - format.width / 2, meanY - format.height / 2)
  const maxDrift = Math.min(format.width, format.height) * LAYOUT_CENTER_BALANCE_TOLERANCE_RATIO
  const centerBalanceScore = maxDrift > 0 ? clamp(1 - centerDrift / maxDrift, 0, 1) : 1

  const overlapRatio =
    pairs.length > 0
      ? pairs.filter(([a, b]) => intersectionArea(a.worldBBox, b.worldBBox) > 0).length /
        pairs.length
      : 1
  const overlapScore = rangeScore(
    overlapRatio,
    LAYOUT_OVERLAP_PAIR_RATIO_MIN,
    LAYOUT_OVERLAP_PAIR_RATIO_MAX,
  )

  const offFrameCount = candidate.filter(
    (item) => intersectionArea(item.worldBBox, canvasRect) <= 0,
  ).length
  const offFrameScore = 1 - offFrameCount / candidate.length

  const mainItems = candidate.filter((item) => item.input.state === 'main')
  const mainScore =
    mainItems.length > 0
      ? average(
          mainItems.map((item) => {
            const index = candidate.indexOf(item)
            return mainVisibilityScore(item, candidate.slice(index + 1), format)
          }),
        )
      : 1

  const minCenterDistance = avgObjectSpan * LAYOUT_MIN_CENTER_DISTANCE_RATIO
  const clusteringScore =
    pairs.length > 0
      ? 1 -
        pairs.filter(([a, b]) => Math.hypot(a.x - b.x, a.y - b.y) < minCenterDistance).length /
          pairs.length
      : 1

  const weights = LAYOUT_SCORE_WEIGHTS
  const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0)
  const weightedScore =
    weights.coverage * coverageScore +
    weights.centerBalance * centerBalanceScore +
    weights.overlapRatio * overlapScore +
    weights.fullyOffFrame * offFrameScore +
    weights.mainVisibility * mainScore +
    weights.clustering * clusteringScore

  const baseScore = totalWeight > 0 ? weightedScore / totalWeight : 0
  return baseScore - LAYOUT_VIOLATION_PENALTY * countReadabilityViolations(candidate, canvasRect)
}

export function layoutScene(request: LayoutRequest): LayoutPlacement[] {
  if (request.items.length === 0) return []

  const format = resolveFormat(request)
  const objectScale = resolveObjectScale(
    request.objectScale,
    request.items.map((item) => item.bbox),
    format,
  )
  const orderedItems = stableOrderByState(
    request.items.map((item) => ({
      ...item,
      bbox: {
        ...item.bbox,
        width: item.bbox.width * objectScale,
        height: item.bbox.height * objectScale,
      },
    })),
  )
  const densityScale = computeLayoutDensityScale(format, orderedItems.length)
  const canvasMinSide = Math.min(format.width, format.height)
  const anchors = buildAnchors(format)
  const jitterRadius = canvasMinSide * LAYOUT_JITTER_RADIUS_RATIO * densityScale
  const avgObjectSpan = average(
    orderedItems.map((item) => Math.max(item.bbox.width, item.bbox.height)),
  )

  const rng = mulberry32(request.seed)
  let bestCandidate: CandidateItem[] | undefined
  let bestScore = -Infinity
  for (let i = 0; i < LAYOUT_CANDIDATE_COUNT; i++) {
    const candidate = generateCandidate(rng, orderedItems, anchors, jitterRadius)
    const score = scoreCandidate(candidate, format, avgObjectSpan)
    if (score > bestScore) {
      bestScore = score
      bestCandidate = candidate
    }
  }

  if (!bestCandidate) return []
  return bestCandidate.map((candidate) => ({
    objectId: candidate.input.objectId,
    state: candidate.input.state,
    x: candidate.x,
    y: candidate.y,
    rotation: candidate.rotation,
    flipX: false,
  }))
}
