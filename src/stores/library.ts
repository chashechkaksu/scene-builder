import { defineStore } from 'pinia'
import manifestJson from '@/library/manifest.json'
import type { LibraryManifest, ObjectState, Size } from '@/shared/types'

const manifest = manifestJson as unknown as LibraryManifest

const rawSvgModules = import.meta.glob('../library/**/*.svg', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>

export interface SymbolDefinition {
  symbolId: string
  viewBox: [number, number, number, number]
  innerMarkup: string
}

function parseSvgMarkup(raw: string): {
  viewBox: [number, number, number, number]
  innerMarkup: string
} {
  const parser = new DOMParser()
  const doc = parser.parseFromString(raw, 'image/svg+xml')
  const root = doc.documentElement
  const viewBoxAttr = root.getAttribute('viewBox')
  let viewBox: [number, number, number, number] = [0, 0, 0, 0]
  if (viewBoxAttr) {
    const parts = viewBoxAttr.trim().split(/\s+/).map(Number)
    if (parts.length === 4) {
      viewBox = [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 0]
    }
  }
  return { viewBox, innerMarkup: root.innerHTML }
}

async function loadRawSvg(filePath: string): Promise<string> {
  const key = `../library/${filePath}`
  const loader = rawSvgModules[key]
  if (!loader) {
    throw new Error(`Файл библиотеки не найден: ${filePath}`)
  }
  return loader()
}

export const useLibraryStore = defineStore('library', () => {
  const symbolCache = new Map<string, Promise<SymbolDefinition | undefined>>()

  function getLibraryManifest(): LibraryManifest {
    return manifest
  }

  function getSymbolMarkup(
    objectId: string,
    size: Size,
    state: ObjectState,
  ): Promise<SymbolDefinition | undefined> {
    const symbolId = `${objectId}-${size}-${state}`
    const cached = symbolCache.get(symbolId)
    if (cached) return cached

    const promise = (async () => {
      const object = manifest.objects.find((candidate) => candidate.id === objectId)
      if (!object) return undefined
      const assetRef = object.sizes[size][state]
      const raw = await loadRawSvg(assetRef.file)
      const { viewBox, innerMarkup } = parseSvgMarkup(raw)
      return { symbolId, viewBox, innerMarkup }
    })()
    symbolCache.set(symbolId, promise)
    return promise
  }

  function getBackgroundSymbolMarkup(
    schemeId: string,
    size: Size,
  ): Promise<SymbolDefinition | undefined> {
    const symbolId = `bg-frame-${schemeId}-${size}`
    const cached = symbolCache.get(symbolId)
    if (cached) return cached

    const promise = (async () => {
      const frame = manifest.backgrounds.find((candidate) => candidate.schemeId === schemeId)
      if (!frame) return undefined
      const assetRef = frame.sizes[size]
      const raw = await loadRawSvg(assetRef.file)
      const { viewBox, innerMarkup } = parseSvgMarkup(raw)
      return { symbolId, viewBox, innerMarkup }
    })()
    symbolCache.set(symbolId, promise)
    return promise
  }

  function getObjectRef(objectId: string, size: Size, state: ObjectState) {
    const object = manifest.objects.find((candidate) => candidate.id === objectId)
    return object?.sizes[size][state]
  }

  return {
    getLibraryManifest,
    getSymbolMarkup,
    getBackgroundSymbolMarkup,
    getObjectRef,
  }
})
