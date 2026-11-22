import { computed } from 'vue'
import { resolveObjectScale } from '@/core/layout/object-scale'
import { resolveFormat } from '@/shared/formats'
import { useLibraryStore } from '@/stores/library'
import { useSceneStore } from '@/stores/scene'

export function useEffectiveObjectScale() {
  const sceneStore = useSceneStore()
  const libraryStore = useLibraryStore()
  return computed(() => {
    const scene = sceneStore.scene
    const bboxes = scene.items.flatMap((item) => {
      const bbox = libraryStore.getObjectRef(item.objectId, scene.size, item.state)?.bbox
      return bbox ? [bbox] : []
    })
    return resolveObjectScale(scene.objectScale, bboxes, resolveFormat(scene))
  })
}
