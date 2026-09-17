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

    const openaiImage = registry.image['openai']?.models['gpt-image-2']
    const openaiRate = openaiImage?.costPerImageBySizeQualityCents?.['1024x1536']?.['high']
    expect(openaiRate).toBeDefined()
    expect(estimateImageCosts({
      openaiImageModels: ['gpt-image-2'], imageSize: '1024x1536', imageQuality: 'high'
    } as never)[0]?.costPerImageCents).toBe(openaiRate as number)

    const seedream = registry.image['replicate']?.models['bytedance/seedream-5-pro']
    const seedreamRate = seedream?.costPerImageBySizeCents?.['2K']
    expect(seedreamRate).toBeDefined()
    expect(estimateImageCosts({
      replicateImageModels: ['bytedance/seedream-5-pro'], imageSize: '2K'
    } as never)[0]?.costPerImageCents).toBe(seedreamRate as number)

    const grokVideo = registry.video['grok']?.models['grok-imagine-video-1.5']
    const base = grokVideo?.baseCostPerSecondCents
    const multiplier = grokVideo?.resolutionMultiplier1080p
    expect(base).toBeDefined()
    expect(multiplier).toBeDefined()
    expect(estimateVideoCosts({
      grokVideoModels: ['grok-imagine-video-1.5'], videoResolution: '1080p', videoDuration: 5
    } as never)[0]?.costPerSecond).toBe((base as number) * (multiplier as number))

    const falVideo = registry.video['fal']?.models['minimax/h3']
    expect(falVideo?.baseCostPerSecondCents).toBeDefined()
    expect(estimateVideoCosts({
      falVideoModels: ['minimax/h3'], videoDuration: 5
    } as never)[0]?.costPerSecond).toBe(falVideo?.baseCostPerSecondCents as number)
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
    expect(requireRegistryRate(4.5, { category: 'image', service: 'replicate', model: 'm', field: 'costPerImageCents' })).toBe(4.5)
    expect(() => requireRegistryRate(undefined, { category: 'image', service: 'replicate', model: 'm', field: 'costPerImageCents' }))
      .toThrow(/Missing costPerImageCents for replicate\/m in the image model registry/)
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
