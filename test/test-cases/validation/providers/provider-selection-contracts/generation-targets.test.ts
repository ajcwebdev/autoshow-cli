import { describe, expect, test } from 'bun:test'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { collectImageTargets } from '~/cli/commands/visuals/image/image-generation-targets'
import { collectVideoTargets } from '~/cli/commands/visuals/video/video-targets'
import { collectMusicTargets } from '~/cli/commands/audio/music/music-targets'

describe('provider selection contracts', () => {
  test('Image and video flags select targets and participate in all-provider shortcuts', () => {
    const explicitOpts = buildOptsFromFlags({
      'openai-image': ['gpt-image-2.5-sunburst'],
      'grok-video': ['grok-imagine-video-1.5'],
      'gemini-video': ['gemini-omni-1.1-flash']
    })

    expect(explicitOpts.openaiImageModels).toEqual(['gpt-image-2.5-sunburst'])
    expect(explicitOpts.grokVideoModels).toEqual(['grok-imagine-video-1.5'])
    expect(explicitOpts.geminiVideoModels).toEqual(['gemini-omni-1.1-flash'])
    expect(collectImageTargets(explicitOpts).map((target) => `${target.service}:${target.model}`)).toEqual([
      'openai:gpt-image-2.5-sunburst'
    ])
    expect(collectVideoTargets(explicitOpts).map((target) => `${target.service}:${target.model}`)).toEqual([
      'gemini:gemini-omni-1.1-flash',
      'grok:grok-imagine-video-1.5'
    ])

    const allOpts = buildOptsFromFlags({
      'all-image': true,
      'all-video': true
    })

    expect(allOpts.geminiVideoModels).toEqual([
      'gemini-omni-1.1-flash'
    ])
    expect(allOpts.geminiImageModels).toEqual([
      'gemini-3.1-flash-lite-image'
    ])
    expect(allOpts.openaiImageModels).toEqual([
      'gpt-image-2.5-flare',
      'gpt-image-2.5-sunburst'
    ])
    expect(allOpts.grokVideoModels).toEqual([
      'grok-imagine-video-1.5'
    ])
    expect(collectImageTargets(allOpts).map((target) => `${target.service}:${target.model}`)).toEqual([
      'gemini:gemini-3.1-flash-lite-image',
      'openai:gpt-image-2.5-flare',
      'openai:gpt-image-2.5-sunburst',
      'grok:grok-imagine-image-2.0'
    ])
    expect(collectVideoTargets(allOpts).map((target) => `${target.service}:${target.model}`)).toEqual([
      'gemini:gemini-omni-1.1-flash',
      'grok:grok-imagine-video-1.5'
    ])
  })

  test('removed fal and gpt-image-2 selections reject locally', () => {
    for (const flag of ['fal-image', 'fal-video'] as const) {
      expect(() => buildOptsFromFlags({ [flag]: ['alibaba/qwen-image-3'] })).toThrow(`Provider selections ${flag} are no longer supported`)
    }
    expect(() => buildOptsFromFlags({ 'openai-image': ['gpt-image-2'] })).toThrow('Allowed values: gpt-image-2.5-flare, gpt-image-2.5-sunburst')
  })

  test('Gemini music flag selects targets and participates in all-music shortcut', () => {
    const explicitOpts = buildOptsFromFlags({
      'gemini-music': ['lyria-3.5']
    })

    expect(explicitOpts.geminiMusicModels).toEqual([
      'lyria-3.5'
    ])
    expect(collectMusicTargets(explicitOpts).map((target) => `${target.service}:${target.model}`)).toEqual([
      'gemini:lyria-3.5'
    ])

    const allOpts = buildOptsFromFlags({
      'all-music': true
    })

    expect(allOpts.geminiMusicModels).toEqual([
      'lyria-3.5'
    ])
    expect(collectMusicTargets(allOpts).map((target) => `${target.service}:${target.model}`)).toEqual([
      'elevenlabs:music_v2',
      'elevenlabs:music_v2_5',
      'minimax:music-3.0',
      'gemini:lyria-3.5'
    ])
  })
})
