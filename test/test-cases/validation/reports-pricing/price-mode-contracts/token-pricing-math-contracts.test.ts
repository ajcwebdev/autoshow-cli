import { describe,expect,test } from 'bun:test'
import { estimateLlmCostFromRegistry } from '~/cli/commands/visuals/comic/comic-utils/structured-script-utils/llm-cost'
import { computeTokenCost } from '~/utils/pricing/token-pricing'
import { logLlmTokenEstimate } from '~/cli/commands/visuals/comic/comic-utils/comic-price-llm-estimates'
import { captureLogEvents } from '../../../../test-utils/console-capture'

describe('price mode contracts', () => {
  test('comic Sol estimates convert current promotional cents rates to dollars and honor the full-request context band', () => {
      // https://developers.openai.com/api/docs/models/gpt-5.6-sol, retrieved 2026-10-15:
      // $4/$20 per million through 272K input; $8/$30 strictly above it.
      expect(estimateLlmCostFromRegistry('gpt-5.6-sol', 100_000, 100_000)).toBe(2.4)
      expect(estimateLlmCostFromRegistry('gpt-5.6-sol', 272_000, 1000)).toBeCloseTo(1.108)
      expect(estimateLlmCostFromRegistry('gpt-5.6-sol', 272_001, 1000)).toBeCloseTo(2.206008)
      expect(estimateLlmCostFromRegistry('gpt-5.6-sol', 1_000_000, 1_000_000)).toBe(38)
    })

  test('comic retry estimates select context bands per request and keep input/output components additive', async () => {
      for (const [units, expectedInput, expectedOutput, expectedTotal] of [[200_000, 1.6, .04, 1.64], [300_000, 4.8, .06, 4.86]] as const) {
        const { events } = await captureLogEvents(async () => logLlmTokenEstimate('Sol pricing contract', 'gpt-5.6-sol', 'source', 'fixture.md', units, { maximumCalls: 2, outputUnitsPerCall: 1000 }))
        const cost = events.find(event => event.metadata?.['estimatedInput'] === units * 2)?.metadata
        expect(cost).toMatchObject({ estimatedInput: units * 2, estimatedOutput: 2000, maximumCalls: 2 })
        expect(cost?.['inputCost']).toBeCloseTo(expectedInput)
        expect(cost?.['outputCost']).toBeCloseTo(expectedOutput)
        expect(cost?.['totalCost']).toBeCloseTo(expectedTotal)
      }
    })

  test('shared token pricing helper computes flat cents-per-million rates', () => {
      const cost = computeTokenCost({
        inputCostPer1MCents: 20,
        outputCostPer1MCents: 125
      }, 1_000_000, 1_000_000)

      expect(cost).toMatchObject({
        inputCostPer1MCents: 20,
        outputCostPer1MCents: 125,
        inputCost: 20,
        outputCost: 125,
        totalCost: 145,
        costMultiplier: 1
      })
    })
})
