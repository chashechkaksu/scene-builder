import type { ObjectState } from '@/shared/types'

export interface ComposedObject {
  objectId: string
  state: ObjectState
}

const MAX_COMPOSED_OBJECTS = 5
const MAX_MAIN_OBJECTS = 3

export function selectComposedObjects(rankedObjectIds: string[]): ComposedObject[] {
  const count = Math.min(MAX_COMPOSED_OBJECTS, rankedObjectIds.length)
  const picked = rankedObjectIds.slice(0, count)
  const mainCount = Math.min(MAX_MAIN_OBJECTS, picked.length)
  return picked.map((objectId, index) => ({
    objectId,
    state: index < mainCount ? 'main' : 'bg',
  }))
}
