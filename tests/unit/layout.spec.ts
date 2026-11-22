import { describe, expect, it } from 'vitest'
import {
  LAYOUT_MAIN_MAX_MAIN_OVERLAP_RATIO,
  LAYOUT_MAIN_MIN_VISIBLE_RATIO,
  LAYOUT_MAX_OBJECT_FRAME_AREA_RATIO,
} from '@/core/layout/constants'
import {
  computeLayoutDensityScale,
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

  it('flipX is always false (autolayout never mirrors objects)', () => {
    const items = makeItems(5)
    const result = layoutScene({ items, format: 'landscape', size: 'L', seed: 11 })
    for (const placement of result) {
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

  it('main objects stay visible and do not heavily overlap each other (feasible sizes)', () => {
    for (const format of FORMATS) {
      for (const seed of SEEDS) {
        for (const count of COUNTS.filter((value) => value <= 5)) {
          const items = makeItems(count).map((item) => ({ ...item, state: 'main' as ObjectState }))
          const result = layoutScene({ items, format, size: 'L', seed })
          const formatDef = getFormat(format)
          const canvasRect = { x: 0, y: 0, width: formatDef.width, height: formatDef.height }
          const boxes = result.map((placement) => {
            const input = items.find((item) => item.objectId === placement.objectId)
            return placementWorldBBox(placement, input?.bbox ?? { width: 0, height: 0 })
          })
          boxes.forEach((worldBox, index) => {
            const later = boxes.slice(index + 1)
            const visible = visibleAreaRatio(worldBox, later, canvasRect)
            expect(visible).toBeGreaterThanOrEqual(LAYOUT_MAIN_MIN_VISIBLE_RATIO - 0.15)
            const overlap = boxes
              .filter((_, other) => other !== index)
              .reduce((sum, other) => sum + overlapArea(worldBox, other), 0)
            expect(overlap / (worldBox.width * worldBox.height)).toBeLessThanOrEqual(
              LAYOUT_MAIN_MAX_MAIN_OVERLAP_RATIO + 0.15,
            )
          })
        }
      }
    }
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
