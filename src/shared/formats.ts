import type { CanvasSize, Format } from '@/shared/types'

export interface FormatDefinition {
  id: Format
  nameRu: string
  width: number
  height: number
}

export const FORMATS: Record<Format, FormatDefinition> = {
  square: { id: 'square', nameRu: 'Квадрат', width: 1000, height: 1000 },
  landscape: { id: 'landscape', nameRu: 'Горизонталь', width: 1200, height: 630 },
  portrait: { id: 'portrait', nameRu: 'Вертикаль', width: 800, height: 1200 },
}

export function getFormat(id: Format): FormatDefinition {
  return FORMATS[id]
}

export const MIN_CANVAS_SIDE = 400
export const MAX_CANVAS_SIDE = 2400
export const CANVAS_SIDE_STEP = 10

export function clampCanvasSide(value: number): number {
  return Math.min(MAX_CANVAS_SIDE, Math.max(MIN_CANVAS_SIDE, Math.round(value)))
}

export function resolveFormat(scene: {
  format: Format
  customSize?: CanvasSize | undefined
}): FormatDefinition {
  const preset = getFormat(scene.format)
  if (!scene.customSize) return preset
  return {
    ...preset,
    width: clampCanvasSide(scene.customSize.width),
    height: clampCanvasSide(scene.customSize.height),
  }
}
