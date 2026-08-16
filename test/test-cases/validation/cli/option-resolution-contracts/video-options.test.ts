import { describe, expect, test } from 'bun:test'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { collectVideoTargets, getVideoArtifactFileName } from '~/cli/commands/process-steps/step-6-video/video-targets'

describe('option resolution contracts', () => {
  test('Luma Labs video resolution follows the documented Ray 3.2 values', () => {
    expect(collectVideoTargets(buildOptsFromFlags(false, {
      'lumalabs-video': 'ray-3.2',
      'video-resolution': '540p'
    })).map(target => target.service)).toEqual(['lumalabs'])

    expect(() => collectVideoTargets(buildOptsFromFlags(false, {
      'lumalabs-video': 'ray-3.2',
      'video-resolution': '360p'
    }))).toThrow('Expected 540p, 720p, 1080p')
  })

  test('video mode defaults to text and validates media inputs', () => {
      const imageDataUrl = `data:image/png;base64,${Buffer.from([1, 2, 3]).toString('base64')}`
      const videoDataUrl = `data:video/mp4;base64,${Buffer.from([4, 5, 6]).toString('base64')}`

      expect(() => collectVideoTargets(buildOptsFromFlags(false, {
        'gemini-video': 'veo-3.1-fast-generate-preview',
        'video-input-image': imageDataUrl
      }))).toThrow('--video-input-image is not valid with --video-mode text')

      expect(collectVideoTargets(buildOptsFromFlags(false, {
        'gemini-video': 'veo-3.1-fast-generate-preview'
      })).map(target => target.service)).toEqual(['gemini'])

      expect(collectVideoTargets(buildOptsFromFlags(false, {
        'gemini-video': 'veo-3.1-fast-generate-preview',
        'video-mode': 'image-to-video',
        'video-input-image': imageDataUrl
      })).map(target => target.service)).toEqual(['gemini'])

      expect(collectVideoTargets(buildOptsFromFlags(false, {
        'minimax-video': 'I2V-01',
        'video-mode': 'image-to-video',
        'video-input-image': imageDataUrl
      })).map(target => target.service)).toEqual(['minimax'])

      expect(collectVideoTargets(buildOptsFromFlags(false, {
        'glm-video': 'vidu2-image',
        'video-mode': 'image-to-video',
        'video-input-image': imageDataUrl
      })).map(target => target.service)).toEqual(['glm'])

      expect(() => collectVideoTargets(buildOptsFromFlags(false, {
        'grok-video': 'grok-imagine-video',
        'video-mode': 'reference-to-video',
        'video-reference-image': [imageDataUrl, imageDataUrl, imageDataUrl, imageDataUrl]
      }))).toThrow('--video-reference-image supports at most 3 images')

      expect(() => collectVideoTargets(buildOptsFromFlags(false, {
        'gemini-video': 'veo-3.1-fast-generate-preview',
        'video-mode': 'interpolate',
        'video-input-image': imageDataUrl
      }))).toThrow('--video-mode interpolate requires --video-last-frame')

      expect(() => collectVideoTargets(buildOptsFromFlags(false, {
        'grok-video': 'grok-imagine-video',
        'video-mode': 'edit',
        'video-input-video': videoDataUrl,
        'video-duration': '8'
      }))).toThrow('--video-duration, --video-aspect-ratio, and --video-resolution are not valid with Grok --video-mode edit')
    })

  test('GLM and MiniMax video media modes enforce model capability limits', () => {
      const imageDataUrl = `data:image/png;base64,${Buffer.from([1, 2, 3]).toString('base64')}`

      expect(() => collectVideoTargets(buildOptsFromFlags(false, {
        'minimax-video': 'S2V-01'
      }))).toThrow('--video-mode text is not supported by minimax/S2V-01')

      expect(() => collectVideoTargets(buildOptsFromFlags(false, {
        'minimax-video': 'T2V-01',
        'video-mode': 'image-to-video',
        'video-input-image': imageDataUrl
      }))).toThrow('--video-mode image-to-video is not supported by minimax/T2V-01')

      expect(() => collectVideoTargets(buildOptsFromFlags(false, {
        'minimax-video': 'S2V-01',
        'video-mode': 'reference-to-video',
        'video-reference-image': [imageDataUrl, imageDataUrl]
      }))).toThrow('MiniMax S2V-01 supports exactly one --video-reference-image')

      expect(() => collectVideoTargets(buildOptsFromFlags(false, {
        'glm-video': 'vidu2-reference',
        'video-mode': 'image-to-video',
        'video-input-image': imageDataUrl
      }))).toThrow('--video-mode image-to-video is not supported by glm/vidu2-reference')

      expect(() => collectVideoTargets(buildOptsFromFlags(false, {
        'glm-video': 'vidu2-start-end'
      }))).toThrow('--video-mode text is not supported by glm/vidu2-start-end')

      expect(collectVideoTargets(buildOptsFromFlags(false, {
        'glm-video': 'vidu2-reference',
        'video-mode': 'reference-to-video',
        'video-reference-image': [imageDataUrl, imageDataUrl, imageDataUrl]
      })).map(target => target.model)).toEqual(['vidu2-reference'])

      const allReferenceTargets = collectVideoTargets(buildOptsFromFlags(false, {
        'all-video': true,
        'video-mode': 'reference-to-video',
        'video-reference-image': imageDataUrl
      }))
      expect(allReferenceTargets.map(target => `${target.service}/${target.model}`)).toEqual([
        'gemini/veo-3.1-fast-generate-preview',
        'gemini/veo-3.1-generate-preview',
        'minimax/S2V-01',
        'glm/vidu2-reference',
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

      const explicitOpts = buildOptsFromFlags(false, {
        'replicate-video': ['bytedance/seedance-2.0-fast'],
        'video-mode': 'reference-to-video',
        'video-reference-image': [imageDataUrl, bmpDataUrl],
        'replicate-video-reference-video': [videoDataUrl],
        'replicate-video-reference-audio': [audioDataUrl],
        'replicate-video-seed': '123',
        'replicate-video-generate-audio': false,
        'video-duration': '-1',
        'video-aspect-ratio': 'adaptive'
      })
      expect(explicitOpts.replicateVideoModels).toEqual(['bytedance/seedance-2.0-fast'])
      expect(explicitOpts.replicateVideoSeed).toBe(123)
      expect(explicitOpts.replicateVideoGenerateAudio).toBe(false)
      expect(explicitOpts.replicateVideoReferenceVideos).toEqual([videoDataUrl])
      expect(explicitOpts.replicateVideoReferenceAudios).toEqual([audioDataUrl])
      expect(collectVideoTargets(explicitOpts).map(target => `${target.service}/${target.model}`)).toEqual([
        'replicate/bytedance/seedance-2.0-fast'
      ])

      expect(collectVideoTargets(buildOptsFromFlags(false, {
        'replicate-video': 'bytedance/seedance-2.0',
        'video-mode': 'reference-to-video',
        'video-reference-image': Array.from({ length: 9 }, () => imageDataUrl)
      }))).toHaveLength(1)

      expect(() => collectVideoTargets(buildOptsFromFlags(false, {
        'replicate-video': 'bytedance/seedance-2.0',
        'video-mode': 'reference-to-video',
        'video-reference-image': Array.from({ length: 10 }, () => imageDataUrl)
      }))).toThrow('--video-reference-image supports at most 9 images')

      expect(() => collectVideoTargets(buildOptsFromFlags(false, {
        'replicate-video': 'bytedance/seedance-2.0-fast',
        'video-resolution': '1080p'
      }))).toThrow('Expected 480p or 720p')

      expect(() => collectVideoTargets(buildOptsFromFlags(false, {
        'replicate-video': 'wan-video/wan-2.7-t2v',
        'video-mode': 'image-to-video',
        'video-input-image': imageDataUrl
      }))).toThrow('--video-mode image-to-video is not supported by replicate/wan-video/wan-2.7-t2v')

      expect(() => collectVideoTargets(buildOptsFromFlags(false, {
        'replicate-video-reference-audio': audioDataUrl
      }))).toThrow('Replicate video flags require a Replicate video provider target')
    })

  test('LTX video media modes enforce model capability and documented size limits', () => {
      const imageDataUrl = `data:image/png;base64,${Buffer.from([1, 2, 3]).toString('base64')}`
      const lastFrameDataUrl = `data:image/webp;base64,${Buffer.from([4, 5, 6]).toString('base64')}`
      const videoDataUrl = `data:video/mp4;base64,${Buffer.from([7, 8, 9]).toString('base64')}`

      expect(collectVideoTargets(buildOptsFromFlags(false, {
        'ltx-video': 'ltx-2-3-fast',
        'video-mode': 'image-to-video',
        'video-input-image': imageDataUrl,
        'video-aspect-ratio': '9:16',
        'video-resolution': '4k'
      })).map(target => `${target.service}/${target.model}`)).toEqual([
        'ltx/ltx-2-3-fast'
      ])

      expect(collectVideoTargets(buildOptsFromFlags(false, {
        'ltx-video': 'ltx-2-3-pro',
        'video-mode': 'interpolate',
        'video-input-image': imageDataUrl,
        'video-last-frame': lastFrameDataUrl,
        'video-size': '1440x2560'
      })).map(target => `${target.service}/${target.model}`)).toEqual([
        'ltx/ltx-2-3-pro'
      ])

      expect(collectVideoTargets(buildOptsFromFlags(false, {
        'ltx-video': 'ltx-2-3-pro',
        'video-mode': 'extend',
        'video-input-video': videoDataUrl,
        'video-duration': '30'
      })).map(target => `${target.service}/${target.model}`)).toEqual([
        'ltx/ltx-2-3-pro'
      ])

      expect(() => collectVideoTargets(buildOptsFromFlags(false, {
        'ltx-video': 'ltx-2-3-fast',
        'video-mode': 'extend',
        'video-input-video': videoDataUrl
      }))).toThrow('--video-mode extend is not supported by ltx/ltx-2-3-fast')

      expect(() => collectVideoTargets(buildOptsFromFlags(false, {
        'ltx-video': 'ltx-2-3-fast',
        'video-aspect-ratio': '1:1'
      }))).toThrow('Expected 16:9 or 9:16')

      expect(() => collectVideoTargets(buildOptsFromFlags(false, {
        'ltx-video': 'ltx-2-3-fast',
        'video-resolution': '1440p'
      }))).toThrow('Expected 1080p or 4k')

      expect(() => collectVideoTargets(buildOptsFromFlags(false, {
        'ltx-video': 'ltx-2-3-fast',
        'video-size': '1024x1024'
      }))).toThrow('Invalid --video-size')
    })

  test('Gemini video media modes enforce Lite and 4k capability limits', () => {
      const imageDataUrl = `data:image/png;base64,${Buffer.from([1, 2, 3]).toString('base64')}`
      const videoDataUrl = `data:video/mp4;base64,${Buffer.from([4, 5, 6]).toString('base64')}`

      expect(() => collectVideoTargets(buildOptsFromFlags(false, {
        'gemini-video': 'veo-3.1-lite-generate-preview',
        'video-resolution': '4k'
      }))).toThrow('Veo 3.1 Lite does not support --video-resolution 4k')

      expect(() => collectVideoTargets(buildOptsFromFlags(false, {
        'gemini-video': 'veo-3.1-lite-generate-preview',
        'video-mode': 'reference-to-video',
        'video-reference-image': imageDataUrl
      }))).toThrow('--video-mode reference-to-video is not supported by gemini/veo-3.1-lite-generate-preview')

      expect(() => collectVideoTargets(buildOptsFromFlags(false, {
        'gemini-video': 'veo-3.1-lite-generate-preview',
        'video-mode': 'extend',
        'video-input-video': videoDataUrl
      }))).toThrow('--video-mode extend is not supported by gemini/veo-3.1-lite-generate-preview')

      expect(collectVideoTargets(buildOptsFromFlags(false, {
        'gemini-video': 'veo-3.1-generate-preview',
        'video-resolution': '4k'
      }))).toHaveLength(1)
    })

  test('Grok video rejects 1080p on Imagine Video', () => {
      expect(() => collectVideoTargets(buildOptsFromFlags(false, {
        'grok-video': 'grok-imagine-video',
        'video-resolution': '1080p'
      }))).toThrow('Expected 480p or 720p')
    })

  test('all-video image-to-video keeps compatible I2V targets', () => {
      const imageDataUrl = `data:image/png;base64,${Buffer.from([1, 2, 3]).toString('base64')}`
      const targets = collectVideoTargets(buildOptsFromFlags(false, {
        'all-video': true,
        'video-mode': 'image-to-video',
        'video-input-image': imageDataUrl
      })).map(target => `${target.service}/${target.model}`)

      expect(targets).toContain('gemini/veo-3.1-fast-generate-preview')
      expect(targets).toContain('minimax/MiniMax-Hailuo-2.3')
      expect(targets).toContain('glm/vidu2-image')
      expect(targets).toContain('ltx/ltx-2-3-fast')
      expect(targets).toContain('replicate/alibaba/happyhorse-1.1')
      expect(targets).not.toContain('runway/gen4.5')
      expect(targets).not.toContain('minimax/T2V-01')
      expect(targets).not.toContain('glm/viduq1-text')
      expect(targets).not.toContain('replicate/wan-video/wan-2.7-t2v')
    })

  test('video artifact names use the single-file name or a sanitized multi-target name', () => {
      expect(getVideoArtifactFileName({ service: 'gemini', model: 'veo-3.1-generate-preview' }, true)).toBe('generated-video.mp4')
      expect(getVideoArtifactFileName({ service: 'gemini', model: 'veo-3.1-generate-preview' }, false)).toBe('generated-video-gemini-veo-3.1-generate-preview.mp4')
      expect(getVideoArtifactFileName({ service: 'replicate', model: 'wan-video/wan-2.7-t2v' }, false)).toBe('generated-video-replicate-wan-video-wan-2.7-t2v.mp4')
    })
})
