import type { SemanticWeightedTerm } from '@/shared/types'
import { semanticsDictionary } from '@/library/semantics'
import { normalizeText, removeStopWords, stem, tokenize } from './text'

export type SemanticWeight = SemanticWeightedTerm['weight']

export const WEIGHT_SCORE: Record<SemanticWeight, number> = {
  literal: 1,
  strong: 0.7,
  associative: 0.4,
}

export interface DictionaryTermEntry {
  objectId: string
  weight: SemanticWeight
  originalText: string
  stems: string[]
}

export interface DictionaryIndex {
  singleWordTerms: Map<string, DictionaryTermEntry[]>
  phraseTerms: DictionaryTermEntry[]
  allStems: string[]
  documentFrequency: Map<string, number>
  objectIds: string[]
}

function buildTermEntries(): DictionaryTermEntry[] {
  const entries: DictionaryTermEntry[] = []
  for (const object of semanticsDictionary) {
    for (const term of object.terms) {
      const normalized = normalizeText(term.text)
      const words = removeStopWords(tokenize(normalized))
      if (words.length === 0) {
        continue
      }
      entries.push({
        objectId: object.objectId,
        weight: term.weight,
        originalText: term.text,
        stems: words.map(stem),
      })
    }
  }
  return entries
}

function computeDocumentFrequency(entries: DictionaryTermEntry[]): Map<string, number> {
  const stemToObjects = new Map<string, Set<string>>()
  for (const entry of entries) {
    for (const stemmed of entry.stems) {
      const bucket = stemToObjects.get(stemmed) ?? new Set<string>()
      bucket.add(entry.objectId)
      stemToObjects.set(stemmed, bucket)
    }
  }
  const frequency = new Map<string, number>()
  for (const [stemmed, objects] of stemToObjects) {
    frequency.set(stemmed, objects.size)
  }
  return frequency
}

export function buildDictionaryIndex(): DictionaryIndex {
  const entries = buildTermEntries()
  const objectIds = semanticsDictionary.map((object) => object.objectId)
  const singleWordTerms = new Map<string, DictionaryTermEntry[]>()
  const phraseTerms: DictionaryTermEntry[] = []
  for (const entry of entries) {
    if (entry.stems.length === 1) {
      const key = entry.stems[0]
      if (key === undefined) {
        continue
      }
      const bucket = singleWordTerms.get(key) ?? []
      bucket.push(entry)
      singleWordTerms.set(key, bucket)
    } else {
      phraseTerms.push(entry)
    }
  }
  const documentFrequency = computeDocumentFrequency(entries)
  return {
    singleWordTerms,
    phraseTerms,
    allStems: [...documentFrequency.keys()],
    documentFrequency,
    objectIds,
  }
}

export function inverseDocumentFrequency(index: DictionaryIndex, stemmed: string): number {
  const documentCount = index.objectIds.length
  const frequency = index.documentFrequency.get(stemmed) ?? documentCount
  return Math.log((documentCount + 1) / (frequency + 1)) + 1
}
