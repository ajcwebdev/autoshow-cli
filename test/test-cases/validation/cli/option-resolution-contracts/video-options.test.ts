import { describe, expect, test } from 'bun:test'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { collectVideoTargets, getVideoArtifactFileName } from '~/cli/commands/visuals/video/video-targets'
import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import { parseCommandInvocation } from '~/cli/native/native-parser'
import { commandNamed } from '../../../../test-utils/cli-assertions'

describe('option resolution contracts', () => {
  test('removed audio controls are unknown flags and reference video rejects targets that would ignore it', () => {
    for (const args of [['--generate-audio'], ['--reference-audio', 'https://fixtures.example/reference.mp3']]) {
      expect(() => parseCommandInvocation(['video', 'a prompt', ...args], commandNamed('video'), GLOBAL_FLAG_DEFINITIONS)).toThrow(`Unexpected flag: ${args[0]}`)
    }
    for (const [selector, model] of [['gemini-video', 'gemini-omni-1.1-flash'], ['grok-video', 'grok-imagine-video-1.5']] as const) {
      expect(collectVideoTargets(buildOptsFromFlags({ [selector]: model }))).toHaveLength(1)
    }
    const image = 'https://fixtures.example/reference.png'
    expect(() => collectVideoTargets(buildOptsFromFlags({ 'grok-video': 'grok-imagine-video-1.5', mode: 'reference-to-video', 'reference-image': image, 'reference-video': 'https://fixtures.example/reference.mp4' }))).toThrow('--reference-video is not supported by grok')
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
        'grok/grok-imagine-video-1.5'
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
