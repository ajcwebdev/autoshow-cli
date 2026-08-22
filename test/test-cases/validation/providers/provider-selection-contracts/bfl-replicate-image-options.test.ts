import { describe, expect, test } from 'bun:test'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { collectImageTargets, getExpectedImageArtifactFileNames, getExpectedImageCount } from '~/cli/commands/process-steps/step-5-image/image-generation-targets'
import { withTempImageFixture, withTempImageFixtures } from './shared'

describe('provider selection contracts', () => {
  test('BFL accepts newly mapped shared image options', () => {
    withTempImageFixture('autoshow-image-provider-flags-', (imagePath) => {
      const bflOpts = buildOptsFromFlags({
        'bfl-image': ['flux-2-pro'],
        'input': [imagePath]
      })
      const bflTargets = collectImageTargets(bflOpts)
      expect(bflTargets.map((target) => `${target.service}:${target.model}`)).toEqual([
        'bfl:flux-2-pro'
      ])
      expect(getExpectedImageCount(bflTargets[0]!, bflOpts)).toBe(1)
      expect(getExpectedImageArtifactFileNames(bflTargets[0]!, bflOpts, true)).toEqual(['generated-image.jpg'])
    })
  })

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
        ['response-mode', 'text-image'],
        ['search-grounding', true]
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
      const seedream45 = buildOptsFromFlags({
        'replicate-image': ['bytedance/seedream-4.5'],
        'input': [firstRef],
        'size': '1536x1024',
        'aspect-ratio': '16:9'
      })
      const seedream45Targets = collectImageTargets(seedream45)
      expect(seedream45Targets.map((target) => `${target.service}:${target.model}`)).toEqual([
        'replicate:bytedance/seedream-4.5'
      ])
      expect(getExpectedImageArtifactFileNames(seedream45Targets[0]!, seedream45, true)).toEqual([
        'generated-image.jpg'
      ])

      const seedream5Lite = buildOptsFromFlags({
        'replicate-image': ['bytedance/seedream-5-lite'],
        'format': 'jpeg',
        'size': '3K'
      })
      const seedream5LiteTargets = collectImageTargets(seedream5Lite)
      expect(getExpectedImageArtifactFileNames(seedream5LiteTargets[0]!, seedream5Lite, true)).toEqual([
        'generated-image.jpg'
      ])

      const qwen = buildOptsFromFlags({
        'replicate-image': ['qwen/qwen-image-2'],
        'input': [firstRef],
        'aspect-ratio': '1:1'
      })
      const qwenTargets = collectImageTargets(qwen)
      expect(qwenTargets.map((target) => `${target.service}:${target.model}`)).toEqual([
        'replicate:qwen/qwen-image-2'
      ])
      expect(getExpectedImageArtifactFileNames(qwenTargets[0]!, qwen, true)).toEqual([
        'generated-image.png'
      ])

      const wan = buildOptsFromFlags({
        'replicate-image': ['wan-video/wan-2.7-image'],
        'input': [firstRef, secondRef],
        'size': '1920x1080',
        'count': '4'
      })
      const wanTargets = collectImageTargets(wan)
      expect(wanTargets.map((target) => `${target.service}:${target.model}`)).toEqual([
        'replicate:wan-video/wan-2.7-image'
      ])
      expect(getExpectedImageCount(wanTargets[0]!, wan)).toBe(4)
      expect(getExpectedImageArtifactFileNames(wanTargets[0]!, wan, true)).toEqual([
        'generated-image.png',
        'generated-image-2.png',
        'generated-image-3.png',
        'generated-image-4.png'
      ])

      expect(() => collectImageTargets(buildOptsFromFlags({
        'replicate-image': ['bytedance/seedream-4.5'],
        'count': '2'
      }))).toThrow('--count is supported only by Replicate Wan image models')
      expect(() => collectImageTargets(buildOptsFromFlags({
        'replicate-image': ['bytedance/seedream-4.5'],
        'format': 'webp'
      }))).toThrow('--format is supported only by Replicate Seedream 5 image models')
      expect(() => collectImageTargets(buildOptsFromFlags({
        'replicate-image': ['bytedance/seedream-5-lite'],
        'size': '1536x1024'
      }))).toThrow('Supported values: 2K or 3K')
      expect(() => collectImageTargets(buildOptsFromFlags({
        'replicate-image': ['qwen/qwen-image-2'],
        'input': [firstRef, secondRef]
      }))).toThrow('--input supports at most 1 reference images for Replicate/qwen/qwen-image-2')
      expect(() => collectImageTargets(buildOptsFromFlags({
        'replicate-image': ['qwen/qwen-image-2'],
        'size': '1024x1024'
      }))).toThrow('Use --aspect-ratio for Replicate Qwen image dimensions')
      expect(() => collectImageTargets(buildOptsFromFlags({
        'replicate-image': ['wan-video/wan-2.7-image'],
        'aspect-ratio': '16:9'
      }))).toThrow('Use --size 1K|2K|4K or WIDTHxHEIGHT')
      expect(() => collectImageTargets(buildOptsFromFlags({
        'replicate-image': ['wan-video/wan-2.7-image'],
        'count': '5'
      }))).toThrow('Supported range: 1-4')

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
