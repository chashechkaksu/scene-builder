import { ZodError } from 'zod'
import { parsePalette, type Palette } from './schema'

const builtInModules = import.meta.glob('../../palettes/*.json', { eager: true })

function loadBuiltInPalettes(): Palette[] {
  return Object.values(builtInModules).map((module) =>
    parsePalette((module as { default: unknown }).default),
  )
}

export function getBuiltInPalettes(): Palette[] {
  return loadBuiltInPalettes()
}

export function findPalette(palettes: Palette[], id: string): Palette | undefined {
  return palettes.find((palette) => palette.id === id)
}

export function frozenBackgroundWhiteWarning(palette: Palette): string | undefined {
  if (palette.object.white.toUpperCase() === '#FFFFFF') return undefined
  return `Цвет "white" в палитре "${palette.name}" отличается от #FFFFFF: декоративные белые точки подложки не перекрасятся и могут визуально разойтись с остальной композицией.`
}

export class PaletteParseError extends Error {}

export function parsePaletteData(data: unknown): Palette {
  try {
    return parsePalette(data)
  } catch (error) {
    if (error instanceof ZodError) {
      const issues = error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ')
      throw new PaletteParseError(`Палитра не прошла проверку: ${issues}`)
    }
    throw error
  }
}

export function parsePaletteFile(raw: string): Palette {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    throw new PaletteParseError('Файл не является валидным JSON')
  }
  return parsePaletteData(data)
}
