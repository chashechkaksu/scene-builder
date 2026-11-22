import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import purple from '@/palettes/purple.json'
import { usePaletteStore } from '@/stores/palette'
import { useSceneStore } from '@/stores/scene'

function setup() {
  localStorage.clear()
  setActivePinia(createPinia())
  return { paletteStore: usePaletteStore(), sceneStore: useSceneStore() }
}

function jsonFile(data: unknown, name = 'palette.json'): File {
  return new File([JSON.stringify(data)], name, { type: 'application/json' })
}

describe('stores/palette', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('exposes the three built-in palettes and defaults current to the scene paletteId', () => {
    const { paletteStore } = setup()
    expect(paletteStore.builtIn.map((palette) => palette.id).sort()).toEqual([
      'orange',
      'purple',
      'teal',
    ])
    expect(paletteStore.current.id).toBe('purple')
  })

  it('loads a valid custom palette from a file, adds it and makes it current', async () => {
    const { paletteStore, sceneStore } = setup()
    const custom = { ...purple, id: 'custom-one', name: 'Моя палитра' }
    const result = await paletteStore.loadFromFile(jsonFile(custom))
    expect(result.ok).toBe(true)
    expect(sceneStore.scene.paletteId).toBe('custom-one')
    expect(paletteStore.current.name).toBe('Моя палитра')
    expect(paletteStore.all.map((palette) => palette.id)).toContain('custom-one')
  })

  it('returns a readable error message for invalid JSON and keeps the previous palette active', async () => {
    const { paletteStore, sceneStore } = setup()
    const before = sceneStore.scene.paletteId
    const result = await paletteStore.loadFromFile(
      new File(['{not json'], 'broken.json', { type: 'application/json' }),
    )
    expect(result.ok).toBe(false)
    expect(result.message).toBeTruthy()
    expect(sceneStore.scene.paletteId).toBe(before)
  })

  it('returns a readable error message for a palette missing required roles', async () => {
    const { paletteStore } = setup()
    const broken = { id: 'broken', name: 'Broken', background: { bg1: '#D7CDF5' } }
    const result = await paletteStore.loadFromFile(jsonFile(broken))
    expect(result.ok).toBe(false)
    expect(result.message).toBeTruthy()
  })

  it('re-loading a custom palette with the same id replaces the previous one instead of duplicating it', async () => {
    const { paletteStore } = setup()
    const first = { ...purple, id: 'dup', name: 'First' }
    const second = { ...purple, id: 'dup', name: 'Second' }
    await paletteStore.loadFromFile(jsonFile(first))
    await paletteStore.loadFromFile(jsonFile(second))
    const matches = paletteStore.all.filter((palette) => palette.id === 'dup')
    expect(matches).toHaveLength(1)
    expect(matches[0]?.name).toBe('Second')
  })

  it('a custom palette overrides a built-in palette sharing the same id', async () => {
    const { paletteStore } = setup()
    const overridden = { ...purple, name: 'Перекрашенная' }
    await paletteStore.loadFromFile(jsonFile(overridden))
    expect(paletteStore.current.name).toBe('Перекрашенная')
    expect(paletteStore.all.filter((palette) => palette.id === 'purple')).toHaveLength(1)
  })

  it('applyEdited validates and registers an edited palette as current', () => {
    const { paletteStore, sceneStore } = setup()
    const edited = {
      ...purple,
      id: 'edited',
      name: 'Edited',
      background: { ...purple.background, bg1: '#AAAAAA' },
    }
    const result = paletteStore.applyEdited(edited)
    expect(result.ok).toBe(true)
    expect(sceneStore.scene.paletteId).toBe('edited')
    expect(paletteStore.current.background.bg1).toBe('#AAAAAA')
  })

  it('applyEdited rejects an invalid palette with a readable message, not a raw error dump', () => {
    const { paletteStore } = setup()
    const invalid = { ...purple, background: { ...purple.background, bg1: 'not-a-hex' } }
    const result = paletteStore.applyEdited(invalid)
    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/палитра не прошла проверку/i)
    expect(result.message).toContain('background.bg1')
    expect(result.message).not.toMatch(/^\s*[[{]/)
  })
})
