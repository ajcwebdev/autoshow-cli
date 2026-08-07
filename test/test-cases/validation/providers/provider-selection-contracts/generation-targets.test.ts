import { describe, expect, test } from 'bun:test'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/download-targets/build-opts-from-flags/build-options-from-flags'
import { collectImageTargets } from '~/cli/commands/process-steps/step-5-image/image-generation-targets'
import { collectVideoTargets } from '~/cli/commands/process-steps/step-6-video/video-targets'
import { collectMusicTargets } from '~/cli/commands/process-steps/step-7-music/music-targets'

describe('provider selection contracts', () => {
  test('BFL/Recraft/Replicate image and remaining video flags select targets and participate in all-provider shortcuts', () => {
    const explicitOpts = buildOptsFromFlags(false, {
      'bfl-image': ['flux-2-pro'],
      'recraft-image': ['recraftv4_1'],
      'replicate-image': ['wan-video/wan-2.7-image'],
      'fal-image': ['alibaba/qwen-image-3'],
      'runway-video': ['gen4.5'],
      'ltx-video': ['ltx-2-3-pro'],
      'replicate-video': ['wan-video/wan-2.7-t2v'],
      'fal-video': ['minimax/h3']
    })

    expect(explicitOpts.bflImageModels).toEqual(['flux-2-pro'])
    expect(explicitOpts.recraftImageModels).toEqual(['recraftv4_1'])
    expect(explicitOpts.replicateImageModels).toEqual(['wan-video/wan-2.7-image'])
    expect(explicitOpts.falImageModels).toEqual(['alibaba/qwen-image-3'])
    expect(explicitOpts.runwayVideoModels).toEqual(['gen4.5'])
    expect(explicitOpts.ltxVideoModels).toEqual(['ltx-2-3-pro'])
    expect(explicitOpts.replicateVideoModels).toEqual(['wan-video/wan-2.7-t2v'])
    expect(explicitOpts.falVideoModels).toEqual(['minimax/h3'])
    expect(collectImageTargets(explicitOpts).map((target) => `${target.service}:${target.model}`)).toEqual([
      'bfl:flux-2-pro',
      'recraft:recraftv4_1',
      'replicate:wan-video/wan-2.7-image',
      'fal:alibaba/qwen-image-3'
    ])
    expect(collectVideoTargets(explicitOpts).map((target) => `${target.service}:${target.model}`)).toEqual([
      'runway:gen4.5',
      'ltx:ltx-2-3-pro',
      'replicate:wan-video/wan-2.7-t2v',
      'fal:minimax/h3'
    ])

    const allOpts = buildOptsFromFlags(false, {
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
    expect(allOpts.recraftImageModels).toEqual([
      'recraftv4_1',
      'recraftv4_1_pro',
      'recraftv4_1_utility',
      'recraftv4_1_utility_pro'
    ])
    expect(allOpts.replicateImageModels).toEqual([
      'bytedance/seedream-4.5',
      'bytedance/seedream-5-lite',
      'bytedance/seedream-5-pro',
      'ideogram-ai/ideogram-v4-turbo',
      'ideogram-ai/ideogram-v4-balanced',
      'ideogram-ai/ideogram-v4-quality',
      'prunaai/ernie-image',
      'prunaai/ernie-image-turbo',
      'qwen/qwen-image-2-pro',
      'qwen/qwen-image-2',
      'wan-video/wan-2.7-image-pro',
      'wan-video/wan-2.7-image'
    ])
    expect(allOpts.falImageModels).toEqual([
      'fal-ai/hidream-o1-image',
      'microsoft/mai-image-2.5',
      'microsoft/mai-image-2.5-pro',
      'alibaba/qwen-image-3',
      'reve/2.1'
    ])
    expect(allOpts.runwayVideoModels).toEqual(['gen4.5'])
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
      'pixverse/pixverse-v6',
      'runwayml/aleph-2',
      'wan-video/wan-2.7-t2v'
    ])
    expect(allOpts.falVideoModels).toEqual(['minimax/h3', 'fal-ai/pixverse/c1'])

    const cheapestRecraftOpts = buildOptsFromFlags(false, {
      'recraft-image': true
    })
    expect(cheapestRecraftOpts.recraftImageModels).toEqual(['recraftv4_1'])
    expect(collectImageTargets(cheapestRecraftOpts).map((target) => `${target.service}:${target.model}`)).toEqual([
      'recraft:recraftv4_1'
    ])

    const cheapestReplicateOpts = buildOptsFromFlags(false, {
      'replicate-image': true
    })
    expect(cheapestReplicateOpts.replicateImageModels).toEqual(['prunaai/ernie-image-turbo'])
    expect(collectImageTargets(cheapestReplicateOpts).map((target) => `${target.service}:${target.model}`)).toEqual([
      'replicate:prunaai/ernie-image-turbo'
    ])

    const cheapestReplicateVideoOpts = buildOptsFromFlags(false, {
      'replicate-video': true
    })
    expect(cheapestReplicateVideoOpts.replicateVideoModels).toEqual(['pixverse/pixverse-v6'])
    expect(collectVideoTargets(cheapestReplicateVideoOpts).map((target) => `${target.service}:${target.model}`)).toEqual([
      'replicate:pixverse/pixverse-v6'
    ])
  })

  test('Gemini music flag selects targets and participates in all-music shortcut', () => {
    const explicitOpts = buildOptsFromFlags(false, {
      'gemini-music': ['lyria-3-clip-preview', 'lyria-3-pro-preview']
    })

    expect(explicitOpts.geminiMusicModels).toEqual([
      'lyria-3-clip-preview',
      'lyria-3-pro-preview'
    ])
    expect(collectMusicTargets(explicitOpts).map((target) => `${target.service}:${target.model}`)).toEqual([
      'gemini:lyria-3-clip-preview',
      'gemini:lyria-3-pro-preview'
    ])

    const allOpts = buildOptsFromFlags(false, {
      'all-music': true
    })

    expect(allOpts.geminiMusicModels).toEqual([
      'lyria-3-clip-preview',
      'lyria-3-pro-preview'
    ])
    expect(collectMusicTargets(allOpts).map((target) => `${target.service}:${target.model}`)).toEqual([
      'elevenlabs:music_v1',
      'elevenlabs:music_v2',
      'minimax:music-3.0',
      'gemini:lyria-3-clip-preview',
      'gemini:lyria-3-pro-preview'
    ])
  })
})
