import { describe, expect, test } from 'bun:test'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { collectImageTargets } from '~/cli/commands/visuals/image/image-generation-targets'
import { estimateImageCosts } from '~/cli/commands/visuals/image/image-utils/image-pricing'
import { SUPPORTED_GEMINI_IMAGE_MODELS, SUPPORTED_GROK_IMAGE_MODELS, validateGeminiImageModel, validateGrokImageModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { STANDALONE_IMAGE_PROVIDER_TARGETS } from '~/cli/flags/service-selector-normalization/provider-targets'
import { withTempImageFixture } from './shared'

describe('image model refresh contracts', () => {
  test('active Gemini and Grok registries expose the remaining model sets', () => {
    expect(SUPPORTED_GEMINI_IMAGE_MODELS as readonly string[]).toEqual([
      'gemini-nano-banana-2.1'
    ])
    expect(SUPPORTED_GROK_IMAGE_MODELS as readonly string[]).toEqual([
      'grok-imagine-image-2.0'
    ])
    expect(Object.keys(STANDALONE_IMAGE_PROVIDER_TARGETS)).toEqual([
      'gemini',
      'openai',
      'grok'
    ])
  })

  test('active image registries contain four selectors', () => {
    const targets = collectImageTargets(buildOptsFromFlags({ 'all-image': true }))
    expect(targets).toHaveLength(4)
    expect(targets.filter(target => target.service === 'openai').map(target => target.model)).toEqual(['gpt-image-2.6-flare', 'gpt-image-2.6-sunburst'])
    expect(targets.filter(target => target.service === 'grok').map(target => target.model)).toEqual(['grok-imagine-image-2.0'])
    expect(targets.filter(target => target.service === 'gemini').map(target => target.model)).toEqual(['gemini-nano-banana-2.1'])
  })

  test('retired selectors fail with refresh-report replacement guidance', () => {
    expect(() => validateGrokImageModel('grok-imagine-image')).toThrow('Use "grok-imagine-image-2.0" instead')
    expect(() => validateGrokImageModel('grok-imagine-image-quality')).toThrow('Use "grok-imagine-image-2.0" instead')
    expect(() => validateGeminiImageModel('gemini-3.1-flash-image')).toThrow('Use "gemini-nano-banana-2.1" instead')
    expect(() => validateGeminiImageModel('gemini-3-pro-image')).toThrow('Use "gemini-nano-banana-2.1" instead')
    expect(() => validateGeminiImageModel('gemini-3.1-flash-lite-image')).toThrow('Use "gemini-nano-banana-2.1" instead')
  })

  test('Gemini image targets enforce Nano Banana 2.1 size and ratio capabilities', () => {
    const allTargets = collectImageTargets(buildOptsFromFlags({ 'all-image': true }))
    expect(allTargets.filter((target) => target.service === 'gemini').map((target) => target.model)).toEqual([
      'gemini-nano-banana-2.1'
    ])

    expect(() => collectImageTargets(buildOptsFromFlags({
      'gemini-image': ['gemini-nano-banana-2.1'],
      'size': '8K'
    }))).toThrow('Supported values: 1K, 2K, 4K')
    expect(() => collectImageTargets(buildOptsFromFlags({
      'gemini-image': ['gemini-nano-banana-2.1'],
      'aspect-ratio': '1:9'
    }))).toThrow('Invalid --aspect-ratio value')

    expect(collectImageTargets(buildOptsFromFlags({
      'gemini-image': ['gemini-nano-banana-2.1'],
      'size': '1K'
    })).map((target) => target.model)).toEqual(['gemini-nano-banana-2.1'])
    withTempImageFixture('autoshow-gemini-input-limit-', (imagePath) => {
      expect(() => collectImageTargets(buildOptsFromFlags({
        'gemini-image': ['gemini-nano-banana-2.1'],
        'input': Array.from({ length: 15 }, () => imagePath)
      }))).toThrow('central image registry allows')
    })
  })

  test('Gemini Nano Banana 2.1 starting-price estimates match the registry', () => {
    expect(estimateImageCosts({ geminiImageModels: ['gemini-nano-banana-2.1'], imageSize: '1K' })[0]?.costPerImageCents).toBe(3.36)
  })
})
