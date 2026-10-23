import { describe, expect, test } from 'bun:test'
import { estimateImageCosts } from '~/cli/commands/visuals/image/image-utils/image-pricing'
import { estimateVideoCosts } from '~/cli/commands/visuals/video/video-utils/video-pricing'
import { getModelRegistry, RETIRED_MODEL_RATES } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { RetiredModelRatesSchema } from '~/cli/commands/setup-and-utilities/models/model-loader/model-loader-schemas'
import { requireRegistryRate } from '~/utils/pricing/registry-rate'
import { validateData } from '~/utils/validate/validation'

const EMPTY_RETIRED_RATES = { stt: {}, extract: {}, llm: {}, tts: {}, image: {}, music: {}, video: {} }

describe('registry rate source contracts', () => {
  test('image and video estimators quote the JSON registry rate, not a hardcoded copy', () => {
    const registry = getModelRegistry()

    const grokImage = registry.image['grok']?.models['grok-imagine-image-2.0']
    const grokImageRate = grokImage?.costPerImageBySizeQualityCents?.['2k']?.['medium']
    expect(grokImageRate).toBeDefined()
    expect(estimateImageCosts({
      grokImageModels: ['grok-imagine-image-2.0'], imageSize: '2K', imageQuality: 'medium'
    } as never)[0]?.costPerImageCents).toBe(grokImageRate as number)

    const geminiImage = registry.image['gemini']?.models['gemini-3.1-flash-lite-image']
    const geminiRate = geminiImage?.costPerImageBySizeCents?.['1K']
    expect(geminiRate).toBeDefined()
    expect(estimateImageCosts({
      geminiImageModels: ['gemini-3.1-flash-lite-image'], imageSize: '1K'
    } as never)[0]?.costPerImageCents).toBe(geminiRate as number)

    const grokVideo = registry.video['grok']?.models['grok-imagine-video-1.5']
    const base = grokVideo?.baseCostPerSecondCents
    const multiplier = grokVideo?.resolutionMultiplier1080p
    expect(base).toBeDefined()
    expect(multiplier).toBeDefined()
    expect(estimateVideoCosts({
      grokVideoModels: ['grok-imagine-video-1.5'], videoResolution: '1080p', videoDuration: 5
    } as never)[0]?.costPerSecond).toBe((base as number) * (multiplier as number))

    const geminiVideo = registry.video['gemini']?.models['gemini-omni-1.1-flash']
    const geminiPerSecond = geminiVideo?.costPerSecondByResolutionCents?.['720p']
    expect(geminiPerSecond).toBeDefined()
    expect(estimateVideoCosts({
      geminiVideoModels: ['gemini-omni-1.1-flash'], videoResolution: '720p', videoDuration: 5
    } as never)[0]?.costPerSecond).toBe(geminiPerSecond as number)
  })

  test('image and video pricing modules carry no hardcoded registry-rate fallbacks', async () => {
    const offenders: string[] = []
    for (const file of [
      'src/cli/commands/visuals/image/image-utils/image-pricing.ts',
      'src/cli/commands/visuals/video/video-utils/video-pricing.ts'
    ]) {
      const source = await Bun.file(file).text()
      for (const [index, line] of source.split('\n').entries()) {
        // A numeric literal defaulting a registry lookup is a second source of truth for a provider rate.
        if (/(meta|pricing|Meta)\??\.[A-Za-z0-9_?.[\]'"`]*\s*\?\?\s*-?\d/.test(line)) {
          offenders.push(`${file}:${index + 1}: ${line.trim()}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  test('requireRegistryRate fails loudly instead of quoting a stale number', () => {
    expect(requireRegistryRate(4.5, { category: 'image', service: 'grok', model: 'm', field: 'costPerImageCents' })).toBe(4.5)
    expect(() => requireRegistryRate(undefined, { category: 'image', service: 'grok', model: 'm', field: 'costPerImageCents' }))
      .toThrow(/Missing costPerImageCents for grok\/m in the image model registry/)
  })

  test('retired model rates validate against the live registry schemas', () => {
    expect(() => validateData(RetiredModelRatesSchema, RETIRED_MODEL_RATES, 'retired model rates')).not.toThrow()

    expect(() => validateData(RetiredModelRatesSchema, {
      ...EMPTY_RETIRED_RATES, stt: { 'acme:v1': { costPerHourrCents: 1 } }
    }, 'retired model rates')).toThrow(/costPerHourrCents/)

    expect(() => validateData(RetiredModelRatesSchema, {
      ...EMPTY_RETIRED_RATES, llm: { 'acme:v1': { inputCostPer1MCents: '95' } }
    }, 'retired model rates')).toThrow(/inputCostPer1MCents/)

    // Category-specific field names must not leak across categories.
    expect(() => validateData(RetiredModelRatesSchema, {
      ...EMPTY_RETIRED_RATES, image: { 'acme:v1': { costPerHourCents: 1 } }
    }, 'retired model rates')).toThrow(/costPerHourCents/)

    expect(() => validateData(RetiredModelRatesSchema, {
      ...EMPTY_RETIRED_RATES, stt: { 'acme:v1': { costPerHourCents: 1 } }
    }, 'retired model rates')).not.toThrow()
  })
})
