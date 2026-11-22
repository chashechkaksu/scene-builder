<script setup lang="ts">
import { AlertTriangle, Loader2, SlidersHorizontal, UploadCloud, X } from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { lowBackgroundContrastWarning } from '@/core/palette/contrast'
import { frozenBackgroundWhiteWarning } from '@/core/palette/registry'
import ExportButton from '@/features/export/ExportButton.vue'
import PaletteEditor from '@/features/palette/PaletteEditor.vue'
import { usePaletteStore } from '@/stores/palette'
import { useSceneStore } from '@/stores/scene'

const props = defineProps<{ showBackground: boolean }>()
const emit = defineEmits<{ 'update:showBackground': [boolean] }>()

const sceneStore = useSceneStore()
const paletteStore = usePaletteStore()

const loadError = ref<string | undefined>()
const editorOpen = ref(false)
const fileInputRef = ref<HTMLInputElement>()
const dragActive = ref(false)
const isLoadingPalette = ref(false)

const loadWarning = computed<string | undefined>(
  () =>
    frozenBackgroundWhiteWarning(paletteStore.current) ??
    lowBackgroundContrastWarning(paletteStore.current),
)

function onEscape(event: KeyboardEvent): void {
  if (event.key === 'Escape') editorOpen.value = false
}

onMounted(() => window.addEventListener('keydown', onEscape))
onBeforeUnmount(() => window.removeEventListener('keydown', onEscape))

function onPaletteSelected(event: Event): void {
  const paletteId = (event.target as HTMLSelectElement).value
  sceneStore.setPaletteId(paletteId)
  loadError.value = undefined
}

async function handleFile(file: File): Promise<void> {
  isLoadingPalette.value = true
  try {
    const result = await paletteStore.loadFromFile(file)
    loadError.value = result.ok ? undefined : result.message
  } finally {
    isLoadingPalette.value = false
  }
}

function onFileInputChange(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) void handleFile(file)
  input.value = ''
}

function openFileDialog(): void {
  fileInputRef.value?.click()
}

function onDrop(event: DragEvent): void {
  dragActive.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) void handleFile(file)
}
</script>

<template>
  <div class="toolbar">
    <div class="toolbar__group">
      <label
        class="toolbar__label"
        for="toolbar-palette"
      >Палитра</label>
      <select
        id="toolbar-palette"
        :value="sceneStore.scene.paletteId"
        @change="onPaletteSelected"
      >
        <option
          v-for="palette in paletteStore.all"
          :key="palette.id"
          :value="palette.id"
        >
          {{ palette.name }}
        </option>
      </select>
    </div>

    <div class="toolbar__group">
      <label class="toolbar__label">
        <input
          type="checkbox"
          class="toolbar__switch"
          :checked="props.showBackground"
          @change="emit('update:showBackground', ($event.target as HTMLInputElement).checked)"
        >
        Подложка
      </label>
    </div>

    <div class="toolbar__group">
      <ExportButton :show-background="props.showBackground" />
    </div>

    <div
      class="toolbar__group toolbar__dropzone"
      :class="{ 'toolbar__dropzone--active': dragActive }"
      @dragover.prevent="dragActive = true"
      @dragleave="dragActive = false"
      @drop.prevent="onDrop"
    >
      <button
        type="button"
        aria-label="Загрузить палитру из JSON-файла"
        :disabled="isLoadingPalette"
        :aria-busy="isLoadingPalette"
        @click="openFileDialog"
      >
        <Loader2
          v-if="isLoadingPalette"
          class="toolbar__spinner"
          aria-hidden="true"
          :size="14"
        />
        <UploadCloud
          v-else
          aria-hidden="true"
          :size="14"
        />
        Загрузить палитру (.json)
      </button>
      <input
        ref="fileInputRef"
        type="file"
        accept=".json,application/json"
        class="toolbar__file-input"
        aria-hidden="true"
        tabindex="-1"
        @change="onFileInputChange"
      >
      <button
        type="button"
        :aria-expanded="editorOpen"
        @click="editorOpen = !editorOpen"
      >
        <SlidersHorizontal
          aria-hidden="true"
          :size="14"
        />
        Редактор палитры
      </button>
    </div>

    <p
      v-if="loadError"
      class="toolbar__error"
      role="alert"
    >
      <AlertTriangle
        aria-hidden="true"
        :size="14"
      />
      {{ loadError }}
    </p>
    <p
      v-if="loadWarning"
      class="toolbar__warning"
      role="status"
    >
      <AlertTriangle
        aria-hidden="true"
        :size="14"
      />
      {{ loadWarning }}
    </p>

    <Teleport to="body">
      <div
        v-if="editorOpen"
        class="palette-dialog__scrim"
        @click.self="editorOpen = false"
      >
        <div
          class="palette-dialog"
          role="dialog"
          aria-modal="true"
          aria-label="Редактор палитры"
        >
          <div class="palette-dialog__header">
            <h2 class="palette-dialog__title">
              Редактор палитры
            </h2>
            <button
              type="button"
              class="palette-dialog__close"
              aria-label="Закрыть редактор палитры"
              @click="editorOpen = false"
            >
              <X
                aria-hidden="true"
                :size="16"
              />
            </button>
          </div>
          <PaletteEditor />
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--gradient-panel);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-soft);
}

.toolbar select {
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-lavender);
  background: var(--color-surface);
}

.toolbar button {
  border-radius: var(--radius-pill);
  border: 1px solid var(--color-lavender);
  background: var(--color-surface);
  padding: var(--space-1) var(--space-3);
}

.toolbar button:hover:not(:disabled) {
  background: var(--color-lavender-soft);
  box-shadow: var(--shadow-soft);
}

.toolbar__group {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-size: 0.8rem;
}

.toolbar__label {
  color: var(--color-ink);
}

.toolbar__label:has(.toolbar__switch) {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
}

.toolbar__switch {
  appearance: none;
  -webkit-appearance: none;
  margin: 0;
  width: 38px;
  height: 22px;
  flex-shrink: 0;
  border-radius: var(--radius-pill);
  background: var(--color-border);
  position: relative;
  cursor: pointer;
  transition: background var(--transition-base);
}

.toolbar__switch::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--color-surface);
  box-shadow: var(--shadow-soft);
  transition: transform var(--transition-base);
}

.toolbar__switch:checked {
  background: var(--gradient-accent);
}

.toolbar__switch:checked::after {
  transform: translateX(16px);
}

.toolbar__dropzone {
  flex-direction: row;
  align-items: center;
  border-radius: var(--radius-pill);
  padding: var(--space-1);
  border: 1px dashed var(--color-lavender-deep);
  transition: background-color var(--transition-base);
}

.toolbar__dropzone--active {
  background: var(--color-lavender-soft);
}

.toolbar__file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  overflow: hidden;
}

.toolbar__error,
.toolbar__warning {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  width: 100%;
  margin: 0;
  font-size: var(--font-size-sm);
}

.toolbar__error {
  color: var(--color-danger);
}

.toolbar__warning {
  color: var(--color-warning);
}

.toolbar__dropzone button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.toolbar__spinner {
  animation: toolbar-spin 900ms linear infinite;
}

@keyframes toolbar-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.palette-dialog__scrim {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(26, 26, 26, 0.3);
}

.palette-dialog {
  width: min(480px, 92vw);
  max-height: 90vh;
  overflow-y: auto;
  background: var(--gradient-panel);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-pop);
  animation: palette-dialog-in var(--transition-bouncy);
}

@keyframes palette-dialog-in {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.98);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

.palette-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-3) 0;
}

.palette-dialog__title {
  margin: 0;
  font-size: 1.1rem;
  font-family: var(--font-display);
}

.palette-dialog__close {
  display: inline-flex;
  padding: var(--space-1);
  border-radius: var(--radius-pill);
  border: none;
  background: var(--color-lavender-soft);
}
</style>
