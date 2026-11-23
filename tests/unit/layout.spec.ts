import { describe, expect, it } from 'vitest'
import {
  LAYOUT_BG_MIN_VISIBLE_RATIO,
  LAYOUT_MAIN_MAX_COVER_OF_LARGE_RATIO,
  LAYOUT_MAIN_MAX_MAIN_OVERLAP_RATIO,
  LAYOUT_SMALL_MAIN_MAX_GAP_RATIO,
  LAYOUT_SMALL_MAIN_MAX_OVERLAP_RATIO,
  LAYOUT_MAIN_COVERED_MIN_VISIBLE_RATIO,
  LAYOUT_MAIN_MIN_VISIBLE_RATIO,
  LAYOUT_MAX_OBJECT_FRAME_AREA_RATIO,
} from '@/core/layout/constants'
import {
  computeLayoutDensityScale,
  diagnoseLayout,
  smallMainViolations,
  mainStackViolations,
  requiredMainVisibility,
  exceedsFrameAreaLimit,
  layoutScene,
  visibleAreaRatio,
  type LayoutItemInput,
} from '@/core/layout/layout'
import { getFormat } from '@/shared/formats'
import type { Format, ObjectState } from '@/shared/types'

function makeItems(count: number): LayoutItemInput[] {
  const states: ObjectState[] = ['main', 'bg']
  return Array.from({ length: count }, (_, index) => ({
    objectId: `obj-${index}`,
    state: states[index % 2] as ObjectState,
    bbox: { x: 0, y: 0, width: 100 + index * 10, height: 80 + index * 5 },
  }))
}

function intersects(
  bbox: { x: number; y: number; width: number; height: number },
  rect: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    bbox.x < rect.x + rect.width &&
    bbox.x + bbox.width > rect.x &&
    bbox.y < rect.y + rect.height &&
    bbox.y + bbox.height > rect.y
  )
}

function placementWorldBBox(
  placement: { x: number; y: number; rotation: number },
  bbox: { width: number; height: number },
): { x: number; y: number; width: number; height: number } {
  const halfW = bbox.width / 2
  const halfH = bbox.height / 2
  const corners = [
    { x: -halfW, y: -halfH },
    { x: halfW, y: -halfH },
    { x: halfW, y: halfH },
    { x: -halfW, y: halfH },
  ]
  const angle = (placement.rotation * Math.PI) / 180
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const worldCorners = corners.map((corner) => ({
    x: placement.x + corner.x * cos - corner.y * sin,
    y: placement.y + corner.x * sin + corner.y * cos,
  }))
  const xs = worldCorners.map((corner) => corner.x)
  const ys = worldCorners.map((corner) => corner.y)
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  }
}

const FORMATS: Format[] = ['square', 'landscape', 'portrait']
const SEEDS = [0, 1, 7, 42, 1000, 99999]
const COUNTS = [1, 2, 3, 5, 8]

describe('core/layout property tests', () => {
  it('returns an empty array for an empty item list', () => {
    expect(layoutScene({ items: [], format: 'square', size: 'L', seed: 0 })).toEqual([])
  })

  it('is deterministic: the same request always yields the same result', () => {
    for (const format of FORMATS) {
      for (const seed of SEEDS) {
        const items = makeItems(4)
        const first = layoutScene({ items, format, size: 'L', seed })
        const second = layoutScene({ items, format, size: 'L', seed })
        expect(second).toEqual(first)
      }
    }
  })

  it('seed+1 gives a different layout for the same items (at least one differs)', () => {
    for (const format of FORMATS) {
      for (const count of COUNTS) {
        const items = makeItems(count)
        const a = layoutScene({ items, format, size: 'L', seed: 1 })
        const b = layoutScene({ items, format, size: 'L', seed: 2 })
        const changed = a.some((placement, index) => {
          const other = b[index]
          return (
            !other ||
            placement.x !== other.x ||
            placement.y !== other.y ||
            placement.rotation !== other.rotation
          )
        })
        expect(changed).toBe(true)
      }
    }
  })

  it('preserves item count and composition (objectId + state) regardless of order', () => {
    for (const format of FORMATS) {
      for (const seed of SEEDS) {
        for (const count of COUNTS) {
          const items = makeItems(count)
          const result = layoutScene({ items, format, size: 'L', seed })
          expect(result).toHaveLength(items.length)
          const inputPairs = items.map((item) => `${item.objectId}:${item.state}`).sort()
          const outputPairs = result.map((item) => `${item.objectId}:${item.state}`).sort()
          expect(outputPairs).toEqual(inputPairs)
        }
      }
    }
  })

  it('orders background items before main items (z-order)', () => {
    const items: LayoutItemInput[] = [
      { objectId: 'main-1', state: 'main', bbox: { x: 0, y: 0, width: 100, height: 100 } },
      { objectId: 'bg-1', state: 'bg', bbox: { x: 0, y: 0, width: 100, height: 100 } },
      { objectId: 'main-2', state: 'main', bbox: { x: 0, y: 0, width: 100, height: 100 } },
      { objectId: 'bg-2', state: 'bg', bbox: { x: 0, y: 0, width: 100, height: 100 } },
    ]
    const result = layoutScene({ items, format: 'square', size: 'L', seed: 3 })
    const firstMainIndex = result.findIndex((item) => item.state === 'main')
    const lastBgIndex = result.map((item) => item.state).lastIndexOf('bg')
    expect(lastBgIndex).toBeLessThan(firstMainIndex)
  })

  it('most objects are at least partially within the frame (not a mass fly-out)', () => {
    for (const format of FORMATS) {
      for (const seed of SEEDS) {
        for (const count of COUNTS) {
          const items = makeItems(count)
          const result = layoutScene({ items, format, size: 'L', seed })
          const formatDef = getFormat(format)
          const canvasRect = { x: 0, y: 0, width: formatDef.width, height: formatDef.height }
          const itemsByObjectId = new Map(items.map((item) => [item.objectId, item]))
          const offFrameCount = result.filter((placement) => {
            const input = itemsByObjectId.get(placement.objectId)
            if (!input) return false
            const worldBBox = placementWorldBBox(placement, input.bbox)
            return !intersects(worldBBox, canvasRect)
          }).length
          expect(offFrameCount).toBeLessThanOrEqual(Math.ceil(result.length * 0.5))
        }
      }
    }
  })

  it('flipX is always false and rotation always 0 (autolayout keeps the isometry)', () => {
    const items = makeItems(5)
    const result = layoutScene({ items, format: 'landscape', size: 'L', seed: 11 })
    for (const placement of result) {
      expect(placement.rotation).toBe(0)
      expect(placement.flipX).toBe(false)
    }
  })
})

describe('computeLayoutDensityScale', () => {
  it('returns 1 for zero or negative item counts', () => {
    const format = getFormat('square')
    expect(computeLayoutDensityScale(format, 0)).toBe(1)
    expect(computeLayoutDensityScale(format, -1)).toBe(1)
  })

  it('stays within the configured min/max bounds across formats and counts', () => {
    for (const formatId of FORMATS) {
      const format = getFormat(formatId)
      for (const count of [1, 2, 3, 5, 10, 20, 50]) {
        const scale = computeLayoutDensityScale(format, count)
        expect(scale).toBeGreaterThanOrEqual(0.5)
        expect(scale).toBeLessThanOrEqual(1.6)
      }
    }
  })

  it('decreases (or stays equal) as item count grows for a fixed format', () => {
    const format = getFormat('square')
    const scaleFew = computeLayoutDensityScale(format, 2)
    const scaleMany = computeLayoutDensityScale(format, 20)
    expect(scaleMany).toBeLessThanOrEqual(scaleFew)
  })
})

describe('readability thresholds', () => {
  const frame = { x: 0, y: 0, width: 1000, height: 1000 }
  const box = (x: number, y: number, width: number, height: number) => ({ x, y, width, height })

  it('visibleAreaRatio accounts for frame cropping and later overlaps', () => {
    expect(visibleAreaRatio(box(100, 100, 200, 200), [], frame)).toBeCloseTo(1, 5)
    expect(visibleAreaRatio(box(-100, 0, 200, 200), [], frame)).toBeCloseTo(0.5, 1)
    expect(visibleAreaRatio(box(100, 100, 200, 200), [box(100, 100, 100, 200)], frame)).toBeCloseTo(
      0.5,
      1,
    )
    expect(visibleAreaRatio(box(2000, 2000, 100, 100), [], frame)).toBe(0)
  })

  it('exceedsFrameAreaLimit flags objects larger than the area share limit', () => {
    const side = Math.sqrt(LAYOUT_MAX_OBJECT_FRAME_AREA_RATIO * 1_000_000)
    expect(exceedsFrameAreaLimit(box(0, 0, side - 1, side - 1), frame)).toBe(false)
    expect(exceedsFrameAreaLimit(box(0, 0, side + 5, side + 5), frame)).toBe(true)
  })

  it('requiredMainVisibility is lower only for a main object covered by a later main one', () => {
    const boxes = [box(0, 0, 100, 100), box(50, 50, 40, 40), box(500, 500, 40, 40)]
    const states = ['main', 'main', 'main'] as ObjectState[]
    expect(requiredMainVisibility(0, boxes, states)).toBe(LAYOUT_MAIN_COVERED_MIN_VISIBLE_RATIO)
    expect(requiredMainVisibility(1, boxes, states)).toBe(LAYOUT_MAIN_MIN_VISIBLE_RATIO)
    expect(requiredMainVisibility(2, boxes, states)).toBe(LAYOUT_MAIN_MIN_VISIBLE_RATIO)
  })

  it('mainStackViolations limits stack depth to 2 and the cover of a large object', () => {
    const states = ['main', 'main', 'main'] as ObjectState[]
    const big = box(0, 0, 100, 100)
    expect(mainStackViolations([big, box(70, 70, 40, 40), box(500, 500, 40, 40)], states)).toBe(0)
    expect(
      mainStackViolations([big, box(10, 10, 40, 40), box(30, 30, 20, 20)], states),
    ).toBeGreaterThan(0)
    expect(
      mainStackViolations([box(0, 0, 100, 100), box(50, 0, 100, 100), box(25, 50, 40, 40)], states),
    ).toBeGreaterThan(0)
    const coverShare = (40 * 40) / (100 * 100)
    expect(coverShare).toBeLessThanOrEqual(LAYOUT_MAIN_MAX_COVER_OF_LARGE_RATIO)
    expect(mainStackViolations([big, box(20, 20, 80, 80)], ['main', 'main'])).toBeGreaterThan(0)
  })

  it('small main objects stay fully visible and large covered ones stay above the covered limit', () => {
    for (const format of FORMATS) {
      for (const seed of SEEDS) {
        const items: LayoutItemInput[] = [
          { objectId: 'big', state: 'main', bbox: { x: 0, y: 0, width: 420, height: 300 } },
          { objectId: 'small', state: 'main', bbox: { x: 0, y: 0, width: 140, height: 100 } },
          { objectId: 'mid', state: 'main', bbox: { x: 0, y: 0, width: 220, height: 160 } },
          { objectId: 'bgA', state: 'bg', bbox: { x: 0, y: 0, width: 500, height: 350 } },
        ]
        const request = { items, format, size: 'L' as const, seed }
        const placements = layoutScene(request)
        const report = diagnoseLayout(request, placements)
        for (const row of report.objects.filter((object) => object.state === 'main')) {
          expect(row.visibleRatio).toBeGreaterThanOrEqual(row.requiredVisibleRatio)
        }
        expect(report.mainStackViolations).toBe(0)
      }
    }
  })

  it('layouts respect stack depth and background visibility rules (feasible sizes)', () => {
    for (const format of FORMATS) {
      for (const seed of SEEDS) {
        const items: LayoutItemInput[] = [
          { objectId: 'big', state: 'main', bbox: { x: 0, y: 0, width: 420, height: 300 } },
          { objectId: 'small', state: 'main', bbox: { x: 0, y: 0, width: 140, height: 100 } },
          { objectId: 'mid', state: 'main', bbox: { x: 0, y: 0, width: 220, height: 160 } },
          { objectId: 'bgA', state: 'bg', bbox: { x: 0, y: 0, width: 500, height: 350 } },
          { objectId: 'bgB', state: 'bg', bbox: { x: 0, y: 0, width: 400, height: 300 } },
        ]
        const request = { items, format, size: 'L' as const, seed }
        const placements = layoutScene(request)
        const report = diagnoseLayout(request, placements)
        for (const row of report.objects.filter((object) => object.state === 'bg')) {
          expect(row.visibleRatio).toBeGreaterThanOrEqual(LAYOUT_BG_MIN_VISIBLE_RATIO)
        }
        expect(report.mainStackViolations).toBe(0)
      }
    }
  })

  it('smallMainViolations requires a small main object to hug the nearest larger one', () => {
    const states = ['main', 'main'] as ObjectState[]
    const maxGap = 1000 * LAYOUT_SMALL_MAIN_MAX_GAP_RATIO
    const big = box(0, 0, 400, 300)
    expect(smallMainViolations([big, box(400 + maxGap - 5, 100, 80, 60)], states, frame)).toBe(0)
    expect(smallMainViolations([big, box(400 + maxGap + 60, 100, 80, 60)], states, frame)).toBe(1)
    expect(smallMainViolations([big, box(340, 100, 80, 60)], states, frame)).toBeGreaterThan(0)
    expect(smallMainViolations([big, box(380, 100, 80, 60)], states, frame)).toBe(0)
    const overlapShare = (20 * 60) / (80 * 60)
    expect(overlapShare).toBeLessThanOrEqual(LAYOUT_SMALL_MAIN_MAX_OVERLAP_RATIO + 0.05)
  })

  it('main objects of similar size are not forced together', () => {
    const states = ['main', 'main'] as ObjectState[]
    expect(smallMainViolations([box(0, 0, 400, 300), box(600, 0, 380, 290)], states, frame)).toBe(0)
  })

  it('small main objects stand next to a larger main object in finished layouts', () => {
    for (const format of FORMATS) {
      for (const seed of SEEDS) {
        const items: LayoutItemInput[] = [
          { objectId: 'big', state: 'main', bbox: { x: 0, y: 0, width: 420, height: 300 } },
          { objectId: 'coin', state: 'main', bbox: { x: 0, y: 0, width: 90, height: 60 } },
          { objectId: 'bgA', state: 'bg', bbox: { x: 0, y: 0, width: 500, height: 350 } },
        ]
        const request = { items, format, size: 'L' as const, seed }
        const placements = layoutScene(request)
        const report = diagnoseLayout(request, placements)
        expect(report.mainStackViolations).toBe(0)
        const big = placements.find((placement) => placement.objectId === 'big')
        const coin = placements.find((placement) => placement.objectId === 'coin')
        const frameDef = getFormat(format)
        const maxCentreDistance = 210 + 45 + Math.min(frameDef.width, frameDef.height) * 0.08 + 150
        expect(
          Math.hypot((big?.x ?? 0) - (coin?.x ?? 0), (big?.y ?? 0) - (coin?.y ?? 0)),
        ).toBeLessThan(maxCentreDistance)
      }
    }
  })

  it('spreads objects across the frame zones in landscape (every third is occupied)', () => {
    for (const seed of SEEDS) {
      const items = makeItems(4)
      const result = layoutScene({ items, format: 'landscape', size: 'L', seed })
      const width = getFormat('landscape').width
      const occupied = new Set(
        result.map((placement) => Math.min(2, Math.floor((placement.x / width) * 3))),
      )
      expect(occupied.size).toBe(3)
    }
  })

  it('main/main overlap stays within the limit for similar-sized objects', () => {
    for (const format of FORMATS) {
      for (const seed of SEEDS) {
        const items: LayoutItemInput[] = [
          { objectId: 'a', state: 'main', bbox: { x: 0, y: 0, width: 300, height: 220 } },
          { objectId: 'b', state: 'main', bbox: { x: 0, y: 0, width: 280, height: 210 } },
        ]
        const request = { items, format, size: 'L' as const, seed }
        const placements = layoutScene(request)
        const [first, second] = placements
        if (!first || !second) throw new Error('unreachable')
        const boxA = placementWorldBBox(first, { width: 300, height: 220 })
        const boxB = placementWorldBBox(second, { width: 280, height: 210 })
        const overlap = overlapArea(boxA, boxB) / Math.min(300 * 220, 280 * 210)
        expect(overlap).toBeLessThanOrEqual(LAYOUT_MAIN_MAX_MAIN_OVERLAP_RATIO + 0.001)
      }
    }
  })

  it('orders main objects from the largest to the smallest so a small one lies on top', () => {
    const items: LayoutItemInput[] = [
      { objectId: 'small', state: 'main', bbox: { x: 0, y: 0, width: 100, height: 80 } },
      { objectId: 'big', state: 'main', bbox: { x: 0, y: 0, width: 400, height: 300 } },
    ]
    const result = layoutScene({ items, format: 'landscape', size: 'L', seed: 4 })
    expect(result.map((placement) => placement.objectId)).toEqual(['big', 'small'])
  })
})

function overlapArea(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  return w > 0 && h > 0 ? w * h : 0
}
