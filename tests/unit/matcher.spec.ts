import { describe, expect, it } from 'vitest'
import { matchComponents, matchMetaphor } from '@/core/matcher'

describe('matchMetaphor edge cases', () => {
  it('empty input does not throw and returns a non-confident neutral result', () => {
    expect(() => matchMetaphor('')).not.toThrow()
    const result = matchMetaphor('')
    expect(result.confident).toBe(false)
    expect(result.matches.length).toBeGreaterThan(0)
  })

  it('whitespace-only input does not throw', () => {
    expect(() => matchMetaphor('   \n\t  ')).not.toThrow()
    const result = matchMetaphor('   \n\t  ')
    expect(result.confident).toBe(false)
  })

  it('garbage input does not throw and is not confident', () => {
    expect(() => matchMetaphor('asdkjhqwe 1234 %%% ///')).not.toThrow()
    const result = matchMetaphor('asdkjhqwe 1234 %%% ///')
    expect(result.confident).toBe(false)
  })

  it('very long input does not throw', () => {
    const longInput = `${'лампа идея озарение '.repeat(500)}`
    expect(() => matchMetaphor(longInput)).not.toThrow()
    const result = matchMetaphor(longInput)
    expect(result.matches.length).toBeGreaterThan(0)
  })

  it('every match has a score in [0, 1] and at least one reason', () => {
    const result = matchMetaphor('Идея, которая зажигает')
    expect(result.matches.length).toBeGreaterThan(0)
    for (const match of result.matches) {
      expect(match.score).toBeGreaterThanOrEqual(0)
      expect(match.score).toBeLessThanOrEqual(1)
      expect(match.reasons.length).toBeGreaterThan(0)
    }
  })
})

describe('matchComponents', () => {
  it('empty input does not throw and returns no matches', () => {
    expect(() => matchComponents('')).not.toThrow()
    const result = matchComponents('')
    expect(result.matches).toEqual([])
    expect(result.unknownChunks).toEqual([])
  })

  it('very long input does not throw', () => {
    const longInput = Array.from({ length: 500 }, () => 'книга').join(', ')
    expect(() => matchComponents(longInput)).not.toThrow()
  })

  it('parses comma-separated component names', () => {
    const result = matchComponents('книга, телефон, наушники')
    const ids = result.matches.map((match) => match.objectId)
    expect(ids).toContain('book')
    expect(ids).toContain('phone')
    expect(ids).toContain('headphones')
    expect(result.unknownChunks).toEqual([])
  })

  it('parses "и"-separated and "&"-separated component names', () => {
    const resultAnd = matchComponents('лампа и ручка')
    expect(resultAnd.matches.map((match) => match.objectId).sort()).toEqual(['lamp', 'pen'].sort())

    const resultAmpersand = matchComponents('лампа & ручка')
    expect(resultAmpersand.matches.map((match) => match.objectId).sort()).toEqual(
      ['lamp', 'pen'].sort(),
    )
  })

  it('recognizes known components with a small typo via fuzzy match', () => {
    const result = matchComponents('кнга, телефн')
    const ids = result.matches.map((match) => match.objectId)
    expect(ids).toContain('book')
    expect(ids).toContain('phone')
  })

  it('marks unknown chunks without blocking recognized ones', () => {
    const result = matchComponents('книга, абырвалг, телефон')
    const ids = result.matches.map((match) => match.objectId)
    expect(ids).toContain('book')
    expect(ids).toContain('phone')
    expect(result.unknownChunks).toEqual(['абырвалг'])
  })

  it('does not duplicate an object matched by multiple chunks', () => {
    const result = matchComponents('книга, книга')
    const bookMatches = result.matches.filter((match) => match.objectId === 'book')
    expect(bookMatches).toHaveLength(1)
  })
})
