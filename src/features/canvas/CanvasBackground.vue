<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { sliceTransform } from '@/features/canvas/geometry'
import type { FormatDefinition } from '@/shared/formats'
import type { Size } from '@/shared/types'
import { useLibraryStore, type SymbolDefinition } from '@/stores/library'

const props = defineProps<{
  schemeId: string
  size: Size
  format: FormatDefinition
  visible: boolean
}>()

const libraryStore = useLibraryStore()

const hasFrame = computed(() =>
  libraryStore.getLibraryManifest().backgrounds.some((frame) => frame.schemeId === props.schemeId),
)

const symbolDef = ref<SymbolDefinition>()

watch(
  () => [props.schemeId, props.size, hasFrame.value] as const,
  async ([schemeId, size, available]) => {
    if (!available) {
      symbolDef.value = undefined
      return
    }
    symbolDef.value = await libraryStore.getBackgroundSymbolMarkup(schemeId, size)
  },
  { immediate: true },
)

const backgroundTransform = computed(() => {
  const def = symbolDef.value
  if (!def) return ''
  const [, , viewWidth, viewHeight] = def.viewBox
  return sliceTransform(viewWidth, viewHeight, {
    x: 0,
    y: 0,
    width: props.format.width,
    height: props.format.height,
  })
})
</script>

<template>
  <g class="canvas-background">
    <template v-if="visible && symbolDef">
      <!-- eslint-disable vue/no-v-text-v-html-on-component -->
      <defs>
        <symbol
          :id="symbolDef.symbolId"
          :viewBox="`${symbolDef.viewBox[0]} ${symbolDef.viewBox[1]} ${symbolDef.viewBox[2]} ${symbolDef.viewBox[3]}`"
          v-html="symbolDef.innerMarkup"
        />
      </defs>
      <!-- eslint-enable vue/no-v-text-v-html-on-component -->
      <g :transform="backgroundTransform">
        <use :href="`#${symbolDef.symbolId}`" />
      </g>
    </template>
    <rect
      v-else
      x="0"
      y="0"
      :width="format.width"
      :height="format.height"
      fill="var(--role-bg-1, #f5f2fb)"
    />
  </g>
</template>
