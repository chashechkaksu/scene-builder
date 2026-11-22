import { describe, expect, it } from 'vitest'
import { composeMetaphor } from '@/core/compose/compose-metaphor'
import { matchMetaphor } from '@/core/matcher'
import metaphors from '../fixtures/metaphors.json'

interface MetaphorCase {
  input: string
  expectedObjectIds: string[]
  minObjects?: number
}

const cases = metaphors as MetaphorCase[]

const TOP_N = 3
const REQUIRED_HIT_RATE = 0.85

function isHit(testCase: MetaphorCase, result: ReturnType<typeof matchMetaphor>): boolean {
  if (testCase.expectedObjectIds.length === 0) {
    return result.confident === false
  }
  const topIds = result.matches.slice(0, TOP_N).map((match) => match.objectId)
  return testCase.expectedObjectIds.some((expected) => topIds.includes(expected))
}

describe('core/matcher regression (tests/fixtures/metaphors.json)', () => {
  it(`hit rate is at least ${REQUIRED_HIT_RATE * 100}%`, () => {
    const results = cases.map((testCase) => ({
      testCase,
      result: matchMetaphor(testCase.input),
    }))
    const hits = results.filter(({ testCase, result }) => isHit(testCase, result))
    const hitRate = hits.length / cases.length

    const misses = results
      .filter(({ testCase, result }) => !isHit(testCase, result))
      .map(({ testCase, result }) => ({
        input: testCase.input,
        expected: testCase.expectedObjectIds,
        confident: result.confident,
        got: result.matches.slice(0, TOP_N).map((match) => match.objectId),
      }))

    expect(hitRate, `misses: ${JSON.stringify(misses, null, 2)}`).toBeGreaterThanOrEqual(
      REQUIRED_HIT_RATE,
    )
  })

  it.each(cases)('case: "$input"', (testCase) => {
    const result = matchMetaphor(testCase.input)
    expect(result.matches.length).toBeGreaterThan(0)
  })

  it.each(cases)('composition has 4-5 objects with a background one: "$input"', (testCase) => {
    const { composed } = composeMetaphor(testCase.input)
    expect(composed.length).toBeGreaterThanOrEqual(testCase.minObjects ?? 4)
    expect(composed.length).toBeLessThanOrEqual(5)
    expect(new Set(composed.map((object) => object.objectId)).size).toBe(composed.length)
    expect(composed.some((object) => object.state === 'bg')).toBe(true)
    const mains = composed.filter((object) => object.state === 'main')
    expect(mains.length).toBeGreaterThanOrEqual(1)
    expect(mains.length).toBeLessThanOrEqual(3)
  })

  it.each(cases.filter((testCase) => testCase.expectedObjectIds.length > 0))(
    'semantic matches are main, fillers are background: "$input"',
    (testCase) => {
      const { composed } = composeMetaphor(testCase.input)
      for (const object of composed) {
        if (object.score === 0) expect(object.state).toBe('bg')
      }
    },
  )
})
