import { describe, expect, it } from 'vitest'
import { parsePalette } from '@/core/palette/schema'
import { applyPaletteToElement, cssVarsFromPalette } from '@/core/recolor/recolor'
import purple from '@/palettes/purple.json'
import orange from '@/palettes/orange.json'

describe('core/recolor', () => {
  it('produces all 8 role css variables with exact palette hex values', () => {
    const palette = parsePalette(purple)
    const vars = cssVarsFromPalette(palette)
    expect(vars).toEqual({
      '--role-bg-1': '#D7CDF5',
      '--role-bg-2': '#AA9BF0',
      '--role-bg-3': '#7864D7',
      '--role-ink': '#181817',
      '--role-obj-1': '#F9ECB0',
      '--role-obj-2': '#F9A3AA',
      '--role-obj-3': '#FFE3E1',
      '--role-white': '#FFFFFF',
    })
  })

  it('applies a different palette without touching unrelated inline styles', () => {
    const el = document.createElement('div')
    el.style.setProperty('opacity', '0.5')
    applyPaletteToElement(el, parsePalette(orange))
    expect(el.style.getPropertyValue('--role-bg-1')).toBe('#FDD7B9')
    expect(el.style.getPropertyValue('opacity')).toBe('0.5')
  })
})
