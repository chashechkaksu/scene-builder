import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Resvg } from '@resvg/resvg-js'
import { exportSceneToSvg } from '../src/core/export/export'
import { getFormat } from '../src/shared/formats'
import {
  EXAMPLE_SEEDS,
  PALETTES,
  buildAssetSource,
  buildScene,
  loadLibrary,
  renderPng,
  type ExampleSeed,
} from './examples'

const OUTPUT_DIR = join(process.cwd(), 'docs/_preview')
const VARIANT_COUNT = 12
const COLUMNS = 4
const CELL_WIDTH = 480
const LABEL_HEIGHT = 34
const GAP = 12

function encodePng(png: Buffer): string {
  return `data:image/png;base64,${png.toString('base64')}`
}

function renderVariant(library: ReturnType<typeof loadLibrary>, example: ExampleSeed): Buffer {
  const palette = PALETTES[example.paletteId]
  if (!palette) throw new Error(`examples-preview: нет палитры "${example.paletteId}"`)
  const scene = buildScene(library, example)
  const assets = buildAssetSource(library, example.paletteId, example.size)
  return renderPng(exportSceneToSvg(scene, palette, true, assets))
}

function buildSheet(example: ExampleSeed, variants: Buffer[]): string {
  const format = getFormat(example.format)
  const cellHeight = Math.round((CELL_WIDTH * format.height) / format.width)
  const rows = Math.ceil(variants.length / COLUMNS)
  const width = COLUMNS * CELL_WIDTH + (COLUMNS + 1) * GAP
  const height = rows * (cellHeight + LABEL_HEIGHT) + (rows + 1) * GAP
  const cells = variants.map((png, index) => {
    const x = GAP + (index % COLUMNS) * (CELL_WIDTH + GAP)
    const y = GAP + Math.floor(index / COLUMNS) * (cellHeight + LABEL_HEIGHT + GAP)
    return [
      `<text x="${x}" y="${y + 24}" font-family="Arial, sans-serif" font-size="22" fill="#1A1A1A">seed ${index + 1}</text>`,
      `<image x="${x}" y="${y + LABEL_HEIGHT}" width="${CELL_WIDTH}" height="${cellHeight}" href="${encodePng(png)}" />`,
    ].join('')
  })
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="${width}" height="${height}" fill="#FFFFFF" />`,
    ...cells,
    '</svg>',
  ].join('')
}

function main(): void {
  mkdirSync(OUTPUT_DIR, { recursive: true })
  const library = loadLibrary()
  for (const example of EXAMPLE_SEEDS) {
    const variants = Array.from({ length: VARIANT_COUNT }, (_, index) =>
      renderVariant(library, { ...example, seed: index + 1 }),
    )
    const sheet = new Resvg(buildSheet(example, variants), {
      font: { loadSystemFonts: true },
    })
      .render()
      .asPng()
    const file = join(OUTPUT_DIR, `${example.id}-seeds-1-${VARIANT_COUNT}.png`)
    writeFileSync(file, sheet)
    console.log(`examples:preview: ${file}`)
  }
}

main()
