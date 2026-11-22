import { selectComposedObjects, type ComposedObject } from '@/core/compose/select-composed-objects'
import { layoutScene, type LayoutItemInput } from '@/core/layout/layout'
import { useLibraryStore } from '@/stores/library'
import { useSceneStore } from '@/stores/scene'

export { selectComposedObjects, type ComposedObject }

export function applyComposition(objects: ComposedObject[], seed: number): void {
  const sceneStore = useSceneStore()
  const libraryStore = useLibraryStore()
  const size = sceneStore.scene.size

  const items: LayoutItemInput[] = objects.flatMap((object) => {
    const ref = libraryStore.getObjectRef(object.objectId, size, object.state)
    if (!ref) return []
    return [{ objectId: object.objectId, state: object.state, bbox: ref.bbox }]
  })

  const placements = layoutScene({
    items,
    format: sceneStore.scene.format,
    customSize: sceneStore.scene.customSize,
    size,
    objectScale: sceneStore.scene.objectScale,
    seed,
  })
  sceneStore.replaceItems(
    placements.map((placement) => ({
      objectId: placement.objectId,
      state: placement.state,
      x: placement.x,
      y: placement.y,
      rotation: placement.rotation,
      flipX: placement.flipX,
    })),
  )
}

export function nextLayoutSeed(current: number): number {
  return current + 1
}
