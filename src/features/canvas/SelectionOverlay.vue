<script setup lang="ts">
import { computed } from 'vue'
import {
  axisAlignedBounds,
  itemWorldCorners,
  rotationHandlePosition,
  type Rect,
} from '@/features/canvas/geometry'
import type { SceneItem } from '@/shared/types'

const props = defineProps<{
  items: SceneItem[]
  getBbox: (item: SceneItem) => Rect
}>()

const emit = defineEmits<{
  'rotate-pointerdown': [event: PointerEvent, uid: string]
  'rotate-keydown': [event: KeyboardEvent, uid: string]
}>()

const boxes = computed(() =>
  props.items.map((item) => ({
    uid: item.uid,
    bounds: axisAlignedBounds(itemWorldCorners(item, props.getBbox(item))),
  })),
)

const rotateHandle = computed(() => {
  if (props.items.length !== 1) return undefined
  const item = props.items[0]
  if (!item) return undefined
  const position = rotationHandlePosition(item, props.getBbox(item))
  return { uid: item.uid, center: { x: item.x, y: item.y }, position, rotation: item.rotation }
})

function onRotatePointerDown(event: PointerEvent): void {
  if (!rotateHandle.value) return
  emit('rotate-pointerdown', event, rotateHandle.value.uid)
}

function onRotateKeyDown(event: KeyboardEvent): void {
  if (!rotateHandle.value) return
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
  event.preventDefault()
  emit('rotate-keydown', event, rotateHandle.value.uid)
}
</script>

<template>
  <g class="selection-overlay">
    <rect
      v-for="box in boxes"
      :key="box.uid"
      class="selection-box"
      :x="box.bounds.x"
      :y="box.bounds.y"
      :width="box.bounds.width"
      :height="box.bounds.height"
      fill="none"
      stroke="var(--role-ink, #1a1a1a)"
      stroke-width="2"
      stroke-dasharray="6 4"
      pointer-events="none"
    />
    <template v-if="rotateHandle">
      <line
        :x1="rotateHandle.center.x"
        :y1="rotateHandle.center.y"
        :x2="rotateHandle.position.x"
        :y2="rotateHandle.position.y"
        stroke="var(--role-ink, #1a1a1a)"
        pointer-events="none"
      />
      <circle
        class="rotate-handle"
        data-role="rotate-handle"
        role="slider"
        tabindex="0"
        aria-label="Повернуть объект (перетащите, или стрелки влево/вправо, Shift — шаг 15°)"
        aria-valuemin="-180"
        aria-valuemax="180"
        :aria-valuenow="rotateHandle.rotation"
        :cx="rotateHandle.position.x"
        :cy="rotateHandle.position.y"
        r="9"
        fill="var(--role-white, #fff)"
        stroke="var(--role-ink, #1a1a1a)"
        stroke-width="2"
        @pointerdown="onRotatePointerDown"
        @keydown="onRotateKeyDown"
      />
    </template>
  </g>
</template>

<style scoped>
.rotate-handle {
  cursor: grab;
}
</style>
