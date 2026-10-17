import { describe, expect, test } from 'bun:test'

import {
  charLevenshteinBreakdown,
  charLevenshteinDistance,
  levenshteinBreakdown,
  levenshteinDistance,
  type WerBreakdown
} from '../../../../.codex/skills/consensus/scripts/ocr/ocr_consensus_lib'

// Independent dense oracle: reconstruct the preferred path from costs rather
// than storing or decoding the production implementation's packed operations.
const denseBreakdown = (reference: string[], candidate: string[]): WerBreakdown => {
  const costs = Array.from(
    { length: reference.length + 1 },
    () => new Array<number>(candidate.length + 1).fill(0)
  )
  for (let i = 0; i <= reference.length; i++) costs[i]![0] = i
  for (let j = 0; j <= candidate.length; j++) costs[0]![j] = j
  for (let i = 1; i <= reference.length; i++) {
    for (let j = 1; j <= candidate.length; j++) {
      costs[i]![j] = Math.min(
        costs[i - 1]![j - 1]! + Number(reference[i - 1] !== candidate[j - 1]),
        costs[i - 1]![j]! + 1,
        costs[i]![j - 1]! + 1
      )
    }
  }

  let substitutions = 0
  let deletions = 0
  let insertions = 0
  let i = reference.length
  let j = candidate.length
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && reference[i - 1] === candidate[j - 1]) {
      i--
      j--
    } else if (i > 0 && j > 0 && costs[i]![j] === costs[i - 1]![j - 1]! + 1) {
      substitutions++
      i--
      j--
    } else if (i > 0 && costs[i]![j] === costs[i - 1]![j]! + 1) {
      deletions++
      i--
    } else {
      insertions++
      j--
    }
  }
  return { distance: costs[reference.length]![candidate.length]!, substitutions, deletions, insertions }
}

const binarySequences = (): string[][] => {
  const sequences: string[][] = []
  for (let length = 0; length <= 5; length++) {
    for (let bits = 0; bits < 2 ** length; bits++) {
      sequences.push(Array.from({ length }, (_, index) => ((bits >>> index) & 1) === 0 ? 'a' : 'b'))
    }
  }
  return sequences
}

describe('OCR edit-distance breakdown parity', () => {
  test('matches the independent dense oracle for every binary sequence pair through length five', () => {
    const sequences = binarySequences()
    expect(sequences).toHaveLength(63)
    for (const reference of sequences) {
      for (const candidate of sequences) {
        const expected = denseBreakdown(reference, candidate)
        expect({ reference, candidate, result: levenshteinBreakdown(reference, candidate) }).toEqual({
          reference,
          candidate,
          result: expected
        })
        expect(levenshteinDistance(reference, candidate)).toBe(expected.distance)
      }
    }
  })

  test('keeps substitution-first ties and directional insertions and deletions', () => {
    expect(levenshteinBreakdown(['a', 'b'], ['b', 'a'])).toEqual({
      distance: 2, substitutions: 2, deletions: 0, insertions: 0
    })
    expect(levenshteinBreakdown(['a', 'a'], ['b'])).toEqual({
      distance: 2, substitutions: 1, deletions: 1, insertions: 0
    })
    expect(levenshteinBreakdown(['b'], ['a', 'a'])).toEqual({
      distance: 2, substitutions: 1, deletions: 0, insertions: 1
    })
  })

  test('preserves traceback when rows and final cells cross packed-byte boundaries', () => {
    const reference = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
    for (const candidate of [
      ['b', 'c', 'a'],
      ['b', 'c', 'a', 'e', 'h'],
      ['b', 'c', 'a', 'e', 'h', 'g', 'i']
    ]) {
      expect(levenshteinBreakdown(reference, candidate)).toEqual(denseBreakdown(reference, candidate))
      expect(levenshteinBreakdown(candidate, reference)).toEqual(denseBreakdown(candidate, reference))
    }
  })

  test('counts Unicode code points and combining marks without changing character alignment', () => {
    const reference = 'A😀é猫'
    const candidate = 'A🙂e\u0301猫'
    expect(charLevenshteinBreakdown(reference, candidate)).toEqual(denseBreakdown([...reference], [...candidate]))
    expect(charLevenshteinBreakdown(reference, candidate)).toEqual({
      distance: 3, substitutions: 2, deletions: 0, insertions: 1
    })
    expect(charLevenshteinBreakdown('😀😀', '😀')).toEqual({
      distance: 1, substitutions: 0, deletions: 1, insertions: 0
    })
  })

  test('preserves counts in both orientations at and beyond the existing fallback boundary', () => {
    for (const length of [10_000, 10_001]) {
      const repeated = new Array<string>(length).fill('a')
      expect(levenshteinBreakdown(repeated, ['b'])).toEqual({
        distance: length, substitutions: 1, deletions: length - 1, insertions: 0
      })
      expect(levenshteinBreakdown(['b'], repeated)).toEqual({
        distance: length, substitutions: 1, deletions: 0, insertions: length - 1
      })
    }
  })

  test('exact identical long token and Unicode sequences have zero edits across the existing fallback boundary', () => {
    for (const length of [10_000, 10_001]) {
      const reference = Array.from({ length }, (_, index) => `token-${index}`)
      const candidate = [...reference]
      expect(levenshteinDistance(reference, candidate)).toBe(0)
      expect(levenshteinBreakdown(reference, candidate)).toEqual({
        distance: 0, substitutions: 0, deletions: 0, insertions: 0
      })
    }
    const text = '猫😀é '.repeat(10_000)
    expect(charLevenshteinDistance(text, text)).toBe(0)
    expect(charLevenshteinBreakdown(text, text)).toEqual({
      distance: 0, substitutions: 0, deletions: 0, insertions: 0
    })
  })
})
