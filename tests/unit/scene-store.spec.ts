import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useSceneStore } from '@/stores/scene'

function setup() {
  localStorage.clear()
  setActivePinia(createPinia())
  return useSceneStore()
}

describe('stores/scene', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('adds an item and selects it', () => {
    const scene = setup()
    const uid = scene.addItem('lamp', 'main', { x: 100, y: 200 })
    expect(scene.scene.items).toHaveLength(1)
    const item = scene.scene.items[0]
    expect(item).toMatchObject({
      uid,
      objectId: 'lamp',
      state: 'main',
      x: 100,
      y: 200,
      rotation: 0,
      flipX: false,
    })
    expect(scene.selection.has(uid)).toBe(true)
  })

  it('removes selected items', () => {
    const scene = setup()
    const uidA = scene.addItem('lamp', 'main', { x: 0, y: 0 })
    const uidB = scene.addItem('pen', 'main', { x: 0, y: 0 })
    scene.removeItems([uidA])
    expect(scene.scene.items.map((item) => item.uid)).toEqual([uidB])
    expect(scene.selection.has(uidA)).toBe(false)
  })

  it('duplicates items with an offset and selects the copies', () => {
    const scene = setup()
    const uid = scene.addItem('lamp', 'main', { x: 10, y: 10 })
    scene.duplicateItems([uid])
    expect(scene.scene.items).toHaveLength(2)
    const original = scene.scene.items[0]
    const copy = scene.scene.items[1]
    expect(original?.uid).toBe(uid)
    expect(copy?.x).toBe(30)
    expect(copy?.y).toBe(30)
    expect(scene.selection.has(copy?.uid ?? '')).toBe(true)
    expect(scene.selection.has(uid)).toBe(false)
  })

  it('updates transform of an item', () => {
    const scene = setup()
    const uid = scene.addItem('lamp', 'main', { x: 0, y: 0 })
    scene.updateItemTransform(uid, { x: 50, rotation: 45, flipX: true })
    const item = scene.scene.items.find((candidate) => candidate.uid === uid)
    expect(item).toMatchObject({ x: 50, y: 0, rotation: 45, flipX: true })
  })

  it('toggles main/bg state', () => {
    const scene = setup()
    const uid = scene.addItem('lamp', 'main', { x: 0, y: 0 })
    scene.setItemState(uid, 'bg')
    expect(scene.scene.items[0]?.state).toBe('bg')
  })

  it('setSize changes only the scene size, not item positions/rotation/flip', () => {
    const scene = setup()
    const uid = scene.addItem('lamp', 'main', { x: 50, y: 60 })
    scene.updateItemTransform(uid, { rotation: 30, flipX: true })
    expect(scene.scene.size).toBe('L')

    scene.setSize('S')

    expect(scene.scene.size).toBe('S')
    expect(scene.scene.items[0]).toMatchObject({ x: 50, y: 60, rotation: 30, flipX: true })
  })

  describe('layer order', () => {
    function threeItems() {
      const scene = setup()
      const a = scene.addItem('book', 'main', { x: 0, y: 0 })
      const b = scene.addItem('lamp', 'main', { x: 0, y: 0 })
      const c = scene.addItem('pen', 'main', { x: 0, y: 0 })
      return { scene, a, b, c }
    }

    it('bringToFront moves selected items to the end preserving relative order', () => {
      const { scene, a, b, c } = threeItems()
      scene.bringToFront([a])
      expect(scene.scene.items.map((item) => item.uid)).toEqual([b, c, a])
    })

    it('sendToBack moves selected items to the start', () => {
      const { scene, a, b, c } = threeItems()
      scene.sendToBack([c])
      expect(scene.scene.items.map((item) => item.uid)).toEqual([c, a, b])
    })

    it('bringForward swaps with the next item', () => {
      const { scene, a, b, c } = threeItems()
      scene.bringForward([a])
      expect(scene.scene.items.map((item) => item.uid)).toEqual([b, a, c])
    })

    it('sendBackward swaps with the previous item', () => {
      const { scene, a, b, c } = threeItems()
      scene.sendBackward([c])
      expect(scene.scene.items.map((item) => item.uid)).toEqual([a, c, b])
    })

    it('reorderItems moves an item to an explicit index', () => {
      const { scene, a, b, c } = threeItems()
      scene.reorderItems(0, 2)
      expect(scene.scene.items.map((item) => item.uid)).toEqual([b, c, a])
    })
  })

  describe('selection', () => {
    it('selectOnly, toggleSelect, selectMany, clearSelection', () => {
      const scene = setup()
      const a = scene.addItem('book', 'main', { x: 0, y: 0 })
      const b = scene.addItem('lamp', 'main', { x: 0, y: 0 })
      scene.selectOnly(a)
      expect([...scene.selection]).toEqual([a])
      scene.toggleSelect(b)
      expect(new Set(scene.selection)).toEqual(new Set([a, b]))
      scene.toggleSelect(a)
      expect([...scene.selection]).toEqual([b])
      scene.selectMany([a, b])
      expect(new Set(scene.selection)).toEqual(new Set([a, b]))
      scene.clearSelection()
      expect(scene.selection.size).toBe(0)
    })
  })

  describe('undo/redo', () => {
    it('undoes and redoes add/remove operations', () => {
      const scene = setup()
      expect(scene.canUndo).toBe(false)
      const uid = scene.addItem('lamp', 'main', { x: 0, y: 0 })
      expect(scene.canUndo).toBe(true)
      scene.removeItems([uid])
      expect(scene.scene.items).toHaveLength(0)
      scene.undo()
      expect(scene.scene.items).toHaveLength(1)
      expect(scene.canRedo).toBe(true)
      scene.undo()
      expect(scene.scene.items).toHaveLength(0)
      expect(scene.canUndo).toBe(false)
      scene.redo()
      expect(scene.scene.items).toHaveLength(1)
      scene.redo()
      expect(scene.scene.items).toHaveLength(0)
    })

    it('does not restore selection on undo', () => {
      const scene = setup()
      scene.addItem('lamp', 'main', { x: 0, y: 0 })
      scene.clearSelection()
      scene.undo()
      expect(scene.selection.size).toBe(0)
    })

    it('applyWithoutHistory mutates state without pushing an undo entry', () => {
      const scene = setup()
      const uid = scene.addItem('lamp', 'main', { x: 0, y: 0 })
      scene.beginInteraction()
      scene.applyWithoutHistory((draft) => {
        const item = draft.items.find((candidate) => candidate.uid === uid)
        if (item) item.x = 999
      })
      scene.applyWithoutHistory((draft) => {
        const item = draft.items.find((candidate) => candidate.uid === uid)
        if (item) item.x = 1234
      })
      expect(scene.scene.items[0]?.x).toBe(1234)
      scene.undo()
      expect(scene.scene.items[0]?.x).toBe(0)
    })
  })

  describe('persistence', () => {
    it('ignores invalid persisted JSON and starts with an empty scene', () => {
      localStorage.setItem('vector-composer/scene', '{ not valid')
      const scene = setup()
      expect(scene.scene.items).toHaveLength(0)
      expect(scene.scene.format).toBe('square')
    })

    it('ignores a structurally invalid persisted scene', () => {
      localStorage.setItem('vector-composer/scene', JSON.stringify({ foo: 'bar' }))
      const scene = setup()
      expect(scene.scene.items).toHaveLength(0)
    })
  })
})
