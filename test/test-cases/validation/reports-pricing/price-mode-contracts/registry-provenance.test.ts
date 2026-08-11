import { describe, expect, test } from 'bun:test'
import { safeParse } from 'valibot'
import { getModelRegistry, ModelRegistrySchema } from '~/cli/commands/setup-and-utilities/models/model-loader'
import type { JsonObject, ModelRegistry, RegistryModelRecord } from '~/types'
import { isRecord } from './shared'

const PRICING_PROVENANCE_FIELDS = [
  'pricingSourceUrl',
  'pricingCurrency',
  'pricingTier',
  'pricingNotes'
] as const

const PRICE_FIELD_NAMES = [
  'costPerHourCents',
  'costPer1kPagesCents',
  'costPerMInputTokensCents',
  'costPerMCachedInputTokensCents',
  'costPerMOutputTokensCents',
  'inputCostPer1MCents',
  'cachedInputCostPer1MCents',
  'outputCostPer1MCents',
  'costPer1kCharsCents',
  'inputCostPer1MCharsCents',
  'outputCostPer1MCharsCents',
  'costPerImageCents',
  'costPerTrackCents',
  'costPerMinuteCents',
  'lyricsCostPerTrackCents',
  'baseCostPerSecondCents',
  'baseJobFeeCents',
  'blockCost720pCents',
  'blockCost1080pCents',
  'inputImageCostCents',
  'inputVideoCostPerSecondCents'
] as const

const RETIRED_USD_MODEL_FIELDS_BY_CATEGORY = {
  stt: ['costPerHourUSD'],
  extract: [
    'costPer1kPagesUSD',
    'costPerMInputTokensUSD',
    'costPerMCachedInputTokensUSD',
    'costPerMOutputTokensUSD'
  ],
  llm: ['inputCostPer1MUSD', 'cachedInputCostPer1MUSD', 'outputCostPer1MUSD'],
  tts: ['costPer1kCharsUSD', 'inputCostPer1MCharsUSD', 'outputCostPer1MCharsUSD'],
  image: ['costPerImageUSD'],
  music: ['costPerTrackUSD', 'costPerMinuteUSD', 'lyricsCostPerTrackUSD'],
  video: [
    'baseCostPerSecondUSD',
    'baseJobFeeUSD',
    'blockCost720pUSD',
    'blockCost1080pUSD',
    'inputImageCostUSD',
    'inputVideoCostPerSecondUSD'
  ]
} as const satisfies Record<keyof ModelRegistry, readonly string[]>

const RETIRED_USD_TOKEN_BAND_FIELDS = [
  'inputCostPer1MUSD',
  'cachedInputCostPer1MUSD',
  'outputCostPer1MUSD'
] as const

const CREDIT_PRICED_MODEL_KEYS = new Set([
  'stt/supadata/auto',
  'stt/scrapecreators/youtube-transcript'
])

const getRegistryModelRecords = (): RegistryModelRecord[] => {
  const registry = getModelRegistry() as unknown as Record<string, Record<string, { type: string, models: Record<string, JsonObject> }>>
  const records: RegistryModelRecord[] = []

  for (const [step, services] of Object.entries(registry)) {
    for (const [provider, service] of Object.entries(services)) {
      for (const [model, entry] of Object.entries(service.models)) {
        records.push({
          step: step as keyof ModelRegistry,
          provider,
          model,
          serviceType: service.type,
          entry
        })
      }
    }
  }

  return records
}

const hasPositivePricingField = (entry: JsonObject): boolean =>
  PRICE_FIELD_NAMES.some((field) => {
    const value = entry[field]
    return typeof value === 'number' && value > 0
  })

const hasPositiveTokenPricingBand = (entry: JsonObject): boolean => {
  const bands = entry['tokenPricingBands']
  return Array.isArray(bands) && bands.some((band) =>
    isRecord(band) && hasPositivePricingField(band)
  )
}

const hasPositiveFixedCostMatrix = (entry: JsonObject): boolean => {
  const matrix = entry['fixedCostByResolutionDurationCents']
  if (!isRecord(matrix)) return false
  return Object.values(matrix).some((durationCosts) =>
    isRecord(durationCosts)
    && Object.values(durationCosts).some((value) => typeof value === 'number' && value > 0)
  )
}

const isPaidApiRegistryModel = (record: RegistryModelRecord): boolean =>
  record.serviceType === 'api'
  && (
    hasPositivePricingField(record.entry)
    || hasPositiveTokenPricingBand(record.entry)
    || hasPositiveFixedCostMatrix(record.entry)
    || CREDIT_PRICED_MODEL_KEYS.has(`${record.step}/${record.provider}/${record.model}`)
  )

const validatePricingProvenance = (record: RegistryModelRecord): string[] =>
  PRICING_PROVENANCE_FIELDS.flatMap((field) => {
    const value = record.entry[field]
    if (typeof value !== 'string' || value.trim().length === 0) {
      return [`${record.step}/${record.provider}/${record.model}: missing ${field}`]
    }
    if (field === 'pricingCurrency' && value !== 'USD') {
      return [`${record.step}/${record.provider}/${record.model}: ${field}=${value}`]
    }
    return []
  })

describe('price mode contracts', () => {
  test('paid API registry entries declare pricing provenance', () => {
      const missing = getRegistryModelRecords()
        .filter(isPaidApiRegistryModel)
        .flatMap(validatePricingProvenance)

      expect(missing).toEqual([])
    })

  test('registry schemas reject retired USD pricing fields', () => {
      const acceptedModelFields = (Object.entries(RETIRED_USD_MODEL_FIELDS_BY_CATEGORY) as Array<[
        keyof ModelRegistry,
        readonly string[]
      ]>).flatMap(([category, fields]) =>
        fields.flatMap((field) => {
          const registry = structuredClone(getModelRegistry())
          const services = registry[category] as Record<string, { models: Record<string, JsonObject> }>
          const service = Object.values(services)[0]
          const model = Object.values(service?.models ?? {})[0]
          if (!model) {
            throw new Error(`Missing ${category} registry model fixture`)
          }
          model[field] = 1
          return safeParse(ModelRegistrySchema, registry).success
            ? [`${category}.${field}`]
            : []
        })
      )

      const acceptedTokenBandFields = RETIRED_USD_TOKEN_BAND_FIELDS.flatMap((field) => {
        const registry = structuredClone(getModelRegistry())
        const band = registry.llm['minimax']?.models['MiniMax-M3']?.tokenPricingBands?.[0]
        if (!band) {
          throw new Error('Missing MiniMax-M3 token pricing band fixture')
        }
        ;(band as unknown as JsonObject)[field] = 1
        return safeParse(ModelRegistrySchema, registry).success
          ? [`llm.tokenPricingBands.${field}`]
          : []
      })

      expect([...acceptedModelFields, ...acceptedTokenBandFields]).toEqual([])
    })
})
