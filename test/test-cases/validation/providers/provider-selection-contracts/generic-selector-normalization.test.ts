import { describe, expect, test } from 'bun:test'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { collectExplicitOcrTargets } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-targets'
import { collectSttTargets } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-targets'
import { collectImageTargets } from '~/cli/commands/process-steps/step-5-image/image-generation-targets'
import { collectVideoTargets } from '~/cli/commands/process-steps/step-6-video/video-targets'
import { collectMusicTargets } from '~/cli/commands/process-steps/step-7-music/music-targets'
import { normalizeExtractGenericSelectorFlags as normalizeExtractGenericSelectorOccurrences } from '~/cli/flags/service-selector-normalization/extract-selectors'
import { normalizeGenericProviderSelectorFlags as normalizeGenericProviderSelectorOccurrences } from '~/cli/flags/service-selector-normalization/generic-provider-selectors'
import { normalizeWriteStepSelectorFlags as normalizeWriteStepSelectorOccurrences } from '~/cli/flags/service-selector-normalization/write-step-selectors'
import { STANDALONE_IMAGE_PROVIDER_TARGETS, STANDALONE_MUSIC_PROVIDER_TARGETS, STANDALONE_TTS_PROVIDER_TARGETS, STANDALONE_VIDEO_PROVIDER_TARGETS } from '~/cli/flags/service-selector-normalization/provider-targets'
import { normalizeResumeSelectorFlagsForTarget as normalizeResumeSelectorOccurrencesForTarget } from '~/cli/commands/setup-and-utilities/resume/resume-dispatch'
import { buildWriteResumeOutputFileName } from '~/cli/commands/setup-and-utilities/resume/write/write-resume'
import type { ExtractSelectorInputRoutes, ResumeTarget, Step3Metadata } from '~/types'
import { flagOccurrencesFromValues, parseFlagsAndOccurrences } from '../../../../test-utils/flag-occurrences'
import { extractStep2CommandFlags } from '~/cli/flags/extract-flags'

const normalizeGenericProviderSelectorFlags = (
  flags: Record<string, unknown>,
  explicitFlags: Set<string>,
  selectorFlag: string,
  targets: Record<string, string>,
  options: { allProvidersTarget?: string, allLocalTarget?: string } = {}
) => normalizeGenericProviderSelectorOccurrences(
  flags,
  explicitFlags,
  flagOccurrencesFromValues(flags, explicitFlags),
  selectorFlag,
  targets,
  options
)

const normalizeWriteStepSelectorFlags = (
  flags: Record<string, unknown>,
  explicitFlags: Set<string>
) => normalizeWriteStepSelectorOccurrences(flags, explicitFlags, flagOccurrencesFromValues(flags, explicitFlags))

const normalizeExtractGenericSelectorFlags = (
  flags: Record<string, unknown>,
  explicitFlags: Set<string>,
  routes: ExtractSelectorInputRoutes
) => normalizeExtractGenericSelectorOccurrences(flags, explicitFlags, flagOccurrencesFromValues(flags, explicitFlags), routes)

const normalizeResumeSelectorFlagsForTarget = (
  target: ResumeTarget,
  flags: Record<string, unknown>,
  explicitFlags: Set<string>,
  _rawArgs: string[]
) => normalizeResumeSelectorOccurrencesForTarget(target, flags, explicitFlags, flagOccurrencesFromValues(flags, explicitFlags))

const normalizeExtractGenericSelectorArgs = (
  argv: string[],
  routes: ExtractSelectorInputRoutes
): string[] => {
  const parsed = parseFlagsAndOccurrences(argv, extractStep2CommandFlags)
  const normalized = normalizeExtractGenericSelectorOccurrences(
    parsed.flags,
    parsed.rawParsed.explicitFlags,
    parsed.rawParsed.flagOccurrences,
    routes
  )
  return normalized.flagOccurrences.flatMap((occurrence) => [
    `--${occurrence.name}`,
    ...(typeof occurrence.value === 'string' ? [occurrence.value] : [])
  ])
}

describe('provider selection contracts', () => {
  test('dedicated command generic provider selectors normalize to existing runtime option keys', () => {
    const ttsNormalized = normalizeGenericProviderSelectorFlags({
      provider: ['openai=gpt-4o-mini-tts-2025-12-15', 'elevenlabs=eleven_v3']
    }, new Set(['provider']), 'provider', STANDALONE_TTS_PROVIDER_TARGETS, { allProvidersTarget: 'all-tts' })
    const imageNormalized = normalizeGenericProviderSelectorFlags({
      provider: ['openai=gpt-image-2', 'grok=grok-imagine-image-quality', 'replicate=wan-video/wan-2.7-image']
    }, new Set(['provider']), 'provider', STANDALONE_IMAGE_PROVIDER_TARGETS, { allProvidersTarget: 'all-image' })
    const videoNormalized = normalizeGenericProviderSelectorFlags({
      provider: ['gemini=veo-3.1-lite-generate-preview', 'ltx=ltx-2-3-fast', 'replicate=bytedance/seedance-2.0-fast']
    }, new Set(['provider']), 'provider', STANDALONE_VIDEO_PROVIDER_TARGETS, { allProvidersTarget: 'all-video' })
    const musicNormalized = normalizeGenericProviderSelectorFlags({
      provider: ['minimax=music-3.0', 'gemini=lyria-3-pro-preview']
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

    const ttsOpts = buildOptsFromFlags(false, ttsNormalized.flags, {}, ttsNormalized.explicitFlags)
    const imageOpts = buildOptsFromFlags(false, imageNormalized.flags, {}, imageNormalized.explicitFlags)
    const videoOpts = buildOptsFromFlags(false, videoNormalized.flags, {}, videoNormalized.explicitFlags)
    const musicOpts = buildOptsFromFlags(false, musicNormalized.flags, {}, musicNormalized.explicitFlags)

    expect(ttsOpts.openaiTtsModels).toEqual(['gpt-4o-mini-tts-2025-12-15'])
    expect(ttsOpts.elevenlabsTtsModels).toEqual(['eleven_v3'])
    expect(collectImageTargets(imageOpts).map((target) => `${target.service}:${target.model}`)).toEqual([
      'openai:gpt-image-2',
      'grok:grok-imagine-image-quality',
      'replicate:wan-video/wan-2.7-image'
    ])
    expect(collectVideoTargets(videoOpts).map((target) => `${target.service}:${target.model}`)).toEqual([
      'gemini:veo-3.1-lite-generate-preview',
      'ltx:ltx-2-3-fast',
      'replicate:bytedance/seedance-2.0-fast'
    ])
    expect(collectMusicTargets(musicOpts).map((target) => `${target.service}:${target.model}`)).toEqual([
      'minimax:music-3.0',
      'gemini:lyria-3-pro-preview'
    ])

    const writeNormalized = normalizeWriteStepSelectorFlags({
      llm: ['grok=grok-4.5', 'together=kimi-k2.6', 'together=glm-5.1', 'cerebras=gpt-oss-120b', 'cerebras=zai-glm-4.7']
    }, new Set(['llm']))
    const writeOpts = buildOptsFromFlags(false, writeNormalized.flags, {}, writeNormalized.explicitFlags)
    expect(writeOpts.grokModels).toEqual(['grok-4.5'])
    expect(writeOpts.grokModel).toBe('grok-4.5')
    expect(writeOpts.togetherModels).toEqual(['kimi-k2.6', 'glm-5.1'])
    expect(writeOpts.togetherModel).toBe('kimi-k2.6')
    expect(writeOpts.cerebrasModels).toEqual(['gpt-oss-120b', 'zai-glm-4.7'])
    expect(writeOpts.cerebrasModel).toBe('gpt-oss-120b')

    const imageArgNormalized = normalizeGenericProviderSelectorFlags(
      {
        provider: ['openai=gpt-image-2', 'gemini=gemini-3.1-flash-lite-image', 'replicate=wan-video/wan-2.7-image']
      },
      new Set(['provider']),
      'provider',
      STANDALONE_IMAGE_PROVIDER_TARGETS,
      { allProvidersTarget: 'all-image' }
    )
    expect(imageArgNormalized.flagOccurrences.map(({ name, value }) => ({ name, value }))).toEqual([
      { name: 'openai-image', value: 'gpt-image-2' },
      { name: 'gemini-image', value: 'gemini-3.1-flash-lite-image' },
      { name: 'replicate-image', value: 'wan-video/wan-2.7-image' }
    ])

    const videoArgNormalized = normalizeGenericProviderSelectorFlags(
      { provider: ['replicate=bytedance/seedance-2.0-fast'] },
      new Set(['provider']),
      'provider',
      STANDALONE_VIDEO_PROVIDER_TARGETS,
      { allProvidersTarget: 'all-video' }
    )
    expect(videoArgNormalized.flagOccurrences.map(({ name, value }) => ({ name, value }))).toEqual([
      { name: 'replicate-video', value: 'bytedance/seedance-2.0-fast' }
    ])
  })

  test('write step-scoped --all-local normalizes local provider groups and rejects bare usage', () => {
    const normalized = normalizeWriteStepSelectorFlags({
      'all-local': ['stt', 'ocr', 'url']
    }, new Set(['all-local']))

    expect(normalized.flags).toMatchObject({
      'all-local-stt': true,
      'all-local-ocr': true,
      'all-local-url': true
    })
    expect(normalized.flags['all-local-llm']).toBeUndefined()
    expect(normalized.flags['all-local-tts']).toBeUndefined()
    expect(normalized.flags['all-local-image']).toBeUndefined()
    expect(normalized.flags['all-local-video']).toBeUndefined()
    expect(normalized.flags['all-local-music']).toBeUndefined()
    expect(normalized.explicitFlags.has('all-local-stt')).toBe(true)
    expect(normalized.explicitFlags.has('all-local')).toBe(false)

    expect(() => normalizeWriteStepSelectorFlags({
      'all-local': ['llm']
    }, new Set(['all-local']))).toThrow('--all-local does not support step "llm"')

    expect(() => normalizeWriteStepSelectorFlags({
      'all-local': ['image']
    }, new Set(['all-local']))).toThrow('--all-local does not support step "image"')

    expect(() => normalizeWriteStepSelectorFlags({
      'all-local': ['tts']
    }, new Set(['all-local']))).toThrow('--all-local does not support step "tts"')

    expect(() => normalizeWriteStepSelectorFlags({
      'all-local': true
    }, new Set(['all-local']))).toThrow('--all-local requires a step')
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
    }, new Set(['all-providers', 'all-local']))).toThrow('--all-local does not support step "tts"')
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

  test('write resume generic providers normalize to LLM runtime option keys', () => {
    const normalized = normalizeResumeSelectorFlagsForTarget({
      kind: 'write',
      scope: 'single',
      dir: '/tmp/write-run',
      manifestPath: '/tmp/write-run/manifest.json'
    }, {
      provider: ['together=kimi-k2.6', 'together=glm-5.1', 'cerebras=gpt-oss-120b', 'cerebras=zai-glm-4.7']
    }, new Set(['provider']), [
      'resume',
      '/tmp/write-run',
      '--provider',
      'together=kimi-k2.6',
      '--provider',
      'together=glm-5.1',
      '--provider',
      'cerebras=gpt-oss-120b',
      '--provider',
      'cerebras=zai-glm-4.7'
    ])
    const opts = buildOptsFromFlags(false, normalized.flags, {}, normalized.explicitFlags, normalized.flagOccurrences)

    expect(normalized.flagOccurrences.map(({ name, value }) => ({ name, value }))).toEqual([
      { name: 'together', value: 'kimi-k2.6' },
      { name: 'together', value: 'glm-5.1' },
      { name: 'cerebras', value: 'gpt-oss-120b' },
      { name: 'cerebras', value: 'zai-glm-4.7' }
    ])
    expect(opts.togetherModels).toEqual(['kimi-k2.6', 'glm-5.1'])
    expect(opts.cerebrasModels).toEqual(['gpt-oss-120b', 'zai-glm-4.7'])
  })

  test('write resume filenames keep duplicate short model selectors service-qualified', () => {
    const existingEntries: Step3Metadata[] = [
      {
        llmService: 'glm',
        llmModel: 'glm-5.1',
        processingTime: 1,
        inputTokenCount: 1,
        outputTokenCount: 1,
        outputFileName: 'text-glm-5.1.json',
        outputFormat: 'json',
        structuredMode: 'native',
        structuredPresetNames: ['shortSummary']
      },
      {
        llmService: 'kimi',
        llmModel: 'kimi-k2.6',
        processingTime: 1,
        inputTokenCount: 1,
        outputTokenCount: 1,
        outputFileName: 'text-kimi-k2.6.json',
        outputFormat: 'json',
        structuredMode: 'native',
        structuredPresetNames: ['shortSummary']
      }
    ]
    const selectedTargets = [
      { service: 'together' as const, model: 'kimi-k2.6' },
      { service: 'together' as const, model: 'glm-5.1' },
      { service: 'cerebras' as const, model: 'gpt-oss-120b' },
      { service: 'cerebras' as const, model: 'zai-glm-4.7' }
    ]
    const reservedFileNames = new Set(existingEntries.map((entry) => entry.outputFileName))

    expect(buildWriteResumeOutputFileName({
      target: selectedTargets[0]!,
      selectedTargets,
      existingEntries,
      reservedFileNames
    })).toBe('text-together-kimi-k2.6.json')
    expect(buildWriteResumeOutputFileName({
      target: selectedTargets[1]!,
      selectedTargets,
      existingEntries,
      reservedFileNames
    })).toBe('text-together-glm-5.1.json')
    expect(buildWriteResumeOutputFileName({
      target: selectedTargets[2]!,
      selectedTargets,
      existingEntries,
      reservedFileNames
    })).toBe('text-gpt-oss-120b.json')
    expect(buildWriteResumeOutputFileName({
      target: selectedTargets[3]!,
      selectedTargets,
      existingEntries,
      reservedFileNames
    })).toBe('text-zai-glm-4.7.json')
  })

  test('extract generic provider selectors route to STT or OCR internal keys', () => {
    const mediaNormalized = normalizeExtractGenericSelectorFlags({
      provider: ['mistral=voxtral-mini-2602']
    }, new Set(['provider']), { media: true, document: false })
    const documentNormalized = normalizeExtractGenericSelectorFlags({
      provider: ['glm=glm-ocr']
    }, new Set(['provider']), { media: false, document: true })
    const grokDocumentNormalized = normalizeExtractGenericSelectorFlags({
      provider: ['grok=grok-4.3']
    }, new Set(['provider']), { media: false, document: true })
    const mixedDefaultNormalized = normalizeExtractGenericSelectorFlags({
      provider: ['mistral']
    }, new Set(['provider']), { media: true, document: true })
    const grokMixedDefaultNormalized = normalizeExtractGenericSelectorFlags({
      provider: ['grok']
    }, new Set(['provider']), { media: true, document: true })
    const localMixedNormalized = normalizeExtractGenericSelectorFlags({
      'all-local': true
    }, new Set(['all-local']), { media: true, document: true, article: true })

    expect(buildOptsFromFlags(false, mediaNormalized.flags, {}, mediaNormalized.explicitFlags).mistralSttModels).toEqual(['voxtral-mini-2602'])
    expect(buildOptsFromFlags(false, documentNormalized.flags, {}, documentNormalized.explicitFlags).glmOcrModels).toEqual(['glm-ocr'])
    expect(buildOptsFromFlags(false, grokDocumentNormalized.flags, {}, grokDocumentNormalized.explicitFlags).grokOcrModels).toEqual(['grok-4.3'])
    const mixedDefaultOpts = buildOptsFromFlags(false, mixedDefaultNormalized.flags, {}, mixedDefaultNormalized.explicitFlags)
    expect(mixedDefaultOpts.mistralSttModels).toEqual(['voxtral-mini-2602'])
    expect(mixedDefaultOpts.mistralOcrModels).toEqual(['mistral-ocr-2512'])
    const grokMixedDefaultOpts = buildOptsFromFlags(false, grokMixedDefaultNormalized.flags, {}, grokMixedDefaultNormalized.explicitFlags)
    expect(grokMixedDefaultOpts.grokSttModels).toEqual(['speech-to-text'])
    expect(grokMixedDefaultOpts.grokOcrModels).toEqual(['grok-4.3'])
    expect(localMixedNormalized.flags).toMatchObject({
      'all-local-stt': true,
      'all-local-ocr': true,
      'all-local-url': true
    })
    const localMixedOpts = buildOptsFromFlags(false, localMixedNormalized.flags, {}, localMixedNormalized.explicitFlags)
    expect(collectSttTargets(localMixedOpts).map((target) => target.service)).toContain('whisper')
    expect(collectExplicitOcrTargets(localMixedOpts).map((target) => target.service)).toEqual([
      'tesseract'
    ])
    expect(localMixedOpts.urlBackends).toEqual(['defuddle'])

    const articleNormalized = normalizeExtractGenericSelectorFlags({
      provider: ['firecrawl']
    }, new Set(['provider']), { media: false, document: false, article: true })
    expect(articleNormalized.flags['url-provider']).toBe('firecrawl')
    expect(articleNormalized.explicitFlags.has('url-provider')).toBe(true)
    expect(buildOptsFromFlags(false, articleNormalized.flags, {}, articleNormalized.explicitFlags).urlBackend).toBe('firecrawl')
    expect(() => normalizeExtractGenericSelectorFlags({
      provider: ['firecrawl=reader-v1']
    }, new Set(['provider']), { media: false, document: false, article: true })).toThrow('does not accept a model')

    const routeAwareDocumentArgs = normalizeExtractGenericSelectorArgs([
      'extract',
      'input/examples/document/1-document.pdf',
      '--provider',
      'glm=glm-ocr',
      '--price'
    ], { media: false, document: true })
    expect(routeAwareDocumentArgs).toEqual([
      '--glm-ocr',
      'glm-ocr',
      '--price'
    ])
    expect(normalizeExtractGenericSelectorArgs([
      'extract',
      'input/examples/document/1-document.pdf',
      '--provider',
      'grok=grok-4.3',
      '--price'
    ], { media: false, document: true })).toEqual([
      '--grok-ocr',
      'grok-4.3',
      '--price'
    ])
    expect(normalizeExtractGenericSelectorArgs([
      'extract',
      'https://ajc.pics/autoshow/examples/0-audio-short.mp3',
      '--provider=mistral=voxtral-mini-2602',
      '--price'
    ], { media: true, document: false })).toEqual([
      '--mistral-stt',
      'voxtral-mini-2602',
      '--price'
    ])
    expect(normalizeExtractGenericSelectorArgs([
      'extract',
      'input/examples/batch/2-urls.md',
      '--provider',
      'mistral'
    ], { media: true, document: true })).toEqual([
      '--mistral-stt',
      '--mistral-ocr'
    ])
    expect(normalizeExtractGenericSelectorArgs([
      'extract',
      'input/examples/batch/2-urls.md',
      '--provider',
      'grok'
    ], { media: true, document: true })).toEqual([
      '--grok-stt',
      '--grok-ocr'
    ])
    expect(normalizeExtractGenericSelectorArgs([
      'extract',
      'input/examples/batch/2-urls.md',
      '--all-local'
    ], { media: true, document: true, article: true })).toEqual([
      '--all-local-stt',
      '--all-local-ocr',
      '--all-local-url'
    ])
    expect(normalizeExtractGenericSelectorArgs([
      'extract',
      'https://article.test/story.html',
      '--provider',
      'firecrawl'
    ], { media: false, document: false, article: true })).toEqual([
      '--url-provider',
      'firecrawl'
    ])

    const routeAwareDocumentOpts = buildOptsFromFlags(false, documentNormalized.flags, {}, documentNormalized.explicitFlags, documentNormalized.flagOccurrences)
    expect(routeAwareDocumentOpts.glmOcrModels).toEqual(['glm-ocr'])
    expect(routeAwareDocumentOpts.glmModels).toBeUndefined()

    expect(() => normalizeExtractGenericSelectorFlags({
      provider: ['mistral=mistral-ocr-2512']
    }, new Set(['provider']), { media: true, document: true })).toThrow('--provider mistral=<model> is ambiguous')
  })
})
