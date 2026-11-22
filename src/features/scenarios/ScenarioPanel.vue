<script setup lang="ts">
import { ref } from 'vue'
import ScenarioComponents from '@/features/scenarios/ScenarioComponents.vue'
import ScenarioMetaphor from '@/features/scenarios/ScenarioMetaphor.vue'

type ScenarioTab = 'metaphor' | 'components'

const activeTab = ref<ScenarioTab>('metaphor')
</script>

<template>
  <div class="scenario-panel">
    <div
      class="scenario-panel__tabs"
      role="tablist"
      aria-label="Способ сборки композиции"
    >
      <button
        type="button"
        role="tab"
        class="scenario-panel__tab"
        :class="{ 'scenario-panel__tab--active': activeTab === 'metaphor' }"
        :aria-selected="activeTab === 'metaphor'"
        @click="activeTab = 'metaphor'"
      >
        По метафоре
      </button>
      <button
        type="button"
        role="tab"
        class="scenario-panel__tab"
        :class="{ 'scenario-panel__tab--active': activeTab === 'components' }"
        :aria-selected="activeTab === 'components'"
        @click="activeTab = 'components'"
      >
        По компонентам
      </button>
    </div>
    <ScenarioMetaphor v-if="activeTab === 'metaphor'" />
    <ScenarioComponents v-else />
  </div>
</template>

<style scoped>
.scenario-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--gradient-panel);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-soft);
}

.scenario-panel__tabs {
  display: flex;
  gap: var(--space-1);
  border-radius: var(--radius-pill);
  padding: 3px;
  background: var(--color-lavender-soft);
  width: fit-content;
}

.scenario-panel__tab {
  padding: var(--space-1) var(--space-4);
  border: none;
  border-radius: var(--radius-pill);
  background: transparent;
  font-family: var(--font-display);
  font-weight: 500;
  cursor: pointer;
}

.scenario-panel__tab--active {
  background: var(--color-surface);
  box-shadow: var(--shadow-soft);
  color: var(--color-focus);
}
</style>
