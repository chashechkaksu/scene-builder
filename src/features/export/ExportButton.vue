<script setup lang="ts">
import { Download, Loader2 } from 'lucide-vue-next'
import { ref } from 'vue'
import { exportSceneToSvg, type ExportAssetSource, type SymbolMarkup } from '@/core/export/export'
import type { Rect } from '@/features/canvas/geometry'
import type { ObjectState, Size } from '@/shared/types'
import { EXPORT_BUTTON_LABEL, EXPORT_ERROR_PREFIX, EXPORT_FILE_NAME } from '@/shared/strings'
import { useLibraryStore } from '@/stores/library'
import { usePaletteStore } from '@/stores/palette'
import { useSceneStore } from '@/stores/scene'

const props = defineProps<{ showBackground: boolean }>()

const sceneStore = useSceneStore()
const paletteStore = usePaletteStore()
const libraryStore = useLibraryStore()

const exportError = ref<string | undefined>()
const isExporting = ref(false)

function objectKey(objectId: string, size: Size, state: ObjectState): string {
  return `${objectId}-${size}-${state}`
}

async function buildAssetSource(): Promise<ExportAssetSource> {
  const size = sceneStore.scene.size
  const uniqueKeys = new Map<string, { objectId: string; state: ObjectState }>()
  for (const item of sceneStore.scene.items) {
    uniqueKeys.set(objectKey(item.objectId, size, item.state), item)
  }

  const [loadedSymbols, background] = await Promise.all([
    Promise.all(
      [...uniqueKeys.entries()].map(async ([key, { objectId, state }]) => {
        const symbol = await libraryStore.getSymbolMarkup(objectId, size, state)
        const assetRef = libraryStore.getObjectRef(objectId, size, state)
        return { key, symbol, bbox: assetRef?.bbox }
      }),
    ),
    props.showBackground
      ? libraryStore.getBackgroundSymbolMarkup(sceneStore.scene.paletteId, size)
      : Promise.resolve(undefined),
  ])

  const symbols = new Map<string, SymbolMarkup>()
  const bboxes = new Map<string, Rect>()
  for (const entry of loadedSymbols) {
    if (entry.symbol) symbols.set(entry.key, entry.symbol)
    if (entry.bbox) bboxes.set(entry.key, entry.bbox)
  }

  return {
    getObjectSymbol: (objectId, objectSize, state) =>
      symbols.get(objectKey(objectId, objectSize, state)),
    getObjectBBox: (objectId, objectSize, state) =>
      bboxes.get(objectKey(objectId, objectSize, state)),
    getBackgroundSymbol: () => background,
  }
}

function downloadSvg(markup: string): void {
  const blob = new Blob([markup], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = EXPORT_FILE_NAME
  link.click()
  URL.revokeObjectURL(url)
}

async function onExport(): Promise<void> {
  exportError.value = undefined
  isExporting.value = true
  try {
    const assets = await buildAssetSource()
    const markup = exportSceneToSvg(
      sceneStore.scene,
      paletteStore.current,
      props.showBackground,
      assets,
    )
    downloadSvg(markup)
  } catch (error) {
    exportError.value = `${EXPORT_ERROR_PREFIX}${error instanceof Error ? error.message : String(error)}`
  } finally {
    isExporting.value = false
  }
}
</script>

<template>
  <div class="export-button">
    <button
      type="button"
      :disabled="isExporting"
      :aria-busy="isExporting"
      @click="onExport"
    >
      <Loader2
        v-if="isExporting"
        class="export-button__spinner"
        aria-hidden="true"
        :size="14"
      />
      <Download
        v-else
        aria-hidden="true"
        :size="14"
      />
      {{ EXPORT_BUTTON_LABEL }}
    </button>
    <p
      v-if="exportError"
      class="export-button__error"
      role="alert"
    >
      {{ exportError }}
    </p>
  </div>
</template>

<style scoped>
.export-button {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.export-button button {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-4);
  border-radius: var(--radius-pill);
  border: none;
  background: var(--gradient-accent);
  color: #fff;
  box-shadow: var(--shadow-soft);
}

.export-button button:hover:not(:disabled) {
  box-shadow: var(--shadow-raised);
}

.export-button__spinner {
  animation: export-button-spin 900ms linear infinite;
}

@keyframes export-button-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.export-button__error {
  margin: 0;
  color: var(--color-danger);
  font-size: 0.8rem;
}
</style>
