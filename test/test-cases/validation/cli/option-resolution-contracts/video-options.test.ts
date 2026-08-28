import { describe, expect, test } from 'bun:test'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { collectVideoTargets, getVideoArtifactFileName } from '~/cli/commands/process-steps/step-6-video/video-targets'

describe('option resolution contracts', () => {
  test('Luma Labs video resolution follows the documented Ray 3.2 values', () => {
    expect(collectVideoTargets(buildOptsFromFlags({
      'lumalabs-video': 'ray-3.2',
      'resolution': '540p'
    })).map(target => target.service)).toEqual(['lumalabs'])

    expect(() => collectVideoTargets(buildOptsFromFlags({
      'lumalabs-video': 'ray-3.2',
      'resolution': '360p'
    }))).toThrow('Expected 540p, 720p, 1080p')
  })

  test('retired video selectors fail with replacement guidance', () => {
    for (const [provider, model, replacement] of [
      ['replicate', 'runwayml/aleph-2', 'grok-imagine-video'],
      ['replicate', 'wan-video/wan-2.7-t2v', 'bytedance/seedance-2.0-fast']
    ] as const) {
      expect(() => buildOptsFromFlags({
        [`${provider}-video`]: model
      })).toThrow(`Use "${replacement}" instead`)
    }
  })

  test('video mode defaults to text and validates media inputs', () => {
      const imageDataUrl = `data:image/png;base64,${Buffer.from([1, 2, 3]).toString('base64')}`
      const videoDataUrl = `data:video/mp4;base64,${Buffer.from([4, 5, 6]).toString('base64')}`

      expect(() => collectVideoTargets(buildOptsFromFlags({
        'gemini-video': 'veo-3.1-fast-generate-preview',
        'input-image': imageDataUrl
      }))).toThrow('--input-image is not valid with --mode text')

      expect(collectVideoTargets(buildOptsFromFlags({
        'gemini-video': 'veo-3.1-fast-generate-preview'
      })).map(target => target.service)).toEqual(['gemini'])

      expect(collectVideoTargets(buildOptsFromFlags({
        'gemini-video': 'veo-3.1-fast-generate-preview',
        'mode': 'image-to-video',
        'input-image': imageDataUrl
      })).map(target => target.service)).toEqual(['gemini'])

      expect(() => collectVideoTargets(buildOptsFromFlags({
        'grok-video': 'grok-imagine-video',
        'mode': 'reference-to-video',
        'reference-image': [imageDataUrl, imageDataUrl, imageDataUrl, imageDataUrl]
      }))).toThrow('--reference-image supports at most 3 images')

      expect(() => collectVideoTargets(buildOptsFromFlags({
        'gemini-video': 'veo-3.1-fast-generate-preview',
        'mode': 'interpolate',
        'input-image': imageDataUrl
      }))).toThrow('--mode interpolate requires --last-frame')

      expect(() => collectVideoTargets(buildOptsFromFlags({
        'grok-video': 'grok-imagine-video',
        'mode': 'edit',
        'input-video': videoDataUrl,
        'duration': '8'
      }))).toThrow('--duration, --aspect-ratio, and --resolution are not valid with Grok --mode edit')
    })

  test('all-video reference mode keeps compatible active targets', () => {
      const imageDataUrl = `data:image/png;base64,${Buffer.from([1, 2, 3]).toString('base64')}`
      const allReferenceTargets = collectVideoTargets(buildOptsFromFlags({
        'all-video': true,
        'mode': 'reference-to-video',
        'reference-image': imageDataUrl
      }))
      expect(allReferenceTargets.map(target => `${target.service}/${target.model}`)).toEqual([
        'gemini/veo-3.1-fast-generate-preview',
        'gemini/veo-3.1-generate-preview',
        'grok/grok-imagine-video',
        'grok/grok-imagine-video-1.5',
        'replicate/alibaba/happyhorse-1.1',
        'replicate/bytedance/seedance-2.0',
        'replicate/bytedance/seedance-2.0-fast',
        'replicate/kwaivgi/kling-v3-omni-video',
        'fal/minimax/h3',
        'fal/fal-ai/pixverse/c1'
      ])
    })

  test('Replicate video options resolve models and enforce model-specific media limits', () => {
      const imageDataUrl = `data:image/png;base64,${Buffer.from([1, 2, 3]).toString('base64')}`
      const bmpDataUrl = `data:image/bmp;base64,${Buffer.from([4, 5, 6]).toString('base64')}`
      const videoDataUrl = `data:video/mp4;base64,${Buffer.from([7, 8, 9]).toString('base64')}`
      const audioDataUrl = `data:audio/mpeg;base64,${Buffer.from([10, 11, 12]).toString('base64')}`

      const explicitOpts = buildOptsFromFlags({
        'replicate-video': ['bytedance/seedance-2.0-fast'],
        'mode': 'reference-to-video',
        'reference-image': [imageDataUrl, bmpDataUrl],
        'reference-video': [videoDataUrl],
        'reference-audio': [audioDataUrl],
        'replicate-video-seed': '123',
        'generate-audio': false,
        'duration': '-1',
        'aspect-ratio': 'adaptive'
      })
      expect(explicitOpts.replicateVideoModels).toEqual(['bytedance/seedance-2.0-fast'])
      expect(explicitOpts.replicateVideoSeed).toBe(123)
      expect(explicitOpts.videoGenerateAudio).toBe(false)
      expect(explicitOpts.videoReferenceVideos).toEqual([videoDataUrl])
      expect(explicitOpts.videoReferenceAudios).toEqual([audioDataUrl])
      expect(collectVideoTargets(explicitOpts).map(target => `${target.service}/${target.model}`)).toEqual([
        'replicate/bytedance/seedance-2.0-fast'
      ])

      expect(collectVideoTargets(buildOptsFromFlags({
        'replicate-video': 'bytedance/seedance-2.0',
        'mode': 'reference-to-video',
        'reference-image': Array.from({ length: 9 }, () => imageDataUrl)
      }))).toHaveLength(1)

      expect(() => collectVideoTargets(buildOptsFromFlags({
        'replicate-video': 'bytedance/seedance-2.0',
        'mode': 'reference-to-video',
        'reference-image': Array.from({ length: 10 }, () => imageDataUrl)
      }))).toThrow('--reference-image supports at most 9 images')

      expect(() => collectVideoTargets(buildOptsFromFlags({
        'replicate-video': 'bytedance/seedance-2.0-fast',
        'resolution': '1080p'
      }))).toThrow('Expected 480p or 720p')

      expect(() => buildOptsFromFlags({
        'replicate-video': 'wan-video/wan-2.7-t2v'
      })).toThrow('Use "bytedance/seedance-2.0-fast" instead')

      expect(() => collectVideoTargets(buildOptsFromFlags({
        'replicate-video-seed': '123'
      }))).toThrow('Replicate video flags require a Replicate video provider target')
    })

  test('LTX video media modes enforce model capability and documented size limits', () => {
      const imageDataUrl = `data:image/png;base64,${Buffer.from([1, 2, 3]).toString('base64')}`
      const lastFrameDataUrl = `data:image/webp;base64,${Buffer.from([4, 5, 6]).toString('base64')}`
      const videoDataUrl = `data:video/mp4;base64,${Buffer.from([7, 8, 9]).toString('base64')}`

      expect(collectVideoTargets(buildOptsFromFlags({
        'ltx-video': 'ltx-2-3-fast',
        'mode': 'image-to-video',
        'input-image': imageDataUrl,
        'aspect-ratio': '9:16',
        'resolution': '4k'
      })).map(target => `${target.service}/${target.model}`)).toEqual([
        'ltx/ltx-2-3-fast'
      ])

      expect(collectVideoTargets(buildOptsFromFlags({
        'ltx-video': 'ltx-2-3-pro',
        'mode': 'interpolate',
        'input-image': imageDataUrl,
        'last-frame': lastFrameDataUrl,
        'resolution': '4k',
        'aspect-ratio': '9:16'
      })).map(target => `${target.service}/${target.model}`)).toEqual([
        'ltx/ltx-2-3-pro'
      ])

      expect(collectVideoTargets(buildOptsFromFlags({
        'ltx-video': 'ltx-2-3-pro',
        'mode': 'extend',
        'input-video': videoDataUrl,
        'duration': '30'
      })).map(target => `${target.service}/${target.model}`)).toEqual([
        'ltx/ltx-2-3-pro'
      ])

      expect(() => collectVideoTargets(buildOptsFromFlags({
        'ltx-video': 'ltx-2-3-fast',
        'mode': 'extend',
        'input-video': videoDataUrl
      }))).toThrow('--mode extend is not supported by ltx/ltx-2-3-fast')

      expect(() => collectVideoTargets(buildOptsFromFlags({
        'ltx-video': 'ltx-2-3-fast',
        'aspect-ratio': '1:1'
      }))).toThrow('Expected 16:9 or 9:16')

      expect(() => collectVideoTargets(buildOptsFromFlags({
        'ltx-video': 'ltx-2-3-fast',
        'resolution': '1440p'
      }))).toThrow('Expected 1080p or 4k')
    })

  test('Gemini video media modes enforce Lite and 4k capability limits', () => {
      const imageDataUrl = `data:image/png;base64,${Buffer.from([1, 2, 3]).toString('base64')}`
      const videoDataUrl = `data:video/mp4;base64,${Buffer.from([4, 5, 6]).toString('base64')}`

      expect(() => collectVideoTargets(buildOptsFromFlags({
        'gemini-video': 'veo-3.1-lite-generate-preview',
        'resolution': '4k'
      }))).toThrow('Veo 3.1 Lite does not support --resolution 4k')

      expect(() => collectVideoTargets(buildOptsFromFlags({
        'gemini-video': 'veo-3.1-lite-generate-preview',
        'mode': 'reference-to-video',
        'reference-image': imageDataUrl
      }))).toThrow('--mode reference-to-video is not supported by gemini/veo-3.1-lite-generate-preview')

      expect(() => collectVideoTargets(buildOptsFromFlags({
        'gemini-video': 'veo-3.1-lite-generate-preview',
        'mode': 'extend',
        'input-video': videoDataUrl
      }))).toThrow('--mode extend is not supported by gemini/veo-3.1-lite-generate-preview')

      expect(collectVideoTargets(buildOptsFromFlags({
        'gemini-video': 'veo-3.1-generate-preview',
        'resolution': '4k'
      }))).toHaveLength(1)
    })

  test('Grok video rejects 1080p on Imagine Video', () => {
      expect(() => collectVideoTargets(buildOptsFromFlags({
        'grok-video': 'grok-imagine-video',
        'resolution': '1080p'
      }))).toThrow('Expected 480p or 720p')
    })

  test('all-video image-to-video keeps compatible I2V targets', () => {
      const imageDataUrl = `data:image/png;base64,${Buffer.from([1, 2, 3]).toString('base64')}`
      const targets = collectVideoTargets(buildOptsFromFlags({
        'all-video': true,
        'mode': 'image-to-video',
        'input-image': imageDataUrl
      })).map(target => `${target.service}/${target.model}`)

      expect(targets).toContain('gemini/veo-3.1-fast-generate-preview')
      expect(targets).toContain('ltx/ltx-2-3-fast')
      expect(targets).toContain('replicate/alibaba/happyhorse-1.1')
      expect(targets).not.toContain('replicate/wan-video/wan-2.7-t2v')
    })

  test('video artifact names use the single-file name or a sanitized multi-target name', () => {
      expect(getVideoArtifactFileName({ service: 'gemini', model: 'veo-3.1-generate-preview' }, true)).toBe('generated-video.mp4')
      expect(getVideoArtifactFileName({ service: 'gemini', model: 'veo-3.1-generate-preview' }, false)).toBe('generated-video-gemini-veo-3.1-generate-preview.mp4')
      expect(getVideoArtifactFileName({ service: 'replicate', model: 'wan-video/wan-2.7-t2v' }, false)).toBe('generated-video-replicate-wan-video-wan-2.7-t2v.mp4')
    })
})
