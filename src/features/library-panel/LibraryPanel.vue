<script setup lang="ts">
import { Plus } from 'lucide-vue-next'
import { computed } from 'vue'
import { resolveFormat } from '@/shared/formats'
import { useLibraryStore } from '@/stores/library'
import { useSceneStore } from '@/stores/scene'

const libraryStore = useLibraryStore()
const sceneStore = useSceneStore()

const objects = computed(() => libraryStore.getLibraryManifest().objects)

function addToCanvas(objectId: string): void {
  const format = resolveFormat(sceneStore.scene)
  sceneStore.addItem(objectId, 'main', {
    x: format.width / 2,
    y: format.height / 2,
  })
}
</script>

<template>
  <div class="library-panel">
    <h2 class="library-panel__title">
      Библиотека
    </h2>
    <ul class="library-panel__list">
      <li
        v-for="object in objects"
        :key="object.id"
      >
        <button
          type="button"
          class="library-panel__item"
          :aria-label="`Добавить на холст: ${object.nameRu}`"
          @click="addToCanvas(object.id)"
        >
          <span
            class="library-panel__badge"
            aria-hidden="true"
          >
            <Plus :size="16" />
          </span>
          {{ object.nameRu }}
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.library-panel {
  padding: var(--space-3);
}

.library-panel__title {
  margin: 0 0 var(--space-2);
  font-size: var(--font-size-lg);
  font-family: var(--font-display);
  font-weight: 600;
}

.library-panel__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  list-style: none;
  margin: 0;
  padding: 0;
}

.library-panel__item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  text-align: left;
  padding: var(--space-2);
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  background: var(--color-surface);
  box-shadow: var(--shadow-soft);
}

.library-panel__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border-radius: var(--radius-pill);
  background: var(--gradient-peachy);
  color: var(--color-ink);
}

.library-panel__item:hover {
  background: var(--color-surface-muted);
  border-color: var(--color-border);
  box-shadow: var(--shadow-raised);
}

.library-panel__item:hover .library-panel__badge {
  background: var(--gradient-accent);
  color: #fff;
}

.library-panel__item:focus-visible {
  background: var(--color-lavender);
}
</style>
