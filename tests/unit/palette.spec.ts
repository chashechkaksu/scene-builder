import { describe, expect, it } from 'vitest'
import { parsePalette, roleToHex } from '@/core/palette/schema'
import {
  frozenBackgroundWhiteWarning,
  getBuiltInPalettes,
  PaletteParseError,
  parsePaletteFile,
} from '@/core/palette/registry'
import purple from '@/palettes/purple.json'

describe('core/palette', () => {
  it('keeps "white" at #FFFFFF in every built-in palette (required by the frozen background dot)', () => {
    for (const palette of getBuiltInPalettes()) {
      expect(frozenBackgroundWhiteWarning(palette)).toBeUndefined()
    }
  })

  it('warns when a custom palette would desync the frozen background white dot', () => {
    const custom = parsePalette({
      ...purple,
      id: 'custom',
      object: { ...purple.object, white: '#F0F0F0' },
    })
    expect(frozenBackgroundWhiteWarning(custom)).toMatch(/декоративные белые точки подложки/)
  })

  it('parses a valid built-in palette', () => {
    const palette = parsePalette(purple)
    expect(palette.id).toBe('purple')
    expect(roleToHex(palette, 'bg-1')).toBe('#D7CDF5')
    expect(roleToHex(palette, 'white')).toBe('#FFFFFF')
  })

  it('rejects a palette missing a required role', () => {
    const broken = { ...purple, background: { bg1: '#D7CDF5', bg2: '#AA9BF0', bg3: '#7864D7' } }
    expect(() => parsePalette(broken)).toThrow()
  })

  it('rejects an invalid hex value with a readable error', () => {
    expect(() =>
      parsePaletteFile(
        JSON.stringify({ ...purple, background: { ...purple.background, bg1: 'purple' } }),
      ),
    ).toThrow(PaletteParseError)
  })

  it('rejects malformed JSON with a readable error', () => {
    expect(() => parsePaletteFile('{not json')).toThrow(PaletteParseError)
  })
})
