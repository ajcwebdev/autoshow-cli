import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/download-targets/build-opts-from-flags/build-options-from-flags'
import { collectImageTargets } from '~/cli/commands/process-steps/step-5-image/image-generation-targets'
import { withTempImageFixture } from './shared'

describe('provider selection contracts', () => {
  test('gpt-image-2 accepts flexible valid OpenAI image sizes', () => {
    const opts = buildOptsFromFlags(false, {
      'openai-image': ['gpt-image-2'],
      'image-size': '2048x1152'
    })

    expect(collectImageTargets(opts).map((target) => `${target.service}:${target.model}`)).toEqual([
      'openai:gpt-image-2'
    ])
  })

  test('OpenAI image size validation is model-specific', () => {
    for (const invalidSize of ['1025x1024', '4096x1024', '3840x1024', '800x800', '3840x3840']) {
      const opts = buildOptsFromFlags(false, {
        'openai-image': ['gpt-image-2'],
        'image-size': invalidSize
      })
      expect(() => collectImageTargets(opts)).toThrow(`Invalid --image-size value "${invalidSize}" for gpt-image-2`)
    }

    const validFlexibleSizeOpts = buildOptsFromFlags(false, {
      'openai-image': ['gpt-image-2'],
      'image-size': '2048x1152'
    })
    expect(collectImageTargets(validFlexibleSizeOpts).map((target) => `${target.service}:${target.model}`)).toEqual([
      'openai:gpt-image-2'
    ])
  })

  test('gpt-image-2 rejects transparent background', () => {
    const opts = buildOptsFromFlags(false, {
      'openai-image': ['gpt-image-2'],
      'image-background': 'transparent'
    })

    expect(() => collectImageTargets(opts)).toThrow('--image-background transparent is not supported by OpenAI/gpt-image-2')
  })

  test('image-count maps only to providers with native multi-image request support', () => {
    const multiOpts = buildOptsFromFlags(false, {
      'openai-image': ['gpt-image-2'],
      'grok-image': ['grok-imagine-image-quality'],
      'image-count': '3'
    })
    const targets = collectImageTargets(multiOpts)
    expect(targets.map((target) => `${target.service}:${target.model}`)).toEqual([
      'openai:gpt-image-2',
      'grok:grok-imagine-image-quality'
    ])

    for (const [flag, model, providerName] of [
      ['gemini-image', 'gemini-3.1-flash-lite-image', 'Gemini'],
      ['bfl-image', 'flux-2-pro', 'BFL']
    ] as const) {
      const opts = buildOptsFromFlags(false, {
        [flag]: [model],
        'image-count': '2'
      })
      expect(() => collectImageTargets(opts)).toThrow(`${providerName}/${model}`)
    }
  })

  test('image edit/reference flags validate provider and model support', () => {
    withTempImageFixture('autoshow-image-input-', (imagePath, tempDir) => {
      const openaiEditOpts = buildOptsFromFlags(false, {
        'openai-image': ['gpt-image-2'],
        'image-input': [imagePath]
      })
      expect(collectImageTargets(openaiEditOpts).map((target) => `${target.service}:${target.model}`)).toEqual([
        'openai:gpt-image-2'
      ])

      const bflEditOpts = buildOptsFromFlags(false, {
        'bfl-image': ['flux-2-pro'],
        'image-input': [imagePath]
      })
      expect(collectImageTargets(bflEditOpts).map((target) => `${target.service}:${target.model}`)).toEqual([
        'bfl:flux-2-pro'
      ])

      const missingPath = join(tempDir, 'missing.png')
      const missingInputOpts = buildOptsFromFlags(false, {
        'openai-image': ['gpt-image-2'],
        'image-input': [missingPath]
      })
      expect(() => collectImageTargets(missingInputOpts)).toThrow(`--image-input file "${missingPath}" does not exist`)
    })
  })
})
