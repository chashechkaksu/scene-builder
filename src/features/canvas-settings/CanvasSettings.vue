<script setup lang="ts">
import { computed } from 'vue'
import {
  CANVAS_SIDE_STEP,
  FORMATS,
  MAX_CANVAS_SIDE,
  MIN_CANVAS_SIDE,
  clampCanvasSide,
  resolveFormat,
} from '@/shared/formats'
import type { Format, Size } from '@/shared/types'
import { useSceneStore } from '@/stores/scene'

const sceneStore = useSceneStore()

const formatList = Object.values(FORMATS)
const sizes: Array<{ id: Size; hint: string }> = [
  { id: 'L', hint: 'Подробная детализация' },
  { id: 'S', hint: 'Упрощённая детализация' },
]

const canvas = computed(() => resolveFormat(sceneStore.scene))
const isCustom = computed(() => sceneStore.scene.customSize !== undefined)

function readNumber(event: Event): number {
  return Number((event.target as HTMLInputElement).value)
}

let sliderDragStarted = false

function applySize(width: number, height: number): void {
  if (!sliderDragStarted) {
    sceneStore.beginInteraction()
    sliderDragStarted = true
  }
  sceneStore.applyWithoutHistory((draft) => {
    draft.customSize = { width: clampCanvasSide(width), height: clampCanvasSide(height) }
  })
}

function onWidth(event: Event): void {
  const value = readNumber(event)
  if (Number.isFinite(value)) applySize(value, canvas.value.height)
}

function onHeight(event: Event): void {
  const value = readNumber(event)
  if (Number.isFinite(value)) applySize(canvas.value.width, value)
}

function onSliderChange(): void {
  sliderDragStarted = false
}
</script>

<template>
  <section
    class="canvas-settings"
    aria-labelledby="canvas-settings-title"
  >
    <h2
      id="canvas-settings-title"
      class="canvas-settings__title"
    >
      Холст
    </h2>

    <div class="canvas-settings__block">
      <span class="canvas-settings__label">Формат</span>
      <div
        class="canvas-settings__segmented"
        role="group"
        aria-label="Формат холста"
      >
        <button
          v-for="item in formatList"
          :key="item.id"
          type="button"
          class="canvas-settings__segment"
          :class="{
            'canvas-settings__segment--active': !isCustom && sceneStore.scene.format === item.id,
          }"
          :aria-pressed="!isCustom && sceneStore.scene.format === item.id"
          @click="sceneStore.setFormat(item.id as Format)"
        >
          {{ item.nameRu }}
        </button>
      </div>
      <p
        v-if="isCustom"
        class="canvas-settings__custom"
      >
        Свой размер
      </p>
    </div>

    <div class="canvas-settings__block">
      <label
        class="canvas-settings__label"
        for="canvas-width"
      >
        Ширина
        <output>{{ canvas.width }}</output>
      </label>
      <input
        id="canvas-width"
        type="range"
        :min="MIN_CANVAS_SIDE"
        :max="MAX_CANVAS_SIDE"
        :step="CANVAS_SIDE_STEP"
        :value="canvas.width"
        @input="onWidth"
        @change="onSliderChange"
      >
    </div>

    <div class="canvas-settings__block">
      <label
        class="canvas-settings__label"
        for="canvas-height"
      >
        Высота
        <output>{{ canvas.height }}</output>
      </label>
      <input
        id="canvas-height"
        type="range"
        :min="MIN_CANVAS_SIDE"
        :max="MAX_CANVAS_SIDE"
        :step="CANVAS_SIDE_STEP"
        :value="canvas.height"
        @input="onHeight"
        @change="onSliderChange"
      >
    </div>

    <p class="canvas-settings__hint">
      Размер можно менять и мышью: потяните ручку у правого или нижнего края холста.
    </p>

    <div class="canvas-settings__block">
      <span class="canvas-settings__label">Детализация</span>
      <div
        class="canvas-settings__segmented"
        role="group"
        aria-label="Размер детализации L/S"
      >
        <button
          v-for="item in sizes"
          :key="item.id"
          type="button"
          class="canvas-settings__segment"
          :class="{ 'canvas-settings__segment--active': sceneStore.scene.size === item.id }"
          :aria-pressed="sceneStore.scene.size === item.id"
          :title="item.hint"
          @click="sceneStore.setSize(item.id)"
        >
          {{ item.id }}
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.canvas-settings {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-3);
  border-bottom: 1px solid var(--color-border);
}

.canvas-settings__title {
  margin: 0;
  font-size: var(--font-size-lg, 1.1rem);
  font-family: var(--font-display);
  font-weight: 600;
}

.canvas-settings__block {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.canvas-settings__label {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
}

.canvas-settings__segmented {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.canvas-settings__segment {
  flex: 1 1 auto;
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--color-lavender);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  font-size: 0.8rem;
  cursor: pointer;
  transition:
    background-color var(--transition-base),
    box-shadow var(--transition-base);
}

.canvas-settings__segment:hover:not(.canvas-settings__segment--active) {
  background: var(--color-lavender-soft);
}

.canvas-settings__segment--active {
  background: var(--gradient-accent);
  border-color: transparent;
  color: #fff;
  box-shadow: var(--shadow-soft);
}

.canvas-settings__custom,
.canvas-settings__hint {
  margin: 0;
  font-size: var(--font-size-sm);
  opacity: 0.7;
}
</style>
