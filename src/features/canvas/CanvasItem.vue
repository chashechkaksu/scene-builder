<script setup lang="ts">
import { computed } from 'vue'
import { itemTransform, type Rect } from '@/features/canvas/geometry'
import type { SceneItem } from '@/shared/types'

const props = defineProps<{
  item: SceneItem
  symbolId: string
  bbox: Rect
  objectScale: number
  selected: boolean
  override?: Partial<Pick<SceneItem, 'x' | 'y' | 'rotation'>>
}>()

const emit = defineEmits<{
  pointerdown: [event: PointerEvent, uid: string]
}>()

const transform = computed(() =>
  itemTransform(props.override ? { ...props.item, ...props.override } : props.item, props.bbox, props.objectScale),
)

function onPointerDown(event: PointerEvent): void {
  emit('pointerdown', event, props.item.uid)
}
</script>

<template>
  <g
    class="canvas-item"
    :class="{ 'canvas-item--selected': selected }"
    :transform="transform"
    :data-uid="item.uid"
    :data-state="item.state"
    @pointerdown="onPointerDown"
  >
    <use
      :href="`#${symbolId}`"
      x="0"
      y="0"
    />
  </g>
</template>

<style scoped>
.canvas-item {
  cursor: grab;
  animation: canvas-item-enter var(--transition-base) ease-out;
}

@keyframes canvas-item-enter {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}
</style>
