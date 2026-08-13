import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { buildLLMModelOptions, resolveLLMDefaults } from '~/cli/options/option-resolution/model-option-llm-defaults'
import { buildProcessingOptions } from '~/cli/commands/process-steps/step-1-download/download-targets/single/media-runner'
import { collectSttTargets } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-targets'
import type { ProcessingOptions, ProcessingSource } from '~/types'
import { DEFAULT_TTS_CHUNK_CONCURRENCY } from '~/utils/concurrency-defaults'
import { buildAggregatedPriceEstimate } from '~/cli/commands/pricing-orchestration/aggregate-pricing'
import { flagOccurrencesFromValues } from '../../../../test-utils/flag-occurrences'
import { withTempDir } from '../../../../test-utils/temp-dirs'

type ResolvedOptions = ReturnType<typeof buildOptsFromFlags>

const sourceKeys = new Set(['url', 'filePath'])
const defaultResolvedOptions = buildOptsFromFlags(false, {})
const positiveProcessingKeys = Object.keys(buildProcessingOptions(
  { url: 'https://example.com/reference' },
  '/tmp/reference-output',
  defaultResolvedOptions
)).filter((key) => !sourceKeys.has(key)).sort()

const expectComposedValueParity = (
  source: ProcessingSource,
  outputDir: string,
  resolvedOptions: ResolvedOptions,
  actual: ProcessingOptions
): void => {
  const actualRecord = actual as Record<string, unknown>
  const resolvedRecord = resolvedOptions as Record<string, unknown>
  const llmRecord = buildLLMModelOptions(resolveLLMDefaults(resolvedOptions)) as Record<string, unknown>
  const actualPositiveKeys = Object.keys(actualRecord).filter((key) => !sourceKeys.has(key)).sort()

  expect(actualPositiveKeys).toEqual(positiveProcessingKeys)
  expect(actual.outputDir).toBe(outputDir)
  expect('url' in actual).toBe('url' in source)
  expect('filePath' in actual).toBe('filePath' in source)

  for (const key of positiveProcessingKeys) {
    if (key === 'outputDir') {
      continue
    }
    const expected = key in llmRecord ? llmRecord[key] : resolvedRecord[key]
    expect(actualRecord[key], `composed value for ${key}`).toEqual(expected)
  }
}

type MatrixCase = {
  label: string
  flags: Record<string, unknown>
  explicitFlags?: Set<string>
}

const MATRIX: MatrixCase[] = [
  {
    label: 'defaults',
    flags: {}
  },
  {
    label: 'explicit flags',
    flags: {
      'provider-concurrency': '4',
      'local-concurrency': '2',
      'tts-chunk-concurrency': '7',
      'youtube-captions': true,
      'prompt': ['summary', 'chapters'],
      'image-size': '1024x1024',
      'video-duration': '8',
      'music-duration': '45'
    },
    explicitFlags: new Set([
      'provider-concurrency',
      'local-concurrency',
      'tts-chunk-concurrency',
      'youtube-captions',
      'prompt',
      'image-size',
      'video-duration',
      'music-duration'
    ])
  },
  {
    label: 'config-injected flags',
    flags: {
      'image-provider-concurrency': '6',
      'video-local-concurrency': '3',
      'music-provider-concurrency': '5',
      'prompt-file': 'custom-prompt.md',
      __autoshowConfigInjectedFlags: [
        'image-provider-concurrency',
        'video-local-concurrency',
        'music-provider-concurrency',
        'prompt-file'
      ]
    }
  },
  {
    label: 'all-provider shortcuts',
    flags: {
      'all-stt': true,
      'all-llm': true,
      'all-tts': true,
      'all-image': true,
      'all-video': true,
      'all-music': true
    },
    explicitFlags: new Set([
      'all-stt',
      'all-llm',
      'all-tts',
      'all-image',
      'all-video',
      'all-music'
    ])
  }
]

describe('processing-options boundary differential', () => {
  test('positive composition has a stable two-direction key surface for URL and file sources', () => {
    const urlOptions = buildProcessingOptions({ url: 'https://example.com/watch' }, '/tmp/output', defaultResolvedOptions)
    const fileOptions = buildProcessingOptions({ filePath: '/tmp/input.mp4' }, '/tmp/output', defaultResolvedOptions)

    expect(Object.keys(urlOptions).filter((key) => !sourceKeys.has(key)).sort()).toEqual(positiveProcessingKeys)
    expect(Object.keys(fileOptions).filter((key) => !sourceKeys.has(key)).sort()).toEqual(positiveProcessingKeys)
  })

  test('option resolution supplies every retired schema default before projection', () => {
    const runtimeOptions = buildOptsFromFlags(false, {})
    const options = buildProcessingOptions({ url: 'https://example.com/watch' }, '/tmp/output', runtimeOptions)

    expect(options.llmProviderConcurrency).toBe(runtimeOptions.llmProviderConcurrency)
    expect(options.llmLocalConcurrency).toBe(runtimeOptions.llmLocalConcurrency)
    expect(options.ttsProviderConcurrency).toBe(runtimeOptions.ttsProviderConcurrency)
    expect(options.ttsLocalConcurrency).toBe(runtimeOptions.ttsLocalConcurrency)
    expect(options.ttsChunkConcurrency).toBe(DEFAULT_TTS_CHUNK_CONCURRENCY)
    expect(options.imageProviderConcurrency).toBe(runtimeOptions.imageProviderConcurrency)
    expect(options.imageLocalConcurrency).toBe(runtimeOptions.imageLocalConcurrency)
    expect(options.videoProviderConcurrency).toBe(runtimeOptions.videoProviderConcurrency)
    expect(options.videoLocalConcurrency).toBe(runtimeOptions.videoLocalConcurrency)
    expect(options.musicProviderConcurrency).toBe(runtimeOptions.musicProviderConcurrency)
    expect(options.musicLocalConcurrency).toBe(runtimeOptions.musicLocalConcurrency)
  })

  test('the narrowed STT and write-pricing inputs preserve resolved-option behavior', async () => {
    await withTempDir('autoshow-processing-options-', async (tempDir) => {
      const inputPath = join(tempDir, 'input.mp4')
      await Bun.write(inputPath, new Uint8Array())
      const runtimeOptions = buildOptsFromFlags(false, {})
      const processingOptions = buildProcessingOptions({ filePath: inputPath }, '/tmp/output', runtimeOptions)

      expect(collectSttTargets(processingOptions)).toEqual(collectSttTargets(runtimeOptions))
      expect(await buildAggregatedPriceEstimate('write', inputPath, processingOptions)).toEqual(
        await buildAggregatedPriceEstimate('write', inputPath, runtimeOptions)
      )
    })
  })

  for (const matrixCase of MATRIX) {
    for (const source of [
      { url: 'https://example.com/watch' } as const,
      { filePath: '/tmp/input.mp4' } as const
    ]) {
      const sourceLabel = 'url' in source ? 'URL' : 'file'

      test(`${matrixCase.label} preserves the retired boundary values for ${sourceLabel} input`, () => {
        const explicitFlags = matrixCase.explicitFlags ?? new Set<string>()
        const runtimeOptions = buildOptsFromFlags(
          false,
          matrixCase.flags,
          {},
          explicitFlags,
          flagOccurrencesFromValues(matrixCase.flags, explicitFlags)
        )
        const actual = buildProcessingOptions(source, '/tmp/output', runtimeOptions)

        expectComposedValueParity(source, '/tmp/output', runtimeOptions, actual)
        expect(collectSttTargets(actual)).toEqual(collectSttTargets(runtimeOptions))
      })
    }
  }
})
