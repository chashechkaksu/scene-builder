import type { Palette } from './schema'

const LOW_CONTRAST_DISTANCE_THRESHOLD = 30

interface Rgb {
  r: number
  g: number
  b: number
}

function hexToRgb(hex: string): Rgb {
  const value = hex.replace('#', '')
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  }
}

function distance(a: Rgb, b: Rgb): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2)
}

export function lowBackgroundContrastWarning(palette: Palette): string | undefined {
  const bg1 = hexToRgb(palette.background.bg1)
  const bg2 = hexToRgb(palette.background.bg2)
  const bg3 = hexToRgb(palette.background.bg3)
  const pairs = [distance(bg1, bg2), distance(bg1, bg3), distance(bg2, bg3)]
  const allLow = pairs.every((value) => value < LOW_CONTRAST_DISTANCE_THRESHOLD)
  if (!allLow) return undefined
  return `Цвета фона "${palette.name}" (bg-1, bg-2, bg-3) слабо отличаются друг от друга — декоративные элементы подложки могут быть плохо заметны.`
}
