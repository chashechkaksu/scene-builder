import type { BBox } from '@/core/geometry/bbox'
import { mulberry32, type Prng } from '@/core/layout/prng'
import {
  LAYOUT_ANCHOR_FRACTIONS_LANDSCAPE,
  LAYOUT_ANCHOR_FRACTIONS_PORTRAIT,
  LAYOUT_ANCHOR_FRACTIONS_SQUARE,
  LAYOUT_ASPECT_DENSITY_MAX,
  LAYOUT_BG_MAX_GROUP_AREA_RATIO,
  LAYOUT_BG_MAX_OVERLAPPING_BACKGROUNDS,
  LAYOUT_BG_MIN_VISIBLE_RATIO,
  LAYOUT_CANDIDATE_COUNT,
  LAYOUT_CENTER_BALANCE_TOLERANCE_RATIO,
  LAYOUT_COVERAGE_TARGET_MAX,
  LAYOUT_COVERAGE_TARGET_MIN,
  LAYOUT_DENSITY_BASE_COUNT,
  LAYOUT_JITTER_RADIUS_RATIO,
  LAYOUT_LANDSCAPE_ASPECT_THRESHOLD,
  LAYOUT_LONG_SIDE_ZONE_COUNT,
  LAYOUT_MAIN_COVERED_MIN_VISIBLE_RATIO,
  LAYOUT_MAIN_EDGE_MARGIN_RATIO,
  LAYOUT_MAIN_MAX_COVER_OF_LARGE_RATIO,
  LAYOUT_MAIN_MAX_GAP_RATIO,
  LAYOUT_MAIN_MAX_MAIN_OVERLAP_RATIO,
  LAYOUT_MAIN_MIN_VISIBLE_RATIO,
  LAYOUT_MAIN_OBSCURED_AREA_RATIO,
  LAYOUT_MAIN_OVER_BG_MAX_COVER_RATIO,
  LAYOUT_MAX_DENSITY_SCALE,
  LAYOUT_MAX_OBJECT_FRAME_AREA_RATIO,
  LAYOUT_MIN_CENTER_DISTANCE_RATIO,
  LAYOUT_MIN_DENSITY_SCALE,
  LAYOUT_OVERLAP_PAIR_RATIO_MAX,
  LAYOUT_OVERLAP_PAIR_RATIO_MIN,
  LAYOUT_PORTRAIT_ASPECT_THRESHOLD,
  LAYOUT_SCORE_WEIGHTS,
  LAYOUT_SMALL_MAIN_AREA_RATIO,
  LAYOUT_SMALL_MAIN_MAX_GAP_RATIO,
  LAYOUT_SMALL_MAIN_MAX_OVERLAP_RATIO,
  LAYOUT_SQUARE_ZONE_GRID,
  LAYOUT_VIOLATION_PENALTY,
  LAYOUT_VISIBILITY_SAMPLE_GRID,
  LAYOUT_ZONE_COVERAGE_TARGET,
  LAYOUT_ZONE_SAMPLE_GRID,
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

function area(bbox: BBox): number {
  return bbox.width * bbox.height
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

/** Largest background first, then main objects from the largest to the smallest, so small ones lie on top. */
function stableOrderByState(items: LayoutItemInput[]): LayoutItemInput[] {
  const background = items
    .filter((item) => item.state === 'bg')
    .sort((a, b) => area(b.bbox) - area(a.bbox))
  const main = items
    .filter((item) => item.state === 'main')
    .sort((a, b) => area(b.bbox) - area(a.bbox))
  return [...background, ...main]
}

export function computeLayoutDensityScale(format: FormatDefinition, itemCount: number): number {
  if (itemCount <= 0) return 1
  const countFactor = Math.sqrt(LAYOUT_DENSITY_BASE_COUNT / itemCount)
  const aspectRatio = format.height > 0 ? format.width / format.height : 1
  const elongation = aspectRatio >= 1 ? aspectRatio : 1 / aspectRatio
  const aspectFactor = clamp(Math.sqrt(elongation), 1, LAYOUT_ASPECT_DENSITY_MAX)
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

function shuffledIndices(rng: Prng, count: number): number[] {
  const indices = Array.from({ length: count }, (_, index) => index)
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const a = indices[i]
    const b = indices[j]
    if (a !== undefined && b !== undefined) {
      indices[i] = b
      indices[j] = a
    }
  }
  return indices
}

function placeNextToLarger(rng: Prng, small: BBox, target: CandidateItem): Point {
  const overlapDepth = rng() * LAYOUT_SMALL_MAIN_MAX_OVERLAP_RATIO
  const side = Math.floor(rng() * 4)
  const along = (rng() * 2 - 1) * 0.5
  const horizontalReach = target.worldBBox.width / 2 + (small.width / 2) * (1 - overlapDepth)
  const verticalReach = target.worldBBox.height / 2 + (small.height / 2) * (1 - overlapDepth)
  const centerX = target.x
  const centerY = target.y
  if (side === 0)
    return { x: centerX + horizontalReach, y: centerY + along * target.worldBBox.height }
  if (side === 1)
    return { x: centerX - horizontalReach, y: centerY + along * target.worldBBox.height }
  if (side === 2) return { x: centerX + along * target.worldBBox.width, y: centerY + verticalReach }
  return { x: centerX + along * target.worldBBox.width, y: centerY - verticalReach }
}

function generateCandidate(
  rng: Prng,
  items: LayoutItemInput[],
  anchors: Point[],
  jitterRadius: number,
): CandidateItem[] {
  const anchorOrder = shuffledIndices(rng, anchors.length)
  const mainAreas = items.filter((item) => item.state === 'main').map((item) => area(item.bbox))
  const largestMainArea = Math.max(0, ...mainAreas)
  const placed: CandidateItem[] = []
  items.forEach((input, itemIndex) => {
    const anchorIndex = anchorOrder[itemIndex % anchorOrder.length] ?? 0
    const anchor = anchors[anchorIndex]
    const jitterAngle = rng() * 2 * Math.PI
    const jitterDistance = rng() * jitterRadius
    let x = (anchor?.x ?? 0) + Math.cos(jitterAngle) * jitterDistance
    let y = (anchor?.y ?? 0) + Math.sin(jitterAngle) * jitterDistance
    const isSmall =
      input.state === 'main' &&
      mainAreas.length > 1 &&
      area(input.bbox) <= largestMainArea * LAYOUT_SMALL_MAIN_AREA_RATIO
    const larger = placed.filter(
      (item) => item.input.state === 'main' && area(item.input.bbox) > area(input.bbox),
    )
    if (isSmall && larger.length > 0) {
      const target = larger[Math.floor(rng() * larger.length)]
      if (target) ({ x, y } = placeNextToLarger(rng, input.bbox, target))
    }
    placed.push({ input, x, y, rotation: 0, worldBBox: worldBBoxOf(input.bbox, x, y, 0) })
  })
  return placed
}

function rangeScore(value: number, min: number, max: number): number {
  if (value >= min && value <= max) return 1
  const span = max - min
  if (span <= 0) return 1
  const distance = value < min ? min - value : value - max
  return clamp(1 - distance / span, 0, 1)
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
  const frameArea = area(frame)
  return frameArea > 0 && area(item) / frameArea > LAYOUT_MAX_OBJECT_FRAME_AREA_RATIO
}

function boundsOf(boxes: BBox[]): BBox {
  const minX = Math.min(...boxes.map((box) => box.x))
  const minY = Math.min(...boxes.map((box) => box.y))
  const maxX = Math.max(...boxes.map((box) => box.x + box.width))
  const maxY = Math.max(...boxes.map((box) => box.y + box.height))
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

/** Share of the frame covered by the bounding rectangle of all objects (clipped to the frame). */
export function groupAreaRatio(boxes: BBox[], frame: BBox): number {
  if (boxes.length === 0 || area(frame) <= 0) return 0
  return intersectionArea(boundsOf(boxes), frame) / area(frame)
}

function rectGap(a: BBox, b: BBox): number {
  const dx = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.width, b.x + b.width))
  const dy = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.height, b.y + b.height))
  return Math.hypot(dx, dy)
}

/** Number of extra disconnected main-object clusters (gap above the limit); 0 = one connected group. */
export function mainGapBreaks(mainBoxes: BBox[], frame: BBox): number {
  if (mainBoxes.length < 2) return 0
  const maxGap = Math.min(frame.width, frame.height) * LAYOUT_MAIN_MAX_GAP_RATIO
  const parent = mainBoxes.map((_, index) => index)
  const find = (index: number): number => {
    let root = index
    while (parent[root] !== root) root = parent[root] ?? root
    return root
  }
  for (const [i, a] of mainBoxes.entries()) {
    for (const [j, b] of mainBoxes.entries()) {
      if (j <= i || rectGap(a, b) > maxGap) continue
      parent[find(i)] = find(j)
    }
  }
  return new Set(mainBoxes.map((_, index) => find(index))).size - 1
}

/** Minimum visible share a main object needs: only a larger one lying under a smaller one may be partly covered. */
export function requiredMainVisibility(
  index: number,
  boxes: BBox[],
  states: ObjectState[],
): number {
  const self = boxes[index]
  if (!self) return LAYOUT_MAIN_MIN_VISIBLE_RATIO
  const coveredByLaterMain = boxes.some(
    (other, otherIndex) =>
      otherIndex > index && states[otherIndex] === 'main' && intersectionArea(self, other) > 0,
  )
  return coveredByLaterMain ? LAYOUT_MAIN_COVERED_MIN_VISIBLE_RATIO : LAYOUT_MAIN_MIN_VISIBLE_RATIO
}

/** Violations of the stack rules: depth at most 2 and a small object covers no more than the allowed share of a large one. */
export function mainStackViolations(boxes: BBox[], states: ObjectState[]): number {
  let violations = 0
  boxes.forEach((top, topIndex) => {
    if (states[topIndex] !== 'main') return
    const under = boxes.flatMap((box, index) =>
      index < topIndex && states[index] === 'main' && intersectionArea(top, box) > 0 ? [box] : [],
    )
    const above = boxes.filter(
      (box, index) =>
        index > topIndex && states[index] === 'main' && intersectionArea(top, box) > 0,
    )
    if (under.length > 1) violations++
    if (under.length > 0 && above.length > 0) violations++
    for (const box of under) {
      if (intersectionArea(top, box) / area(box) > LAYOUT_MAIN_MAX_COVER_OF_LARGE_RATIO)
        violations++
    }
  })
  return violations
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
  const itemArea = area(item.worldBBox)
  const obscuredArea = laterItems.reduce(
    (sum, later) => sum + intersectionArea(item.worldBBox, later.worldBBox),
    0,
  )
  const obscuredRatio = itemArea > 0 ? Math.min(obscuredArea / itemArea, 1) : 0
  const obscuredScore = obscuredRatio >= LAYOUT_MAIN_OBSCURED_AREA_RATIO ? 0 : 1 - obscuredRatio
  return (edgeScore + obscuredScore) / 2
}

function coveredAreaRatio(item: BBox, covers: BBox[], frame: BBox): number {
  const grid = LAYOUT_VISIBILITY_SAMPLE_GRID
  let inFrame = 0
  let covered = 0
  for (let row = 0; row < grid; row++) {
    for (let col = 0; col < grid; col++) {
      const x = item.x + ((col + 0.5) / grid) * item.width
      const y = item.y + ((row + 0.5) / grid) * item.height
      if (!contains(frame, x, y)) continue
      inFrame++
      if (covers.some((other) => contains(other, x, y))) covered++
    }
  }
  return inFrame === 0 ? 0 : covered / inFrame
}

function isSmallMain(index: number, boxes: BBox[], states: ObjectState[]): boolean {
  const self = boxes[index]
  if (!self || states[index] !== 'main') return false
  const largest = Math.max(...boxes.filter((_, i) => states[i] === 'main').map(area))
  return area(self) <= largest * LAYOUT_SMALL_MAIN_AREA_RATIO
}

/** Small main objects (coin, pen, puzzle) must sit right next to the nearest larger main object. */
export function smallMainViolations(boxes: BBox[], states: ObjectState[], frame: BBox): number {
  const mainBoxes = boxes.filter((_, index) => states[index] === 'main')
  if (mainBoxes.length < 2) return 0
  const maxGap = Math.min(frame.width, frame.height) * LAYOUT_SMALL_MAIN_MAX_GAP_RATIO
  let violations = 0
  boxes.forEach((small, index) => {
    if (!isSmallMain(index, boxes, states)) return
    const larger = mainBoxes.filter((box) => area(box) > area(small))
    if (larger.length === 0) return
    if (Math.min(...larger.map((box) => rectGap(small, box))) > maxGap) violations++
    const overlap = Math.max(...larger.map((box) => intersectionArea(small, box)))
    if (overlap / area(small) > LAYOUT_SMALL_MAIN_MAX_OVERLAP_RATIO) violations++
  })
  return violations
}

function buildZones(frame: BBox): BBox[] {
  const aspectRatio = frame.height > 0 ? frame.width / frame.height : 1
  const cols =
    aspectRatio >= LAYOUT_LANDSCAPE_ASPECT_THRESHOLD
      ? LAYOUT_LONG_SIDE_ZONE_COUNT
      : aspectRatio <= LAYOUT_PORTRAIT_ASPECT_THRESHOLD
        ? 1
        : LAYOUT_SQUARE_ZONE_GRID
  const rows =
    aspectRatio <= LAYOUT_PORTRAIT_ASPECT_THRESHOLD
      ? LAYOUT_LONG_SIDE_ZONE_COUNT
      : aspectRatio >= LAYOUT_LANDSCAPE_ASPECT_THRESHOLD
        ? 1
        : LAYOUT_SQUARE_ZONE_GRID
  const zones: BBox[] = []
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      zones.push({
        x: (col * frame.width) / cols,
        y: (row * frame.height) / rows,
        width: frame.width / cols,
        height: frame.height / rows,
      })
    }
  }
  return zones
}

function zoneBalanceScore(candidate: CandidateItem[], frame: BBox): number {
  const grid = LAYOUT_ZONE_SAMPLE_GRID
  const scores = buildZones(frame).map((zone) => {
    let covered = 0
    for (let row = 0; row < grid; row++) {
      for (let col = 0; col < grid; col++) {
        const x = zone.x + ((col + 0.5) / grid) * zone.width
        const y = zone.y + ((row + 0.5) / grid) * zone.height
        if (candidate.some((item) => contains(item.worldBBox, x, y))) covered++
      }
    }
    return clamp(covered / (grid * grid) / LAYOUT_ZONE_COVERAGE_TARGET, 0, 1)
  })
  return average(scores)
}

function countReadabilityViolations(candidate: CandidateItem[], frame: BBox): number {
  const boxes = candidate.map((item) => item.worldBBox)
  const states = candidate.map((item) => item.input.state)
  const mainBoxes = boxes.filter((_, index) => states[index] === 'main')
  const mainGroup = mainBoxes.length > 0 ? boundsOf(mainBoxes) : undefined
  let violations = mainStackViolations(boxes, states) + smallMainViolations(boxes, states, frame)
  candidate.forEach((item, index) => {
    const box = item.worldBBox
    if (exceedsFrameAreaLimit(box, frame)) violations += 0.25
    const visible = visibleAreaRatio(box, boxes.slice(index + 1), frame)
    if (item.input.state === 'main') {
      if (visible < requiredMainVisibility(index, boxes, states)) violations++
      boxes.forEach((other, otherIndex) => {
        if (otherIndex <= index || states[otherIndex] !== 'main') return
        const smaller = Math.min(area(box), area(other))
        const limit =
          isSmallMain(index, boxes, states) || isSmallMain(otherIndex, boxes, states)
            ? LAYOUT_SMALL_MAIN_MAX_OVERLAP_RATIO
            : LAYOUT_MAIN_MAX_MAIN_OVERLAP_RATIO
        if (smaller > 0 && intersectionArea(box, other) / smaller > limit) violations++
      })
      return
    }
    if (visible < LAYOUT_BG_MIN_VISIBLE_RATIO) violations++
    const mainCovers = boxes
      .slice(index + 1)
      .filter((_, offset) => states[index + 1 + offset] === 'main')
    if (coveredAreaRatio(box, mainCovers, frame) > LAYOUT_MAIN_OVER_BG_MAX_COVER_RATIO) violations++
    const overlappingBackgrounds = boxes.filter(
      (other, otherIndex) =>
        otherIndex !== index && states[otherIndex] === 'bg' && intersectionArea(box, other) > 0,
    ).length
    if (overlappingBackgrounds > LAYOUT_BG_MAX_OVERLAPPING_BACKGROUNDS) violations++
    if (mainGroup && area(box) > area(mainGroup) * LAYOUT_BG_MAX_GROUP_AREA_RATIO) violations++
  })
  return violations
}

function scoreCandidate(
  candidate: CandidateItem[],
  format: FormatDefinition,
  avgObjectSpan: number,
): number {
  const canvasRect: BBox = { x: 0, y: 0, width: format.width, height: format.height }
  const canvasArea = area(canvasRect)
  const boxes = candidate.map((item) => item.worldBBox)
  const pairs = allPairs(candidate)

  const coverageRatio =
    canvasArea > 0
      ? boxes.reduce((sum, box) => sum + intersectionArea(box, canvasRect), 0) / canvasArea
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

  const offFrameCount = boxes.filter((box) => intersectionArea(box, canvasRect) <= 0).length
  const offFrameScore = 1 - offFrameCount / candidate.length

  const mainItems = candidate.filter((item) => item.input.state === 'main')
  const mainScore =
    mainItems.length > 0
      ? average(
          mainItems.map((item) =>
            mainVisibilityScore(item, candidate.slice(candidate.indexOf(item) + 1), format),
          ),
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
    weights.zoneBalance * zoneBalanceScore(candidate, canvasRect) +
    weights.clustering * clusteringScore

  const baseScore = totalWeight > 0 ? weightedScore / totalWeight : 0
  return baseScore - LAYOUT_VIOLATION_PENALTY * countReadabilityViolations(candidate, canvasRect)
}

function scaledItems(request: LayoutRequest, format: FormatDefinition): LayoutItemInput[] {
  const objectScale = resolveObjectScale(
    request.objectScale,
    request.items.map((item) => item.bbox),
    format,
  )
  return request.items.map((item) => ({
    ...item,
    bbox: {
      ...item.bbox,
      width: item.bbox.width * objectScale,
      height: item.bbox.height * objectScale,
    },
  }))
}

export function layoutScene(request: LayoutRequest): LayoutPlacement[] {
  if (request.items.length === 0) return []

  const format = resolveFormat(request)
  const orderedItems = stableOrderByState(scaledItems(request, format))
  const densityScale = computeLayoutDensityScale(format, orderedItems.length)
  const avgObjectSpan = average(
    orderedItems.map((item) => Math.max(item.bbox.width, item.bbox.height)),
  )

  const anchors = buildAnchors(format)
  const jitterRadius =
    Math.min(format.width, format.height) * LAYOUT_JITTER_RADIUS_RATIO * densityScale
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

export interface LayoutDiagnostics {
  objectId: string
  state: ObjectState
  visibleRatio: number
  requiredVisibleRatio: number
}

export interface LayoutReport {
  objects: LayoutDiagnostics[]
  groupAreaRatio: number
  mainGapBreaks: number
  mainStackViolations: number
}

/** Readability metrics of a finished layout (bbox-based, same samplers as the scorer). */
export function diagnoseLayout(
  request: LayoutRequest,
  placements: LayoutPlacement[],
): LayoutReport {
  const format = resolveFormat(request)
  const frame: BBox = { x: 0, y: 0, width: format.width, height: format.height }
  const items = scaledItems(request, format)
  const boxes = placements.map((placement) => {
    const input = items.find(
      (item) => item.objectId === placement.objectId && item.state === placement.state,
    )
    return worldBBoxOf(
      input?.bbox ?? { x: 0, y: 0, width: 0, height: 0 },
      placement.x,
      placement.y,
      placement.rotation,
    )
  })
  const states = placements.map((placement) => placement.state)
  return {
    objects: placements.map((placement, index) => ({
      objectId: placement.objectId,
      state: placement.state,
      visibleRatio: visibleAreaRatio(boxes[index] ?? frame, boxes.slice(index + 1), frame),
      requiredVisibleRatio:
        placement.state === 'main'
          ? requiredMainVisibility(index, boxes, states)
          : LAYOUT_BG_MIN_VISIBLE_RATIO,
    })),
    groupAreaRatio: groupAreaRatio(boxes, frame),
    mainStackViolations: mainStackViolations(boxes, states),
    mainGapBreaks: mainGapBreaks(
      boxes.filter((_, index) => states[index] === 'main'),
      frame,
    ),
  }
}
