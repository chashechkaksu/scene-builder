import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { JSDOM } from 'jsdom'
import { Resvg } from '@resvg/resvg-js'
import {
  selectComposedObjects,
  type ComposedObject,
} from '../src/core/compose/select-composed-objects'
import { diagnoseLayout, layoutScene, type LayoutItemInput } from '../src/core/layout/layout'
import { composeMetaphor } from '../src/core/compose/compose-metaphor'
import { matchComponents } from '../src/core/matcher/matcher'
import {
  exportSceneToSvg,
  type ExportAssetSource,
  type SymbolMarkup,
} from '../src/core/export/export'
import { parsePalette, type Palette } from '../src/core/palette/schema'
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
const OUTPUT_DIR = join(ROOT, 'docs/examples')

const manifest = manifestJson as unknown as LibraryManifest

export const PALETTES: Record<string, Palette> = {
  purple: parsePalette(purpleJson),
  orange: parsePalette(orangeJson),
  teal: parsePalette(tealJson),
}

export type ExampleScenario = 'metaphor' | 'components'

export interface ExampleSeed {
  id: string
  scenario: ExampleScenario
  input: string
  format: Format
  size: Size
  paletteId: string
  seed: number
}

export const EXAMPLE_SEEDS: ExampleSeed[] = [
  {
    id: 'example-1-privacy',
    scenario: 'metaphor',
    input: 'Защита личных данных',
    format: 'square',
    size: 'L',
    paletteId: 'purple',
    seed: 9,
  },
  {
    id: 'example-2-finance-components',
    scenario: 'components',
    input: 'кошелёк, монета, папка, тюльпаны',
    format: 'landscape',
    size: 'L',
    paletteId: 'orange',
    seed: 8,
  },
  {
    id: 'example-3-idea',
    scenario: 'metaphor',
    input: 'Идея, которая зажигает',
    format: 'portrait',
    size: 'S',
    paletteId: 'teal',
    seed: 10,
  },
]

export function libraryFilePath(file: string): string {
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

export interface LoadedLibrary {
  objectSymbols: Map<string, SymbolMarkup>
  objectBBoxes: Map<string, { x: number; y: number; width: number; height: number }>
  backgroundSymbols: Map<string, SymbolMarkup>
}

const SIZES: Size[] = ['L', 'S']

export function loadLibrary(): LoadedLibrary {
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

export function buildAssetSource(
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

function composedObjects(example: ExampleSeed): ComposedObject[] {
  if (example.scenario === 'metaphor') return composeMetaphor(example.input).composed
  const ids = matchComponents(example.input, manifest).matches.map((match) => match.objectId)
  return selectComposedObjects(ids)
}

export function buildScene(library: LoadedLibrary, example: ExampleSeed): Scene {
  const composed = composedObjects(example)

  const items: LayoutItemInput[] = composed.flatMap((object) => {
    const bbox = library.objectBBoxes.get(`${object.objectId}-${example.size}-${object.state}`)
    if (!bbox) return []
    return [{ objectId: object.objectId, state: object.state, bbox }]
  })
  if (items.length === 0) {
    throw new Error(
      `examples: для «${example.input}» (${example.id}) не нашлось ни одного валидного объекта`,
    )
  }

  const layoutRequest = {
    items,
    format: example.format,
    size: example.size,
    seed: example.seed,
  }
  const placements = layoutScene(layoutRequest)
  const report = diagnoseLayout(layoutRequest, placements)
  console.log(
    `  ${example.id}: group=${report.groupAreaRatio.toFixed(2)} gapBreaks=${report.mainGapBreaks} ` +
      report.objects
        .map(
          (row) =>
            `${row.objectId}/${row.state}=${row.visibleRatio.toFixed(2)}(>=${row.requiredVisibleRatio})`,
        )
        .join(' '),
  )

  return {
    format: example.format,
    size: example.size,
    paletteId: example.paletteId,
    items: placements.map((placement, index) => ({
      uid: `${example.id}-${index}`,
      objectId: placement.objectId,
      state: placement.state,
      x: placement.x,
      y: placement.y,
      rotation: placement.rotation,
      flipX: placement.flipX,
    })),
  }
}

export function renderPng(svgMarkup: string): Buffer {
  const resvg = new Resvg(svgMarkup, { font: { loadSystemFonts: false } })
  return resvg.render().asPng()
}

const SCENARIO_LABEL: Record<ExampleScenario, string> = {
  metaphor: 'по метафоре',
  components: 'по компонентам',
}

function buildReadme(rows: Array<{ example: ExampleSeed; objectIds: string[] }>): string {
  const header = '| Файл | Сценарий | Ввод | Формат | Размер | Палитра | Seed | Объекты |'
  const divider = '|---|---|---|---|---|---|---|---|'
  const lines = rows.map(({ example, objectIds }) => {
    const palette = PALETTES[example.paletteId]
    const paletteName = palette ? palette.name : example.paletteId
    return `| \`${example.id}.svg\` / \`.png\` | ${SCENARIO_LABEL[example.scenario]} | «${example.input}» | ${example.format} | ${example.size} | ${paletteName} | ${example.seed} | ${objectIds.join(', ')} |`
  })
  return [
    '# Примеры композиций',
    '',
    'Сгенерировано командой `npm run examples` через реальный пайплайн сервиса: `core/matcher` (подбор объектов) → `core/layout` (детерминированная раскладка по seed) → `core/export` (сборка самостоятельного SVG). `.svg` — результат сервиса (векторный, редактируемый, без растра), `.png` — растровое превью только для просмотра в этом README, в продукте не используется.',
    '',
    header,
    divider,
    ...lines,
    '',
    'Примеры намеренно различаются по всем осям: сценарий (метафора / явные компоненты), формат (квадрат / горизонталь / вертикаль), цветовая схема (все три встроенные палитры) и размер детализации (L и S).',
  ].join('\n')
}

function main(): void {
  mkdirSync(OUTPUT_DIR, { recursive: true })
  const library = loadLibrary()

  const rows: Array<{ example: ExampleSeed; objectIds: string[] }> = []

  for (const example of EXAMPLE_SEEDS) {
    const palette = PALETTES[example.paletteId]
    if (!palette) throw new Error(`examples: нет палитры "${example.paletteId}"`)
    const scene = buildScene(library, example)
    const assets = buildAssetSource(library, example.paletteId, example.size)
    const svg = exportSceneToSvg(scene, palette, true, assets)
    const png = renderPng(svg)

    writeFileSync(join(OUTPUT_DIR, `${example.id}.svg`), svg, 'utf8')
    writeFileSync(join(OUTPUT_DIR, `${example.id}.png`), png)

    const objectIds = scene.items.map((item) =>
      item.state === 'bg' ? `${item.objectId} (фон)` : item.objectId,
    )
    rows.push({ example, objectIds })
    console.log(
      `examples: «${example.input}» (${SCENARIO_LABEL[example.scenario]}) → ${objectIds.join(', ')} → ${example.id}.svg/.png`,
    )
  }

  writeFileSync(join(OUTPUT_DIR, 'README.md'), buildReadme(rows), 'utf8')
  console.log(
    `examples: сгенерировано ${EXAMPLE_SEEDS.length} композиций (svg+png) и README.md в ${OUTPUT_DIR}`,
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main()
}
