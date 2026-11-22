<script setup lang="ts">
import { RefreshCw, Shuffle, Wand2 } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { composeMetaphor } from '@/core/compose/compose-metaphor'
import type { ObjectMatch } from '@/core/matcher'
import {
  applyComposition,
  nextLayoutSeed,
  type ComposedObject,
} from '@/features/scenarios/compose'
import { celebrateComposition } from '@/shared/celebrate'
import { useLibraryStore } from '@/stores/library'

type SelectedObject = ComposedObject & Pick<ObjectMatch, 'score' | 'reasons'>

const EXAMPLES = [
  'Защита личных данных',
  'Идея, которая зажигает',
  'Как копить на отпуск',
  'Учимся на ходу',
]

const libraryStore = useLibraryStore()

const input = ref('')
const ranked = ref<ObjectMatch[]>([])
const confident = ref(true)
const selected = ref<SelectedObject[]>([])
const seed = ref(0)
const hasComposed = ref(false)

function nameFor(objectId: string): string {
  return (
    libraryStore.getLibraryManifest().objects.find((object) => object.id === objectId)?.nameRu ??
    objectId
  )
}

const unusedAlternatives = computed(() => {
  const selectedIds = new Set(selected.value.map((match) => match.objectId))
  return ranked.value.filter((match) => !selectedIds.has(match.objectId))
})

function showComposition(objects: SelectedObject[]): void {
  selected.value = objects
  seed.value = Date.now() % 100000
  applyComposition(objects, seed.value)
  hasComposed.value = true
  celebrateComposition()
}

function onCompose(): void {
  const text = input.value.trim()
  if (text.length === 0) return
  const composition = composeMetaphor(text)
  ranked.value = composition.ranked
  confident.value = composition.confident
  showComposition(composition.composed)
}

function onExample(example: string): void {
  input.value = example
  onCompose()
}

function onAnotherLayout(): void {
  if (selected.value.length === 0) return
  seed.value = nextLayoutSeed(seed.value)
  applyComposition(selected.value, seed.value)
}

function onReplace(objectId: string): void {
  const alternative = unusedAlternatives.value[0]
  if (!alternative) return
  const index = selected.value.findIndex((match) => match.objectId === objectId)
  if (index === -1) return
  const replaced = selected.value[index]
  if (!replaced) return
  selected.value = selected.value.map((match, candidateIndex) =>
    candidateIndex === index ? { ...alternative, state: replaced.state } : match,
  )
  applyComposition(selected.value, seed.value)
}
</script>

<template>
  <div class="scenario-metaphor">
    <label
      class="scenario-metaphor__label"
      for="scenario-metaphor-input"
    >
      Метафора или заголовок
    </label>
    <textarea
      id="scenario-metaphor-input"
      v-model="input"
      class="scenario-metaphor__input"
      rows="2"
      placeholder="Например: «Защита личных данных»"
      @keydown.enter.exact.prevent="onCompose"
    />
    <div class="scenario-metaphor__examples">
      <button
        v-for="example in EXAMPLES"
        :key="example"
        type="button"
        class="scenario-metaphor__example"
        @click="onExample(example)"
      >
        {{ example }}
      </button>
    </div>
    <div class="scenario-metaphor__actions">
      <button
        type="button"
        :disabled="input.trim().length === 0"
        @click="onCompose"
      >
        <Wand2
          aria-hidden="true"
          :size="14"
        />
        Собрать
      </button>
      <button
        type="button"
        :disabled="!hasComposed"
        @click="onAnotherLayout"
      >
        <Shuffle
          aria-hidden="true"
          :size="14"
        />
        Другой вариант
      </button>
    </div>

    <p
      v-if="hasComposed && !confident"
      class="scenario-metaphor__notice"
      role="status"
    >
      Точных совпадений нет, подобрали близкие по смыслу.
    </p>

    <ul
      v-if="hasComposed"
      class="scenario-metaphor__list"
    >
      <li
        v-for="match in selected"
        :key="match.objectId"
        class="scenario-metaphor__item"
      >
        <div class="scenario-metaphor__item-main">
          <span class="scenario-metaphor__item-name">{{ nameFor(match.objectId) }}</span>
          <span class="scenario-metaphor__item-state">
            {{ match.state === 'main' ? 'главный' : 'фоновый' }}
          </span>
        </div>
        <p
          v-if="match.reasons.length > 0"
          class="scenario-metaphor__item-reason"
        >
          {{ match.reasons.join('; ') }}
        </p>
        <button
          type="button"
          class="scenario-metaphor__item-replace"
          :disabled="unusedAlternatives.length === 0"
          @click="onReplace(match.objectId)"
        >
          <RefreshCw
            aria-hidden="true"
            :size="12"
          />
          Заменить объект
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.scenario-metaphor {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.scenario-metaphor__label {
  font-size: 0.8rem;
  color: var(--color-ink);
}

.scenario-metaphor__input {
  resize: vertical;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-lavender);
  padding: var(--space-2);
  font: inherit;
  background: var(--color-surface);
  transition:
    border-color var(--transition-base),
    box-shadow var(--transition-base);
}

.scenario-metaphor__input:focus-visible {
  border-color: var(--color-lavender-deep);
  box-shadow: var(--shadow-soft);
}

.scenario-metaphor__examples {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.scenario-metaphor__example {
  padding: 2px var(--space-2);
  border-radius: var(--radius-pill);
  border: 1px solid var(--color-lavender);
  background: var(--color-surface);
  font-size: var(--font-size-sm);
}

.scenario-metaphor__example:hover:not(:disabled) {
  background: var(--color-lavender-soft);
}

.scenario-metaphor__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.scenario-metaphor__actions button {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  border-radius: var(--radius-pill);
  border: 1px solid var(--color-lavender);
  background: var(--color-surface);
  padding: var(--space-1) var(--space-3);
}

.scenario-metaphor__actions button:first-child {
  border: none;
  background: var(--gradient-accent);
  color: #fff;
  box-shadow: var(--shadow-soft);
}

.scenario-metaphor__actions button:hover:not(:disabled) {
  box-shadow: var(--shadow-raised);
}

.scenario-metaphor__notice {
  margin: 0;
  font-size: 0.8rem;
  color: var(--color-warning);
}

.scenario-metaphor__list {
  list-style: none;
  margin: 0;
  padding: 0 2px 2px 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  max-height: 220px;
  overflow-y: auto;
}

.scenario-metaphor__item {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-soft);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  transition:
    box-shadow var(--transition-base),
    transform var(--transition-bouncy);
}

.scenario-metaphor__item:hover {
  box-shadow: var(--shadow-raised);
  transform: translateY(var(--lift-hover));
}

.scenario-metaphor__item-main {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
  font-size: 0.85rem;
}

.scenario-metaphor__item-state {
  color: var(--color-ink);
  opacity: 0.7;
}

.scenario-metaphor__item-reason {
  margin: 0;
  font-size: 0.75rem;
  opacity: 0.8;
}

.scenario-metaphor__item-replace {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  align-self: flex-start;
  font-size: var(--font-size-sm);
  border: none;
  background: transparent;
  text-decoration: underline;
}
</style>
