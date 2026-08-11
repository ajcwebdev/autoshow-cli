import { describe, expect, test } from 'bun:test'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { collectImageTargets } from '~/cli/commands/process-steps/step-5-image/image-generation-targets'
import { estimateImageCosts } from '~/cli/commands/process-steps/step-5-image/image-utils/image-pricing'
import { SUPPORTED_BFL_IMAGE_MODELS, SUPPORTED_FAL_IMAGE_MODELS, SUPPORTED_GEMINI_IMAGE_MODELS, SUPPORTED_REPLICATE_IMAGE_MODELS } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { withTempImageFixture } from './shared'

describe('image model refresh contracts', () => {
  test('active Gemini and BFL registries expose the refreshed model sets', () => {
    expect(SUPPORTED_GEMINI_IMAGE_MODELS).toEqual([
      'gemini-3.1-flash-lite-image',
      'gemini-3.1-flash-image',
      'gemini-3-pro-image'
    ])
    expect(SUPPORTED_BFL_IMAGE_MODELS).toEqual([
      'flux-2-klein-4b',
      'flux-2-klein-9b',
      'flux-2-pro',
      'flux-2-max',
      'flux-2-flex'
    ])
  })

  test('Replicate registry includes all selected current image models', () => {
    expect(SUPPORTED_REPLICATE_IMAGE_MODELS).toEqual([
      'bytedance/seedream-4.5',
      'bytedance/seedream-5-lite',
      'bytedance/seedream-5-pro',
      'ideogram-ai/ideogram-v4-turbo',
      'ideogram-ai/ideogram-v4-balanced',
      'ideogram-ai/ideogram-v4-quality',
      'prunaai/ernie-image',
      'prunaai/ernie-image-turbo',
      'qwen/qwen-image-2-pro',
      'qwen/qwen-image-2',
      'wan-video/wan-2.7-image-pro',
      'wan-video/wan-2.7-image'
    ])
  })

  test('fal.ai registry includes all selected current image models', () => {
    expect(SUPPORTED_FAL_IMAGE_MODELS).toEqual([
      'fal-ai/hidream-o1-image',
      'microsoft/mai-image-2.5',
      'microsoft/mai-image-2.5-pro',
      'alibaba/qwen-image-3',
      'reve/2.1'
    ])
  })

  test('Gemini image targets enforce Lite size and grounding capabilities', () => {
    const allTargets = collectImageTargets(buildOptsFromFlags(false, { 'all-image': true }))
    expect(allTargets.filter((target) => target.service === 'gemini').map((target) => target.model)).toEqual([
      'gemini-3.1-flash-lite-image',
      'gemini-3.1-flash-image',
      'gemini-3-pro-image'
    ])

    expect(() => collectImageTargets(buildOptsFromFlags(false, {
      'gemini-image': ['gemini-3.1-flash-lite-image'],
      'image-size': '2K'
    }))).toThrow('Supported value: 1K')
    expect(() => collectImageTargets(buildOptsFromFlags(false, {
      'gemini-image': ['gemini-3.1-flash-lite-image'],
      'image-search-grounding': true
    }))).toThrow('Use gemini-3.1-flash-image or gemini-3-pro-image')
    expect(() => collectImageTargets(buildOptsFromFlags(false, {
      'gemini-image': ['gemini-3.1-flash-lite-image'],
      'image-aspect-ratio': '1:8'
    }))).toThrow('Invalid --image-aspect-ratio value')

    expect(collectImageTargets(buildOptsFromFlags(false, {
      'gemini-image': ['gemini-3.1-flash-image', 'gemini-3-pro-image'],
      'image-size': '4K',
      'image-search-grounding': true
    })).map((target) => target.model)).toEqual(['gemini-3.1-flash-image', 'gemini-3-pro-image'])
    expect(collectImageTargets(buildOptsFromFlags(false, {
      'gemini-image': ['gemini-3.1-flash-image'],
      'image-aspect-ratio': '1:8'
    }))).toHaveLength(1)
    withTempImageFixture('autoshow-gemini-input-limit-', (imagePath) => {
      expect(() => collectImageTargets(buildOptsFromFlags(false, {
        'gemini-image': ['gemini-3-pro-image'],
        'image-input': Array.from({ length: 15 }, () => imagePath)
      }))).toThrow('central image registry allows 14')
    })
  })

  test('Klein targets accept the fixed endpoints and cap references at four', () => {
    expect(collectImageTargets(buildOptsFromFlags(false, {
      'bfl-image': ['flux-2-klein-4b', 'flux-2-klein-9b']
    })).map((target) => target.model)).toEqual(['flux-2-klein-4b', 'flux-2-klein-9b'])

    withTempImageFixture('autoshow-klein-input-limit-', (imagePath) => {
      expect(() => collectImageTargets(buildOptsFromFlags(false, {
        'bfl-image': ['flux-2-klein-4b'],
        'image-input': [imagePath, imagePath, imagePath, imagePath, imagePath]
      }))).toThrow('supports at most 4 reference images')
    })
  })

  test('Gemini resolution and Klein starting-price estimates match the registry', () => {
    expect(estimateImageCosts({ geminiImageModel: 'gemini-3.1-flash-lite-image', imageSize: '1K' })[0]?.costPerImageCents).toBe(3.36)
    expect(estimateImageCosts({ geminiImageModel: 'gemini-3.1-flash-image', imageSize: '4K' })[0]?.costPerImageCents).toBe(15.1)
    expect(estimateImageCosts({ geminiImageModel: 'gemini-3-pro-image', imageSize: '4K' })[0]?.costPerImageCents).toBe(24)
    expect(estimateImageCosts({ bflImageModel: 'flux-2-klein-4b' })[0]?.costPerImageCents).toBe(1.4)
    expect(estimateImageCosts({ bflImageModel: 'flux-2-klein-9b' })[0]?.costPerImageCents).toBe(1.5)
    expect(estimateImageCosts({ replicateImageModel: 'bytedance/seedream-5-pro', imageSize: '1K' })[0]?.costPerImageCents).toBe(4.5)
    expect(estimateImageCosts({ replicateImageModel: 'bytedance/seedream-5-pro', imageSize: '2K' })[0]?.costPerImageCents).toBe(9)
    expect(estimateImageCosts({ replicateImageModel: 'ideogram-ai/ideogram-v4-quality' })[0]?.costPerImageCents).toBe(10)
    expect(estimateImageCosts({ replicateImageModel: 'prunaai/ernie-image-turbo', imageCount: 4 })[0]?.totalCost).toBe(4.6)
  })
})
