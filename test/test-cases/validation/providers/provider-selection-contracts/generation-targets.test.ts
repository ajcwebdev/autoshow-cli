import { describe, expect, test } from 'bun:test'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { collectImageTargets } from '~/cli/commands/visuals/image/image-generation-targets'
import { collectVideoTargets } from '~/cli/commands/visuals/video/video-targets'
import { collectMusicTargets } from '~/cli/commands/audio/music/music-targets'

describe('provider selection contracts', () => {
  test('Replicate image and remaining video flags select targets and participate in all-provider shortcuts', () => {
    const explicitOpts = buildOptsFromFlags({
      'replicate-image': ['alibaba/qwen-image-3'],
      'fal-image': ['alibaba/qwen-image-3'],
      'ltx-video': ['ltx-2-5-pro'],
      'replicate-video': ['bytedance/seedance-2.5'],
      'fal-video': ['minimax/h3']
    })

    expect(explicitOpts.replicateImageModels).toEqual(['alibaba/qwen-image-3'])
    expect(explicitOpts.falImageModels).toEqual(['alibaba/qwen-image-3'])
    expect(explicitOpts.ltxVideoModels).toEqual(['ltx-2-5-pro'])
    expect(explicitOpts.replicateVideoModels).toEqual(['bytedance/seedance-2.5'])
    expect(explicitOpts.falVideoModels).toEqual(['minimax/h3'])
    expect(collectImageTargets(explicitOpts).map((target) => `${target.service}:${target.model}`)).toEqual([
      'replicate:alibaba/qwen-image-3',
      'fal:alibaba/qwen-image-3'
    ])
    expect(collectVideoTargets(explicitOpts).map((target) => `${target.service}:${target.model}`)).toEqual([
      'ltx:ltx-2-5-pro',
      'replicate:bytedance/seedance-2.5',
      'fal:minimax/h3'
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
      'gpt-image-2',
      'gpt-image-2.5-flare',
      'gpt-image-2.5-sunburst'
    ])
    expect(allOpts.replicateImageModels).toEqual([
      'bytedance/seedream-5-lite',
      'bytedance/seedream-5-pro',
      'alibaba/qwen-image-3',
      'alibaba/qwen-image-3-pro'
    ])
    expect(allOpts.falImageModels).toEqual([
      'fal-ai/hidream-o1-image',
      'alibaba/qwen-image-3',
      'reve/2.1'
    ])
    expect(allOpts.grokVideoModels).toEqual([
      'grok-imagine-video-1.5'
    ])
    expect(allOpts.ltxVideoModels).toEqual([
      'ltx-2-5-fast',
      'ltx-2-5-pro'
    ])
    expect(allOpts.replicateVideoModels).toEqual([
      'alibaba/happyhorse-1.1',
      'alibaba/wan-3',
      'bytedance/seedance-2.5',
      'pixverse/pixverse-v6'
    ])
    expect(allOpts.lumalabsVideoModels).toEqual([
      'ray-3.2'
    ])
    expect(allOpts.falVideoModels).toEqual(['bytedance/seedance-2.5/text-to-video', 'bytedance/seedance-2.5/image-to-video', 'bytedance/seedance-2.5/reference-to-video', 'minimax/h3-max/text-to-video', 'minimax/h3-max/image-to-video', 'minimax/h3-max-turbo/text-to-video', 'minimax/h3-max-turbo/image-to-video', 'minimax/h3'])
    expect(
      (allOpts.geminiVideoModels?.length ?? 0)
      + (allOpts.grokVideoModels?.length ?? 0)
      + (allOpts.ltxVideoModels?.length ?? 0)
      + (allOpts.replicateVideoModels?.length ?? 0)
      + (allOpts.lumalabsVideoModels?.length ?? 0)
      + (allOpts.falVideoModels?.length ?? 0)
    ).toBe(17)

    const cheapestReplicateOpts = buildOptsFromFlags({
      'replicate-image': true
    })
    expect(cheapestReplicateOpts.replicateImageModels).toEqual(['alibaba/qwen-image-3'])
    expect(collectImageTargets(cheapestReplicateOpts).map((target) => `${target.service}:${target.model}`)).toEqual([
      'replicate:alibaba/qwen-image-3'
    ])

    const cheapestReplicateVideoOpts = buildOptsFromFlags({
      'replicate-video': true
    })
    expect(cheapestReplicateVideoOpts.replicateVideoModels).toEqual(['pixverse/pixverse-v6'])
    expect(collectVideoTargets(cheapestReplicateVideoOpts).map((target) => `${target.service}:${target.model}`)).toEqual([
      'replicate:pixverse/pixverse-v6'
    ])
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
