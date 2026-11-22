<script setup lang="ts">
import { ChevronsDown, ChevronsUp, Eye, EyeOff, MoveDown, MoveUp, Trash2 } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useLibraryStore } from '@/stores/library'
import { useSceneStore } from '@/stores/scene'

const sceneStore = useSceneStore()
const libraryStore = useLibraryStore()

const layers = computed(() =>
  [...sceneStore.scene.items].reverse().map((item, reversedIndex) => ({
    item,
    index: sceneStore.scene.items.length - 1 - reversedIndex,
  })),
)

function nameFor(objectId: string): string {
  return (
    libraryStore.getLibraryManifest().objects.find((object) => object.id === objectId)?.nameRu ??
    objectId
  )
}

function onLayerClick(uid: string, event: MouseEvent): void {
  if (event.shiftKey) sceneStore.toggleSelect(uid)
  else sceneStore.selectOnly(uid)
}

function toggleState(uid: string, currentState: 'main' | 'bg'): void {
  sceneStore.setItemState(uid, currentState === 'main' ? 'bg' : 'main')
}

const draggedIndex = ref<number | null>(null)

function onDragStart(index: number): void {
  draggedIndex.value = index
}

function onDragOver(event: DragEvent): void {
  event.preventDefault()
}

function onDrop(targetIndex: number): void {
  if (draggedIndex.value === null) return
  sceneStore.reorderItems(draggedIndex.value, targetIndex)
  draggedIndex.value = null
}
</script>

<template>
  <div class="layers-panel">
    <h2 class="layers-panel__title">
      Слои
    </h2>
    <div class="layers-panel__actions">
      <button
        type="button"
        @click="sceneStore.bringToFront([...sceneStore.selection])"
      >
        <ChevronsUp
          aria-hidden="true"
          :size="14"
        />
        На передний план
      </button>
      <button
        type="button"
        @click="sceneStore.bringForward([...sceneStore.selection])"
      >
        <MoveUp
          aria-hidden="true"
          :size="14"
        />
        Вперёд
      </button>
      <button
        type="button"
        @click="sceneStore.sendBackward([...sceneStore.selection])"
      >
        <MoveDown
          aria-hidden="true"
          :size="14"
        />
        Назад
      </button>
      <button
        type="button"
        @click="sceneStore.sendToBack([...sceneStore.selection])"
      >
        <ChevronsDown
          aria-hidden="true"
          :size="14"
        />
        На задний план
      </button>
      <button
        type="button"
        class="layers-panel__danger"
        :disabled="sceneStore.selection.size === 0"
        @click="sceneStore.removeItems([...sceneStore.selection])"
      >
        <Trash2
          aria-hidden="true"
          :size="14"
        />
        Удалить
      </button>
    </div>
    <ul class="layers-panel__list">
      <li
        v-for="layer in layers"
        :key="layer.item.uid"
        class="layers-panel__row"
        :class="{ 'layers-panel__row--selected': sceneStore.selection.has(layer.item.uid) }"
        draggable="true"
        :data-uid="layer.item.uid"
        @click="onLayerClick(layer.item.uid, $event)"
        @dragstart="onDragStart(layer.index)"
        @dragover="onDragOver"
        @drop="onDrop(layer.index)"
      >
        <span class="layers-panel__name">{{ nameFor(layer.item.objectId) }}</span>
        <button
          type="button"
          class="layers-panel__state"
          @click.stop="toggleState(layer.item.uid, layer.item.state)"
        >
          <Eye
            v-if="layer.item.state === 'main'"
            aria-hidden="true"
            :size="12"
          />
          <EyeOff
            v-else
            aria-hidden="true"
            :size="12"
          />
          {{ layer.item.state === 'main' ? 'главный' : 'фоновый' }}
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.layers-panel {
  padding: var(--space-3);
}

.layers-panel__title {
  margin: 0 0 var(--space-2);
  font-size: 1.05rem;
  font-family: var(--font-display);
  font-weight: 600;
}

.layers-panel__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  margin-bottom: var(--space-2);
}

.layers-panel__actions button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--font-size-sm);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-pill);
  border: 1px solid var(--color-lavender);
  background: var(--color-surface);
}

.layers-panel__actions button:hover:not(:disabled) {
  background: var(--color-lavender-soft);
  box-shadow: var(--shadow-soft);
}

.layers-panel__actions button.layers-panel__danger {
  border-color: #f0c9cf;
  color: var(--color-danger);
}

.layers-panel__actions button.layers-panel__danger:hover:not(:disabled) {
  background: #fdeef0;
}

.layers-panel__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.layers-panel__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  cursor: pointer;
  background: var(--color-surface);
  box-shadow: var(--shadow-soft);
  border: 1px solid transparent;
  transition:
    box-shadow var(--transition-base),
    background-color var(--transition-base);
}

.layers-panel__row:hover {
  box-shadow: var(--shadow-raised);
}

.layers-panel__row--selected {
  border-color: var(--color-lavender-deep);
  background: var(--color-lavender-soft);
}

.layers-panel__state {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--font-size-sm);
  border: none;
  background: transparent;
  text-decoration: underline;
}
</style>
