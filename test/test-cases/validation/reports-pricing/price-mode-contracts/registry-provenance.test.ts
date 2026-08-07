import { describe, expect, test } from 'bun:test'
import { getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader'
import type { JsonObject, ModelRegistry, RegistryModelRecord } from '~/types'
import { isRecord } from './shared'

const PRICING_PROVENANCE_FIELDS = [
  'pricingSourceUrl',
  'pricingCurrency',
  'pricingTier',
  'pricingNotes'
] as const

const PRICE_FIELD_NAMES = [
  'costPerHourUSD',
  'costPerHourCents',
  'costPer1kPagesUSD',
  'costPer1kPagesCents',
  'costPer1kOutputCharsUSD',
  'costPer1kOutputCharsCents',
  'costPerMInputTokensUSD',
  'costPerMInputTokensCents',
  'costPerMCachedInputTokensUSD',
  'costPerMCachedInputTokensCents',
  'costPerMOutputTokensUSD',
  'costPerMOutputTokensCents',
  'inputCostPer1MUSD',
  'inputCostPer1MCents',
  'cachedInputCostPer1MUSD',
  'cachedInputCostPer1MCents',
  'outputCostPer1MUSD',
  'outputCostPer1MCents',
  'costPer1kCharsUSD',
  'costPer1kCharsCents',
  'inputCostPer1MCharsUSD',
  'inputCostPer1MCharsCents',
  'outputCostPer1MCharsUSD',
  'outputCostPer1MCharsCents',
  'costPerImageUSD',
  'costPerImageCents',
  'costPerTrackUSD',
  'costPerTrackCents',
  'costPerMinuteUSD',
  'costPerMinuteCents',
  'lyricsCostPerTrackUSD',
  'lyricsCostPerTrackCents',
  'baseCostPerSecondUSD',
  'baseCostPerSecondCents',
  'baseJobFeeUSD',
  'baseJobFeeCents',
  'blockCost720pUSD',
  'blockCost720pCents',
  'blockCost1080pUSD',
  'blockCost1080pCents',
  'inputImageCostUSD',
  'inputImageCostCents',
  'inputVideoCostPerSecondUSD',
  'inputVideoCostPerSecondCents'
] as const

const USD_CENTS_FIELD_PAIRS = [
  ['costPerHourUSD', 'costPerHourCents'],
  ['costPer1kPagesUSD', 'costPer1kPagesCents'],
  ['costPer1kOutputCharsUSD', 'costPer1kOutputCharsCents'],
  ['costPerMInputTokensUSD', 'costPerMInputTokensCents'],
  ['costPerMCachedInputTokensUSD', 'costPerMCachedInputTokensCents'],
  ['costPerMOutputTokensUSD', 'costPerMOutputTokensCents'],
  ['inputCostPer1MUSD', 'inputCostPer1MCents'],
  ['cachedInputCostPer1MUSD', 'cachedInputCostPer1MCents'],
  ['outputCostPer1MUSD', 'outputCostPer1MCents'],
  ['costPer1kCharsUSD', 'costPer1kCharsCents'],
  ['inputCostPer1MCharsUSD', 'inputCostPer1MCharsCents'],
  ['outputCostPer1MCharsUSD', 'outputCostPer1MCharsCents'],
  ['costPerImageUSD', 'costPerImageCents'],
  ['costPerTrackUSD', 'costPerTrackCents'],
  ['costPerMinuteUSD', 'costPerMinuteCents'],
  ['lyricsCostPerTrackUSD', 'lyricsCostPerTrackCents'],
  ['baseCostPerSecondUSD', 'baseCostPerSecondCents'],
  ['baseJobFeeUSD', 'baseJobFeeCents'],
  ['blockCost720pUSD', 'blockCost720pCents'],
  ['blockCost1080pUSD', 'blockCost1080pCents'],
  ['inputImageCostUSD', 'inputImageCostCents'],
  ['inputVideoCostPerSecondUSD', 'inputVideoCostPerSecondCents']
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

const collectUsdCentsMismatches = (
  entry: JsonObject,
  path: string
): string[] =>
  USD_CENTS_FIELD_PAIRS.flatMap(([usdField, centsField]) => {
    const usd = entry[usdField]
    const cents = entry[centsField]
    if (typeof usd !== 'number' || typeof cents !== 'number') {
      return []
    }
    const expectedCents = usd * 100
    return Math.abs(expectedCents - cents) < 1e-9
      ? []
      : [`${path}: ${usdField}=${usd} but ${centsField}=${cents}`]
  })

describe('price mode contracts', () => {
  test('paid API registry entries declare pricing provenance', () => {
      const missing = getRegistryModelRecords()
        .filter(isPaidApiRegistryModel)
        .flatMap(validatePricingProvenance)

      expect(missing).toEqual([])
    })

  test('registry USD and cents pricing fields agree', () => {
      const mismatches = getRegistryModelRecords().flatMap((record) => {
        const path = `${record.step}/${record.provider}/${record.model}`
        const tokenPricingBands = record.entry['tokenPricingBands']
        const bandMismatches = Array.isArray(tokenPricingBands)
          ? tokenPricingBands.flatMap((band, index) =>
              isRecord(band)
                ? collectUsdCentsMismatches(band, `${path}.tokenPricingBands[${index}]`)
                : [`${path}.tokenPricingBands[${index}]: invalid band`]
            )
          : []

        return [
          ...collectUsdCentsMismatches(record.entry, path),
          ...bandMismatches
        ]
      })

      expect(mismatches).toEqual([])
    })
})
