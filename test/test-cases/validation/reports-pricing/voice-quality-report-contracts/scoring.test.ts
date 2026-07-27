import { describe, expect, test } from 'bun:test'
import { aggregateWeightedScore, mosToPercentScore, rankVoiceQualityProviders } from '~/utils/voice-quality-scoring'

describe('voice quality scoring contracts', () => {
  test('normalizes MOS scores and aggregates missing weighted components', () => {
    expect(mosToPercentScore(1)).toBe(0)
    expect(mosToPercentScore(3)).toBe(50)
    expect(mosToPercentScore(5)).toBe(100)
    expect(mosToPercentScore(6)).toBe(100)
    expect(mosToPercentScore(0)).toBe(0)
    expect(mosToPercentScore(null)).toBeNull()

    const aggregate = aggregateWeightedScore([
      { key: 'available-high', score: 80, weight: 0.5 },
      { key: 'missing', score: null, weight: 0.25 },
      { key: 'available-low', score: 40, weight: 0.25 }
    ])

    expect(aggregate.score).toBeCloseTo(66.666666, 5)
    expect(aggregate.availableWeight).toBe(0.75)
    expect(aggregate.totalWeight).toBe(1)
    expect(aggregate.missingKeys).toEqual(['missing'])
  })

  test('ranks providers deterministically when scores tie', () => {
    const ranked = rankVoiceQualityProviders([
      { providerKey: 'z/provider', humanSpeechScore: 80, naturalnessScore: 80, speechQualityScore: 80 },
      { providerKey: 'a/provider', humanSpeechScore: 80, naturalnessScore: 80, speechQualityScore: 80 },
      { providerKey: 'm/provider', humanSpeechScore: 90, naturalnessScore: 70, speechQualityScore: 70 }
    ])

    expect(ranked.map((provider) => [provider.rank, provider.providerKey])).toEqual([
      [1, 'm/provider'],
      [2, 'a/provider'],
      [3, 'z/provider']
    ])
  })
})
