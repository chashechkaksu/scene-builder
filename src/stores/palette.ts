import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  findPalette,
  getBuiltInPalettes,
  parsePaletteData,
  parsePaletteFile,
} from '@/core/palette/registry'
import type { Palette } from '@/core/palette/schema'
import { useSceneStore } from '@/stores/scene'

export interface LoadPaletteResult {
  ok: boolean
  message?: string
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('Не удалось прочитать файл'))
    reader.readAsText(file)
  })
}

export const usePaletteStore = defineStore('palette', () => {
  const sceneStore = useSceneStore()

  const builtIn = ref<Palette[]>(getBuiltInPalettes())
  const custom = ref<Palette[]>([])

  const all = computed<Palette[]>(() => {
    const customIds = new Set(custom.value.map((palette) => palette.id))
    return [...builtIn.value.filter((palette) => !customIds.has(palette.id)), ...custom.value]
  })

  const current = computed<Palette>(() => {
    const builtInFirst = builtIn.value[0]
    if (!builtInFirst) throw new Error('Не найдено ни одной встроенной палитры')
    return findPalette(all.value, sceneStore.scene.paletteId) ?? builtInFirst
  })

  async function loadFromFile(file: File): Promise<LoadPaletteResult> {
    let raw: string
    try {
      raw = await readFileAsText(file)
    } catch {
      return { ok: false, message: 'Не удалось прочитать файл' }
    }
    try {
      const palette = parsePaletteFile(raw)
      custom.value = [...custom.value.filter((candidate) => candidate.id !== palette.id), palette]
      sceneStore.setPaletteId(palette.id)
      return { ok: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось разобрать палитру'
      return { ok: false, message }
    }
  }

  function applyEdited(palette: Palette): LoadPaletteResult {
    try {
      const validated = parsePaletteData(palette)
      custom.value = [
        ...custom.value.filter((candidate) => candidate.id !== validated.id),
        validated,
      ]
      sceneStore.setPaletteId(validated.id)
      return { ok: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось применить палитру'
      return { ok: false, message }
    }
  }

  return {
    builtIn,
    custom,
    all,
    current,
    loadFromFile,
    applyEdited,
  }
})
