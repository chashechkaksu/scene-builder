const STOP_WORDS = new Set([
  'и',
  'в',
  'во',
  'на',
  'с',
  'со',
  'по',
  'для',
  'от',
  'до',
  'из',
  'к',
  'ко',
  'о',
  'об',
  'обо',
  'что',
  'как',
  'это',
  'эта',
  'этот',
  'эти',
  'а',
  'но',
  'же',
  'бы',
  'ли',
  'не',
  'ни',
  'то',
  'у',
  'за',
  'при',
  'над',
  'под',
  'про',
  'перед',
  'через',
  'без',
  'или',
  'либо',
  'да',
  'нет',
  'очень',
  'такой',
  'такая',
  'такие',
  'какой',
  'какая',
  'какие',
  'свой',
  'своя',
  'свое',
  'его',
  'ее',
  'её',
  'их',
  'мы',
  'вы',
  'он',
  'она',
  'оно',
  'они',
  'я',
  'ты',
  'the',
  'a',
  'an',
  'of',
  'in',
  'on',
  'for',
  'to',
  'and',
  'or',
  'is',
  'are',
  'was',
  'were',
  'with',
  'at',
  'by',
  'that',
  'this',
  'these',
  'those',
  'as',
  'it',
  'be',
  'about',
])

export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9\s-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function tokenize(normalized: string): string[] {
  if (normalized.length === 0) {
    return []
  }
  return normalized.split(' ').filter((token) => token.length > 0)
}

export function isStopWord(token: string): boolean {
  return STOP_WORDS.has(token)
}

export function removeStopWords(tokens: string[]): string[] {
  return tokens.filter((token) => !isStopWord(token))
}

const RU_SUFFIXES = [
  'ействен',
  'ованиями',
  'ованием',
  'ованиях',
  'ование',
  'ования',
  'иями',
  'иях',
  'ость',
  'ости',
  'ение',
  'ения',
  'ений',
  'ьями',
  'ями',
  'ами',
  'иями',
  'его',
  'ему',
  'ыми',
  'ими',
  'ую',
  'юю',
  'ого',
  'ому',
  'ых',
  'их',
  'ая',
  'яя',
  'ое',
  'ее',
  'ый',
  'ий',
  'ой',
  'ем',
  'ом',
  'ам',
  'ям',
  'ах',
  'ях',
  'ию',
  'ью',
  'ии',
  'ие',
  'ья',
  'ье',
  'ьи',
  'ов',
  'ев',
  'а',
  'я',
  'ы',
  'и',
  'о',
  'у',
  'ю',
  'е',
  'ь',
]

const EN_SUFFIXES = ['ing', 'edly', 'ies', 'ied', 'ed', 'ly', 'es', 's']

const STEM_MIN_LENGTH = 3

export function stem(token: string): string {
  if (token.length <= STEM_MIN_LENGTH) {
    return token
  }
  const isCyrillic = /[а-я]/.test(token)
  const suffixes = isCyrillic ? RU_SUFFIXES : EN_SUFFIXES
  const sorted = [...suffixes].sort((a, b) => b.length - a.length)
  for (const suffix of sorted) {
    if (token.length - suffix.length < STEM_MIN_LENGTH) {
      continue
    }
    if (token.endsWith(suffix)) {
      return token.slice(0, token.length - suffix.length)
    }
  }
  return token
}

export function bigrams(tokens: string[]): string[] {
  const result: string[] = []
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const first = tokens[i]
    const second = tokens[i + 1]
    if (first !== undefined && second !== undefined) {
      result.push(`${first} ${second}`)
    }
  }
  return result
}

export function levenshteinDistance(a: string, b: string): number {
  if (a === b) {
    return 0
  }
  const aLen = a.length
  const bLen = b.length
  if (aLen === 0) {
    return bLen
  }
  if (bLen === 0) {
    return aLen
  }
  let previousRow = Array.from({ length: bLen + 1 }, (_, index) => index)
  let currentRow = new Array<number>(bLen + 1).fill(0)
  for (let i = 1; i <= aLen; i += 1) {
    currentRow[0] = i
    for (let j = 1; j <= bLen; j += 1) {
      const deletionCost = (previousRow[j] ?? 0) + 1
      const insertionCost = (currentRow[j - 1] ?? 0) + 1
      const substitutionCost = (previousRow[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1)
      currentRow[j] = Math.min(deletionCost, insertionCost, substitutionCost)
    }
    const swap = previousRow
    previousRow = currentRow
    currentRow = swap
  }
  return previousRow[bLen] ?? Math.max(aLen, bLen)
}

export function levenshteinThreshold(wordLength: number): number {
  if (wordLength <= 4) {
    return 0
  }
  if (wordLength <= 7) {
    return 1
  }
  return 2
}

export function isFuzzyMatch(a: string, b: string): boolean {
  const threshold = levenshteinThreshold(Math.max(a.length, b.length))
  if (threshold === 0) {
    return a === b
  }
  const lengthDifference = Math.abs(a.length - b.length)
  if (lengthDifference > threshold) {
    return false
  }
  return levenshteinDistance(a, b) <= threshold
}
