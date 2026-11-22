import { describe, expect, it } from 'vitest'
import { lowBackgroundContrastWarning } from '@/core/palette/contrast'
import { parsePalette } from '@/core/palette/schema'
import orange from '@/palettes/orange.json'
import purple from '@/palettes/purple.json'
import teal from '@/palettes/teal.json'

describe('core/palette/contrast', () => {
  it('does not warn for any built-in palette', () => {
    for (const raw of [purple, orange, teal]) {
      const palette = parsePalette(raw)
      expect(lowBackgroundContrastWarning(palette)).toBeUndefined()
    }
  })

  it('warns when bg-1/bg-2/bg-3 are nearly identical', () => {
    const palette = parsePalette({
      ...purple,
      id: 'flat',
      background: { ...purple.background, bg1: '#D7CDF5', bg2: '#D6CCF4', bg3: '#D5CBF3' },
    })
    expect(lowBackgroundContrastWarning(palette)).toMatch(/слабо отличаются/)
  })

  it('does not warn when only two of the three colors are close', () => {
    const palette = parsePalette({
      ...purple,
      id: 'partial',
      background: { ...purple.background, bg1: '#D7CDF5', bg2: '#D6CCF4', bg3: '#181817' },
    })
    expect(lowBackgroundContrastWarning(palette)).toBeUndefined()
  })
})
