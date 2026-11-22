<script setup lang="ts">
import { LayoutPanelLeft, PanelRightOpen } from 'lucide-vue-next'
import { ref } from 'vue'
import CanvasSettings from '@/features/canvas-settings/CanvasSettings.vue'
import CanvasRoot from '@/features/canvas/CanvasRoot.vue'
import LayersPanel from '@/features/layers/LayersPanel.vue'
import LibraryPanel from '@/features/library-panel/LibraryPanel.vue'
import ScenarioPanel from '@/features/scenarios/ScenarioPanel.vue'
import ShortcutsModal from '@/features/shortcuts/ShortcutsModal.vue'
import ToolbarPanel from '@/features/toolbar/ToolbarPanel.vue'
import { APP_TITLE } from '@/shared/strings'

const showBackground = ref(true)

const libraryOpen = ref(false)
const layersOpen = ref(false)
</script>

<template>
  <main class="app-shell">
    <div class="app-shell__head">
      <h1 class="app-shell__title">
        {{ APP_TITLE }}
      </h1>
      <ShortcutsModal />
    </div>
    <ToolbarPanel v-model:show-background="showBackground" />
    <ScenarioPanel />
    <div class="app-shell__panel-toggles">
      <button
        type="button"
        class="app-shell__panel-toggle"
        aria-controls="app-shell-library"
        :aria-expanded="libraryOpen"
        @click="libraryOpen = !libraryOpen"
      >
        <LayoutPanelLeft
          aria-hidden="true"
          :size="16"
        />
        Библиотека
      </button>
      <button
        type="button"
        class="app-shell__panel-toggle"
        aria-controls="app-shell-layers"
        :aria-expanded="layersOpen"
        @click="layersOpen = !layersOpen"
      >
        <PanelRightOpen
          aria-hidden="true"
          :size="16"
        />
        Холст и слои
      </button>
    </div>
    <div class="app-shell__body">
      <div
        v-if="libraryOpen"
        class="app-shell__scrim"
        @click="libraryOpen = false"
      />
      <aside
        id="app-shell-library"
        class="app-shell__panel app-shell__panel--left"
        :class="{ 'app-shell__panel--open': libraryOpen }"
      >
        <LibraryPanel />
      </aside>
      <section class="app-shell__canvas">
        <CanvasRoot :show-background="showBackground" />
      </section>
      <div
        v-if="layersOpen"
        class="app-shell__scrim"
        @click="layersOpen = false"
      />
      <aside
        id="app-shell-layers"
        class="app-shell__panel app-shell__panel--right"
        :class="{ 'app-shell__panel--open': layersOpen }"
      >
        <CanvasSettings />
        <LayersPanel />
      </aside>
    </div>
  </main>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding: var(--space-3);
  gap: var(--space-2);
}

.app-shell__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin: 0 0 var(--space-1);
}

.app-shell__title {
  margin: 0;
  font-size: var(--font-size-xl);
  font-family: var(--font-display);
  font-weight: 600;
  background: var(--gradient-accent);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.app-shell__panel-toggles {
  display: none;
  gap: var(--space-2);
}

.app-shell__panel-toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-pill);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  box-shadow: var(--shadow-soft);
  font-size: var(--font-size-sm);
}

.app-shell__body {
  position: relative;
  flex: 1;
  display: grid;
  grid-template-columns: var(--panel-width) 1fr var(--panel-width);
  gap: var(--space-3);
  min-height: 520px;
}

.app-shell__panel {
  overflow-y: auto;
  background: var(--gradient-panel);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-soft);
}

.app-shell__canvas {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 0;
}

.app-shell__scrim {
  display: none;
}

@media (max-width: 900px) {
  .app-shell__panel-toggles {
    display: flex;
  }

  .app-shell__body {
    grid-template-columns: 1fr;
  }

  .app-shell__panel {
    position: fixed;
    top: 0;
    bottom: 0;
    width: min(var(--panel-width), 80vw);
    z-index: 20;
    border-radius: 0;
    transition: transform var(--transition-base);
  }

  .app-shell__panel--left {
    left: 0;
    transform: translateX(-100%);
  }

  .app-shell__panel--right {
    right: 0;
    transform: translateX(100%);
  }

  .app-shell__panel--open {
    transform: translateX(0);
  }

  .app-shell__scrim {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(26, 26, 26, 0.25);
    z-index: 15;
  }
}
</style>
