<script setup lang="ts">
import { Check, Download } from 'lucide-vue-next'
import { ref, toRaw, watch } from 'vue'
import { lowBackgroundContrastWarning } from '@/core/palette/contrast'
import { frozenBackgroundWhiteWarning } from '@/core/palette/registry'
import type { Palette } from '@/core/palette/schema'
import { usePaletteStore } from '@/stores/palette'

const FIELDS = [
  { key: 'bg1', label: 'Фон 1', group: 'background' as const },
  { key: 'bg2', label: 'Фон 2', group: 'background' as const },
  { key: 'bg3', label: 'Фон 3', group: 'background' as const },
  { key: 'ink', label: 'Контур (ink)', group: 'background' as const },
  { key: 'obj1', label: 'Объект 1', group: 'object' as const },
  { key: 'obj2', label: 'Объект 2', group: 'object' as const },
  { key: 'obj3', label: 'Объект 3', group: 'object' as const },
  { key: 'white', label: 'Белый', group: 'object' as const },
] as const

const paletteStore = usePaletteStore()

function cloneDraft(palette: Palette): Palette {
  return structuredClone(toRaw(palette))
}

const draft = ref<Palette>(cloneDraft(paletteStore.current))
const applyMessage = ref<string | undefined>()
const applyWarning = ref<string | undefined>()

watch(
  () => paletteStore.current,
  (palette) => {
    draft.value = cloneDraft(palette)
  },
)

function fieldValue(field: (typeof FIELDS)[number]): string {
  const group = draft.value[field.group] as Record<string, string>
  return group[field.key] ?? '#000000'
}

function setFieldValue(field: (typeof FIELDS)[number], value: string): void {
  const group = draft.value[field.group] as Record<string, string>
  group[field.key] = value
}

function applyToCanvas(): void {
  const result = paletteStore.applyEdited(draft.value)
  applyMessage.value = result.ok ? 'Применено к холсту' : result.message
  applyWarning.value =
    frozenBackgroundWhiteWarning(draft.value) ?? lowBackgroundContrastWarning(draft.value)
}

function downloadJson(): void {
  const blob = new Blob([JSON.stringify(draft.value, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${draft.value.id || 'palette'}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="palette-editor">
    <div class="palette-editor__field">
      <label for="palette-editor-name">Название</label>
      <input
        id="palette-editor-name"
        v-model="draft.name"
        type="text"
        class="palette-editor__name"
      >
    </div>
    <div class="palette-editor__grid">
      <div
        v-for="field in FIELDS"
        :key="field.key"
        class="palette-editor__field"
      >
        <label :for="`palette-editor-${field.key}`">{{ field.label }}</label>
        <div class="palette-editor__color-row">
          <input
            :id="`palette-editor-${field.key}`"
            type="color"
            :value="fieldValue(field)"
            :aria-label="`Цвет: ${field.label}`"
            @input="setFieldValue(field, ($event.target as HTMLInputElement).value)"
          >
          <input
            type="text"
            class="palette-editor__hex"
            :value="fieldValue(field)"
            :aria-label="`Hex-код: ${field.label}`"
            @change="setFieldValue(field, ($event.target as HTMLInputElement).value)"
          >
        </div>
      </div>
    </div>
    <div class="palette-editor__actions">
      <button
        type="button"
        @click="applyToCanvas"
      >
        <Check
          aria-hidden="true"
          :size="14"
        />
        Применить к холсту
      </button>
      <button
        type="button"
        @click="downloadJson"
      >
        <Download
          aria-hidden="true"
          :size="14"
        />
        Скачать JSON
      </button>
    </div>
    <p
      v-if="applyMessage"
      class="palette-editor__message"
    >
      {{ applyMessage }}
    </p>
    <p
      v-if="applyWarning"
      class="palette-editor__warning"
      role="status"
    >
      {{ applyWarning }}
    </p>
  </div>
</template>

<style scoped>
.palette-editor {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-3);
}

.palette-editor__grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-2);
}

.palette-editor__field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-size: 0.8rem;
}

.palette-editor__field label {
  color: var(--color-ink);
  opacity: 0.85;
}

.palette-editor__name {
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-lavender);
  padding: var(--space-1) var(--space-2);
  background: var(--color-surface);
  font: inherit;
  transition:
    border-color var(--transition-base),
    box-shadow var(--transition-base);
}

.palette-editor__name:focus-visible {
  border-color: var(--color-lavender-deep);
  box-shadow: var(--shadow-soft);
}

.palette-editor__color-row {
  display: flex;
  gap: var(--space-1);
  align-items: center;
}

.palette-editor__hex {
  width: 100%;
  min-width: 0;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-lavender);
  padding: 4px var(--space-1);
  background: var(--color-surface);
}

.palette-editor__color-row input[type='color'] {
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-lavender);
}

.palette-editor__actions {
  display: flex;
  gap: var(--space-2);
}

.palette-editor__actions button {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  border-radius: var(--radius-pill);
  border: 1px solid var(--color-lavender);
  background: var(--color-surface);
  padding: var(--space-1) var(--space-3);
}

.palette-editor__actions button:first-child {
  border: none;
  background: var(--gradient-accent);
  color: #fff;
  box-shadow: var(--shadow-soft);
}

.palette-editor__warning {
  color: var(--color-warning);
  font-size: 0.8rem;
}

.palette-editor__message {
  font-size: 0.8rem;
}
</style>
