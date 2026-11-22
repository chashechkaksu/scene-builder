<script setup lang="ts">
import { Maximize2 } from 'lucide-vue-next'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import CanvasBackground from '@/features/canvas/CanvasBackground.vue'
import CanvasItem from '@/features/canvas/CanvasItem.vue'
import {
  axisAlignedBounds,
  itemWorldCorners,
  rectsIntersect,
  type Rect,
} from '@/features/canvas/geometry'
import SelectionOverlay from '@/features/canvas/SelectionOverlay.vue'
import { applyPaletteToElement } from '@/core/recolor/recolor'
import { clampCanvasSide, resolveFormat } from '@/shared/formats'
import type { ObjectState, SceneItem, Size } from '@/shared/types'
import { useLibraryStore, type SymbolDefinition } from '@/stores/library'
import { usePaletteStore } from '@/stores/palette'
import { useSceneStore } from '@/stores/scene'

const props = withDefaults(defineProps<{ showBackground?: boolean }>(), {
  showBackground: true,
})

const MIN_ZOOM = 0.2
const MAX_ZOOM = 4
const EMPTY_BBOX: Rect = { x: 0, y: 0, width: 0, height: 0 }

const sceneStore = useSceneStore()
const libraryStore = useLibraryStore()
const paletteStore = usePaletteStore()

const containerRef = ref<HTMLDivElement>()
const svgRef = ref<SVGSVGElement>()

const zoom = ref(1)
const panX = ref(0)
const panY = ref(0)
const spacePressed = ref(false)

const format = computed(() => resolveFormat(sceneStore.scene))

const viewportStyle = computed(() => ({
  transform: `translate(${panX.value}px, ${panY.value}px) scale(${zoom.value})`,
  transformOrigin: '0 0',
}))

const symbolDefs = ref(new Map<string, SymbolDefinition>())
const symbolDefList = computed(() => Array.from(symbolDefs.value.values()))

async function ensureSymbolLoaded(objectId: string, size: Size, state: ObjectState): Promise<void> {
  const key = `${objectId}-${size}-${state}`
  if (symbolDefs.value.has(key)) return
  const definition = await libraryStore.getSymbolMarkup(objectId, size, state)
  if (definition) symbolDefs.value.set(key, definition)
}

watch(
  () => [sceneStore.scene.items, sceneStore.scene.size] as const,
  ([items, size]) => {
    for (const item of items) {
      void ensureSymbolLoaded(item.objectId, size, item.state)
    }
  },
  { immediate: true },
)

function getBbox(item: SceneItem): Rect {
  const assetRef = libraryStore.getObjectRef(item.objectId, sceneStore.scene.size, item.state)
  return assetRef?.bbox ?? EMPTY_BBOX
}

function symbolIdFor(item: SceneItem): string {
  return `${item.objectId}-${sceneStore.scene.size}-${item.state}`
}

type LiveOverride = Partial<Pick<SceneItem, 'x' | 'y' | 'rotation'>>
const liveOverride = ref(new Map<string, LiveOverride>())

function clearLiveOverride(uids: string[]): void {
  for (const uid of uids) liveOverride.value.delete(uid)
}

function commitLiveOverride(uids: string[]): void {
  sceneStore.applyWithoutHistory((draft) => {
    for (const uid of uids) {
      const override = liveOverride.value.get(uid)
      const item = draft.items.find((candidate) => candidate.uid === uid)
      if (!override || !item) continue
      Object.assign(item, override)
    }
  })
  clearLiveOverride(uids)
}

const visualSelectedItems = computed(() =>
  sceneStore.selectedItems.map((item) => {
    const override = liveOverride.value.get(item.uid)
    return override ? { ...item, ...override } : item
  }),
)

watch(
  () => paletteStore.current,
  (palette) => {
    if (svgRef.value) applyPaletteToElement(svgRef.value, palette)
  },
)

const FIT_PADDING = 48
const autoFit = ref(true)
const resizingCanvas = ref(false)
let containerObserver: ResizeObserver | undefined

function fitToView(): void {
  const container = containerRef.value
  if (!container || container.clientWidth === 0 || container.clientHeight === 0) return
  const fitted = clamp(
    Math.min(
      (container.clientWidth - FIT_PADDING) / format.value.width,
      (container.clientHeight - FIT_PADDING) / format.value.height,
    ),
    MIN_ZOOM,
    MAX_ZOOM,
  )
  zoom.value = fitted
  panX.value = (container.clientWidth - format.value.width * fitted) / 2
  panY.value = (container.clientHeight - format.value.height * fitted) / 2
}

function refitIfAuto(): void {
  if (autoFit.value && !resizingCanvas.value) fitToView()
}

function resetFit(): void {
  autoFit.value = true
  fitToView()
}

function onZoomSlider(event: Event): void {
  const container = containerRef.value
  if (!container) return
  autoFit.value = false
  const next = Number((event.target as HTMLInputElement).value) / 100
  const centerX = container.clientWidth / 2
  const centerY = container.clientHeight / 2
  const sceneX = (centerX - panX.value) / zoom.value
  const sceneY = (centerY - panY.value) / zoom.value
  zoom.value = clamp(next, MIN_ZOOM, MAX_ZOOM)
  panX.value = centerX - sceneX * zoom.value
  panY.value = centerY - sceneY * zoom.value
}

watch(
  () => [format.value.width, format.value.height],
  () => refitIfAuto(),
)

type ResizeEdge = 'right' | 'bottom' | 'corner'
let resizeEdge: ResizeEdge = 'right'
let resizeStart = { clientX: 0, clientY: 0, width: 0, height: 0 }

function onResizeHandleDown(edge: ResizeEdge, event: PointerEvent): void {
  event.stopPropagation()
  event.preventDefault()
  resizeEdge = edge
  resizeStart = {
    clientX: event.clientX,
    clientY: event.clientY,
    width: format.value.width,
    height: format.value.height,
  }
  resizingCanvas.value = true
  sceneStore.beginInteraction()
  window.addEventListener('pointermove', onResizeMove)
  window.addEventListener('pointerup', onResizeEnd)
}

function onResizeMove(event: PointerEvent): void {
  const deltaX = (event.clientX - resizeStart.clientX) / zoom.value
  const deltaY = (event.clientY - resizeStart.clientY) / zoom.value
  const width = resizeEdge === 'bottom' ? resizeStart.width : resizeStart.width + deltaX
  const height = resizeEdge === 'right' ? resizeStart.height : resizeStart.height + deltaY
  sceneStore.applyWithoutHistory((draft) => {
    draft.customSize = { width: clampCanvasSide(width), height: clampCanvasSide(height) }
  })
}

function onResizeEnd(): void {
  window.removeEventListener('pointermove', onResizeMove)
  window.removeEventListener('pointerup', onResizeEnd)
  resizingCanvas.value = false
  refitIfAuto()
}

const handleStyle = computed(() => ({ '--handle-scale': String(1 / zoom.value) }))

onMounted(() => {
  applyPaletteToElement(svgRef.value as SVGSVGElement, paletteStore.current)
  void nextTick(fitToView)
  if (containerRef.value && typeof ResizeObserver !== 'undefined') {
    containerObserver = new ResizeObserver(refitIfAuto)
    containerObserver.observe(containerRef.value)
  }
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
})

onBeforeUnmount(() => {
  containerObserver?.disconnect()
  window.removeEventListener('pointermove', onResizeMove)
  window.removeEventListener('pointerup', onResizeEnd)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('pointermove', onPanMove)
  window.removeEventListener('pointerup', onPanEnd)
  window.removeEventListener('pointermove', onMarqueeMove)
  window.removeEventListener('pointerup', onMarqueeEnd)
  window.removeEventListener('pointermove', onItemDragMove)
  window.removeEventListener('pointerup', onItemDragEnd)
  window.removeEventListener('pointermove', onRotateMove)
  window.removeEventListener('pointerup', onRotateEnd)
})

function clientToScene(clientX: number, clientY: number): { x: number; y: number } {
  const svg = svgRef.value
  if (!svg) return { x: 0, y: 0 }
  const rect = svg.getBoundingClientRect()
  const scaleX = rect.width / format.value.width
  const scaleY = rect.height / format.value.height
  return {
    x: (clientX - rect.left) / (scaleX || 1),
    y: (clientY - rect.top) / (scaleY || 1),
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function handleWheel(event: WheelEvent): void {
  autoFit.value = false
  const scenePoint = clientToScene(event.clientX, event.clientY)
  const zoomOld = zoom.value
  const factor = Math.exp(-event.deltaY * 0.001)
  const zoomNew = clamp(zoomOld * factor, MIN_ZOOM, MAX_ZOOM)
  panX.value += scenePoint.x * (zoomOld - zoomNew)
  panY.value += scenePoint.y * (zoomOld - zoomNew)
  zoom.value = zoomNew
}

let panStartClient = { x: 0, y: 0 }
let panStartValue = { x: 0, y: 0 }

function startPan(event: PointerEvent): void {
  autoFit.value = false
  panStartClient = { x: event.clientX, y: event.clientY }
  panStartValue = { x: panX.value, y: panY.value }
  window.addEventListener('pointermove', onPanMove)
  window.addEventListener('pointerup', onPanEnd)
}

function onPanMove(event: PointerEvent): void {
  panX.value = panStartValue.x + (event.clientX - panStartClient.x)
  panY.value = panStartValue.y + (event.clientY - panStartClient.y)
}

function onPanEnd(): void {
  window.removeEventListener('pointermove', onPanMove)
  window.removeEventListener('pointerup', onPanEnd)
}

interface MarqueeState {
  startScene: { x: number; y: number }
  moved: boolean
}

let marqueeState: MarqueeState | null = null
const marqueeRect = ref<Rect | null>(null)

function startMarquee(event: PointerEvent): void {
  marqueeState = { startScene: clientToScene(event.clientX, event.clientY), moved: false }
  window.addEventListener('pointermove', onMarqueeMove)
  window.addEventListener('pointerup', onMarqueeEnd)
}

function onMarqueeMove(event: PointerEvent): void {
  if (!marqueeState) return
  const current = clientToScene(event.clientX, event.clientY)
  const dx = current.x - marqueeState.startScene.x
  const dy = current.y - marqueeState.startScene.y
  if (Math.abs(dx) > 2 || Math.abs(dy) > 2) marqueeState.moved = true
  marqueeRect.value = {
    x: Math.min(marqueeState.startScene.x, current.x),
    y: Math.min(marqueeState.startScene.y, current.y),
    width: Math.abs(dx),
    height: Math.abs(dy),
  }
}

function onMarqueeEnd(): void {
  window.removeEventListener('pointermove', onMarqueeMove)
  window.removeEventListener('pointerup', onMarqueeEnd)
  if (!marqueeState) return
  if (!marqueeState.moved) {
    sceneStore.clearSelection()
  } else if (marqueeRect.value) {
    const rect = marqueeRect.value
    const hits = sceneStore.scene.items.filter((item) => {
      const bounds = axisAlignedBounds(itemWorldCorners(item, getBbox(item)))
      return rectsIntersect(bounds, rect)
    })
    sceneStore.selectMany(hits.map((item) => item.uid))
  }
  marqueeState = null
  marqueeRect.value = null
}

function onBackgroundPointerDown(event: PointerEvent): void {
  const target = event.target as Element
  const isBackground = target === svgRef.value || target.closest('.canvas-background') !== null
  if (!isBackground) return
  if (spacePressed.value) {
    startPan(event)
    return
  }
  startMarquee(event)
}

interface DragState {
  startScene: { x: number; y: number }
  startPositions: Map<string, { x: number; y: number }>
  historyPushed: boolean
}

let dragState: DragState | null = null

function startItemDrag(event: PointerEvent): void {
  const startScene = clientToScene(event.clientX, event.clientY)
  const startPositions = new Map(
    sceneStore.selectedItems.map((item) => [item.uid, { x: item.x, y: item.y }]),
  )
  dragState = { startScene, startPositions, historyPushed: false }
  window.addEventListener('pointermove', onItemDragMove)
  window.addEventListener('pointerup', onItemDragEnd)
}

function onItemDragMove(event: PointerEvent): void {
  if (!dragState) return
  const current = clientToScene(event.clientX, event.clientY)
  const dx = current.x - dragState.startScene.x
  const dy = current.y - dragState.startScene.y
  if (dx === 0 && dy === 0) return
  if (!dragState.historyPushed) {
    sceneStore.beginInteraction()
    dragState.historyPushed = true
  }
  for (const [uid, start] of dragState.startPositions) {
    liveOverride.value.set(uid, { x: start.x + dx, y: start.y + dy })
  }
}

function onItemDragEnd(): void {
  window.removeEventListener('pointermove', onItemDragMove)
  window.removeEventListener('pointerup', onItemDragEnd)
  if (dragState?.historyPushed) commitLiveOverride([...dragState.startPositions.keys()])
  else clearLiveOverride([...(dragState?.startPositions.keys() ?? [])])
  dragState = null
}

function onItemPointerDown(event: PointerEvent, uid: string): void {
  event.stopPropagation()
  if (event.shiftKey) {
    sceneStore.toggleSelect(uid)
    return
  }
  if (!sceneStore.selection.has(uid)) {
    sceneStore.selectOnly(uid)
  }
  if (event.altKey) {
    sceneStore.duplicateItems([...sceneStore.selection])
  }
  startItemDrag(event)
}

interface RotateState {
  uid: string
  center: { x: number; y: number }
  startAngle: number
  startRotation: number
  historyPushed: boolean
}

let rotateState: RotateState | null = null

function onRotateHandlePointerDown(event: PointerEvent, uid: string): void {
  event.stopPropagation()
  const item = sceneStore.scene.items.find((candidate) => candidate.uid === uid)
  if (!item) return
  const center = { x: item.x, y: item.y }
  const pointerScene = clientToScene(event.clientX, event.clientY)
  const startAngle = Math.atan2(pointerScene.y - center.y, pointerScene.x - center.x)
  rotateState = { uid, center, startAngle, startRotation: item.rotation, historyPushed: false }
  window.addEventListener('pointermove', onRotateMove)
  window.addEventListener('pointerup', onRotateEnd)
}

function onRotateMove(event: PointerEvent): void {
  if (!rotateState) return
  const pointerScene = clientToScene(event.clientX, event.clientY)
  const currentAngle = Math.atan2(
    pointerScene.y - rotateState.center.y,
    pointerScene.x - rotateState.center.x,
  )
  const deltaDegrees = ((currentAngle - rotateState.startAngle) * 180) / Math.PI
  let newRotation = rotateState.startRotation + deltaDegrees
  if (event.shiftKey) newRotation = Math.round(newRotation / 15) * 15
  if (newRotation === rotateState.startRotation) return
  if (!rotateState.historyPushed) {
    sceneStore.beginInteraction()
    rotateState.historyPushed = true
  }
  liveOverride.value.set(rotateState.uid, { rotation: newRotation })
}

function onRotateEnd(): void {
  window.removeEventListener('pointermove', onRotateMove)
  window.removeEventListener('pointerup', onRotateEnd)
  if (rotateState?.historyPushed) commitLiveOverride([rotateState.uid])
  else if (rotateState) clearLiveOverride([rotateState.uid])
  rotateState = null
}

const ROTATE_KEY_STEP = 1
const ROTATE_KEY_STEP_SHIFT = 15

function onRotateHandleKeyDown(event: KeyboardEvent, uid: string): void {
  const item = sceneStore.scene.items.find((candidate) => candidate.uid === uid)
  if (!item) return
  const step = event.shiftKey ? ROTATE_KEY_STEP_SHIFT : ROTATE_KEY_STEP
  const direction = event.key === 'ArrowLeft' ? -1 : 1
  sceneStore.updateItemTransform(uid, { rotation: item.rotation + direction * step })
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'
}

function onKeyDown(event: KeyboardEvent): void {
  if (isEditableTarget(event.target)) return
  if (event.code === 'Space') {
    spacePressed.value = true
    event.preventDefault()
    return
  }
  const mod = event.ctrlKey || event.metaKey
  if (mod && event.key.toLowerCase() === 'z') {
    event.preventDefault()
    if (event.shiftKey) sceneStore.redo()
    else sceneStore.undo()
    return
  }
  if (mod && event.key.toLowerCase() === 'd') {
    event.preventDefault()
    sceneStore.duplicateItems([...sceneStore.selection])
    return
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault()
    sceneStore.removeItems([...sceneStore.selection])
    return
  }
  if (event.key === ']') {
    event.preventDefault()
    if (mod) sceneStore.bringToFront([...sceneStore.selection])
    else sceneStore.bringForward([...sceneStore.selection])
    return
  }
  if (event.key === '[') {
    event.preventDefault()
    if (mod) sceneStore.sendToBack([...sceneStore.selection])
    else sceneStore.sendBackward([...sceneStore.selection])
  }
}

function onKeyUp(event: KeyboardEvent): void {
  if (event.code === 'Space') spacePressed.value = false
}
</script>

<template>
  <div
    ref="containerRef"
    class="canvas-container"
    :class="{ 'canvas-container--pan': spacePressed }"
  >
    <div
      class="canvas-viewport"
      :style="viewportStyle"
    >
      <svg
        ref="svgRef"
        class="canvas-svg"
        :width="format.width"
        :height="format.height"
        :viewBox="`0 0 ${format.width} ${format.height}`"
        @wheel.prevent="handleWheel"
        @pointerdown="onBackgroundPointerDown"
      >
        <defs>
          <symbol
            v-for="def in symbolDefList"
            :id="def.symbolId"
            :key="def.symbolId"
            :viewBox="`${def.viewBox[0]} ${def.viewBox[1]} ${def.viewBox[2]} ${def.viewBox[3]}`"
            :width="def.viewBox[2]"
            :height="def.viewBox[3]"
            v-html="def.innerMarkup"
          />
        </defs>
        <CanvasBackground
          :scheme-id="sceneStore.scene.paletteId"
          :size="sceneStore.scene.size"
          :format="format"
          :visible="props.showBackground"
        />
        <CanvasItem
          v-for="item in sceneStore.scene.items"
          :key="item.uid"
          :item="item"
          :symbol-id="symbolIdFor(item)"
          :bbox="getBbox(item)"
          :selected="sceneStore.selection.has(item.uid)"
          :override="liveOverride.get(item.uid)"
          @pointerdown="onItemPointerDown"
        />
        <SelectionOverlay
          :items="visualSelectedItems"
          :get-bbox="getBbox"
          @rotate-pointerdown="onRotateHandlePointerDown"
          @rotate-keydown="onRotateHandleKeyDown"
        />
        <rect
          v-if="marqueeRect"
          class="canvas-marquee"
          :x="marqueeRect.x"
          :y="marqueeRect.y"
          :width="marqueeRect.width"
          :height="marqueeRect.height"
          fill="rgba(90, 80, 160, 0.1)"
          stroke="var(--role-ink, #1a1a1a)"
          stroke-dasharray="4 4"
        />
        <text
          v-if="sceneStore.scene.items.length === 0"
          class="canvas-empty-hint"
          :x="format.width / 2"
          :y="format.height / 2"
          text-anchor="middle"
          dominant-baseline="middle"
          pointer-events="none"
        >
          Добавьте объект из библиотеки слева или соберите композицию по сценарию выше
        </text>
      </svg>
      <div
        class="canvas-handle canvas-handle--right"
        :style="handleStyle"
        role="separator"
        aria-orientation="vertical"
        aria-label="Потяните, чтобы изменить ширину холста"
        title="Потяните, чтобы изменить ширину"
        @pointerdown="onResizeHandleDown('right', $event)"
      />
      <div
        class="canvas-handle canvas-handle--bottom"
        :style="handleStyle"
        role="separator"
        aria-orientation="horizontal"
        aria-label="Потяните, чтобы изменить высоту холста"
        title="Потяните, чтобы изменить высоту"
        @pointerdown="onResizeHandleDown('bottom', $event)"
      />
      <div
        class="canvas-handle canvas-handle--corner"
        :style="handleStyle"
        role="separator"
        aria-label="Потяните, чтобы изменить размер холста"
        title="Потяните, чтобы изменить размер"
        @pointerdown="onResizeHandleDown('corner', $event)"
      />
    </div>
    <div class="canvas-zoom">
      <label
        class="canvas-zoom__label"
        for="canvas-zoom-slider"
      >Масштаб</label>
      <input
        id="canvas-zoom-slider"
        type="range"
        :min="MIN_ZOOM * 100"
        :max="MAX_ZOOM * 100"
        step="5"
        :value="Math.round(zoom * 100)"
        @input="onZoomSlider"
      >
      <output class="canvas-zoom__value">{{ Math.round(zoom * 100) }}%</output>
      <button
        type="button"
        class="canvas-zoom__fit"
        aria-label="Вписать холст в окно"
        title="Вписать в окно"
        @click="resetFit"
      >
        <Maximize2
          aria-hidden="true"
          :size="14"
        />
      </button>
    </div>
  </div>
</template>

<style scoped>
.canvas-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--color-surface);
  touch-action: none;
}

.canvas-container--pan {
  cursor: grab;
}

.canvas-viewport {
  position: absolute;
  top: 0;
  left: 0;
  will-change: transform;
}

.canvas-handle {
  position: absolute;
  background: var(--gradient-accent);
  border: 1px solid var(--color-border);
  opacity: 0.65;
  touch-action: none;
  transition:
    opacity var(--transition-base),
    transform var(--transition-base);
}

.canvas-handle:hover {
  opacity: 1;
  transform: scale(1.08);
}

.canvas-handle--right {
  top: 50%;
  left: 100%;
  width: calc(10px * var(--handle-scale));
  height: calc(64px * var(--handle-scale));
  margin-left: calc(6px * var(--handle-scale));
  margin-top: calc(-32px * var(--handle-scale));
  border-radius: 999px;
  cursor: ew-resize;
}

.canvas-handle--bottom {
  left: 50%;
  top: 100%;
  height: calc(10px * var(--handle-scale));
  width: calc(64px * var(--handle-scale));
  margin-top: calc(6px * var(--handle-scale));
  margin-left: calc(-32px * var(--handle-scale));
  border-radius: 999px;
  cursor: ns-resize;
}

.canvas-handle--corner {
  left: 100%;
  top: 100%;
  width: calc(16px * var(--handle-scale));
  height: calc(16px * var(--handle-scale));
  margin-left: calc(6px * var(--handle-scale));
  margin-top: calc(6px * var(--handle-scale));
  border-radius: 4px;
  cursor: nwse-resize;
}

.canvas-zoom {
  position: absolute;
  left: 50%;
  bottom: var(--space-3);
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
  background: var(--color-surface);
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-raised);
  font-size: var(--font-size-sm);
}

.canvas-zoom__value {
  min-width: 3.2em;
  text-align: right;
}

.canvas-zoom__fit {
  display: inline-flex;
  padding: var(--space-1);
  border-radius: 999px;
}

.canvas-svg {
  display: block;
  box-shadow: var(--shadow-soft);
  border-radius: var(--radius-md);
}

.canvas-empty-hint {
  fill: var(--role-ink, #1a1a1a);
  opacity: 0.45;
  font-size: 22px;
  font-family: var(--font-sans);
}
</style>
