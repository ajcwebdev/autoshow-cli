import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { collectImageTargets } from '~/cli/commands/visuals/image/image-generation-targets'
import { withTempImageFixture } from './shared'

describe('provider selection contracts', () => {
  test('gpt-image-2.5-flare accepts flexible valid OpenAI image sizes', () => {
    const opts = buildOptsFromFlags({
      'openai-image': ['gpt-image-2.5-flare'],
      'size': '2048x1152'
    })

    expect(collectImageTargets(opts).map((target) => `${target.service}:${target.model}`)).toEqual([
      'openai:gpt-image-2.5-flare'
    ])
  })

  test('OpenAI image size validation is model-specific', () => {
    for (const invalidSize of ['1025x1024', '4096x1024', '3840x1024', '800x800', '3840x3840']) {
      const opts = buildOptsFromFlags({
        'openai-image': ['gpt-image-2.5-flare'],
        'size': invalidSize
      })
      expect(() => collectImageTargets(opts)).toThrow(`Invalid --size value "${invalidSize}" for gpt-image-2.5-flare`)
    }

    const validFlexibleSizeOpts = buildOptsFromFlags({
      'openai-image': ['gpt-image-2.5-flare'],
      'size': '2048x1152'
    })
    expect(collectImageTargets(validFlexibleSizeOpts).map((target) => `${target.service}:${target.model}`)).toEqual([
      'openai:gpt-image-2.5-flare'
    ])
  })

  test('transparent background is OpenAI-only and requires an alpha-capable format', () => {
    expect(() => collectImageTargets(buildOptsFromFlags({
      'openai-image': ['gpt-image-2.5-flare'],
      'background': 'transparent',
      'format': 'jpeg'
    }))).toThrow('requires --format png or webp')
    expect(collectImageTargets(buildOptsFromFlags({
      'openai-image': ['gpt-image-2.5-flare'],
      'background': 'transparent',
      'format': 'png'
    }))).toHaveLength(1)
    expect(() => collectImageTargets(buildOptsFromFlags({
      'grok-image': ['grok-imagine-image-2.0'],
      'background': 'transparent'
    }))).toThrow('--background is not supported by Grok/grok-imagine-image-2.0')
  })

  test('image-count maps only to providers with native multi-image request support', () => {
    const multiOpts = buildOptsFromFlags({
      'openai-image': ['gpt-image-2.5-flare'],
      'grok-image': ['grok-imagine-image-2.0'],
      'count': '3'
    })
    const targets = collectImageTargets(multiOpts)
    expect(targets.map((target) => `${target.service}:${target.model}`)).toEqual([
      'openai:gpt-image-2.5-flare',
      'grok:grok-imagine-image-2.0'
    ])

    for (const [flag, model, providerName] of [
      ['gemini-image', 'gemini-3.1-flash-lite-image', 'Gemini'],
    ] as const) {
      const opts = buildOptsFromFlags({
        [flag]: [model],
        'count': '2'
      })
      expect(() => collectImageTargets(opts)).toThrow(`${providerName}/${model}`)
    }
  })

  test('image edit/reference flags validate provider and model support', () => {
    withTempImageFixture('autoshow-image-input-', (imagePath, tempDir) => {
      const openaiEditOpts = buildOptsFromFlags({
        'openai-image': ['gpt-image-2.5-flare'],
        'input': [imagePath]
      })
      expect(collectImageTargets(openaiEditOpts).map((target) => `${target.service}:${target.model}`)).toEqual([
        'openai:gpt-image-2.5-flare'
      ])

      const grokEditOpts = buildOptsFromFlags({
        'grok-image': ['grok-imagine-image-2.0'],
        'input': [imagePath]
      })
      expect(collectImageTargets(grokEditOpts).map((target) => `${target.service}:${target.model}`)).toEqual([
        'grok:grok-imagine-image-2.0'
      ])

      const missingPath = join(tempDir, 'missing.png')
      const missingInputOpts = buildOptsFromFlags({
        'openai-image': ['gpt-image-2.5-flare'],
        'input': [missingPath]
      })
      expect(() => collectImageTargets(missingInputOpts)).toThrow(`--input file "${missingPath}" does not exist`)
    })
  })
})
