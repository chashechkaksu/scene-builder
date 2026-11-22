import { describe, expect, it } from 'vitest'
import {
  BuildError,
  normalizeHex,
  parseSvg,
  prefixIds,
  processDocument,
  validateRawSvg,
} from '../../scripts/build-library'

describe('scripts/build-library pipeline (synthetic fixtures, assets-src untouched)', () => {
  describe('validateRawSvg', () => {
    it('rejects <image>', () => {
      expect(() => validateRawSvg('f', '<svg><image href="x.png"/></svg>')).toThrow(BuildError)
    })

    it('rejects embedded raster data URIs', () => {
      expect(() =>
        validateRawSvg('f', '<svg><rect fill="url(data:image/png;base64,AAA)"/></svg>'),
      ).toThrow(BuildError)
    })

    it('rejects external href references', () => {
      expect(() => validateRawSvg('f', '<svg><a href="https://example.com"/></svg>')).toThrow(
        BuildError,
      )
    })

    it('accepts a plain local svg', () => {
      expect(() => validateRawSvg('f', '<svg viewBox="0 0 10 10"><rect/></svg>')).not.toThrow()
    })
  })

  describe('normalizeHex', () => {
    it('expands 3-digit hex and uppercases', () => {
      expect(normalizeHex('#abc')).toBe('#AABBCC')
    })
    it('normalizes the "white" keyword', () => {
      expect(normalizeHex('white')).toBe('#FFFFFF')
    })
    it('returns undefined for unrecognized values', () => {
      expect(normalizeHex('not-a-color')).toBeUndefined()
      expect(normalizeHex('rgb(1,2,3)')).toBeUndefined()
    })
  })

  describe('parseSvg + processDocument', () => {
    it('throws on a missing viewBox', () => {
      const doc = parseSvg('f', '<svg><rect fill="#D7CDF5"/></svg>')
      expect(() =>
        processDocument('f', doc, 'p-', {
          freezeLiteralWhite: false,
          roleMap: { '#D7CDF5': 'bg-1' },
        }),
      ).toThrow(BuildError)
    })

    it('leaves fill="none" untouched and does not flag it as unclassified', () => {
      const doc = parseSvg(
        'f',
        '<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="none"/></svg>',
      )
      const result = processDocument('f', doc, 'p-', { freezeLiteralWhite: false, roleMap: {} })
      expect(result.unclassified).toHaveLength(0)
      expect(result.roles).toHaveLength(0)
    })

    it('reports an unknown color instead of guessing the nearest canonical one', () => {
      const doc = parseSvg(
        'f',
        '<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="#123456"/></svg>',
      )
      const result = processDocument('f', doc, 'p-', { freezeLiteralWhite: false, roleMap: {} })
      expect(result.unclassified).toEqual([{ file: 'f', value: '#123456' }])
    })

    it('rewrites a matched color to var(--role-x, hex) and tags data-role', () => {
      const doc = parseSvg(
        'f',
        '<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="#D7CDF5"/></svg>',
      )
      processDocument('f', doc, 'p-', { freezeLiteralWhite: false, roleMap: { '#D7CDF5': 'bg-1' } })
      const rect = doc.documentElement?.getElementsByTagName('rect').item(0)
      expect(rect?.getAttribute('fill')).toBe('var(--role-bg-1, #D7CDF5)')
      expect(rect?.getAttribute('data-role')).toBe('bg-1')
    })

    it('freezes literal white without assigning it a role when requested', () => {
      const doc = parseSvg(
        'f',
        '<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="white"/></svg>',
      )
      const result = processDocument('f', doc, 'p-', {
        freezeLiteralWhite: true,
        roleMap: { '#FFFFFF': 'white' },
      })
      const rect = doc.documentElement?.getElementsByTagName('rect').item(0)
      expect(rect?.getAttribute('fill')).toBe('white')
      expect(rect?.getAttribute('data-role')).toBeNull()
      expect(result.roles).toHaveLength(0)
    })

    it('skips color classification for shapes nested inside <defs>', () => {
      const doc = parseSvg(
        'f',
        '<svg viewBox="0 0 10 10"><defs><clipPath id="c"><rect width="10" height="10" fill="#123456"/></clipPath></defs></svg>',
      )
      const result = processDocument('f', doc, 'p-', { freezeLiteralWhite: false, roleMap: {} })
      expect(result.unclassified).toHaveLength(0)
    })
  })

  describe('prefixIds', () => {
    it('renames ids and rewrites matching url(#...) references', () => {
      const doc = parseSvg(
        'f',
        '<svg viewBox="0 0 10 10"><g clip-path="url(#clip0)"><rect width="10" height="10"/></g><defs><clipPath id="clip0"><rect width="10" height="10"/></clipPath></defs></svg>',
      )
      const root = doc.documentElement
      if (!root) throw new Error('no root')
      prefixIds(root, 'book-L-main-')
      const clipPath = root.getElementsByTagName('clipPath').item(0)
      const group = root.getElementsByTagName('g').item(0)
      expect(clipPath?.getAttribute('id')).toBe('book-L-main-clip0')
      expect(group?.getAttribute('clip-path')).toBe('url(#book-L-main-clip0)')
    })
  })
})
