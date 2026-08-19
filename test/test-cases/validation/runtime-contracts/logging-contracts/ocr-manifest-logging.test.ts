import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { getOcrTargetDirectoryName } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-targets'
import { collectPartialStep2Metadata } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-partial-step2'
import { buildWriteManifestConsoleSummary, logExtractManifestConsoleSummary } from '~/cli/commands/process-steps/write-manifest-log/write-manifest-log'
import { renderHumanTable } from '~/utils/app-logger/human-table/human-table'
import { stripAnsi } from '~/utils/terminal-colors'
import {
  createOcrCostDiagnosticsMetadata,
  createPartialOcrDiagnosticsMetadata
} from './ocr-logging-fixtures'
import { createCapturingLogger } from './shared'

describe('OCR manifest logging contracts', () => {
  test('extract manifest summary includes OCR cost calculation diagnostics', () => {
    const metadata = createOcrCostDiagnosticsMetadata()
    const summary = buildWriteManifestConsoleSummary(metadata)

    expect(summary.runSummary?.rows[0]).toMatchObject({
      step: 'Extract',
      providerModel: 'openai/gpt-5.4-nano',
      predictedCostCents: 0.58044,
      actualCostCents: 0.3075
    })
    expect(summary.promptUsage?.rows[0]).toMatchObject({
      step: 'Extract',
      providerModel: 'openai/gpt-5.4-nano',
      usage: '6000/1500 tok'
    })
    expect(summary.ocrCostCalculation?.rows[0]).toMatchObject({
      providerModel: 'openai/gpt-5.4-nano',
      pages: 2,
      predictedInputs: '5972/3688 tok',
      actualInputs: '6000/1500 tok',
      rates: '20\u00a2/1M in / 125\u00a2/1M out',
      predictedCostCents: 0.58044,
      actualCostCents: 0.3075,
      deltaCents: -0.27294
    })
    expect(summary.ocrCostCalculation?.rows[1]).toMatchObject({
      providerModel: 'gemini/gemini-3.1-flash-lite',
      pages: 690,
      predictedInputs: '600000/300000 tok',
      actualInputs: '806511/401834 tok; retries p38,p447,p660 +111696 out',
      rates: '10\u00a2/1M in / 40\u00a2/1M out',
      predictedCostCents: 60,
      actualCostCents: 74,
      deltaCents: 14
    })

    const { logger, writes } = createCapturingLogger()
    const outputDir = join(process.cwd(), 'autoshow-run')
    logExtractManifestConsoleSummary(outputDir, metadata, {}, logger)
    expect(writes.map(write => write.message)).toEqual([
      'Locations',
      'Run Summary',
      'Prompt Usage',
      'OCR Cost Calculation'
    ])
    expect(writes[0]?.options?.humanTable).toMatchObject({
      columns: ['artifact', 'path'],
      rows: [{ artifact: 'manifest', path: join(outputDir, 'manifest.json') }]
    })
    expect(writes[3]?.options?.humanTable?.columns).toEqual([
      'providerModel',
      'pages',
      'predInputs',
      'actInputs',
      'rates',
      'predCost',
      'actCost',
      'delta'
    ])

    const renderedOcrCost = summary.ocrCostCalculation?.humanTable
      ? stripAnsi(renderHumanTable(summary.ocrCostCalculation.humanTable))
      : ''
    expect(renderedOcrCost).toContain('806511/401834 tok; retries p38,p447,p660 +111696 out')
    expect(renderedOcrCost).toContain('6000/1500 tok')
  })

  test('extract manifest summary marks partial failed OCR provider usage', () => {
    const summary = buildWriteManifestConsoleSummary(createPartialOcrDiagnosticsMetadata())

    expect(summary.runSummary?.rows[1]).toMatchObject({
      step: 'Extract (partial)',
      providerModel: 'kimi/kimi-latest (failed partial)',
      actualCostSource: 'partial_provider_usage',
      actualInputMetric: 'pages',
      actualInputValue: 227
    })
    expect(summary.promptUsage?.rows[1]).toMatchObject({
      step: 'Extract (partial)',
      providerModel: 'kimi/kimi-latest (failed partial)',
      usage: '971207/107681 tok / 227/228 pages'
    })
    expect(summary.ocrCostCalculation?.rows[1]).toMatchObject({
      providerModel: 'kimi/kimi-latest (failed partial)',
      pages: '227/228',
      actualInputs: '971207/107681 tok; partial failed',
      actualCostCents: 0.7
    })

    const renderedRunSummary = summary.runSummary?.humanTable
      ? stripAnsi(renderHumanTable(summary.runSummary.humanTable))
      : ''
    expect(renderedRunSummary).toContain('kimi/kimi-latest (failed partial)')
  })

  test('partial OCR metadata aggregates local cached page-result tokens without leaking source names', async () => {
    const outputDir = await mkdtemp(join(process.cwd(), '.autoshow-partial-ocr-'))
    const target = { service: 'kimi' as const, model: 'kimi-latest' }
    const pageResultsDir = join(outputDir, 'providers', getOcrTargetDirectoryName(target), 'page-results')

    try {
      await mkdir(pageResultsDir, { recursive: true })
      await writeFile(join(pageResultsDir, 'page-000001.json'), JSON.stringify({
        version: 2,
        mode: 'single-page',
        sourceFile: 'sensitive-input-name.pdf',
        totalPages: 3,
        pageNumber: 1,
        run: {
          pages: [{ pageNumber: 1, method: 'ocr', text: 'alpha page' }],
          extractionMethod: 'kimi-ocr',
          ocrService: 'kimi',
          ocrModel: 'kimi-latest',
          totalPages: 1,
          promptTokens: 10,
          completionTokens: 3
        }
      }))
      await writeFile(join(pageResultsDir, 'page-000002.json'), JSON.stringify({
        version: 2,
        mode: 'single-page',
        sourceFile: 'sensitive-input-name.pdf',
        totalPages: 3,
        pageNumber: 2,
        run: {
          pages: [{ pageNumber: 2, method: 'ocr', text: 'beta page' }],
          extractionMethod: 'kimi-ocr',
          ocrService: 'kimi',
          ocrModel: 'kimi-latest',
          totalPages: 1,
          promptTokens: 20,
          completionTokens: 4
        }
      }))
      await writeFile(join(pageResultsDir, 'page-000003.json'), JSON.stringify({
        version: 2,
        mode: 'single-page',
        totalPages: 3,
        pageNumber: 3,
        run: {
          pages: [{ pageNumber: 3, method: 'ocr', text: 'source-less page' }],
          extractionMethod: 'kimi-ocr',
          ocrService: 'kimi',
          ocrModel: 'kimi-latest',
          totalPages: 1,
          promptTokens: 100,
          completionTokens: 100
        }
      }))

      const partial = await collectPartialStep2Metadata({
        outputDir,
        requestedTargets: [target],
        failuresByIndex: new Map([[0, {
          message: 'Kimi OCR page 3 timed out after 10m',
          category: 'timeout',
          failureKind: 'timeout',
          retryable: true,
          elapsedMs: 600000
        }]]),
        dpi: 300,
        languages: 'eng'
      })

      expect(partial).toHaveLength(1)
      expect(partial[0]).toMatchObject({
        extractionMethod: 'kimi-ocr',
        totalPages: 3,
        completedPages: 2,
        failedPages: 1,
        promptTokens: 30,
        completionTokens: 7,
        providerCostSource: 'partial_provider_usage',
        status: 'failed_partial',
        failure: {
          category: 'timeout',
          elapsedMs: 600000
        }
      })
      expect(JSON.stringify(partial)).not.toContain('sensitive-input-name.pdf')
    } finally {
      await rm(outputDir, { recursive: true, force: true })
    }
  })
})
