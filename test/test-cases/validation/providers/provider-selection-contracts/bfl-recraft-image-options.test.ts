import { describe, expect, test } from 'bun:test'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/download-targets/build-opts-from-flags/build-options-from-flags'
import { collectImageTargets, getExpectedImageArtifactFileNames, getExpectedImageCount } from '~/cli/commands/process-steps/step-5-image/image-generation-targets'
import { withTempImageFixture, withTempImageFixtures } from './shared'

describe('provider selection contracts', () => {
  test('Recraft image options validate supported shared controls and reject edit/output flags', () => {
    const valid = buildOptsFromFlags(false, {
      'recraft-image': 'recraftv4_1_pro',
      'image-count': '6',
      'image-size': '2560x1664'
    })
    expect(collectImageTargets(valid).map((target) => `${target.service}:${target.model}`)).toEqual([
      'recraft:recraftv4_1_pro'
    ])
    expect(getExpectedImageCount(collectImageTargets(valid)[0]!, valid)).toBe(6)
    expect(getExpectedImageArtifactFileNames(collectImageTargets(valid)[0]!, valid, true)).toEqual([
      'generated-image.png',
      'generated-image-2.png',
      'generated-image-3.png',
      'generated-image-4.png',
      'generated-image-5.png',
      'generated-image-6.png'
    ])

    expect(() => collectImageTargets(buildOptsFromFlags(false, {
      'recraft-image': 'recraftv4_1',
      'image-count': '7'
    }))).toThrow('Supported range: 1-6')
    expect(() => collectImageTargets(buildOptsFromFlags(false, {
      'recraft-image': 'recraftv4_1',
      'image-size': '1024x1024',
      'image-aspect-ratio': '1:1'
    }))).toThrow('cannot be used together')
    expect(() => collectImageTargets(buildOptsFromFlags(false, {
      'recraft-image': 'recraftv4_1',
      'image-size': '1024x1024'
    }))).not.toThrow()
    expect(() => collectImageTargets(buildOptsFromFlags(false, {
      'recraft-image': 'recraftv4_1_vector'
    }))).toThrow('Invalid model "recraftv4_1_vector" for --provider/--image recraft[=model]')
    expect(() => collectImageTargets(buildOptsFromFlags(false, {
      'recraft-image': 'recraftv4_1',
      'image-input': ['reference.png']
    }))).toThrow('--image-input')
    expect(() => collectImageTargets(buildOptsFromFlags(false, {
      'recraft-image': 'recraftv4_1',
      'image-format': 'webp'
    }))).toThrow('--image-format')
  })

  test('BFL accepts newly mapped shared image options', () => {
    withTempImageFixture('autoshow-image-provider-flags-', (imagePath) => {
      const bflOpts = buildOptsFromFlags(false, {
        'bfl-image': ['flux-2-pro'],
        'image-input': [imagePath]
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
      const createOpts = buildOptsFromFlags(false, {
        'lumalabs-image': ['uni-1'],
        'image-aspect-ratio': '16:9',
        'image-format': 'png'
      })
      const createTargets = collectImageTargets(createOpts)
      expect(createTargets.map((target) => `${target.service}:${target.model}`)).toEqual(['lumalabs:uni-1'])
      expect(getExpectedImageArtifactFileNames(createTargets[0]!, createOpts, true)).toEqual(['generated-image.png'])

      const editOpts = buildOptsFromFlags(false, {
        'lumalabs-image': ['uni-1-max'],
        'image-input': [firstRef, secondRef],
        'image-format': 'jpeg'
      })
      expect(collectImageTargets(editOpts).map((target) => `${target.service}:${target.model}`)).toEqual(['lumalabs:uni-1-max'])
      expect(getExpectedImageArtifactFileNames(collectImageTargets(editOpts)[0]!, editOpts, true)).toEqual(['generated-image.jpg'])

      for (const [flag, value] of [
        ['image-aspect-ratio', '21:9'],
        ['image-format', 'gif']
      ] as const) {
        const opts = buildOptsFromFlags(false, {
          'lumalabs-image': ['uni-1'],
          [flag]: value
        })
        expect(() => collectImageTargets(opts)).toThrow(`Invalid --${flag} value "${value}" for Luma Labs`)
      }

      for (const [flag, value] of [
        ['image-size', '1024x1024'],
        ['image-count', '2'],
        ['image-quality', 'high'],
        ['image-background', 'transparent'],
        ['image-compression', '80'],
        ['image-response-mode', 'text-image'],
        ['image-search-grounding', true]
      ] as const) {
        const opts = buildOptsFromFlags(false, {
          'lumalabs-image': ['uni-1'],
          [flag]: value
        })
        expect(() => collectImageTargets(opts)).toThrow('not supported by Luma Labs/uni-1')
      }

      const tooManyInputs = buildOptsFromFlags(false, {
        'lumalabs-image': ['uni-1'],
        'image-input': Array.from({ length: 10 }, () => firstRef)
      })
      expect(() => collectImageTargets(tooManyInputs)).toThrow('--image-input supports at most 9 reference images for Luma Labs/uni-1')
    })
  })

  test('Replicate image options validate per-model-family controls', () => {
    withTempImageFixtures('autoshow-replicate-image-input-', ({ firstRef, secondRef }) => {
      const seedream45 = buildOptsFromFlags(false, {
        'replicate-image': ['bytedance/seedream-4.5'],
        'image-input': [firstRef],
        'image-size': '1536x1024',
        'image-aspect-ratio': '16:9'
      })
      const seedream45Targets = collectImageTargets(seedream45)
      expect(seedream45Targets.map((target) => `${target.service}:${target.model}`)).toEqual([
        'replicate:bytedance/seedream-4.5'
      ])
      expect(getExpectedImageArtifactFileNames(seedream45Targets[0]!, seedream45, true)).toEqual([
        'generated-image.jpg'
      ])

      const seedream5Lite = buildOptsFromFlags(false, {
        'replicate-image': ['bytedance/seedream-5-lite'],
        'image-format': 'jpeg',
        'image-size': '3K'
      })
      const seedream5LiteTargets = collectImageTargets(seedream5Lite)
      expect(getExpectedImageArtifactFileNames(seedream5LiteTargets[0]!, seedream5Lite, true)).toEqual([
        'generated-image.jpg'
      ])

      const qwen = buildOptsFromFlags(false, {
        'replicate-image': ['qwen/qwen-image-2'],
        'image-input': [firstRef],
        'image-aspect-ratio': '1:1'
      })
      const qwenTargets = collectImageTargets(qwen)
      expect(qwenTargets.map((target) => `${target.service}:${target.model}`)).toEqual([
        'replicate:qwen/qwen-image-2'
      ])
      expect(getExpectedImageArtifactFileNames(qwenTargets[0]!, qwen, true)).toEqual([
        'generated-image.png'
      ])

      const wan = buildOptsFromFlags(false, {
        'replicate-image': ['wan-video/wan-2.7-image'],
        'image-input': [firstRef, secondRef],
        'image-size': '1920x1080',
        'image-count': '4'
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

      expect(() => collectImageTargets(buildOptsFromFlags(false, {
        'replicate-image': ['bytedance/seedream-4.5'],
        'image-count': '2'
      }))).toThrow('--image-count is supported only by Replicate Wan and ERNIE image models')
      expect(() => collectImageTargets(buildOptsFromFlags(false, {
        'replicate-image': ['bytedance/seedream-4.5'],
        'image-format': 'webp'
      }))).toThrow('--image-format is supported only by Replicate Seedream 5 and ERNIE image models')
      expect(() => collectImageTargets(buildOptsFromFlags(false, {
        'replicate-image': ['bytedance/seedream-5-lite'],
        'image-size': '1536x1024'
      }))).toThrow('Supported values: 2K or 3K')
      expect(() => collectImageTargets(buildOptsFromFlags(false, {
        'replicate-image': ['qwen/qwen-image-2'],
        'image-input': [firstRef, secondRef]
      }))).toThrow('--image-input supports at most 1 reference images for Replicate/qwen/qwen-image-2')
      expect(() => collectImageTargets(buildOptsFromFlags(false, {
        'replicate-image': ['qwen/qwen-image-2'],
        'image-size': '1024x1024'
      }))).toThrow('Use --image-aspect-ratio for Replicate Qwen image dimensions')
      expect(() => collectImageTargets(buildOptsFromFlags(false, {
        'replicate-image': ['wan-video/wan-2.7-image'],
        'image-aspect-ratio': '16:9'
      }))).toThrow('Use --image-size 1K|2K|4K or WIDTHxHEIGHT')
      expect(() => collectImageTargets(buildOptsFromFlags(false, {
        'replicate-image': ['wan-video/wan-2.7-image'],
        'image-count': '5'
      }))).toThrow('Supported range: 1-4')

      const seedream5Pro = buildOptsFromFlags(false, {
        'replicate-image': ['bytedance/seedream-5-pro'],
        'image-input': [firstRef, secondRef],
        'image-size': '2K',
        'image-format': 'jpeg'
      })
      expect(getExpectedImageArtifactFileNames(collectImageTargets(seedream5Pro)[0]!, seedream5Pro, true)).toEqual(['generated-image.jpg'])
      expect(() => collectImageTargets(buildOptsFromFlags(false, {
        'replicate-image': ['bytedance/seedream-5-pro'],
        'image-input': Array.from({ length: 11 }, (_, index) => `https://example.com/reference-${index}.png`)
      }))).toThrow('--image-input supports at most 10 reference images')

      const ideogram = buildOptsFromFlags(false, {
        'replicate-image': ['ideogram-ai/ideogram-v4-balanced'],
        'image-size': '2048x2048'
      })
      expect(collectImageTargets(ideogram).map((target) => target.model)).toEqual(['ideogram-ai/ideogram-v4-balanced'])
      expect(() => collectImageTargets(buildOptsFromFlags(false, {
        'replicate-image': ['ideogram-ai/ideogram-v4-turbo'],
        'image-input': [firstRef]
      }))).toThrow('text-to-image only')
      expect(() => collectImageTargets(buildOptsFromFlags(false, {
        'replicate-image': ['ideogram-ai/ideogram-v4-quality'],
        'image-size': '1024x1024'
      }))).toThrow('Supported values: 2048x2048')

      const ernie = buildOptsFromFlags(false, {
        'replicate-image': ['prunaai/ernie-image-turbo'],
        'image-size': '1264x848',
        'image-count': '4',
        'image-format': 'jpeg'
      })
      const ernieTargets = collectImageTargets(ernie)
      expect(getExpectedImageCount(ernieTargets[0]!, ernie)).toBe(4)
      expect(getExpectedImageArtifactFileNames(ernieTargets[0]!, ernie, true)).toEqual([
        'generated-image.jpg',
        'generated-image-2.jpg',
        'generated-image-3.jpg',
        'generated-image-4.jpg'
      ])
    })
  })
})
