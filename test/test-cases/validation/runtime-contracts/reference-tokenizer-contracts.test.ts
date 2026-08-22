import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import {
  countReferenceTokens,
  encodeReferenceTokens,
  REFERENCE_TOKENIZER_METADATA,
  REFERENCE_TOKENIZER_RANK_DATA_FILE
} from '~/utils/reference-tokenizer'
import goldenVectors from './reference-tokenizer-golden-vectors.json'

describe('reference tokenizer', () => {
  test('metadata records the in-repository implementation and pinned rank data', () => {
    expect(REFERENCE_TOKENIZER_METADATA).toEqual({
      name: 'o200k_base',
      implementation: 'in-repository-bpe',
      rankDataSha256: '3a005bb166d080a740fda2b6764aa501ea0c016b6de2c39d789c684832b1943a'
    })
  })

  test('vendored rank data matches the pinned SHA-256', () => {
    const actual = new Bun.CryptoHasher('sha256').update(readFileSync(REFERENCE_TOKENIZER_RANK_DATA_FILE)).digest('hex')
    expect(actual).toBe(REFERENCE_TOKENIZER_METADATA.rankDataSha256)
  })

  test('vendored rank data holds the complete consecutive o200k_base table', () => {
    const lines = Buffer.from(Bun.gunzipSync(readFileSync(REFERENCE_TOKENIZER_RANK_DATA_FILE)))
      .toString('utf8')
      .split('\n')
      .filter((line) => line.length > 0)
    expect(lines.length).toBe(199998)
    lines.forEach((line, index) => {
      const rank = Number.parseInt(line.slice(line.indexOf(' ') + 1), 10)
      if (rank !== index) {
        throw new Error(`rank gap at line ${index}: ${line}`)
      }
    })
  })

  test('golden vectors generated with tiktoken@1.0.22 encode identically', () => {
    expect(goldenVectors.encoding).toBe('o200k_base')
    expect(goldenVectors.vectors.length).toBeGreaterThanOrEqual(60)
    for (const vector of goldenVectors.vectors) {
      const tokens = encodeReferenceTokens(vector.text)
      expect(`${vector.id}:${tokens.length}`).toBe(`${vector.id}:${vector.tokenCount}`)
      expect(countReferenceTokens(vector.text)).toBe(vector.tokenCount)
      if ('tokens' in vector && vector.tokens) {
        expect(`${vector.id}:${tokens.join(',')}`).toBe(`${vector.id}:${vector.tokens.join(',')}`)
      }
    }
  })

  test('special tokens are encoded as ordinary text, never as special ids', () => {
    expect(encodeReferenceTokens('<|endoftext|>')).not.toContain(199999)
    expect(encodeReferenceTokens('<|endofprompt|>')).not.toContain(200018)
    expect(countReferenceTokens('<|endoftext|>')).toBeGreaterThan(1)
  })
})
