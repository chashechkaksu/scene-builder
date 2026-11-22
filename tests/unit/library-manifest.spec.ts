import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import manifest from '@/library/manifest.json'
import { ROLES } from '@/core/palette/schema'

const LIBRARY_DIR = join(process.cwd(), 'src/library')
const BG_ALLOWED = new Set(['bg-1', 'bg-2', 'bg-3', 'ink'])

describe('library manifest', () => {
  it('contains all 10 objects with L/S × main/bg asset refs', () => {
    expect(manifest.objects).toHaveLength(10)
    for (const object of manifest.objects) {
      for (const size of ['L', 'S'] as const) {
        for (const state of ['main', 'bg'] as const) {
          const ref = object.sizes[size][state]
          expect(ref.viewBox).toHaveLength(4)
          expect(ref.roles.length).toBeGreaterThan(0)
          expect(existsSync(join(LIBRARY_DIR, ref.file))).toBe(true)
        }
      }
    }
  })

  it('restricts bg-state objects and backgrounds to bg-*/ink roles only', () => {
    for (const object of manifest.objects) {
      for (const size of ['L', 'S'] as const) {
        const bgRef = object.sizes[size].bg
        for (const role of bgRef.roles) {
          expect(BG_ALLOWED.has(role)).toBe(true)
        }
      }
    }
    for (const background of manifest.backgrounds) {
      for (const size of ['L', 'S'] as const) {
        for (const role of background.sizes[size].roles) {
          expect(BG_ALLOWED.has(role)).toBe(true)
        }
      }
    }
  })

  it('only ever uses roles from the canonical set', () => {
    const allowed = new Set<string>(ROLES)
    for (const object of manifest.objects) {
      for (const size of ['L', 'S'] as const) {
        for (const state of ['main', 'bg'] as const) {
          for (const role of object.sizes[size][state].roles) {
            expect(allowed.has(role)).toBe(true)
          }
        }
      }
    }
  })

  it('prefixes every generated id with the asset identity', () => {
    const ref = manifest.objects[0]?.sizes.L.main
    if (!ref) throw new Error('fixture missing')
    const svg = readFileSync(join(LIBRARY_DIR, ref.file), 'utf8')
    const ids = [...svg.matchAll(/id="([^"]+)"/g)].map((m) => m[1])
    for (const id of ids) {
      expect(id?.startsWith(`${manifest.objects[0]?.id}-L-main-`)).toBe(true)
    }
  })

  it('contains 3 background schemes for both sizes', () => {
    expect(manifest.backgrounds).toHaveLength(3)
    const schemeIds = manifest.backgrounds.map((b) => b.schemeId).sort()
    expect(schemeIds).toEqual(['orange', 'purple', 'teal'])
  })

  it('never embeds raster content in generated svg', () => {
    for (const object of manifest.objects) {
      for (const size of ['L', 'S'] as const) {
        for (const state of ['main', 'bg'] as const) {
          const svg = readFileSync(join(LIBRARY_DIR, object.sizes[size][state].file), 'utf8')
          expect(svg).not.toMatch(/<image/i)
          expect(svg).not.toMatch(/data:(image|application)\//i)
        }
      }
    }
  })
})
