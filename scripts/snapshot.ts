import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { JSDOM } from 'jsdom'
import { Resvg } from '@resvg/resvg-js'
import {
  exportSceneToSvg,
  type ExportAssetSource,
  type SymbolMarkup,
} from '../src/core/export/export'
import { parsePalette, type Palette } from '../src/core/palette/schema'
import { FORMATS } from '../src/shared/formats'
import type { Format, LibraryManifest, ObjectState, Scene, Size } from '../src/shared/types'
import purpleJson from '../src/palettes/purple.json'
import orangeJson from '../src/palettes/orange.json'
import tealJson from '../src/palettes/teal.json'
import manifestJson from '../src/library/manifest.json'

const dom = new JSDOM()
globalThis.DOMParser = dom.window.DOMParser as unknown as typeof DOMParser
globalThis.XMLSerializer = dom.window.XMLSerializer as unknown as typeof XMLSerializer
globalThis.Node = dom.window.Node as unknown as typeof Node

const ROOT = process.cwd()
const LIBRARY_DIR = join(ROOT, 'src/library')
const OUTPUT_DIR = join(ROOT, 'docs/examples/snapshots')

const manifest = manifestJson as unknown as LibraryManifest

const PALETTES: Record<string, Palette> = {
  purple: parsePalette(purpleJson),
  orange: parsePalette(orangeJson),
  teal: parsePalette(tealJson),
}

const SIZES: Size[] = ['L', 'S']
const FORMAT_IDS = Object.keys(FORMATS) as Format[]
const PALETTE_IDS = Object.keys(PALETTES)

function libraryFilePath(file: string): string {
  return resolve(LIBRARY_DIR, file)
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

interface LoadedLibrary {
  objectSymbols: Map<string, SymbolMarkup>
  objectBBoxes: Map<string, { x: number; y: number; width: number; height: number }>
  backgroundSymbols: Map<string, SymbolMarkup>
}

function loadLibrary(): LoadedLibrary {
  const objectSymbols = new Map<string, SymbolMarkup>()
  const objectBBoxes = new Map<string, { x: number; y: number; width: number; height: number }>()
  const backgroundSymbols = new Map<string, SymbolMarkup>()

  for (const object of manifest.objects) {
    for (const size of SIZES) {
      for (const state of ['main', 'bg'] as const) {
        const ref = object.sizes[size][state]
        objectSymbols.set(`${object.id}-${size}-${state}`, loadSymbol(ref.file))
        objectBBoxes.set(`${object.id}-${size}-${state}`, ref.bbox)
      }
    }
  }
  for (const frame of manifest.backgrounds) {
    for (const size of SIZES) {
      backgroundSymbols.set(`${frame.schemeId}-${size}`, loadSymbol(frame.sizes[size].file))
    }
  }

  return { objectSymbols, objectBBoxes, backgroundSymbols }
}

function buildAssetSource(
  library: LoadedLibrary,
  paletteId: string,
  size: Size,
): ExportAssetSource {
  return {
    getObjectSymbol: (objectId: string, objectSize: Size, state: ObjectState) =>
      library.objectSymbols.get(`${objectId}-${objectSize}-${state}`),
    getObjectBBox: (objectId: string, objectSize: Size, state: ObjectState) =>
      library.objectBBoxes.get(`${objectId}-${objectSize}-${state}`),
    getBackgroundSymbol: () => library.backgroundSymbols.get(`${paletteId}-${size}`),
  }
}

interface CompositionTemplateItem {
  objectId: string
  state: ObjectState
  xFrac: number
  yFrac: number
  rotation: number
  flipX: boolean
}

const COMPOSITION_A: CompositionTemplateItem[] = [
  { objectId: 'book', state: 'bg', xFrac: 0.28, yFrac: 0.32, rotation: -8, flipX: false },
  { objectId: 'lamp', state: 'main', xFrac: 0.52, yFrac: 0.48, rotation: 0, flipX: false },
  { objectId: 'pen', state: 'main', xFrac: 0.72, yFrac: 0.68, rotation: 20, flipX: false },
]

const COMPOSITION_B: CompositionTemplateItem[] = [
  { objectId: 'folder', state: 'bg', xFrac: 0.3, yFrac: 0.4, rotation: 10, flipX: false },
  { objectId: 'tulips', state: 'main', xFrac: 0.38, yFrac: 0.62, rotation: -5, flipX: false },
  { objectId: 'wallet', state: 'main', xFrac: 0.66, yFrac: 0.55, rotation: 0, flipX: true },
  { objectId: 'coin', state: 'main', xFrac: 0.78, yFrac: 0.3, rotation: 15, flipX: false },
]

function compositionForFormat(format: Format): CompositionTemplateItem[] {
  return format === 'landscape' ? COMPOSITION_B : COMPOSITION_A
}

function buildScene(format: Format, size: Size, paletteId: string): Scene {
  const { width, height } = FORMATS[format]
  const template = compositionForFormat(format)
  return {
    format,
    size,
    paletteId,
    items: template.map((item, index) => ({
      uid: `${format}-${size}-${paletteId}-${index}`,
      objectId: item.objectId,
      state: item.state,
      x: item.xFrac * width,
      y: item.yFrac * height,
      rotation: item.rotation,
      flipX: item.flipX,
    })),
  }
}

function renderPng(svgMarkup: string): Buffer {
  const resvg = new Resvg(svgMarkup, { font: { loadSystemFonts: false } })
  const rendered = resvg.render()
  return rendered.asPng()
}

function main(): void {
  mkdirSync(OUTPUT_DIR, { recursive: true })
  const library = loadLibrary()

  let count = 0
  for (const format of FORMAT_IDS) {
    for (const paletteId of PALETTE_IDS) {
      for (const size of SIZES) {
        const palette = PALETTES[paletteId]
        if (!palette) throw new Error(`snapshot: нет палитры "${paletteId}"`)
        const scene = buildScene(format, size, paletteId)
        const assets = buildAssetSource(library, paletteId, size)
        const svgMarkup = exportSceneToSvg(scene, palette, true, assets)
        const png = renderPng(svgMarkup)
        const fileName = `${format}-${paletteId}-${size}.png`
        writeFileSync(join(OUTPUT_DIR, fileName), png)
        count += 1
      }
    }
  }

  console.log(
    `snapshot: сгенерировано ${count} PNG (${FORMAT_IDS.length} формата × ${PALETTE_IDS.length} палитры × ${SIZES.length} размера) в ${OUTPUT_DIR}`,
  )
}

main()
