import { describe, expect, test } from 'bun:test'

import {
  levenshteinBreakdown
} from '../../../../.codex/skills/consensus/scripts/url/url_consensus_lib'

describe('URL consensus long-distance contracts', () => {
  test('keeps long identical, edited, inserted, and truncated sequences deterministic', () => {
    const reference = Array.from({ length: 20_000 }, (_, index) => `token-${index}`)
    const substitutions = [...reference]
    for (let index = 100; index < substitutions.length; index += 200) {
      substitutions[index] = `changed-${index}`
    }
    const inserted = [...reference.slice(0, 10_000), 'inserted', ...reference.slice(10_000)]
    const truncated = reference.slice(0, 2_500)

    expect(levenshteinBreakdown(reference, reference).distance).toBe(0)
    expect(levenshteinBreakdown(reference, substitutions).distance).toBeGreaterThanOrEqual(95)
    expect(levenshteinBreakdown(reference, substitutions).distance).toBeLessThanOrEqual(105)
    expect(levenshteinBreakdown(reference, inserted).distance).toBe(1)
    expect(levenshteinBreakdown(reference, truncated).distance).toBe(17_500)
  })

  test('preserves the magnitude of dense long-sequence substitutions', () => {
    const reference = Array.from({ length: 10_001 }, (_, index) => `reference-${index}`)
    const substituted = Array.from({ length: 10_001 }, (_, index) => `candidate-${index}`)

    expect(levenshteinBreakdown(reference, substituted).distance).toBe(10_001)
  })

  test('scales separated long-sequence insertions and deletions back to edit units', () => {
    const reference = Array.from({ length: 20_000 }, (_, index) => String.fromCodePoint(0x1000 + index))
    const inserted = [
      ...reference.slice(0, 5_000),
      String.fromCodePoint(0x9000),
      ...reference.slice(5_000, 10_000),
      String.fromCodePoint(0x9001),
      ...reference.slice(10_000, 15_000),
      String.fromCodePoint(0x9002),
      ...reference.slice(15_000)
    ]
    const deletedIndexes = new Set([5_000, 10_000, 15_000])
    const deleted = reference.filter((_value, index) => !deletedIndexes.has(index))

    expect(levenshteinBreakdown(reference, inserted).distance).toBe(3)
    expect(levenshteinBreakdown(reference, deleted).distance).toBe(3)
  })

  test('preserves edit magnitude when a long unique-token block is moved', () => {
    const reference = Array.from({ length: 12_000 }, (_, index) => `token-${index}`)
    const rotated = [...reference.slice(1_000), ...reference.slice(0, 1_000)]

    expect(levenshteinBreakdown(reference, rotated).distance).toBe(2_000)
  })

  test('uses extended exact alignment before accepting a coarse token-anchor estimate', () => {
    const uniquePrefix = Array.from({ length: 2_500 }, (_value, index) => `unique-${index}`)
    const repeatedTail = [
      ...new Array<string>(4_000).fill('a'),
      ...new Array<string>(4_000).fill('b')
    ]
    const reference = [...uniquePrefix, ...repeatedTail]
    const rotated = [
      'changed-first-token',
      ...uniquePrefix.slice(1),
      ...repeatedTail.slice(200),
      ...repeatedTail.slice(0, 200)
    ]

    expect(levenshteinBreakdown(reference, rotated).distance).toBe(401)
    expect(levenshteinBreakdown(rotated, reference).distance).toBe(401)
  })

  test('keeps long reordered-block anchor estimates symmetric', () => {
    const blocks = Array.from({ length: 10 }, (_value, blockIndex) =>
      Array.from({ length: 1_100 }, (_blockValue, tokenIndex) =>
        `block-${blockIndex}-token-${tokenIndex}`
      )
    )
    const reference = blocks.flat()
    const reordered = [1, 0, 2, 7, 5, 6, 3, 4, 8, 9]
      .flatMap((blockIndex) => blocks[blockIndex]!)
    const forward = levenshteinBreakdown(reference, reordered).distance
    const reverse = levenshteinBreakdown(reordered, reference).distance

    expect(forward).toBe(6_600)
    expect(reverse).toBe(forward)
  })

  test('scores distributed patience-anchor gaps by their changed content', () => {
    const pairs = Array.from({ length: 6_000 }, (_value, index) => [
      `unique-${index}`,
      'common'
    ])
    const reference = pairs.flat()
    const withLateCommonTokensDeleted = pairs.flatMap((pair, index) =>
      index >= 3_950 ? [pair[0]!] : pair
    )
    const candidate = [
      ...withLateCommonTokensDeleted.slice(0, 2),
      ...Array.from({ length: 2_050 }, (_value, index) => `inserted-${index}`),
      ...withLateCommonTokensDeleted.slice(2)
    ]

    expect(reference).toHaveLength(12_000)
    expect(candidate).toHaveLength(12_000)
    expect(levenshteinBreakdown(reference, candidate).distance).toBe(4_100)
    expect(levenshteinBreakdown(candidate, reference).distance).toBe(4_100)
  })

  test('preserves section order when long sequences contain repeated elements', () => {
    const reference = [...new Array<string>(6_000).fill('a'), ...new Array<string>(6_000).fill('b')]
    const reordered = [...new Array<string>(6_000).fill('b'), ...new Array<string>(6_000).fill('a')]

    expect(levenshteinBreakdown(reference, reordered).distance).toBe(12_000)
    expect(levenshteinBreakdown(reordered, reference).distance).toBe(12_000)
  })

  test('keeps a periodic one-element rotation above zero distance', () => {
    const reference = Array.from({ length: 10_002 }, (_value, index) => index % 2 === 0 ? 'a' : 'b')
    const rotated = [...reference.slice(1), reference[0]!]

    expect(levenshteinBreakdown(reference, rotated).distance).toBe(2)
    expect(levenshteinBreakdown(rotated, reference).distance).toBe(2)
  })

  test('keeps repeated-sequence substitutions above the bounded exact limit', () => {
    const length = 12_000
    const changedIndexes = [
      0,
      length - 1,
      ...Array.from({ length }, (_value, index) => index)
        .filter((index) => index > 0 && index < length - 1)
        .slice(0, 2_048)
    ]
    const reference = new Array<string>(length).fill('a')
    const substituted = [...reference]
    for (const index of changedIndexes) substituted[index] = 'b'

    expect(changedIndexes).toHaveLength(2_050)
    expect(levenshteinBreakdown(reference, substituted).distance).toBe(2_050)
    expect(levenshteinBreakdown(substituted, reference).distance).toBe(2_050)
  })

  test('preserves alignment across multiple large inserted blocks', () => {
    const reference = Array.from({ length: 12_000 }, (_value, index) => String(index % 10))
    const inserted = [
      ...reference.slice(0, 3_000),
      ...new Array<string>(1_100).fill('x'),
      ...reference.slice(3_000, 9_000),
      ...new Array<string>(1_100).fill('y'),
      ...reference.slice(9_000)
    ]
    const insertedAndSubstituted = [...inserted]
    insertedAndSubstituted[7_500] = 'z'

    expect(levenshteinBreakdown(reference, inserted).distance).toBe(2_200)
    expect(levenshteinBreakdown(inserted, reference).distance).toBe(2_200)
    expect(levenshteinBreakdown(reference, insertedAndSubstituted).distance).toBe(2_201)
  })

})
