import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ReferenceTokenizerMetadata } from '~/types'

export const REFERENCE_TOKENIZER_METADATA: ReferenceTokenizerMetadata = {
  name: 'o200k_base',
  implementation: 'in-repository-bpe',
  rankDataSha256: '3a005bb166d080a740fda2b6764aa501ea0c016b6de2c39d789c684832b1943a'
}

export const REFERENCE_TOKENIZER_RANK_DATA_FILE = join(import.meta.dir, '..', 'tools', 'o200k-base-ranks.tiktoken.gz')

const CONTRACTION_SUFFIX = "'(?:[sS]|[tT]|[rR][eE]|[vV][eE]|[mM]|[lL][lL]|[dD])"
const WHITESPACE_CLASS = '\\t\\n\\x0B\\f\\r \\x85\\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000'
const PIECE_PATTERN = new RegExp(
  [
    `[^\\r\\n\\p{L}\\p{N}]?[\\p{Lu}\\p{Lt}\\p{Lm}\\p{Lo}\\p{M}]*[\\p{Ll}\\p{Lm}\\p{Lo}\\p{M}]+(?:${CONTRACTION_SUFFIX})?`,
    `[^\\r\\n\\p{L}\\p{N}]?[\\p{Lu}\\p{Lt}\\p{Lm}\\p{Lo}\\p{M}]+[\\p{Ll}\\p{Lm}\\p{Lo}\\p{M}]*(?:${CONTRACTION_SUFFIX})?`,
    '\\p{N}{1,3}',
    ` ?[^${WHITESPACE_CLASS}\\p{L}\\p{N}]+[\\r\\n/]*`,
    `[${WHITESPACE_CLASS}]*[\\r\\n]+`,
    `[${WHITESPACE_CLASS}]+(?![^${WHITESPACE_CLASS}])`,
    `[${WHITESPACE_CLASS}]+`
  ].join('|'),
  'gu'
)

const utf8Encoder = new TextEncoder()

const bytesToKey = (bytes: Uint8Array): string => {
  let key = ''
  for (const byte of bytes) key += String.fromCharCode(byte)
  return key
}

let cachedRanks: Map<string, number> | undefined

const getRanks = (): Map<string, number> => {
  if (cachedRanks) return cachedRanks
  const lines = Buffer.from(Bun.gunzipSync(readFileSync(REFERENCE_TOKENIZER_RANK_DATA_FILE))).toString('utf8')
  const ranks = new Map<string, number>()
  for (const line of lines.split('\n')) {
    if (line.length === 0) continue
    const separator = line.indexOf(' ')
    ranks.set(
      Buffer.from(line.slice(0, separator), 'base64').toString('latin1'),
      Number.parseInt(line.slice(separator + 1), 10)
    )
  }
  cachedRanks = ranks
  return ranks
}

const MAX_RANK = Number.MAX_SAFE_INTEGER

const bytePairEncode = (piece: string, ranks: Map<string, number>): number[] => {
  const parts: [number, number][] = []
  let minRank = MAX_RANK
  let minIndex = -1
  for (let i = 0; i < piece.length - 1; i++) {
    const rank = ranks.get(piece.slice(i, i + 2)) ?? MAX_RANK
    if (rank < minRank) {
      minRank = rank
      minIndex = i
    }
    parts.push([i, rank])
  }
  parts.push([piece.length - 1, MAX_RANK])
  parts.push([piece.length, MAX_RANK])

  const rankAt = (index: number): number => {
    if (index + 3 >= parts.length) return MAX_RANK
    const part = parts[index]
    const boundary = parts[index + 3]
    if (!part || !boundary) return MAX_RANK
    return ranks.get(piece.slice(part[0], boundary[0])) ?? MAX_RANK
  }

  while (minRank !== MAX_RANK) {
    const i = minIndex
    const previous = parts[i - 1]
    if (previous) previous[1] = rankAt(i - 1)
    const merged = parts[i]
    if (merged) merged[1] = rankAt(i)
    parts.splice(i + 1, 1)

    minRank = MAX_RANK
    minIndex = -1
    for (let j = 0; j < parts.length - 1; j++) {
      const rank = parts[j]?.[1] ?? MAX_RANK
      if (rank < minRank) {
        minRank = rank
        minIndex = j
      }
    }
  }

  const tokens: number[] = []
  for (let i = 0; i < parts.length - 1; i++) {
    const start = parts[i]
    const end = parts[i + 1]
    if (!start || !end) continue
    const rank = ranks.get(piece.slice(start[0], end[0]))
    if (rank === undefined) continue
    tokens.push(rank)
  }
  return tokens
}

export const encodeReferenceTokens = (content: string): number[] => {
  const ranks = getRanks()
  const tokens: number[] = []
  for (const match of content.matchAll(PIECE_PATTERN)) {
    const key = bytesToKey(utf8Encoder.encode(match[0]))
    const direct = ranks.get(key)
    if (direct !== undefined) {
      tokens.push(direct)
      continue
    }
    tokens.push(...bytePairEncode(key, ranks))
  }
  return tokens
}

export const countReferenceTokens = (content: string): number => encodeReferenceTokens(content).length
