import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { buildProcessingOptions } from '~/cli/commands/process-steps/step-1-download/download-targets/single/media-runner'
import { collectSttTargets } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-targets'
import type { MatrixCase, ProcessingOptions, ProcessingSource, ResolvedFlagOptions } from '~/types'
import { buildAggregatedPriceEstimate } from '~/cli/commands/pricing-orchestration/aggregate-pricing'
import { flagOccurrencesFromValues } from '../../../../test-utils/flag-occurrences'
import { withTempDir } from '../../../../test-utils/temp-dirs'

const sourceKeys = new Set(['url', 'filePath'])
const writeOnlyProcessingKeys = new Set([
  'skipLLM',
  'prompts',
  'promptFile',
  'renderedText',
  'renderedOutDir',
  'trackList',
  'promptMd',
  'llmProviderConcurrency',
  'llmLocalConcurrency'
])
const defaultResolvedOptions = buildOptsFromFlags({})
const positiveProcessingKeys = Object.keys(buildProcessingOptions(
  { url: 'https://example.com/reference' },
  '/tmp/reference-output',
  defaultResolvedOptions
)).filter((key) => !sourceKeys.has(key)).sort()

const expectComposedValueParity = (
  source: ProcessingSource,
  outputDir: string,
  resolvedOptions: ResolvedFlagOptions,
  actual: ProcessingOptions
): void => {
  const actualRecord = actual as Record<string, unknown>
  const resolvedRecord = resolvedOptions as Record<string, unknown>
  const actualPositiveKeys = Object.keys(actualRecord).filter((key) => !sourceKeys.has(key)).sort()

  expect(actualPositiveKeys).toEqual(positiveProcessingKeys)
  expect(actualPositiveKeys.some((key) => writeOnlyProcessingKeys.has(key))).toBe(false)
  expect(actual.outputDir).toBe(outputDir)
  expect('url' in actual).toBe('url' in source)
  expect('filePath' in actual).toBe('filePath' in source)

  for (const key of positiveProcessingKeys) {
    if (key === 'outputDir') {
      continue
    }
    expect(actualRecord[key], `composed value for ${key}`).toEqual(resolvedRecord[key])
  }
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
      'youtube-captions': true,
      split: true
    },
    explicitFlags: new Set([
      'provider-concurrency',
      'local-concurrency',
      'youtube-captions',
      'split'
    ])
  },
  {
    label: 'config-injected flags',
    flags: {
      'youtube-captions': true,
      __autoshowConfigInjectedFlags: [
        'youtube-captions'
      ]
    }
  },
  {
    label: 'all-provider shortcuts',
    flags: {
      'all-stt': true
    },
    explicitFlags: new Set([
      'all-stt'
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

  test('extract projection keeps STT and source fields without write-only LLM options', () => {
    const runtimeOptions = buildOptsFromFlags({})
    const options = buildProcessingOptions({ url: 'https://example.com/watch' }, '/tmp/output', runtimeOptions)

    expect(options.youtubeCaptions).toBe(runtimeOptions.youtubeCaptions)
    expect(options.split).toBe(runtimeOptions.split)
    expect(options.whisperModels).toBe(runtimeOptions.whisperModels)
    expect('skipLLM' in options).toBe(false)
    expect('prompts' in options).toBe(false)
    expect('llmProviderConcurrency' in options).toBe(false)
  })

  test('the narrowed STT and extract-pricing inputs preserve resolved-option behavior', async () => {
    await withTempDir('autoshow-processing-options-', async (tempDir) => {
      const inputPath = join(tempDir, 'input.mp4')
      await Bun.write(inputPath, new Uint8Array())
      const runtimeOptions = buildOptsFromFlags({})
      const processingOptions = buildProcessingOptions({ filePath: inputPath }, '/tmp/output', runtimeOptions)

      expect(collectSttTargets(processingOptions)).toEqual(collectSttTargets(runtimeOptions))
      expect(await buildAggregatedPriceEstimate('extract', inputPath, processingOptions)).toEqual(
        await buildAggregatedPriceEstimate('extract', inputPath, runtimeOptions)
      )
    })
  })

  for (const matrixCase of MATRIX) {
    for (const source of [
      { url: 'https://example.com/watch' } as const,
      { filePath: '/tmp/input.mp4' } as const
    ]) {
      const sourceLabel = 'url' in source ? 'URL' : 'file'

      test(`${matrixCase.label} preserves extract processing options for ${sourceLabel} input`, () => {
        const explicitFlags = matrixCase.explicitFlags ?? new Set<string>()
        const runtimeOptions = buildOptsFromFlags(matrixCase.flags, {}, explicitFlags, { flagOccurrences: flagOccurrencesFromValues(matrixCase.flags, explicitFlags) })
        const actual = buildProcessingOptions(source, '/tmp/output', runtimeOptions)

        expectComposedValueParity(source, '/tmp/output', runtimeOptions, actual)
        expect(collectSttTargets(actual)).toEqual(collectSttTargets(runtimeOptions))
      })
    }
  }
})
