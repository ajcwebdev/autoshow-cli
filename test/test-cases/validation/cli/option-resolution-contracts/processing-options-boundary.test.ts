import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { buildLLMModelOptions, resolveLLMDefaults } from '~/cli/options/option-resolution/model-option-llm-defaults'
import { buildProcessingOptions } from '~/cli/commands/process-steps/step-1-download/download-targets/single/media-runner'
import { collectSttTargets } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-targets'
import type { MatrixCase, ProcessingOptions, ProcessingSource, ResolvedFlagOptions } from '~/types'
import { buildAggregatedPriceEstimate } from '~/cli/commands/pricing-orchestration/aggregate-pricing'
import { flagOccurrencesFromValues } from '../../../../test-utils/flag-occurrences'
import { withTempDir } from '../../../../test-utils/temp-dirs'

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
  resolvedOptions: ResolvedFlagOptions,
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
      'prompt': ['summary', 'chapters']
    },
    explicitFlags: new Set([
      'provider-concurrency',
      'local-concurrency',
      'youtube-captions',
      'prompt'
    ])
  },
  {
    label: 'config-injected flags',
    flags: {
      'prompt-file': 'custom-prompt.md',
      __autoshowConfigInjectedFlags: [
        'prompt-file'
      ]
    }
  },
  {
    label: 'all-provider shortcuts',
    flags: {
      'all-stt': true,
      'all-llm': true
    },
    explicitFlags: new Set([
      'all-stt',
      'all-llm'
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
