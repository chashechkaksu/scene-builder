import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { exportSceneToSvg, type ExportAssetSource, type SymbolMarkup } from '@/core/export/export'
import { parsePalette } from '@/core/palette/schema'
import { getFormat } from '@/shared/formats'
import type { LibraryManifest, ObjectState, Scene, Size } from '@/shared/types'
import purpleJson from '@/palettes/purple.json'
import orangeJson from '@/palettes/orange.json'
import manifestJson from '@/library/manifest.json'

const manifest = manifestJson as unknown as LibraryManifest
const palette = parsePalette(purpleJson)

const GEOMETRY_ATTRS = [
  'd',
  'points',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'width',
  'height',
] as const

function libraryFilePath(file: string): string {
  return resolve(process.cwd(), 'src/library', file)
}

function parseSymbolMarkup(raw: string): SymbolMarkup {
  const doc = new DOMParser().parseFromString(raw, 'image/svg+xml')
  const root = doc.documentElement
  const viewBoxAttr = root.getAttribute('viewBox') ?? '0 0 0 0'
  const parts = viewBoxAttr.trim().split(/\s+/).map(Number)
  const viewBox: [number, number, number, number] = [
    parts[0] ?? 0,
    parts[1] ?? 0,
    parts[2] ?? 0,
    parts[3] ?? 0,
  ]
  return { viewBox, innerMarkup: root.innerHTML }
}

function loadSymbol(file: string): SymbolMarkup {
  const raw = readFileSync(libraryFilePath(file), 'utf-8')
  return parseSymbolMarkup(raw)
}

function sourceTopLevelElements(file: string): Element[] {
  const raw = readFileSync(libraryFilePath(file), 'utf-8')
  const doc = new DOMParser().parseFromString(raw, 'image/svg+xml')
  return Array.from(doc.documentElement.children)
}

function geometryAttrs(el: Element): Record<string, string> {
  const result: Record<string, string> = {}
  for (const attr of GEOMETRY_ATTRS) {
    const value = el.getAttribute(attr)
    if (value !== null) result[attr] = value
  }
  return result
}

function buildAssetSource(): ExportAssetSource {
  const objectSymbols = new Map<string, SymbolMarkup>()
  const objectBBoxes = new Map<string, { x: number; y: number; width: number; height: number }>()
  const backgroundSymbols = new Map<string, SymbolMarkup>()

  for (const object of manifest.objects) {
    for (const size of ['L', 'S'] as const) {
      for (const state of ['main', 'bg'] as const) {
        const ref = object.sizes[size][state]
        objectSymbols.set(`${object.id}-${size}-${state}`, loadSymbol(ref.file))
        objectBBoxes.set(`${object.id}-${size}-${state}`, ref.bbox)
      }
    }
  }
  for (const frame of manifest.backgrounds) {
    for (const size of ['L', 'S'] as const) {
      backgroundSymbols.set(`${frame.schemeId}-${size}`, loadSymbol(frame.sizes[size].file))
    }
  }

  return {
    getObjectSymbol: (objectId: string, size: Size, state: ObjectState) =>
      objectSymbols.get(`${objectId}-${size}-${state}`),
    getObjectBBox: (objectId: string, size: Size, state: ObjectState) =>
      objectBBoxes.get(`${objectId}-${size}-${state}`),
    getBackgroundSymbol: () => backgroundSymbols.get('purple-L'),
  }
}

function buildScene(): Scene {
  return {
    format: 'square',
    size: 'L',
    paletteId: 'purple',
    items: [
      { uid: 'a', objectId: 'lamp', state: 'main', x: 100, y: 200, rotation: 15, flipX: false },
      { uid: 'b', objectId: 'lamp', state: 'bg', x: 300, y: 450, rotation: 200, flipX: true },
      { uid: 'c', objectId: 'pen', state: 'main', x: 500, y: 600, rotation: 0, flipX: false },
    ],
  }
}

describe('core/export golden geometry', () => {
  const assets = buildAssetSource()
  const scene = buildScene()
  const markup = exportSceneToSvg(scene, palette, true, assets)
  const doc = new DOMParser().parseFromString(markup, 'image/svg+xml')

  it('does not contain any raster, variable or symbol-reference markup', () => {
    expect(markup).not.toContain('<image')
    expect(markup).not.toContain('data:')
    expect(markup).not.toContain('var(')
    expect(markup).not.toContain('<use')
  })

  it('root viewBox matches the selected format', () => {
    const format = getFormat(scene.format)
    const root = doc.documentElement
    expect(root.getAttribute('viewBox')).toBe(`0 0 ${format.width} ${format.height}`)
  })

  it('has exactly one object group per scene item, in z-order', () => {
    const groups = Array.from(doc.querySelectorAll('[data-object]'))
    expect(groups).toHaveLength(scene.items.length)
    groups.forEach((group, index) => {
      expect(group.getAttribute('data-object')).toBe(scene.items[index]?.objectId)
      expect(group.getAttribute('data-state')).toBe(scene.items[index]?.state)
    })
  })

  it('all ids in the exported document are unique', () => {
    const elementsWithId = Array.from(doc.querySelectorAll('[id]'))
    const ids = elementsWithId.map((el) => el.getAttribute('id'))
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.length).toBeGreaterThan(0)
  })

  it('preserves every geometric attribute of each instance unchanged', () => {
    const groups = Array.from(doc.querySelectorAll('[data-object]'))
    scene.items.forEach((item, index) => {
      const group = groups[index]
      if (!group) throw new Error('ожидалась группа объекта')
      const sourceFile = manifest.objects.find((o) => o.id === item.objectId)?.sizes[scene.size][
        item.state
      ].file
      if (!sourceFile) throw new Error('не найден исходный файл ассета')
      const sourceElements = sourceTopLevelElements(sourceFile)
      const exportedElements = Array.from(group.children)
      expect(exportedElements).toHaveLength(sourceElements.length)
      sourceElements.forEach((sourceEl, elementIndex) => {
        const exportedEl = exportedElements[elementIndex]
        expect(exportedEl).toBeDefined()
        expect(geometryAttrs(exportedEl as Element)).toEqual(geometryAttrs(sourceEl))
      })
    })
  })

  it('resolves fill/stroke role variables to concrete palette hex values and drops data-role', () => {
    const lampMainGroup = doc.querySelector('[data-object="lamp"][data-state="main"]')
    if (!lampMainGroup) throw new Error('не найдена группа лампы')
    const colored = Array.from(lampMainGroup.querySelectorAll('[fill]')).filter(
      (el) => el.getAttribute('fill') === palette.background.ink,
    )
    expect(colored.length).toBeGreaterThan(0)
    expect(lampMainGroup.querySelectorAll('[data-role]')).toHaveLength(0)
  })

  it('applies a different palette by producing different resolved hex values', () => {
    const orange = parsePalette(orangeJson)
    const orangeMarkup = exportSceneToSvg(scene, orange, true, assets)
    expect(orangeMarkup).not.toContain(palette.background.bg1)
    expect(orangeMarkup).toContain(orange.background.bg1)
  })
})

describe('core/export background', () => {
  const assets = buildAssetSource()
  const scene = buildScene()

  it('renders a solid bg-1 fill with no decorative frame when background is hidden', () => {
    const markup = exportSceneToSvg(scene, palette, false, assets)
    const doc = new DOMParser().parseFromString(markup, 'image/svg+xml')
    const root = doc.documentElement
    const firstRect = root.querySelector('g > rect, g rect')
    expect(firstRect).not.toBeNull()
    expect(firstRect?.getAttribute('fill')).toBe(palette.background.bg1)
    const format = getFormat(scene.format)
    expect(firstRect?.getAttribute('width')).toBe(String(format.width))
    expect(firstRect?.getAttribute('height')).toBe(String(format.height))
    expect(markup).not.toContain('bg-2')
  })

  it('renders the decorative background frame with a slice transform when visible', () => {
    const markup = exportSceneToSvg(scene, palette, true, assets)
    expect(markup).toMatch(/translate\([-\d.]+ [-\d.]+\) scale\([-\d.]+\)/)
    const doc = new DOMParser().parseFromString(markup, 'image/svg+xml')
    const backgroundGroup = doc.documentElement.querySelector('g[clip-path] > g')
    expect(backgroundGroup).not.toBeNull()
    expect(backgroundGroup?.getAttribute('transform')).toMatch(/translate/)
  })
})
