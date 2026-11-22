import type { Role } from '@/core/palette/schema'

export type Size = 'L' | 'S'
export type ObjectState = 'main' | 'bg'
export type Format = 'square' | 'landscape' | 'portrait'

export interface SemanticWeightedTerm {
  text: string
  weight: 'literal' | 'strong' | 'associative'
}

export interface SemanticMeta {
  keywords: SemanticWeightedTerm[]
}

export interface AssetRef {
  file: string
  viewBox: [number, number, number, number]
  bbox: { x: number; y: number; width: number; height: number }
  roles: Role[]
}

export interface LibraryObject {
  id: string
  nameRu: string
  sizes: Record<Size, Record<ObjectState, AssetRef>>
  meta: SemanticMeta
}

export interface BackgroundFrame {
  schemeId: string
  sizes: Record<Size, AssetRef>
}

export interface LibraryManifest {
  objects: LibraryObject[]
  backgrounds: BackgroundFrame[]
}

export interface SceneItem {
  uid: string
  objectId: string
  state: ObjectState
  x: number
  y: number
  rotation: number
  flipX: boolean
}

export interface CanvasSize {
  width: number
  height: number
}

export interface Scene {
  format: Format
  customSize?: CanvasSize
  size: Size
  paletteId: string
  items: SceneItem[]
}
