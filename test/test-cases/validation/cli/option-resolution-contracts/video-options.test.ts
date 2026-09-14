import { describe, expect, test } from 'bun:test'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { collectVideoTargets, getVideoArtifactFileName } from '~/cli/commands/visuals/video/video-targets'

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
      ['replicate', 'runwayml/aleph-2', 'grok-imagine-video-1.5'],
      ['replicate', 'wan-video/wan-2.7-t2v', 'bytedance/seedance-2.5'],
      ['replicate', 'kwaivgi/kling-v3-video', 'pixverse/pixverse-v6'],
      ['replicate', 'kwaivgi/kling-v3-omni-video', 'bytedance/seedance-2.5'],
      ['replicate', 'bytedance/seedance-2.0', 'bytedance/seedance-2.5'],
      ['replicate', 'bytedance/seedance-2.0-fast', 'bytedance/seedance-2.5'],
      ['grok', 'grok-imagine-video', 'grok-imagine-video-1.5'],
      ['ltx', 'ltx-2-3-fast', 'ltx-2-5-fast'],
      ['ltx', 'ltx-2-3-pro', 'ltx-2-5-pro'],
      ['fal', 'fal-ai/pixverse/c1', 'minimax/h3'],
      ['gemini', 'veo-3.1-generate-preview', 'gemini-omni-1.1-flash'],
      ['gemini', 'veo-3.1-fast-generate-preview', 'gemini-omni-1.1-flash'],
      ['gemini', 'veo-3.1-lite-generate-preview', 'gemini-omni-1.1-flash']
    ] as const) {
      expect(() => buildOptsFromFlags({
        [`${provider}-video`]: model
      })).toThrow(`Use "${replacement}" instead`)
    }
  })

  test('video mode defaults to text and validates media inputs', () => {
      const imageDataUrl = `data:image/png;base64,${Buffer.from([1, 2, 3]).toString('base64')}`

      expect(() => collectVideoTargets(buildOptsFromFlags({
        'gemini-video': 'gemini-omni-1.1-flash',
        'input-image': imageDataUrl
      }))).toThrow('--input-image is not valid with --mode text')

      expect(collectVideoTargets(buildOptsFromFlags({
        'gemini-video': 'gemini-omni-1.1-flash'
      })).map(target => target.service)).toEqual(['gemini'])

      expect(collectVideoTargets(buildOptsFromFlags({
        'gemini-video': 'gemini-omni-1.1-flash',
        'mode': 'image-to-video',
        'input-image': imageDataUrl
      })).map(target => target.service)).toEqual(['gemini'])

      expect(() => collectVideoTargets(buildOptsFromFlags({
        'grok-video': 'grok-imagine-video-1.5',
        'mode': 'reference-to-video',
        'reference-image': [imageDataUrl, imageDataUrl, imageDataUrl, imageDataUrl, imageDataUrl, imageDataUrl]
      }))).toThrow('--reference-image supports at most 5 images')

      expect(() => collectVideoTargets(buildOptsFromFlags({
        'gemini-video': 'gemini-omni-1.1-flash',
        'mode': 'interpolate',
        'input-image': imageDataUrl
      }))).toThrow('--mode interpolate requires --last-frame')

      expect(() => collectVideoTargets(buildOptsFromFlags({
        'grok-video': 'grok-imagine-video-1.5',
        'mode': 'edit',
        'input-video': `data:video/mp4;base64,${Buffer.from([4, 5, 6]).toString('base64')}`
      }))).toThrow('--mode edit is not supported by grok/grok-imagine-video-1.5')
    })

  test('all-video reference mode keeps compatible active targets', () => {
      const imageDataUrl = `data:image/png;base64,${Buffer.from([1, 2, 3]).toString('base64')}`
      const allReferenceTargets = collectVideoTargets(buildOptsFromFlags({
        'all-video': true,
        'mode': 'reference-to-video',
        'reference-image': imageDataUrl
      }))
      expect(allReferenceTargets.map(target => `${target.service}/${target.model}`)).toEqual([
        'gemini/gemini-omni-1.1-flash',
        'grok/grok-imagine-video-1.5',
        'replicate/alibaba/happyhorse-1.1',
        'replicate/bytedance/seedance-2.5',
        'fal/bytedance/seedance-2.5/reference-to-video',
        'fal/minimax/h3'
      ])
    })

  test('Replicate video options resolve models and enforce model-specific media limits', () => {
      const imageDataUrl = `data:image/png;base64,${Buffer.from([1, 2, 3]).toString('base64')}`
      const bmpDataUrl = `data:image/bmp;base64,${Buffer.from([4, 5, 6]).toString('base64')}`
      const videoDataUrl = `data:video/mp4;base64,${Buffer.from([7, 8, 9]).toString('base64')}`
      const audioDataUrl = `data:audio/mpeg;base64,${Buffer.from([10, 11, 12]).toString('base64')}`

      const explicitOpts = buildOptsFromFlags({
        'replicate-video': ['bytedance/seedance-2.5'],
        'mode': 'reference-to-video',
        'reference-image': [imageDataUrl, bmpDataUrl],
        'reference-video': [videoDataUrl],
        'reference-audio': [audioDataUrl],
        'replicate-video-seed': '123',
        'generate-audio': false,
        'duration': '-1',
        'aspect-ratio': 'adaptive'
      })
      expect(explicitOpts.replicateVideoModels).toEqual(['bytedance/seedance-2.5'])
      expect(explicitOpts.replicateVideoSeed).toBe(123)
      expect(explicitOpts.videoGenerateAudio).toBe(false)
      expect(explicitOpts.videoReferenceVideos).toEqual([videoDataUrl])
      expect(explicitOpts.videoReferenceAudios).toEqual([audioDataUrl])
      expect(collectVideoTargets(explicitOpts).map(target => `${target.service}/${target.model}`)).toEqual([
        'replicate/bytedance/seedance-2.5'
      ])

      expect(collectVideoTargets(buildOptsFromFlags({
        'replicate-video': 'bytedance/seedance-2.5',
        'mode': 'reference-to-video',
        'reference-image': Array.from({ length: 30 }, () => imageDataUrl)
      }))).toHaveLength(1)

      expect(() => collectVideoTargets(buildOptsFromFlags({
        'replicate-video': 'bytedance/seedance-2.5',
        'mode': 'reference-to-video',
        'reference-image': Array.from({ length: 31 }, () => imageDataUrl)
      }))).toThrow('--reference-image supports at most 30 images')

      expect(() => collectVideoTargets(buildOptsFromFlags({
        'replicate-video': 'bytedance/seedance-2.5',
        'resolution': '1080p'
      }))).toThrow('supports 480p or 720p')

      expect(() => buildOptsFromFlags({
        'replicate-video': 'wan-video/wan-2.7-t2v'
      })).toThrow('Use "bytedance/seedance-2.5" instead')

      expect(() => collectVideoTargets(buildOptsFromFlags({
        'replicate-video-seed': '123'
      }))).toThrow('Replicate video flags require a Replicate video provider target')
    })

  test('LTX video media modes enforce model capability and documented size limits', () => {
      const imageDataUrl = `data:image/png;base64,${Buffer.from([1, 2, 3]).toString('base64')}`
      const lastFrameDataUrl = `data:image/webp;base64,${Buffer.from([4, 5, 6]).toString('base64')}`
      const videoDataUrl = `data:video/mp4;base64,${Buffer.from([7, 8, 9]).toString('base64')}`

      expect(collectVideoTargets(buildOptsFromFlags({
        'ltx-video': 'ltx-2-5-fast',
        'mode': 'image-to-video',
        'input-image': imageDataUrl,
        'aspect-ratio': '9:16',
        'resolution': '4k'
      })).map(target => `${target.service}/${target.model}`)).toEqual([
        'ltx/ltx-2-5-fast'
      ])

      expect(collectVideoTargets(buildOptsFromFlags({
        'ltx-video': 'ltx-2-5-pro',
        'mode': 'interpolate',
        'input-image': imageDataUrl,
        'last-frame': lastFrameDataUrl,
        'resolution': '4k',
        'aspect-ratio': '9:16'
      })).map(target => `${target.service}/${target.model}`)).toEqual([
        'ltx/ltx-2-5-pro'
      ])

      expect(() => collectVideoTargets(buildOptsFromFlags({
        'ltx-video': 'ltx-2-5-pro',
        'mode': 'extend',
        'input-video': videoDataUrl,
        'duration': '30'
      }))).toThrow('--mode extend is not supported by ltx/ltx-2-5-pro')

      expect(() => collectVideoTargets(buildOptsFromFlags({
        'ltx-video': 'ltx-2-5-fast',
        'aspect-ratio': '1:1'
      }))).toThrow('Expected 16:9 or 9:16')

      expect(() => collectVideoTargets(buildOptsFromFlags({
        'ltx-video': 'ltx-2-5-fast',
        'resolution': '480p'
      }))).toThrow('Expected 720p or 1080p or 1440p or 4k')
    })

  test('Gemini Omni video media modes accept Omni capabilities and reject invalid controls', () => {
      const imageDataUrl = `data:image/png;base64,${Buffer.from([1, 2, 3]).toString('base64')}`
      const videoDataUrl = `data:video/mp4;base64,${Buffer.from([4, 5, 6]).toString('base64')}`

      expect(collectVideoTargets(buildOptsFromFlags({
        'gemini-video': 'gemini-omni-1.1-flash',
        'resolution': '4k'
      })).map(target => `${target.service}/${target.model}`)).toEqual([
        'gemini/gemini-omni-1.1-flash'
      ])

      expect(collectVideoTargets(buildOptsFromFlags({
        'gemini-video': 'gemini-omni-1.1-flash',
        'mode': 'reference-to-video',
        'reference-image': imageDataUrl
      })).map(target => `${target.service}/${target.model}`)).toEqual([
        'gemini/gemini-omni-1.1-flash'
      ])

      expect(collectVideoTargets(buildOptsFromFlags({
        'gemini-video': 'gemini-omni-1.1-flash',
        'mode': 'extend',
        'input-video': videoDataUrl
      })).map(target => `${target.service}/${target.model}`)).toEqual([
        'gemini/gemini-omni-1.1-flash'
      ])

      expect(() => collectVideoTargets(buildOptsFromFlags({
        'gemini-video': 'gemini-omni-1.1-flash',
        'aspect-ratio': '1:1'
      }))).toThrow('Expected 16:9 or 9:16')

      expect(() => collectVideoTargets(buildOptsFromFlags({
        'gemini-video': 'gemini-omni-1.1-flash',
        'mode': 'reference-to-video',
        'reference-audio': [`data:audio/mpeg;base64,${Buffer.from([7, 8, 9]).toString('base64')}`]
      }))).toThrow('--reference-audio is not supported by gemini/gemini-omni-1.1-flash')
    })

  test('Grok Imagine Video 1.5 rejects 1080p for reference-to-video', () => {
      const imageDataUrl = `data:image/png;base64,${Buffer.from([1, 2, 3]).toString('base64')}`
      expect(() => collectVideoTargets(buildOptsFromFlags({
        'grok-video': 'grok-imagine-video-1.5',
        'mode': 'reference-to-video',
        'reference-image': imageDataUrl,
        'resolution': '1080p'
      }))).toThrow('reference-to-video is limited to 720p')
    })

  test('all-video image-to-video keeps compatible I2V targets', () => {
      const imageDataUrl = `data:image/png;base64,${Buffer.from([1, 2, 3]).toString('base64')}`
      const targets = collectVideoTargets(buildOptsFromFlags({
        'all-video': true,
        'mode': 'image-to-video',
        'input-image': imageDataUrl
      })).map(target => `${target.service}/${target.model}`)

      expect(targets).toContain('gemini/gemini-omni-1.1-flash')
      expect(targets).toContain('ltx/ltx-2-5-fast')
      expect(targets).toContain('replicate/alibaba/happyhorse-1.1')
      expect(targets).not.toContain('replicate/wan-video/wan-2.7-t2v')
      expect(targets).not.toContain('gemini/veo-3.1-fast-generate-preview')
      expect(targets).not.toContain('ltx/ltx-2-3-fast')
    })

  test('video artifact names use the single-file name or a sanitized multi-target name', () => {
      expect(getVideoArtifactFileName({ service: 'gemini', model: 'gemini-omni-1.1-flash' }, true)).toBe('generated-video.mp4')
      expect(getVideoArtifactFileName({ service: 'gemini', model: 'gemini-omni-1.1-flash' }, false)).toBe('generated-video-gemini-gemini-omni-1.1-flash.mp4')
      expect(getVideoArtifactFileName({ service: 'replicate', model: 'wan-video/wan-2.7-t2v' }, false)).toBe('generated-video-replicate-wan-video-wan-2.7-t2v.mp4')
    })
})
