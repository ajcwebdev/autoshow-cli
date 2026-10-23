import { describe, expect, test } from 'bun:test'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { collectVideoTargets, getVideoArtifactFileName } from '~/cli/commands/visuals/video/video-targets'

describe('option resolution contracts', () => {
  test('video audio and reference controls reject targets that would ignore their values', () => {
    for (const [selector, model] of [
      ['gemini-video', 'gemini-omni-1.1-flash'], ['grok-video', 'grok-imagine-video-1.5'],
      ['fal-video', 'minimax/h3']
    ] as const) {
      for (const value of [true, false]) {
        expect(() => collectVideoTargets(buildOptsFromFlags({ [selector]: model, 'generate-audio': value }))).toThrow('--generate-audio is not configurable')
      }
      expect(collectVideoTargets(buildOptsFromFlags({ [selector]: model }))).toHaveLength(1)
    }
    const image = 'https://fixtures.example/reference.png'
    for (const [flag, value] of [['reference-video', 'https://fixtures.example/reference.mp4'], ['reference-audio', 'https://fixtures.example/reference.mp3']] as const) {
      expect(() => collectVideoTargets(buildOptsFromFlags({ 'grok-video': 'grok-imagine-video-1.5', mode: 'reference-to-video', 'reference-image': image, [flag]: value }))).toThrow(`--${flag} is not supported by grok`)
    }
  })

  test('retired video selectors fail with replacement guidance', () => {
    for (const [provider, model, replacement] of [
      ['grok', 'grok-imagine-video', 'grok-imagine-video-1.5'],
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
        'fal/bytedance/seedance-2.5/reference-to-video',
        'fal/minimax/h3'
      ])
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
      expect(targets).toContain('grok/grok-imagine-video-1.5')
      expect(targets).not.toContain('gemini/veo-3.1-fast-generate-preview')
    })

  test('video artifact names use the single-file name or a sanitized multi-target name', () => {
      expect(getVideoArtifactFileName({ service: 'gemini', model: 'gemini-omni-1.1-flash' }, true)).toBe('generated-video.mp4')
      expect(getVideoArtifactFileName({ service: 'gemini', model: 'gemini-omni-1.1-flash' }, false)).toBe('generated-video-gemini-gemini-omni-1.1-flash.mp4')
    })
})
