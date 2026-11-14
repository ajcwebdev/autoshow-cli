import { describe, expect, test } from 'bun:test'
import { safeParse } from 'valibot'
import { getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { ModelRegistrySchema } from '~/cli/commands/setup-and-utilities/models/model-loader/model-loader-schemas'

const inheritedTimingModels = [
  ['llm', 'openai', 'gpt-6-astra', 'gpt-6.1-sol', 'msPer1KTokens'],
  ['llm', 'openai', 'gpt-6.1-terra', 'gpt-6-luna', 'msPer1KTokens'],
  ['llm', 'gemini', 'gemini-4-carbon', 'gemini-3.8-flash', 'msPer1KTokens'],
  ['llm', 'anthropic', 'claude-fable-5-2', 'claude-opus-5-5', 'msPer1KTokens'],
  ['tts', 'elevenlabs', 'eleven_v4', 'eleven_v3', 'msPer1KChars'],
  ['video', 'grok', 'grok-imagine-video-1.5-lite', 'grok-imagine-video-1.5', 'msPerSecond']
] as const

describe('registry timing provenance', () => {
  for (const [category, provider, model, sourceModel, timingField] of inheritedTimingModels) {
    test(`${provider}/${model}: parsed registry preserves provisional provenance separately from prices`, () => {
      const registry = getModelRegistry()
      const row = registry[category][provider]?.models[model]
      const source = registry[category][provider]?.models[sourceModel]
      expect(row?.estimation?.timingProvenance).toMatchObject({ status: 'provisional', sourceModel })
      expect(row?.estimation?.timingProvenance?.notes).toContain('not measured latency')
      expect(Reflect.get(row!.estimation!, timingField)).toBe(Reflect.get(source!.estimation!, timingField))
      expect(row?.pricingSourceUrl).toMatch(/^https:\/\//)
      expect(row?.pricingCheckedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    test(`${provider}/${model}: rejects incomplete or unqualified calibration metadata`, () => {
      const registry = structuredClone(getModelRegistry())
      const estimation = registry[category][provider]!.models[model]!.estimation!
      const valid = estimation.timingProvenance!
      expect(safeParse(ModelRegistrySchema, registry).success).toBe(true)
      for (const invalid of [
        { sourceModel, notes: valid.notes },
        { status: 'calibrated', sourceModel, notes: valid.notes },
        { status: 'provisional', notes: valid.notes },
        { status: 'provisional', sourceModel, notes: '' },
        { status: 'provisional', sourceModel: ' ', notes: valid.notes },
        { status: 'provisional', sourceModel, notes: ' ' },
        { ...valid, publishedRateMultiplier: 0.5 }
      ]) {
        Reflect.set(estimation, 'timingProvenance', invalid)
        expect(safeParse(ModelRegistrySchema, registry).success).toBe(false)
      }
      Reflect.set(estimation, 'timingProvenance', valid)
      expect(safeParse(ModelRegistrySchema, registry).success).toBe(true)
    })
  }
})
