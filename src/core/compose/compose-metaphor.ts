import { ensureMinimumObjects, matchMetaphor, type ObjectMatch } from '@/core/matcher'
import type { ComposedObject } from './select-composed-objects'

export type ComposedMatch = ComposedObject & Pick<ObjectMatch, 'score' | 'reasons'>

export interface MetaphorComposition {
  composed: ComposedMatch[]
  ranked: ObjectMatch[]
  confident: boolean
}

const MAX_MAIN_OBJECTS = 3
const MIN_TOTAL_OBJECTS = 4
const MAX_TOTAL_OBJECTS = 5
const MIN_BACKGROUND_OBJECTS = 1

/**
 * Objects found by meaning become main (up to 3); fillers and the leftover matches become background.
 * Always returns 4–5 objects with at least one background.
 */
export function composeMetaphor(input: string): MetaphorComposition {
  const result = matchMetaphor(input)
  const semantic = result.matches.filter((match) => match.score > 0)
  const pool = ensureMinimumObjects(semantic, MAX_TOTAL_OBJECTS)
  const filler = pool.filter((match) => match.score === 0)

  const mainCount = Math.max(1, Math.min(MAX_MAIN_OBJECTS, semantic.length))
  const total = Math.min(
    MAX_TOTAL_OBJECTS,
    Math.max(MIN_TOTAL_OBJECTS, semantic.length, mainCount + MIN_BACKGROUND_OBJECTS),
  )
  const ordered = [...semantic, ...filler].slice(0, total)

  const composed = ordered.map<ComposedMatch>((match, index) => ({
    objectId: match.objectId,
    state: index < mainCount ? 'main' : 'bg',
    score: match.score,
    reasons: match.reasons,
  }))
  return { composed, ranked: pool, confident: result.confident }
}
