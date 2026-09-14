import { describe, expect, test } from 'bun:test'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { collectImageTargets } from '~/cli/commands/visuals/image/image-generation-targets'
import { estimateImageCosts } from '~/cli/commands/visuals/image/image-utils/image-pricing'
import { SUPPORTED_FAL_IMAGE_MODELS, SUPPORTED_GEMINI_IMAGE_MODELS, SUPPORTED_GROK_IMAGE_MODELS, SUPPORTED_REPLICATE_IMAGE_MODELS, validateFalImageModel, validateGeminiImageModel, validateGrokImageModel, validateReplicateImageModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { STANDALONE_IMAGE_PROVIDER_TARGETS } from '~/cli/flags/service-selector-normalization/provider-targets'
import { withTempImageFixture } from './shared'

describe('image model refresh contracts', () => {
  test('active Gemini and Grok registries expose the remaining model sets', () => {
    expect(SUPPORTED_GEMINI_IMAGE_MODELS as readonly string[]).toEqual([
      'gemini-3.1-flash-lite-image'
    ])
    expect(SUPPORTED_GROK_IMAGE_MODELS as readonly string[]).toEqual([
      'grok-imagine-image-2.0'
    ])
    expect(Object.keys(STANDALONE_IMAGE_PROVIDER_TARGETS)).toEqual([
      'gemini',
      'openai',
      'grok',
      'replicate',
      'lumalabs',
      'fal'
    ])
  })

  test('active image registries contain 14 selectors after retirement', () => {
    expect(SUPPORTED_REPLICATE_IMAGE_MODELS as readonly string[]).toEqual([
      'bytedance/seedream-5-lite',
      'bytedance/seedream-5-pro',
      'alibaba/qwen-image-3',
      'alibaba/qwen-image-3-pro'
    ])
    expect(SUPPORTED_FAL_IMAGE_MODELS).toEqual([
      'fal-ai/hidream-o1-image',
      'alibaba/qwen-image-3',
      'reve/2.1'
    ])
    const targets = collectImageTargets(buildOptsFromFlags({ 'all-image': true }))
    expect(targets).toHaveLength(14)
    expect(targets.filter(target => target.service === 'grok').map(target => target.model)).toEqual(['grok-imagine-image-2.0'])
    expect(targets.filter(target => target.service === 'gemini').map(target => target.model)).toEqual(['gemini-3.1-flash-lite-image'])
  })

  test('retired selectors fail with refresh-report replacement guidance', () => {
    expect(() => validateGrokImageModel('grok-imagine-image')).toThrow('Use "grok-imagine-image-2.0" instead')
    expect(() => validateGrokImageModel('grok-imagine-image-quality')).toThrow('Use "grok-imagine-image-2.0" instead')
    expect(() => validateGeminiImageModel('gemini-3.1-flash-image')).toThrow('Use "gemini-3.1-flash-lite-image" instead')
    expect(() => validateGeminiImageModel('gemini-3-pro-image')).toThrow('Use "gemini-3.1-flash-lite-image" instead')
    expect(() => validateFalImageModel('microsoft/mai-image-2.5-pro')).toThrow('Use "alibaba/qwen-image-3" instead')
    expect(() => validateReplicateImageModel('ideogram-ai/ideogram-v4-quality')).toThrow('Use "bytedance/seedream-5-lite" instead')
    expect(() => validateReplicateImageModel('prunaai/ernie-image')).toThrow('Use "alibaba/qwen-image-3" instead')
    expect(() => validateReplicateImageModel('qwen/qwen-image-2')).toThrow('Use "alibaba/qwen-image-3" instead')
    expect(() => validateReplicateImageModel('qwen/qwen-image-2-pro')).toThrow('Use "alibaba/qwen-image-3-pro" instead')
    expect(() => validateReplicateImageModel('bytedance/seedream-4.5')).toThrow('Use "bytedance/seedream-5-lite" instead')
    expect(() => validateReplicateImageModel('wan-video/wan-2.7-image')).toThrow('Use "bytedance/seedream-5-lite" instead')
    expect(() => validateReplicateImageModel('wan-video/wan-2.7-image-pro')).toThrow('Use "bytedance/seedream-5-lite" instead')
  })

  test('Gemini image targets enforce Lite size capabilities', () => {
    const allTargets = collectImageTargets(buildOptsFromFlags({ 'all-image': true }))
    expect(allTargets.filter((target) => target.service === 'gemini').map((target) => target.model)).toEqual([
      'gemini-3.1-flash-lite-image'
    ])

    expect(() => collectImageTargets(buildOptsFromFlags({
      'gemini-image': ['gemini-3.1-flash-lite-image'],
      'size': '2K'
    }))).toThrow('Supported values: 1K')
    expect(() => collectImageTargets(buildOptsFromFlags({
      'gemini-image': ['gemini-3.1-flash-lite-image'],
      'aspect-ratio': '1:8'
    }))).toThrow('Invalid --aspect-ratio value')

    expect(collectImageTargets(buildOptsFromFlags({
      'gemini-image': ['gemini-3.1-flash-lite-image'],
      'size': '1K'
    })).map((target) => target.model)).toEqual(['gemini-3.1-flash-lite-image'])
    withTempImageFixture('autoshow-gemini-input-limit-', (imagePath) => {
      expect(() => collectImageTargets(buildOptsFromFlags({
        'gemini-image': ['gemini-3.1-flash-lite-image'],
        'input': Array.from({ length: 15 }, () => imagePath)
      }))).toThrow('central image registry allows')
    })
  })

  test('Gemini lite starting-price estimates match the registry', () => {
    expect(estimateImageCosts({ geminiImageModels: ['gemini-3.1-flash-lite-image'], imageSize: '1K' })[0]?.costPerImageCents).toBe(3.36)
    expect(estimateImageCosts({ replicateImageModels: ['bytedance/seedream-5-pro'], imageSize: '1K' })[0]?.costPerImageCents).toBe(4.5)
    expect(estimateImageCosts({ replicateImageModels: ['bytedance/seedream-5-pro'], imageSize: '2K' })[0]?.costPerImageCents).toBe(9)
  })
})
