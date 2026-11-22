<script setup lang="ts">
import { Eye, EyeOff, Search, Shuffle, Wand2, X } from 'lucide-vue-next'
import { ref } from 'vue'
import { matchComponents, type ObjectMatch } from '@/core/matcher'
import { applyComposition, nextLayoutSeed } from '@/features/scenarios/compose'
import { celebrateComposition } from '@/shared/celebrate'
import type { ObjectState } from '@/shared/types'
import { useLibraryStore } from '@/stores/library'

const libraryStore = useLibraryStore()

const input = ref('')
const chips = ref<Array<ObjectMatch & { state: ObjectState }>>([])
const unknownChunks = ref<string[]>([])
const seed = ref(0)
const hasComposed = ref(false)

function nameFor(objectId: string): string {
  return (
    libraryStore.getLibraryManifest().objects.find((object) => object.id === objectId)?.nameRu ??
    objectId
  )
}

function onParse(): void {
  const result = matchComponents(input.value)
  chips.value = result.matches.map((match) => ({ ...match, state: 'main' as ObjectState }))
  unknownChunks.value = result.unknownChunks
}

function toggleState(objectId: string): void {
  chips.value = chips.value.map((chip) =>
    chip.objectId === objectId ? { ...chip, state: chip.state === 'main' ? 'bg' : 'main' } : chip,
  )
}

function removeChip(objectId: string): void {
  chips.value = chips.value.filter((chip) => chip.objectId !== objectId)
}

function onCompose(): void {
  if (chips.value.length === 0) return
  seed.value = Date.now() % 100000
  applyComposition(chips.value, seed.value)
  hasComposed.value = true
  celebrateComposition()
}

function onAnotherLayout(): void {
  if (chips.value.length === 0) return
  seed.value = nextLayoutSeed(seed.value)
  applyComposition(chips.value, seed.value)
}
</script>

<template>
  <div class="scenario-components">
    <label
      class="scenario-components__label"
      for="scenario-components-input"
    >
      Названия компонентов
    </label>
    <textarea
      id="scenario-components-input"
      v-model="input"
      class="scenario-components__input"
      rows="2"
      placeholder="Например: книга, телефон, наушники"
      @change="onParse"
    />
    <button
      type="button"
      class="scenario-components__parse"
      :disabled="input.trim().length === 0"
      @click="onParse"
    >
      <Search
        aria-hidden="true"
        :size="14"
      />
      Распознать
    </button>

    <p
      v-if="unknownChunks.length > 0"
      class="scenario-components__unknown"
      role="status"
    >
      Не распознано: {{ unknownChunks.join(', ') }}
    </p>

    <ul
      v-if="chips.length > 0"
      class="scenario-components__chips"
    >
      <li
        v-for="chip in chips"
        :key="chip.objectId"
        class="scenario-components__chip"
      >
        <span class="scenario-components__chip-name">{{ nameFor(chip.objectId) }}</span>
        <button
          type="button"
          class="scenario-components__chip-state"
          :aria-pressed="chip.state === 'main'"
          :aria-label="`${nameFor(chip.objectId)}: переключить главный/фоновый`"
          @click="toggleState(chip.objectId)"
        >
          <Eye
            v-if="chip.state === 'main'"
            aria-hidden="true"
            :size="12"
          />
          <EyeOff
            v-else
            aria-hidden="true"
            :size="12"
          />
          {{ chip.state === 'main' ? 'главный' : 'фоновый' }}
        </button>
        <button
          type="button"
          class="scenario-components__chip-remove"
          :aria-label="`Убрать ${nameFor(chip.objectId)}`"
          @click="removeChip(chip.objectId)"
        >
          <X
            aria-hidden="true"
            :size="12"
          />
        </button>
      </li>
    </ul>

    <div
      v-if="chips.length > 0"
      class="scenario-components__actions"
    >
      <button
        type="button"
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
  </div>
</template>

<style scoped>
.scenario-components {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.scenario-components__label {
  font-size: 0.8rem;
  color: var(--color-ink);
}

.scenario-components__input {
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

.scenario-components__input:focus-visible {
  border-color: var(--color-lavender-deep);
  box-shadow: var(--shadow-soft);
}

.scenario-components__unknown {
  margin: 0;
  font-size: 0.8rem;
  color: var(--color-warning);
}

.scenario-components__chips {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.scenario-components__chip {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  box-shadow: var(--shadow-soft);
  font-size: 0.8rem;
  transition: box-shadow var(--transition-base);
}

.scenario-components__chip:hover {
  box-shadow: var(--shadow-raised);
}

.scenario-components__chip-state,
.scenario-components__chip-remove {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: transparent;
  font-size: var(--font-size-sm);
  text-decoration: underline;
}

.scenario-components__chip-remove {
  text-decoration: none;
  color: var(--color-danger);
}

.scenario-components__actions {
  display: flex;
  gap: var(--space-2);
}

.scenario-components__actions button,
.scenario-components__parse {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  border-radius: var(--radius-pill);
  border: 1px solid var(--color-lavender);
  background: var(--color-surface);
  padding: var(--space-1) var(--space-3);
  align-self: flex-start;
}

.scenario-components__actions button:first-child {
  border: none;
  background: var(--gradient-accent);
  color: #fff;
  box-shadow: var(--shadow-soft);
}
</style>
