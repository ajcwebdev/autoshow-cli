import { describe, expect, test } from 'bun:test'
import { collectMusicTargets } from '~/cli/commands/audio/music/music-targets'
import { collectImageTargets } from '~/cli/commands/visuals/image/image-generation-targets'
import { collectVideoTargets } from '~/cli/commands/visuals/video/video-targets'
import { extractStep2CommandFlags } from '~/cli/flags/extract-flags'
import { normalizeExtractGenericSelectorFlags as normalizeExtractGenericSelectorOccurrences } from '~/cli/flags/service-selector-normalization/extract-selectors'
import { STANDALONE_IMAGE_PROVIDER_TARGETS, STANDALONE_MUSIC_PROVIDER_TARGETS, STANDALONE_TTS_PROVIDER_TARGETS, STANDALONE_VIDEO_PROVIDER_TARGETS } from '~/cli/flags/service-selector-normalization/provider-targets'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { parseFlagsAndOccurrences } from '../../../../test-utils/flag-occurrences'
import { normalizeExtractGenericSelectorFlags, normalizeGenericProviderSelectorFlags, normalizeWriteStepSelectorFlags } from './generic-selector-test-adapters'



describe('provider selection contracts', () => {

  test('dedicated command generic provider selectors normalize to existing runtime option keys', () => {
    const ttsNormalized = normalizeGenericProviderSelectorFlags({
      provider: ['openai=gpt-4o-mini-tts-2025-12-15', 'elevenlabs=eleven_v3']
    }, new Set(['provider']), 'provider', STANDALONE_TTS_PROVIDER_TARGETS, { allProvidersTarget: 'all-tts' })
    const imageNormalized = normalizeGenericProviderSelectorFlags({
      provider: ['openai=gpt-image-2', 'grok=grok-imagine-image-2.0', 'replicate=alibaba/qwen-image-3']
    }, new Set(['provider']), 'provider', STANDALONE_IMAGE_PROVIDER_TARGETS, { allProvidersTarget: 'all-image' })
    const videoNormalized = normalizeGenericProviderSelectorFlags({
      provider: ['gemini=gemini-omni-1.1-flash', 'ltx=ltx-2-5-fast', 'replicate=bytedance/seedance-2.5']
    }, new Set(['provider']), 'provider', STANDALONE_VIDEO_PROVIDER_TARGETS, { allProvidersTarget: 'all-video' })
    const musicNormalized = normalizeGenericProviderSelectorFlags({
      provider: ['minimax=music-3.0', 'gemini=lyria-3.5']
    }, new Set(['provider']), 'provider', STANDALONE_MUSIC_PROVIDER_TARGETS, { allProvidersTarget: 'all-music' })
    expect(() => normalizeGenericProviderSelectorFlags({
      'all-local': true
    }, new Set(['all-local']), 'provider', STANDALONE_TTS_PROVIDER_TARGETS, {
      allProvidersTarget: 'all-tts'
    })).toThrow('--all-local is not supported')
    expect(() => normalizeGenericProviderSelectorFlags({
      'all-local': true
    }, new Set(['all-local']), 'provider', STANDALONE_IMAGE_PROVIDER_TARGETS, {
      allProvidersTarget: 'all-image'
    })).toThrow('--all-local is not supported')

    const ttsOpts = buildOptsFromFlags(ttsNormalized.flags, {}, ttsNormalized.explicitFlags)
    const imageOpts = buildOptsFromFlags(imageNormalized.flags, {}, imageNormalized.explicitFlags)
    const videoOpts = buildOptsFromFlags(videoNormalized.flags, {}, videoNormalized.explicitFlags)
    const musicOpts = buildOptsFromFlags(musicNormalized.flags, {}, musicNormalized.explicitFlags)

    expect(ttsOpts.openaiTtsModels).toEqual(['gpt-4o-mini-tts-2025-12-15'])
    expect(ttsOpts.elevenlabsTtsModels).toEqual(['eleven_v3'])
    expect(collectImageTargets(imageOpts).map((target) => `${target.service}:${target.model}`)).toEqual([
      'openai:gpt-image-2',
      'grok:grok-imagine-image-2.0',
      'replicate:alibaba/qwen-image-3'
    ])
    expect(collectVideoTargets(videoOpts).map((target) => `${target.service}:${target.model}`)).toEqual([
      'gemini:gemini-omni-1.1-flash',
      'ltx:ltx-2-5-fast',
      'replicate:bytedance/seedance-2.5'
    ])
    expect(collectMusicTargets(musicOpts).map((target) => `${target.service}:${target.model}`)).toEqual([
      'minimax:music-3.0',
      'gemini:lyria-3.5'
    ])

    const writeNormalized = normalizeWriteStepSelectorFlags({
      llm: ['grok=grok-4.6', 'together=kimi-k3', 'together=glm-5.3-flash', 'anthropic=claude-sonnet-5', 'anthropic=claude-sonnet-5']
    }, new Set(['llm']))
    const writeOpts = buildOptsFromFlags(writeNormalized.flags, {}, writeNormalized.explicitFlags)
    expect(writeOpts.grokModels).toEqual(['grok-4.6'])
    expect(writeOpts.grokModels?.[0]).toBe('grok-4.6')
    expect(writeOpts.togetherModels).toEqual(['kimi-k3', 'glm-5.3-flash'])
    expect(writeOpts.togetherModels?.[0]).toBe('kimi-k3')
    expect(writeOpts.anthropicModels).toEqual(['claude-sonnet-5'])
    expect(writeOpts.anthropicModels?.[0]).toBe('claude-sonnet-5')

    const imageArgNormalized = normalizeGenericProviderSelectorFlags(
      {
        provider: ['openai=gpt-image-2', 'gemini=gemini-3.1-flash-lite-image', 'replicate=alibaba/qwen-image-3']
      },
      new Set(['provider']),
      'provider',
      STANDALONE_IMAGE_PROVIDER_TARGETS,
      { allProvidersTarget: 'all-image' }
    )
    expect(imageArgNormalized.flagOccurrences.map(({ name, value }) => ({ name, value }))).toEqual([
      { name: 'openai-image', value: 'gpt-image-2' },
      { name: 'gemini-image', value: 'gemini-3.1-flash-lite-image' },
      { name: 'replicate-image', value: 'alibaba/qwen-image-3' }
    ])

    const videoArgNormalized = normalizeGenericProviderSelectorFlags(
      { provider: ['replicate=bytedance/seedance-2.5'] },
      new Set(['provider']),
      'provider',
      STANDALONE_VIDEO_PROVIDER_TARGETS,
      { allProvidersTarget: 'all-video' }
    )
    expect(videoArgNormalized.flagOccurrences.map(({ name, value }) => ({ name, value }))).toEqual([
      { name: 'replicate-video', value: 'bytedance/seedance-2.5' }
    ])
  })

  test('canonical occurrences close the three former map-versus-argv selector drifts', () => {
    const suppressed = parseFlagsAndOccurrences([
      'extract',
      'input.mp3',
      '--all-providers=false',
      '--all-local=no'
    ], extractStep2CommandFlags)
    const suppressedNormalized = normalizeExtractGenericSelectorOccurrences(
      suppressed.flags,
      suppressed.rawParsed.explicitFlags,
      suppressed.rawParsed.flagOccurrences,
      { media: true, document: false }
    )
    expect(suppressedNormalized.flagOccurrences).toEqual([])
    expect(suppressedNormalized.explicitFlags.has('all-providers')).toBe(false)
    expect(suppressedNormalized.explicitFlags.has('all-local')).toBe(false)

    expect(() => normalizeExtractGenericSelectorFlags({
      provider: ['firecrawl', 'supadata']
    }, new Set(['provider']), { media: false, document: false, article: true })).toThrow(
      'Article extract supports one --provider URL backend at a time'
    )

    expect(() => normalizeWriteStepSelectorFlags({
      'all-providers': ['stt', 'llm'],
      'all-local': ['tts']
    }, new Set(['all-providers', 'all-local']))).toThrow('Invalid --all-local step "tts"')
    expect(() => normalizeWriteStepSelectorFlags({
      'all-providers': ['stt', 'llm'],
      'all-local': ['llm']
    }, new Set(['all-providers', 'all-local']))).toThrow('--all-local does not support step "llm"')
    const writeAll = normalizeWriteStepSelectorFlags({
      'all-providers': ['stt', 'llm'],
      'all-local': ['stt']
    }, new Set(['all-providers', 'all-local']))
    expect(writeAll.flagOccurrences.map((occurrence) => occurrence.name)).toEqual([
      'all-stt',
      'all-llm',
      'all-local-stt'
    ])
  })
})
