import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { exportSceneToSvg, type ExportAssetSource, type SymbolMarkup } from '@/core/export/export'
import {
  LAYOUT_AUTO_SCALE_MAX_AREA_RATIO,
  OBJECT_SCALE_MAX,
  OBJECT_SCALE_MIN,
} from '@/core/layout/constants'
import { layoutScene } from '@/core/layout/layout'
import { autoObjectScale, resolveObjectScale } from '@/core/layout/object-scale'
import { parsePalette } from '@/core/palette/schema'
import { itemTransform } from '@/features/canvas/geometry'
import purpleJson from '@/palettes/purple.json'
import { useSceneStore } from '@/stores/scene'
import type { Scene } from '@/shared/types'

const frame = { width: 1000, height: 1000 }

describe('auto object scale', () => {
  it('is 1 when every object already fits the area limit', () => {
    expect(autoObjectScale([{ width: 300, height: 300 }], frame)).toBe(OBJECT_SCALE_MAX)
    expect(autoObjectScale([], frame)).toBe(OBJECT_SCALE_MAX)
  })

  it('shrinks the largest object to the area limit', () => {
    const scale = autoObjectScale(
      [
        { width: 1447, height: 988 },
        { width: 300, height: 200 },
      ],
      frame,
    )
    expect(scale).toBeLessThan(1)
    expect(1447 * 988 * scale * scale).toBeCloseTo(LAYOUT_AUTO_SCALE_MAX_AREA_RATIO * 1_000_000, 0)
  })

  it('is clamped to the allowed range, also for explicit values', () => {
    expect(autoObjectScale([{ width: 100000, height: 100000 }], frame)).toBe(OBJECT_SCALE_MIN)
    expect(resolveObjectScale(5, [], frame)).toBe(OBJECT_SCALE_MAX)
    expect(resolveObjectScale(0.01, [], frame)).toBe(OBJECT_SCALE_MIN)
    expect(resolveObjectScale(0.5, [{ width: 9999, height: 9999 }], frame)).toBe(0.5)
  })
})

describe('layout with object scale', () => {
  const items = [
    { objectId: 'a', state: 'main' as const, bbox: { x: 0, y: 0, width: 1400, height: 1000 } },
    { objectId: 'b', state: 'bg' as const, bbox: { x: 0, y: 0, width: 400, height: 300 } },
  ]

  it('stays deterministic and keeps every object', () => {
    const request = { items, format: 'square' as const, size: 'L' as const, seed: 5 }
    expect(layoutScene(request)).toEqual(layoutScene(request))
    expect(layoutScene(request)).toHaveLength(2)
  })

  it('treats an explicit scale as authoritative', () => {
    const auto = layoutScene({ items, format: 'square', size: 'L', seed: 5 })
    const explicit = layoutScene({ items, format: 'square', size: 'L', seed: 5, objectScale: 1 })
    expect(explicit).not.toEqual(auto)
  })
})

describe('item transform scale', () => {
  const bbox = { x: 10, y: 20, width: 100, height: 60 }
  const item = {
    uid: 'u',
    objectId: 'lamp',
    state: 'main' as const,
    x: 5,
    y: 6,
    rotation: 30,
    flipX: false,
  }

  it('applies one uniform factor on the outer transform', () => {
    expect(itemTransform(item, bbox, 0.5)).toContain('scale(0.5 0.5)')
    expect(itemTransform({ ...item, flipX: true }, bbox, 0.5)).toContain('scale(-0.5 0.5)')
    expect(itemTransform(item, bbox)).toContain('scale(1 1)')
  })
})

describe('export with object scale', () => {
  const symbol: SymbolMarkup = {
    viewBox: [0, 0, 1000, 1000],
    innerMarkup: '<path d="M0 0L10 10" fill="#000000" />',
  }
  const assets: ExportAssetSource = {
    getObjectSymbol: () => symbol,
    getObjectBBox: (objectId) =>
      objectId === 'big'
        ? { x: 0, y: 0, width: 1400, height: 1000 }
        : { x: 0, y: 0, width: 700, height: 500 },
    getBackgroundSymbol: () => undefined,
  }
  const palette = parsePalette(purpleJson)
  const scene: Scene = {
    format: 'square',
    size: 'L',
    paletteId: 'purple',
    items: [
      { uid: 'a', objectId: 'big', state: 'main', x: 500, y: 500, rotation: 0, flipX: false },
      { uid: 'b', objectId: 'small', state: 'bg', x: 300, y: 300, rotation: 0, flipX: false },
    ],
  }

  function scalesOf(markup: string): number[] {
    return Array.from(markup.matchAll(/scale\((-?[\d.]+) (-?[\d.]+)\)/g)).map((m) => Number(m[1]))
  }

  it('uses the same scale for all objects and keeps inner geometry intact', () => {
    const markup = exportSceneToSvg(scene, palette, false, assets)
    const objectScales = scalesOf(markup)
    expect(objectScales).toHaveLength(2)
    expect(objectScales[0]).toBe(objectScales[1])
    expect(objectScales[0]).toBeLessThan(1)
    expect(markup.match(/d="M0 0L10 10"/g)).toHaveLength(2)
  })

  it('honours an explicit objectScale', () => {
    const markup = exportSceneToSvg({ ...scene, objectScale: 0.4 }, palette, false, assets)
    expect(scalesOf(markup)).toEqual([0.4, 0.4])
  })
})

describe('stores/scene objectScale', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('setObjectScale clamps, is undone in one step and can return to auto', () => {
    const store = useSceneStore()
    store.setObjectScale(0.5)
    expect(store.scene.objectScale).toBe(0.5)
    store.setObjectScale(9)
    expect(store.scene.objectScale).toBe(OBJECT_SCALE_MAX)
    store.undo()
    expect(store.scene.objectScale).toBe(0.5)
    store.setObjectScale(undefined)
    expect(store.scene.objectScale).toBeUndefined()
  })

  it('batched slider updates are a single undo step', () => {
    const store = useSceneStore()
    store.beginInteraction()
    for (const value of [0.9, 0.8, 0.7]) {
      store.applyWithoutHistory((draft) => {
        draft.objectScale = value
      })
    }
    store.undo()
    expect(store.scene.objectScale).toBeUndefined()
  })

  it('persists objectScale in autosave', async () => {
    const store = useSceneStore()
    store.setObjectScale(0.45)
    await new Promise((resolve) => setTimeout(resolve, 400))
    const raw = JSON.parse(localStorage.getItem('vector-composer/scene') ?? '{}') as Scene
    expect(raw.objectScale).toBe(0.45)
  })
})
