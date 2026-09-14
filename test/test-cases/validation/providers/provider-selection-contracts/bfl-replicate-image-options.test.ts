import { describe, expect, test } from 'bun:test'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { collectImageTargets, getExpectedImageArtifactFileNames, getExpectedImageCount } from '~/cli/commands/visuals/image/image-generation-targets'
import { withTempImageFixtures } from './shared'

describe('provider selection contracts', () => {
  test('Luma Labs accepts matching shared image options and rejects unsupported ones', () => {
    withTempImageFixtures('autoshow-lumalabs-image-input-', ({ firstRef, secondRef }) => {
      const createOpts = buildOptsFromFlags({
        'lumalabs-image': ['uni-1'],
        'aspect-ratio': '16:9',
        'format': 'png'
      })
      const createTargets = collectImageTargets(createOpts)
      expect(createTargets.map((target) => `${target.service}:${target.model}`)).toEqual(['lumalabs:uni-1'])
      expect(getExpectedImageArtifactFileNames(createTargets[0]!, createOpts, true)).toEqual(['generated-image.png'])

      const editOpts = buildOptsFromFlags({
        'lumalabs-image': ['uni-1-max'],
        'input': [firstRef, secondRef],
        'format': 'jpeg'
      })
      expect(collectImageTargets(editOpts).map((target) => `${target.service}:${target.model}`)).toEqual(['lumalabs:uni-1-max'])
      expect(getExpectedImageArtifactFileNames(collectImageTargets(editOpts)[0]!, editOpts, true)).toEqual(['generated-image.jpg'])

      for (const [flag, value] of [
        ['aspect-ratio', '21:9'],
        ['format', 'gif']
      ] as const) {
        const opts = buildOptsFromFlags({
          'lumalabs-image': ['uni-1'],
          [flag]: value
        })
        expect(() => collectImageTargets(opts)).toThrow(`Invalid --${flag} value "${value}" for Luma Labs`)
      }

      for (const [flag, value] of [
        ['size', '1024x1024'],
        ['count', '2'],
        ['quality', 'high'],
        ['background', 'transparent'],
        ['compression', '80'],
        ['response-mode', 'text-image']
      ] as const) {
        const opts = buildOptsFromFlags({
          'lumalabs-image': ['uni-1'],
          [flag]: value
        })
        expect(() => collectImageTargets(opts)).toThrow('not supported by Luma Labs/uni-1')
      }

      const tooManyInputs = buildOptsFromFlags({
        'lumalabs-image': ['uni-1'],
        'input': Array.from({ length: 10 }, () => firstRef)
      })
      expect(() => collectImageTargets(tooManyInputs)).toThrow('--input supports at most 9 reference images for Luma Labs/uni-1')
    })
  })

  test('Replicate image options validate per-model-family controls', () => {
    withTempImageFixtures('autoshow-replicate-image-input-', ({ firstRef, secondRef }) => {
      const seedream5Lite = buildOptsFromFlags({
        'replicate-image': ['bytedance/seedream-5-lite'],
        'format': 'jpeg',
        'size': '3K'
      })
      const seedream5LiteTargets = collectImageTargets(seedream5Lite)
      expect(seedream5LiteTargets.map((target) => `${target.service}:${target.model}`)).toEqual([
        'replicate:bytedance/seedream-5-lite'
      ])
      expect(getExpectedImageArtifactFileNames(seedream5LiteTargets[0]!, seedream5Lite, true)).toEqual([
        'generated-image.jpg'
      ])

      const qwen = buildOptsFromFlags({
        'replicate-image': ['alibaba/qwen-image-3'],
        'input': [firstRef],
        'aspect-ratio': '1:1'
      })
      const qwenTargets = collectImageTargets(qwen)
      expect(qwenTargets.map((target) => `${target.service}:${target.model}`)).toEqual([
        'replicate:alibaba/qwen-image-3'
      ])
      expect(getExpectedImageCount(qwenTargets[0]!, qwen)).toBe(1)
      expect(getExpectedImageArtifactFileNames(qwenTargets[0]!, qwen, true)).toEqual([
        'generated-image.png'
      ])

      expect(() => collectImageTargets(buildOptsFromFlags({
        'replicate-image': ['bytedance/seedream-5-lite'],
        'count': '2'
      }))).toThrow('--count is not supported by Replicate/bytedance/seedream-5-lite. Omit --count.')
      expect(() => collectImageTargets(buildOptsFromFlags({
        'replicate-image': ['alibaba/qwen-image-3'],
        'format': 'webp'
      }))).toThrow('--format is supported only by Replicate Seedream 5 image models')
      expect(() => collectImageTargets(buildOptsFromFlags({
        'replicate-image': ['bytedance/seedream-5-lite'],
        'size': '1536x1024'
      }))).toThrow('Supported values: 2K or 3K')
      expect(() => collectImageTargets(buildOptsFromFlags({
        'replicate-image': ['alibaba/qwen-image-3'],
        'input': [firstRef, secondRef]
      }))).toThrow('--input supports at most 1 reference images for Replicate/alibaba/qwen-image-3')
      expect(() => collectImageTargets(buildOptsFromFlags({
        'replicate-image': ['alibaba/qwen-image-3'],
        'size': '1024x1024'
      }))).toThrow('Use --aspect-ratio for Replicate Qwen image dimensions')

      const seedream5Pro = buildOptsFromFlags({
        'replicate-image': ['bytedance/seedream-5-pro'],
        'input': [firstRef, secondRef],
        'size': '2K',
        'format': 'jpeg'
      })
      expect(getExpectedImageArtifactFileNames(collectImageTargets(seedream5Pro)[0]!, seedream5Pro, true)).toEqual(['generated-image.jpg'])
      expect(() => collectImageTargets(buildOptsFromFlags({
        'replicate-image': ['bytedance/seedream-5-pro'],
        'input': Array.from({ length: 11 }, (_, index) => `https://example.com/reference-${index}.png`)
      }))).toThrow('--input supports at most 10 reference images')

    })
  })
})
