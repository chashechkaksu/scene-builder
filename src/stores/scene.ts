import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'
import { clampObjectScale } from '@/core/layout/object-scale'
import { clampCanvasSide } from '@/shared/formats'
import type { Format, ObjectState, Scene, SceneItem, Size } from '@/shared/types'

const STORAGE_KEY = 'vector-composer/scene'
const HISTORY_LIMIT = 100
const AUTOSAVE_DEBOUNCE_MS = 300
const DUPLICATE_OFFSET = 20

function createEmptyScene(): Scene {
  return {
    format: 'square',
    size: 'L',
    paletteId: 'purple',
    items: [],
  }
}

function createUid(): string {
  return crypto.randomUUID()
}

function isObjectState(value: unknown): value is ObjectState {
  return value === 'main' || value === 'bg'
}

function isFormat(value: unknown): value is Format {
  return value === 'square' || value === 'landscape' || value === 'portrait'
}

function isCustomSize(value: unknown): boolean {
  if (value === undefined) return true
  if (typeof value !== 'object' || value === null) return false
  const size = value as Record<string, unknown>
  return typeof size.width === 'number' && typeof size.height === 'number'
}

function isObjectScale(value: unknown): boolean {
  return value === undefined || (typeof value === 'number' && Number.isFinite(value))
}

function isSize(value: unknown): value is Size {
  return value === 'L' || value === 'S'
}

function isSceneItem(value: unknown): value is SceneItem {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Record<string, unknown>
  return (
    typeof item.uid === 'string' &&
    typeof item.objectId === 'string' &&
    isObjectState(item.state) &&
    typeof item.x === 'number' &&
    typeof item.y === 'number' &&
    typeof item.rotation === 'number' &&
    typeof item.flipX === 'boolean'
  )
}

function isScene(value: unknown): value is Scene {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    isFormat(candidate.format) &&
    isCustomSize(candidate.customSize) &&
    isSize(candidate.size) &&
    isObjectScale(candidate.objectScale) &&
    typeof candidate.paletteId === 'string' &&
    Array.isArray(candidate.items) &&
    candidate.items.every(isSceneItem)
  )
}

function loadPersistedScene(): Scene | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return undefined
    const parsed = JSON.parse(raw)
    return isScene(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

function persistScene(scene: Scene): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scene))
  } catch {
    void 0
  }
}

export const useSceneStore = defineStore('scene', () => {
  const scene = shallowRef<Scene>(loadPersistedScene() ?? createEmptyScene())
  const selection = ref<Set<string>>(new Set())

  const undoStack: Scene[] = []
  const redoStack: Scene[] = []
  const canUndo = ref(false)
  const canRedo = ref(false)

  function refreshHistoryFlags(): void {
    canUndo.value = undoStack.length > 0
    canRedo.value = redoStack.length > 0
  }

  function cloneScene(source: Scene): Scene {
    return structuredClone(source)
  }

  function pushHistory(): void {
    undoStack.push(cloneScene(scene.value))
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift()
    redoStack.length = 0
    refreshHistoryFlags()
  }

  function mutate(mutator: (draft: Scene) => void): void {
    pushHistory()
    const draft = cloneScene(scene.value)
    mutator(draft)
    scene.value = draft
  }

  function beginInteraction(): void {
    pushHistory()
  }

  function applyWithoutHistory(mutator: (draft: Scene) => void): void {
    const draft = cloneScene(scene.value)
    mutator(draft)
    scene.value = draft
  }

  function undo(): void {
    const previous = undoStack.pop()
    if (!previous) return
    redoStack.push(cloneScene(scene.value))
    scene.value = previous
    refreshHistoryFlags()
  }

  function redo(): void {
    const next = redoStack.pop()
    if (!next) return
    undoStack.push(cloneScene(scene.value))
    scene.value = next
    refreshHistoryFlags()
  }

  function findIndex(items: SceneItem[], uid: string): number {
    return items.findIndex((item) => item.uid === uid)
  }

  function addItem(
    objectId: string,
    state: ObjectState,
    position: { x: number; y: number },
  ): string {
    const uid = createUid()
    mutate((draft) => {
      draft.items.push({
        uid,
        objectId,
        state,
        x: position.x,
        y: position.y,
        rotation: 0,
        flipX: false,
      })
    })
    selectOnly(uid)
    return uid
  }

  function replaceItems(items: Array<Omit<SceneItem, 'uid'>>): void {
    const uids = items.map(() => createUid())
    mutate((draft) => {
      draft.items = items.map((item, index) => ({ ...item, uid: uids[index] ?? createUid() }))
    })
    selectMany(uids)
  }

  function removeItems(uids: string[]): void {
    const toRemove = new Set(uids)
    if (toRemove.size === 0) return
    mutate((draft) => {
      draft.items = draft.items.filter((item) => !toRemove.has(item.uid))
    })
    for (const uid of uids) selection.value.delete(uid)
    selection.value = new Set(selection.value)
  }

  function duplicateItems(uids: string[]): void {
    const idsToDuplicate = uids.filter((uid) => findIndex(scene.value.items, uid) !== -1)
    if (idsToDuplicate.length === 0) return
    const newUids: string[] = []
    mutate((draft) => {
      for (const uid of idsToDuplicate) {
        const sourceIndex = findIndex(draft.items, uid)
        if (sourceIndex === -1) continue
        const source = draft.items[sourceIndex]
        if (!source) continue
        const newUid = createUid()
        newUids.push(newUid)
        const copy: SceneItem = {
          ...source,
          uid: newUid,
          x: source.x + DUPLICATE_OFFSET,
          y: source.y + DUPLICATE_OFFSET,
        }
        draft.items.splice(sourceIndex + 1, 0, copy)
      }
    })
    selectMany(newUids)
  }

  function updateItemTransform(
    uid: string,
    patch: Partial<Pick<SceneItem, 'x' | 'y' | 'rotation' | 'flipX'>>,
  ): void {
    mutate((draft) => {
      const item = draft.items.find((candidate) => candidate.uid === uid)
      if (!item) return
      Object.assign(item, patch)
    })
  }

  function setItemState(uid: string, state: ObjectState): void {
    mutate((draft) => {
      const item = draft.items.find((candidate) => candidate.uid === uid)
      if (!item) return
      item.state = state
    })
  }

  function reorderWithinSelection(
    uids: string[],
    reorder: (items: SceneItem[], selectedUids: Set<string>) => SceneItem[],
  ): void {
    const selected = new Set(uids)
    if (selected.size === 0) return
    mutate((draft) => {
      draft.items = reorder(draft.items, selected)
    })
  }

  function bringToFront(uids: string[]): void {
    reorderWithinSelection(uids, (items, selected) => {
      const kept = items.filter((item) => !selected.has(item.uid))
      const moved = items.filter((item) => selected.has(item.uid))
      return [...kept, ...moved]
    })
  }

  function sendToBack(uids: string[]): void {
    reorderWithinSelection(uids, (items, selected) => {
      const kept = items.filter((item) => !selected.has(item.uid))
      const moved = items.filter((item) => selected.has(item.uid))
      return [...moved, ...kept]
    })
  }

  function bringForward(uids: string[]): void {
    reorderWithinSelection(uids, (items, selected) => {
      const result = [...items]
      for (let i = result.length - 2; i >= 0; i--) {
        const current = result[i]
        const next = result[i + 1]
        if (!current || !next) continue
        if (selected.has(current.uid) && !selected.has(next.uid)) {
          result[i] = next
          result[i + 1] = current
        }
      }
      return result
    })
  }

  function sendBackward(uids: string[]): void {
    reorderWithinSelection(uids, (items, selected) => {
      const result = [...items]
      for (let i = 1; i < result.length; i++) {
        const current = result[i]
        const previous = result[i - 1]
        if (!current || !previous) continue
        if (selected.has(current.uid) && !selected.has(previous.uid)) {
          result[i] = previous
          result[i - 1] = current
        }
      }
      return result
    })
  }

  function reorderItems(fromIndex: number, toIndex: number): void {
    if (fromIndex === toIndex) return
    mutate((draft) => {
      const items = draft.items
      if (fromIndex < 0 || fromIndex >= items.length) return
      const [moved] = items.splice(fromIndex, 1)
      if (!moved) return
      const clampedTarget = Math.max(0, Math.min(toIndex, items.length))
      items.splice(clampedTarget, 0, moved)
    })
  }

  function selectOnly(uid: string): void {
    selection.value = new Set([uid])
  }

  function toggleSelect(uid: string): void {
    const next = new Set(selection.value)
    if (next.has(uid)) next.delete(uid)
    else next.add(uid)
    selection.value = next
  }

  function selectMany(uids: string[]): void {
    selection.value = new Set(uids)
  }

  function clearSelection(): void {
    selection.value = new Set()
  }

  function setFormat(format: Format): void {
    mutate((draft) => {
      draft.format = format
      delete draft.customSize
    })
  }

  function setCanvasSize(width: number, height: number): void {
    mutate((draft) => {
      draft.customSize = { width: clampCanvasSide(width), height: clampCanvasSide(height) }
    })
  }

  function setSize(size: Size): void {
    mutate((draft) => {
      draft.size = size
    })
  }

  function setObjectScale(value: number | undefined): void {
    mutate((draft) => {
      if (value === undefined) delete draft.objectScale
      else draft.objectScale = clampObjectScale(value)
    })
  }

  function setPaletteId(paletteId: string): void {
    mutate((draft) => {
      draft.paletteId = paletteId
    })
  }

  const selectedItems = computed(() =>
    scene.value.items.filter((item) => selection.value.has(item.uid)),
  )

  let saveTimer: ReturnType<typeof setTimeout> | undefined
  watch(
    scene,
    (next) => {
      if (saveTimer) clearTimeout(saveTimer)
      saveTimer = setTimeout(() => persistScene(next), AUTOSAVE_DEBOUNCE_MS)
    },
    { deep: false },
  )

  return {
    scene,
    selection,
    selectedItems,
    canUndo,
    canRedo,
    addItem,
    replaceItems,
    removeItems,
    duplicateItems,
    updateItemTransform,
    setItemState,
    bringToFront,
    sendToBack,
    bringForward,
    sendBackward,
    reorderItems,
    selectOnly,
    toggleSelect,
    selectMany,
    clearSelection,
    setFormat,
    setCanvasSize,
    setSize,
    setObjectScale,
    setPaletteId,
    undo,
    redo,
    beginInteraction,
    applyWithoutHistory,
  }
})
