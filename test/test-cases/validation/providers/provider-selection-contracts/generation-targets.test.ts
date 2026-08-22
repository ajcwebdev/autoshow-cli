import { describe, expect, test } from 'bun:test'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { collectImageTargets } from '~/cli/commands/process-steps/step-5-image/image-generation-targets'
import { collectVideoTargets } from '~/cli/commands/process-steps/step-6-video/video-targets'
import { collectMusicTargets } from '~/cli/commands/process-steps/step-7-music/music-targets'

describe('provider selection contracts', () => {
  test('BFL/Replicate image and remaining video flags select targets and participate in all-provider shortcuts', () => {
    const explicitOpts = buildOptsFromFlags({
      'bfl-image': ['flux-2-pro'],
      'replicate-image': ['wan-video/wan-2.7-image'],
      'fal-image': ['alibaba/qwen-image-3'],
      'ltx-video': ['ltx-2-3-pro'],
      'replicate-video': ['bytedance/seedance-2.0-fast'],
      'fal-video': ['minimax/h3']
    })

    expect(explicitOpts.bflImageModels).toEqual(['flux-2-pro'])
    expect(explicitOpts.replicateImageModels).toEqual(['wan-video/wan-2.7-image'])
    expect(explicitOpts.falImageModels).toEqual(['alibaba/qwen-image-3'])
    expect(explicitOpts.ltxVideoModels).toEqual(['ltx-2-3-pro'])
    expect(explicitOpts.replicateVideoModels).toEqual(['bytedance/seedance-2.0-fast'])
    expect(explicitOpts.falVideoModels).toEqual(['minimax/h3'])
    expect(collectImageTargets(explicitOpts).map((target) => `${target.service}:${target.model}`)).toEqual([
      'bfl:flux-2-pro',
      'replicate:wan-video/wan-2.7-image',
      'fal:alibaba/qwen-image-3'
    ])
    expect(collectVideoTargets(explicitOpts).map((target) => `${target.service}:${target.model}`)).toEqual([
      'ltx:ltx-2-3-pro',
      'replicate:bytedance/seedance-2.0-fast',
      'fal:minimax/h3'
    ])

    const allOpts = buildOptsFromFlags({
      'all-image': true,
      'all-video': true
    })

    expect(allOpts.geminiVideoModels).toEqual([
      'veo-3.1-fast-generate-preview',
      'veo-3.1-generate-preview',
      'veo-3.1-lite-generate-preview'
    ])
    expect(allOpts.geminiImageModels).toEqual([
      'gemini-3.1-flash-lite-image',
      'gemini-3.1-flash-image',
      'gemini-3-pro-image'
    ])
    expect(allOpts.openaiImageModels).toEqual([
      'gpt-image-2'
    ])
    expect(allOpts.bflImageModels).toEqual([
      'flux-2-klein-4b',
      'flux-2-klein-9b',
      'flux-2-pro',
      'flux-2-max',
      'flux-2-flex'
    ])
    expect(allOpts.replicateImageModels).toEqual([
      'bytedance/seedream-4.5',
      'bytedance/seedream-5-lite',
      'bytedance/seedream-5-pro',
      'qwen/qwen-image-2-pro',
      'qwen/qwen-image-2',
      'wan-video/wan-2.7-image-pro',
      'wan-video/wan-2.7-image'
    ])
    expect(allOpts.falImageModels).toEqual([
      'fal-ai/hidream-o1-image',
      'alibaba/qwen-image-3',
      'reve/2.1'
    ])
    expect(allOpts.ltxVideoModels).toEqual([
      'ltx-2-3-fast',
      'ltx-2-3-pro'
    ])
    expect(allOpts.replicateVideoModels).toEqual([
      'alibaba/happyhorse-1.1',
      'bytedance/seedance-2.0',
      'bytedance/seedance-2.0-fast',
      'kwaivgi/kling-v3-video',
      'kwaivgi/kling-v3-omni-video',
      'pixverse/pixverse-v6'
    ])
    expect(allOpts.falVideoModels).toEqual(['minimax/h3', 'fal-ai/pixverse/c1'])

    const cheapestReplicateOpts = buildOptsFromFlags({
      'replicate-image': true
    })
    expect(cheapestReplicateOpts.replicateImageModels).toEqual(['wan-video/wan-2.7-image'])
    expect(collectImageTargets(cheapestReplicateOpts).map((target) => `${target.service}:${target.model}`)).toEqual([
      'replicate:wan-video/wan-2.7-image'
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
      'gemini-music': ['lyria-3-pro-preview']
    })

    expect(explicitOpts.geminiMusicModels).toEqual([
      'lyria-3-pro-preview'
    ])
    expect(collectMusicTargets(explicitOpts).map((target) => `${target.service}:${target.model}`)).toEqual([
      'gemini:lyria-3-pro-preview'
    ])

    const allOpts = buildOptsFromFlags({
      'all-music': true
    })

    expect(allOpts.geminiMusicModels).toEqual([
      'lyria-3-pro-preview'
    ])
    expect(collectMusicTargets(allOpts).map((target) => `${target.service}:${target.model}`)).toEqual([
      'elevenlabs:music_v2',
      'minimax:music-3.0',
      'gemini:lyria-3-pro-preview'
    ])
  })
})
