<script setup lang="ts">
import { Keyboard, X } from 'lucide-vue-next'
import { onBeforeUnmount, onMounted, ref } from 'vue'

const open = ref(false)

const GROUPS: Array<{ title: string; items: Array<{ keys: string[]; label: string }> }> = [
  {
    title: 'Холст и объекты',
    items: [
      { keys: ['Клик'], label: 'Выделить объект' },
      { keys: ['Shift', 'Клик'], label: 'Добавить/убрать объект из выделения' },
      { keys: ['Рамка мышью'], label: 'Выделить несколько объектов' },
      { keys: ['Alt', 'Перетаскивание'], label: 'Дублировать объект на лету' },
      { keys: ['Shift', 'Поворот ручкой'], label: 'Поворот с шагом 15°' },
      { keys: ['←', '→', 'на ручке поворота'], label: 'Поворот на 1° (Shift — 15°)' },
      { keys: ['Пробел', 'Перетаскивание'], label: 'Панорамирование холста' },
      { keys: ['Колесо мыши'], label: 'Масштаб холста' },
    ],
  },
  {
    title: 'Редактирование',
    items: [
      { keys: ['Ctrl', 'Z'], label: 'Отменить' },
      { keys: ['Ctrl', 'Shift', 'Z'], label: 'Повторить' },
      { keys: ['Ctrl', 'D'], label: 'Дублировать выделенное' },
      { keys: ['Delete'], label: 'Удалить выделенное' },
    ],
  },
  {
    title: 'Слои',
    items: [
      { keys: [']'], label: 'На слой вперёд' },
      { keys: ['Ctrl', ']'], label: 'На передний план' },
      { keys: ['['], label: 'На слой назад' },
      { keys: ['Ctrl', '['], label: 'На задний план' },
    ],
  },
  {
    title: 'Прочее',
    items: [
      { keys: ['Enter'], label: 'Собрать композицию (в поле метафоры)' },
      { keys: ['Esc'], label: 'Закрыть открытое окно' },
      { keys: ['Shift', '/'], label: 'Показать эту подсказку' },
    ],
  },
]

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    open.value = false
    return
  }
  if (event.shiftKey && event.code === 'Slash' && !isEditableTarget(event.target)) {
    event.preventDefault()
    open.value = !open.value
  }
}

onMounted(() => window.addEventListener('keydown', onKeyDown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeyDown))
</script>

<template>
  <button
    type="button"
    class="shortcuts-trigger"
    aria-label="Горячие клавиши"
    title="Горячие клавиши (Shift + /)"
    @click="open = true"
  >
    <Keyboard
      aria-hidden="true"
      :size="16"
    />
  </button>

  <Teleport to="body">
    <div
      v-if="open"
      class="shortcuts-dialog__scrim"
      @click.self="open = false"
    >
      <div
        class="shortcuts-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Горячие клавиши"
      >
        <div class="shortcuts-dialog__header">
          <h2 class="shortcuts-dialog__title">
            Горячие клавиши
          </h2>
          <button
            type="button"
            class="shortcuts-dialog__close"
            aria-label="Закрыть окно горячих клавиш"
            @click="open = false"
          >
            <X
              aria-hidden="true"
              :size="16"
            />
          </button>
        </div>
        <div class="shortcuts-dialog__body">
          <section
            v-for="group in GROUPS"
            :key="group.title"
            class="shortcuts-group"
          >
            <h3 class="shortcuts-group__title">
              {{ group.title }}
            </h3>
            <ul class="shortcuts-list">
              <li
                v-for="item in group.items"
                :key="item.label"
                class="shortcuts-item"
              >
                <span class="shortcuts-keys">
                  <kbd
                    v-for="key in item.keys"
                    :key="key"
                  >{{ key }}</kbd>
                </span>
                <span class="shortcuts-label">{{ item.label }}</span>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.shortcuts-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-pill, 999px);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  box-shadow: var(--shadow-soft);
  cursor: pointer;
}

.shortcuts-trigger:hover {
  background: var(--color-lavender);
}

.shortcuts-dialog__scrim {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(26, 26, 26, 0.3);
}

.shortcuts-dialog {
  width: min(520px, 92vw);
  max-height: 85vh;
  overflow-y: auto;
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-soft);
}

.shortcuts-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-3) 0;
}

.shortcuts-dialog__title {
  margin: 0;
  font-family: var(--font-display, inherit);
  font-size: 1.1rem;
}

.shortcuts-dialog__close {
  display: inline-flex;
  padding: var(--space-1);
  border-radius: 999px;
}

.shortcuts-dialog__body {
  padding: var(--space-2) var(--space-3) var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.shortcuts-group__title {
  margin: 0 0 var(--space-1);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-ink);
  opacity: 0.6;
}

.shortcuts-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.shortcuts-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  font-size: 0.85rem;
  padding: var(--space-1) 0;
}

.shortcuts-keys {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.shortcuts-keys kbd {
  font-family: inherit;
  font-size: 0.75rem;
  padding: 2px 7px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: var(--color-surface-muted);
  box-shadow: 0 1px 0 var(--color-border);
}

.shortcuts-label {
  color: var(--color-ink);
  opacity: 0.85;
  text-align: right;
}
</style>
