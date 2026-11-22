import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { layoutScene } from '@/core/layout/layout'
import { MAX_CANVAS_SIDE, MIN_CANVAS_SIDE, clampCanvasSide, resolveFormat } from '@/shared/formats'
import { useSceneStore } from '@/stores/scene'

function setup() {
  localStorage.clear()
  setActivePinia(createPinia())
  return useSceneStore()
}

describe('resolveFormat', () => {
  it('возвращает пресет, если свой размер не задан', () => {
    expect(resolveFormat({ format: 'square' })).toMatchObject({ width: 1000, height: 1000 })
  })

  it('использует свой размер и ограничивает его границами', () => {
    expect(
      resolveFormat({ format: 'square', customSize: { width: 1500, height: 700 } }),
    ).toMatchObject({
      width: 1500,
      height: 700,
    })
    expect(clampCanvasSide(10)).toBe(MIN_CANVAS_SIDE)
    expect(clampCanvasSide(99999)).toBe(MAX_CANVAS_SIDE)
  })
})

describe('scene store: размер холста', () => {
  beforeEach(() => localStorage.clear())

  it('setCanvasSize задаёт свой размер, setFormat возвращает пресет', () => {
    const store = setup()
    store.setCanvasSize(1400, 900)
    expect(store.scene.customSize).toEqual({ width: 1400, height: 900 })
    store.setFormat('portrait')
    expect(store.scene.customSize).toBeUndefined()
    expect(store.scene.format).toBe('portrait')
  })

  it('смена размера не двигает объекты и отменяется через undo', () => {
    const store = setup()
    store.addItem('lamp', 'main', { x: 120, y: 340 })
    store.setCanvasSize(1600, 900)
    expect(store.scene.items[0]).toMatchObject({ x: 120, y: 340 })
    store.undo()
    expect(store.scene.customSize).toBeUndefined()
  })
})

describe('layout с произвольным размером', () => {
  it('раскладывает объекты в пределах произвольного холста детерминированно', () => {
    const request = {
      items: [
        { objectId: 'lamp', state: 'main' as const, bbox: { x: 0, y: 0, width: 200, height: 260 } },
        { objectId: 'book', state: 'bg' as const, bbox: { x: 0, y: 0, width: 300, height: 220 } },
      ],
      format: 'square' as const,
      customSize: { width: 2000, height: 500 },
      size: 'L' as const,
      seed: 7,
    }
    const first = layoutScene(request)
    expect(first).toEqual(layoutScene(request))
    expect(first).toHaveLength(2)
    const maxX = Math.max(...first.map((placement) => placement.x))
    expect(maxX).toBeGreaterThan(1000)
  })
})
