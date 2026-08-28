import { describe,expect,test } from 'bun:test'
import { estimateLlmCostFromRegistry } from '~/cli/commands/process-steps/step-8-comic/comic-utils/structured-script-utils/llm-cost'
import { computeTokenCost } from '~/utils/pricing/token-pricing'

describe('price mode contracts', () => {
  test('comic LLM estimates convert canonical cents rates to dollars', () => {
      expect(estimateLlmCostFromRegistry('gpt-5.5', 1_000_000, 1_000_000)).toBe(35)
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
