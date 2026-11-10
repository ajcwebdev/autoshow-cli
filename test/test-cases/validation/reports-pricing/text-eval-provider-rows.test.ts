import { describe, expect, test } from 'bun:test'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { withTempDir } from '../../../test-utils/temp-dirs'

type ProviderRow = Record<string, unknown>
type BuildRows = (runDir: string, manifestRecord: { metadata: Record<string, unknown> }) => ProviderRow[]

// The consensus text library is outside the repository type-check include; a computed
// specifier keeps it a runtime-only dependency of this characterization test.
const libraryPath = join(import.meta.dir, '../../../../.codex/skills/consensus/scripts/text/text_eval_lib.ts')
const { buildTextProviderRows } = await import(libraryPath) as { buildTextProviderRows: BuildRows }

const ROW_KEYS = [
  'providerKey', 'provider', 'model', 'group', 'llmService', 'llmModel',
  'processingTimeMs', 'actualProcessingTimeMs', 'estimatedProcessingTimeMs', 'msPerUnit',
  'throughputValue', 'throughputUnit', 'rateBasis', 'timingScope', 'inputMetric', 'inputValue', 'timingSource',
  'costCents', 'actualCostCents', 'estimatedCostCents', 'costSource',
  'inputTokenCount', 'outputTokenCount', 'totalTokenCount', 'tokenCountSource', 'providerUsage', 'rawProviderUsage',
  'outputFileName', 'outputExists', 'outputByteSize', 'structuredMode', 'structuredPresetNames',
  'automatedQualityScore', 'humanQualityScore', 'qualityMetric', 'qualityValue', 'qualityLabel', 'metrics',
]

describe('Text consensus provider rows', () => {
  test('derives timing, cost, output, and quality fields from step3 entries in a stable key order', async () => {
    await withTempDir('text-eval-provider-rows-', async runDir => {
      writeFileSync(join(runDir, 'zeta.md'), 'twelve bytes')
      const rows = buildTextProviderRows(runDir, { metadata: {
        step3: [
          {
            llmService: 'zeta', llmModel: 'large', processingTime: 3000, inputTokenCount: 1000, outputTokenCount: 500,
            outputFileName: 'zeta.md', tokenCountSource: 'provider', providerUsage: { total: 1500 }, rawProviderUsage: 0,
            structuredMode: 'json', structuredPresetNames: ['summary'], textQualityScore: 0.5, humanQualityScore: 4,
          },
          { llmService: 'alpha', llmModel: 'small', outputFileName: 'absent.md', providerUsage: 'invalid' },
        ],
        cost: {
          actual: { steps: [{ step: 'llm', provider: 'zeta', model: 'large', cost: 2.5 }, { step: 'tts', provider: 'alpha', model: 'small', cost: 9 }] },
          estimated: { steps: [{ provider: 'alpha', model: 'small', estimatedCostCents: 0.75 }, { provider: 'zeta', model: 'large', cost: 99 }] },
        },
        timing: {
          estimated: { steps: [{ step: 'llm', provider: 'alpha', model: 'small', processingTimeMs: 800, throughputValue: 12, throughputUnit: 'tok/s' }] },
        },
      } })

      expect(rows.map(row => row['providerKey'])).toEqual(['alpha/small', 'zeta/large'])
      for (const row of rows) expect(Object.keys(row)).toEqual(ROW_KEYS)
      expect(rows[0]).toEqual({
        providerKey: 'alpha/small', provider: 'alpha', model: 'small', group: 'service', llmService: 'alpha', llmModel: 'small',
        processingTimeMs: 800, actualProcessingTimeMs: null, estimatedProcessingTimeMs: 800, msPerUnit: null,
        throughputValue: 12, throughputUnit: 'tok/s', rateBasis: null, timingScope: null, inputMetric: null, inputValue: null, timingSource: 'estimated',
        costCents: 0.75, actualCostCents: null, estimatedCostCents: 0.75, costSource: 'estimated',
        inputTokenCount: 0, outputTokenCount: 0, totalTokenCount: 0, tokenCountSource: null, providerUsage: null, rawProviderUsage: null,
        outputFileName: 'absent.md', outputExists: false, outputByteSize: null, structuredMode: null, structuredPresetNames: [],
        automatedQualityScore: null, humanQualityScore: null, qualityMetric: null, qualityValue: null, qualityLabel: null,
        metrics: { inputTokenCount: 0, outputTokenCount: 0, totalTokenCount: 0, msPerUnit: null },
      })
      expect(rows[1]).toEqual({
        providerKey: 'zeta/large', provider: 'zeta', model: 'large', group: 'service', llmService: 'zeta', llmModel: 'large',
        processingTimeMs: 3000, actualProcessingTimeMs: null, estimatedProcessingTimeMs: null, msPerUnit: 2000,
        throughputValue: null, throughputUnit: null, rateBasis: '1KTokens', timingScope: null, inputMetric: 'tokens', inputValue: 1500,
        timingSource: 'metadata.step3.processingTime',
        costCents: 2.5, actualCostCents: 2.5, estimatedCostCents: null, costSource: 'actual',
        inputTokenCount: 1000, outputTokenCount: 500, totalTokenCount: 1500, tokenCountSource: 'provider', providerUsage: { total: 1500 }, rawProviderUsage: 0,
        outputFileName: 'zeta.md', outputExists: true, outputByteSize: 12, structuredMode: 'json', structuredPresetNames: ['summary'],
        automatedQualityScore: 0.5, humanQualityScore: 4, qualityMetric: 'explicit text quality score', qualityValue: 0.5,
        qualityLabel: '0.50 explicit text quality score',
        metrics: { inputTokenCount: 1000, outputTokenCount: 500, totalTokenCount: 1500, msPerUnit: 2000, automatedQualityScore: 0.5, textQualityScore: 0.5, humanQualityScore: 4 },
      })
      expect(Object.keys(rows[1]!['metrics'] as object)).toEqual([
        'inputTokenCount', 'outputTokenCount', 'totalTokenCount', 'msPerUnit', 'automatedQualityScore', 'textQualityScore', 'humanQualityScore',
      ])
    })
  })

  test('rejects a missing step3 list and entries without a service and model', () => {
    expect(() => buildTextProviderRows('unused', { metadata: {} })).toThrow('Text benchmark canonical manifest item must contain metadata.step3.')
    expect(() => buildTextProviderRows('unused', { metadata: { step3: [{ llmService: 'a', llmModel: 'b' }, { llmService: 'a', llmModel: '' }] } }))
      .toThrow('Text benchmark metadata.step3[1] must include llmService and llmModel.')
  })
})
