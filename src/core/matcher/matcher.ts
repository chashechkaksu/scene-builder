import manifestJson from '@/library/manifest.json'
import type { LibraryManifest } from '@/shared/types'

const manifest = manifestJson as unknown as LibraryManifest
import {
  WEIGHT_SCORE,
  buildDictionaryIndex,
  inverseDocumentFrequency,
  type DictionaryIndex,
  type DictionaryTermEntry,
} from './dictionary-index'
import { semanticsDictionary } from '@/library/semantics'
import {
  bigrams,
  isFuzzyMatch,
  levenshteinThreshold,
  normalizeText,
  removeStopWords,
  stem,
  tokenize,
  levenshteinDistance,
} from './text'

export interface ObjectMatch {
  objectId: string
  score: number
  reasons: string[]
}

export interface MetaphorMatchResult {
  matches: ObjectMatch[]
  confident: boolean
}

export interface ComponentMatchResult {
  matches: ObjectMatch[]
  unknownChunks: string[]
}

const MAX_INPUT_LENGTH = 2000
const MAX_REASON_TERMS = 3
const MAX_METAPHOR_MATCHES = 6
const FUZZY_MATCH_PENALTY = 0.85
const PHRASE_MATCH_BONUS = 1.2
const SCORE_SATURATION_CONSTANT = 2.5
const CONFIDENT_RAW_SCORE_THRESHOLD = 0.6
const NEUTRAL_FALLBACK_OBJECT_IDS = ['lamp', 'book', 'folder']

let cachedIndex: DictionaryIndex | undefined

function getIndex(): DictionaryIndex {
  if (!cachedIndex) {
    cachedIndex = buildDictionaryIndex()
  }
  return cachedIndex
}

function nameRuByObjectId(): Map<string, string> {
  const map = new Map<string, string>()
  for (const object of manifest.objects) {
    map.set(object.id, object.nameRu)
  }
  for (const object of semanticsDictionary) {
    if (!map.has(object.objectId)) {
      map.set(object.objectId, object.objectId)
    }
  }
  return map
}

interface AccumulatedMatch {
  objectId: string
  rawScore: number
  matchedTerms: Map<string, { weightScore: number; entry: DictionaryTermEntry }>
}

function createAccumulator(): Map<string, AccumulatedMatch> {
  return new Map<string, AccumulatedMatch>()
}

function addContribution(
  accumulator: Map<string, AccumulatedMatch>,
  entry: DictionaryTermEntry,
  contribution: number,
): void {
  const existing = accumulator.get(entry.objectId) ?? {
    objectId: entry.objectId,
    rawScore: 0,
    matchedTerms: new Map<string, { weightScore: number; entry: DictionaryTermEntry }>(),
  }
  existing.rawScore += contribution
  const termKey = entry.originalText
  const previousTerm = existing.matchedTerms.get(termKey)
  if (!previousTerm || previousTerm.weightScore < contribution) {
    existing.matchedTerms.set(termKey, { weightScore: contribution, entry })
  }
  accumulator.set(entry.objectId, existing)
}

function matchSingleWordToken(
  index: DictionaryIndex,
  queryStem: string,
  accumulator: Map<string, AccumulatedMatch>,
): void {
  const exactEntries = index.singleWordTerms.get(queryStem)
  if (exactEntries) {
    for (const entry of exactEntries) {
      const idf = inverseDocumentFrequency(index, queryStem)
      addContribution(accumulator, entry, WEIGHT_SCORE[entry.weight] * idf)
    }
    return
  }
  const threshold = levenshteinThreshold(queryStem.length)
  if (threshold === 0) {
    return
  }
  for (const [dictionaryStem, entries] of index.singleWordTerms) {
    if (Math.abs(dictionaryStem.length - queryStem.length) > threshold) {
      continue
    }
    if (levenshteinDistance(queryStem, dictionaryStem) > threshold) {
      continue
    }
    const idf = inverseDocumentFrequency(index, dictionaryStem)
    for (const entry of entries) {
      addContribution(accumulator, entry, WEIGHT_SCORE[entry.weight] * idf * FUZZY_MATCH_PENALTY)
    }
  }
}

function matchPhrases(
  index: DictionaryIndex,
  queryBigramStems: string[][],
  accumulator: Map<string, AccumulatedMatch>,
): void {
  for (const phraseEntry of index.phraseTerms) {
    for (const queryPair of queryBigramStems) {
      if (queryPair.length !== phraseEntry.stems.length) {
        continue
      }
      const matchesAllWords = queryPair.every(
        (word, position) => word === phraseEntry.stems[position],
      )
      if (!matchesAllWords) {
        continue
      }
      const idf = Math.max(
        ...phraseEntry.stems.map((word) => inverseDocumentFrequency(index, word)),
      )
      addContribution(
        accumulator,
        phraseEntry,
        WEIGHT_SCORE[phraseEntry.weight] * idf * PHRASE_MATCH_BONUS,
      )
    }
  }
}

function buildReasons(nameLookup: Map<string, string>, accumulated: AccumulatedMatch): string[] {
  const topTerms = [...accumulated.matchedTerms.values()]
    .sort((a, b) => b.weightScore - a.weightScore)
    .slice(0, MAX_REASON_TERMS)
    .map((term) => term.entry.originalText)
  const label = nameLookup.get(accumulated.objectId) ?? accumulated.objectId
  if (topTerms.length === 0) {
    return [label]
  }
  return [`${label}: ${topTerms.join(', ')}`]
}

function normalizeScore(rawScore: number): number {
  if (rawScore <= 0) {
    return 0
  }
  return rawScore / (rawScore + SCORE_SATURATION_CONSTANT)
}

function truncateInput(input: string): string {
  if (typeof input !== 'string') {
    return ''
  }
  return input.length > MAX_INPUT_LENGTH ? input.slice(0, MAX_INPUT_LENGTH) : input
}

export function matchMetaphor(input: string): MetaphorMatchResult {
  const safeInput = truncateInput(input)
  const normalized = normalizeText(safeInput)
  const tokens = removeStopWords(tokenize(normalized))
  const index = getIndex()
  const nameLookup = nameRuByObjectId()

  if (tokens.length === 0) {
    return buildNeutralResult(nameLookup)
  }

  const accumulator = createAccumulator()
  const stems = tokens.map(stem)
  for (const queryStem of stems) {
    matchSingleWordToken(index, queryStem, accumulator)
  }
  const rawBigrams = bigrams(tokens)
  const stemmedBigramPairs = rawBigrams.map((pair) => pair.split(' ').map(stem))
  matchPhrases(index, stemmedBigramPairs, accumulator)

  const ranked = [...accumulator.values()].sort((a, b) => b.rawScore - a.rawScore)

  if (ranked.length === 0) {
    return buildNeutralResult(nameLookup)
  }

  const topRawScore = ranked[0]?.rawScore ?? 0
  const confident = topRawScore >= CONFIDENT_RAW_SCORE_THRESHOLD

  const matches = ranked.slice(0, MAX_METAPHOR_MATCHES).map((accumulated) => ({
    objectId: accumulated.objectId,
    score: normalizeScore(accumulated.rawScore),
    reasons: buildReasons(nameLookup, accumulated),
  }))

  return { matches, confident }
}

function buildNeutralResult(nameLookup: Map<string, string>): MetaphorMatchResult {
  const matches = NEUTRAL_FALLBACK_OBJECT_IDS.map((objectId) => ({
    objectId,
    score: 0,
    reasons: [`${nameLookup.get(objectId) ?? objectId}: нейтральный набор, точных совпадений нет`],
  }))
  return { matches, confident: false }
}

const CHUNK_DELIMITER = /\s*(?:,|;|\/|&|\+|\n|\sи\s|\sand\s)\s*/i

function splitIntoChunks(input: string): string[] {
  return input
    .split(CHUNK_DELIMITER)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0)
}

interface ComponentCandidate {
  objectId: string
  nameRu: string
  normalizedTexts: string[]
}

function buildComponentCandidates(libraryManifest: LibraryManifest): ComponentCandidate[] {
  const nameByObjectId = new Map<string, string>()
  for (const object of libraryManifest.objects) {
    nameByObjectId.set(object.id, object.nameRu)
  }
  return semanticsDictionary.map((object) => {
    const literalTerms = object.terms
      .filter((term) => term.weight === 'literal')
      .map((term) => normalizeText(term.text))
    const nameRu = nameByObjectId.get(object.objectId) ?? object.objectId
    return {
      objectId: object.objectId,
      nameRu,
      normalizedTexts: [object.objectId, normalizeText(nameRu), ...literalTerms],
    }
  })
}

function findBestComponentMatch(
  chunk: string,
  candidates: ComponentCandidate[],
): { objectId: string; nameRu: string; score: number } | undefined {
  const normalizedChunk = normalizeText(chunk)
  if (normalizedChunk.length === 0) {
    return undefined
  }
  let best: { objectId: string; nameRu: string; score: number } | undefined
  for (const candidate of candidates) {
    for (const candidateText of candidate.normalizedTexts) {
      if (candidateText === normalizedChunk) {
        return { objectId: candidate.objectId, nameRu: candidate.nameRu, score: 1 }
      }
      if (isFuzzyMatch(normalizedChunk, candidateText)) {
        const distance = levenshteinDistance(normalizedChunk, candidateText)
        const maxLength = Math.max(normalizedChunk.length, candidateText.length)
        const score = maxLength === 0 ? 0 : 1 - distance / maxLength
        if (!best || score > best.score) {
          best = { objectId: candidate.objectId, nameRu: candidate.nameRu, score }
        }
      }
    }
  }
  return best
}

export function matchComponents(
  input: string,
  libraryManifest: LibraryManifest = manifest,
): ComponentMatchResult {
  const safeInput = truncateInput(input)
  if (safeInput.trim().length === 0) {
    return { matches: [], unknownChunks: [] }
  }
  const chunks = splitIntoChunks(safeInput)
  const candidates = buildComponentCandidates(libraryManifest)
  const byObjectId = new Map<string, ObjectMatch>()
  const unknownChunks: string[] = []

  for (const chunk of chunks) {
    const found = findBestComponentMatch(chunk, candidates)
    if (!found) {
      unknownChunks.push(chunk)
      continue
    }
    const existing = byObjectId.get(found.objectId)
    const reason = `${found.nameRu}: распознано как «${chunk}»`
    if (!existing || existing.score < found.score) {
      byObjectId.set(found.objectId, {
        objectId: found.objectId,
        score: found.score,
        reasons: [reason],
      })
    }
  }

  return {
    matches: [...byObjectId.values()].sort((a, b) => b.score - a.score),
    unknownChunks,
  }
}

export const MIN_COMPOSITION_OBJECTS = 4

/**
 * Pads matches up to `minimum` objects with neutral fillers (score 0), then with any other library object.
 */
export function ensureMinimumObjects(
  matches: ObjectMatch[],
  minimum: number = MIN_COMPOSITION_OBJECTS,
): ObjectMatch[] {
  if (matches.length >= minimum) return matches
  const nameLookup = nameRuByObjectId()
  const present = new Set(matches.map((match) => match.objectId))
  const fillerIds = [...NEUTRAL_FALLBACK_OBJECT_IDS, ...manifest.objects.map((object) => object.id)]
  const padding = [...new Set(fillerIds)]
    .filter((objectId) => !present.has(objectId))
    .map((objectId) => ({
      objectId,
      score: 0,
      reasons: [`${nameLookup.get(objectId) ?? objectId}: дополняет композицию`],
    }))
  return [...matches, ...padding].slice(0, Math.max(minimum, matches.length))
}
