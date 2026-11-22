import {
  LAYOUT_AUTO_SCALE_MAX_AREA_RATIO,
  OBJECT_SCALE_MAX,
  OBJECT_SCALE_MIN,
} from '@/core/layout/constants'

interface Dimensions {
  width: number
  height: number
}

export function clampObjectScale(value: number): number {
  return Math.min(OBJECT_SCALE_MAX, Math.max(OBJECT_SCALE_MIN, value))
}

/**
 * Single scene-wide object scale. Auto mode shrinks every object by the same factor so that the
 * largest bbox covers at most LAYOUT_AUTO_SCALE_MAX_AREA_RATIO of the frame.
 */
export function autoObjectScale(bboxes: Dimensions[], frame: Dimensions): number {
  const largestArea = Math.max(0, ...bboxes.map((bbox) => bbox.width * bbox.height))
  const frameArea = frame.width * frame.height
  if (largestArea <= 0 || frameArea <= 0) return OBJECT_SCALE_MAX
  return clampObjectScale(Math.sqrt((LAYOUT_AUTO_SCALE_MAX_AREA_RATIO * frameArea) / largestArea))
}

export function resolveObjectScale(
  explicit: number | undefined,
  bboxes: Dimensions[],
  frame: Dimensions,
): number {
  if (explicit !== undefined && Number.isFinite(explicit)) return clampObjectScale(explicit)
  return autoObjectScale(bboxes, frame)
}
