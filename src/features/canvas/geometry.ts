import type { SceneItem } from '@/shared/types'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface Point {
  x: number
  y: number
}

const ROTATE_HANDLE_GAP = 40

function toLocalCorners(bbox: Rect): Point[] {
  const halfW = bbox.width / 2
  const halfH = bbox.height / 2
  return [
    { x: -halfW, y: -halfH },
    { x: halfW, y: -halfH },
    { x: halfW, y: halfH },
    { x: -halfW, y: halfH },
  ]
}

function rotatePoint(point: Point, flipX: boolean, angleRadians: number): Point {
  const scaleX = flipX ? -1 : 1
  const sx = point.x * scaleX
  const cos = Math.cos(angleRadians)
  const sin = Math.sin(angleRadians)
  return {
    x: sx * cos - point.y * sin,
    y: sx * sin + point.y * cos,
  }
}

export function itemWorldCorners(item: SceneItem, bbox: Rect): Point[] {
  const angleRadians = (item.rotation * Math.PI) / 180
  return toLocalCorners(bbox).map((corner) => {
    const rotated = rotatePoint(corner, item.flipX, angleRadians)
    return { x: item.x + rotated.x, y: item.y + rotated.y }
  })
}

export function axisAlignedBounds(points: Point[]): Rect {
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

export function rotationHandlePosition(item: SceneItem, bbox: Rect): Point {
  const localY = -(bbox.height / 2 + ROTATE_HANDLE_GAP)
  const angleRadians = (item.rotation * Math.PI) / 180
  const rotated = rotatePoint({ x: 0, y: localY }, item.flipX, angleRadians)
  return { x: item.x + rotated.x, y: item.y + rotated.y }
}

export function itemTransform(item: SceneItem, bbox: Rect): string {
  const cx = bbox.x + bbox.width / 2
  const cy = bbox.y + bbox.height / 2
  const scaleX = item.flipX ? -1 : 1
  return `translate(${item.x} ${item.y}) rotate(${item.rotation}) scale(${scaleX} 1) translate(${-cx} ${-cy})`
}

export function sliceTransform(viewWidth: number, viewHeight: number, target: Rect): string {
  if (viewWidth <= 0 || viewHeight <= 0) return ''
  const scale = Math.max(target.width / viewWidth, target.height / viewHeight)
  const scaledWidth = viewWidth * scale
  const scaledHeight = viewHeight * scale
  const tx = (target.width - scaledWidth) / 2
  const ty = (target.height - scaledHeight) / 2
  return `translate(${tx} ${ty}) scale(${scale})`
}
