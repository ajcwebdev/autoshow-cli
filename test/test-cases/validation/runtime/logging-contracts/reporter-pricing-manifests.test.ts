import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { getOcrTargetDirectoryName } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-targets'
import { collectPartialStep2Metadata } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-partial-step2'
import { buildWriteManifestConsoleSummary, logExtractManifestConsoleSummary } from '~/cli/commands/process-steps/write-manifest-log/write-manifest-log'
import { createReporter } from '~/utils/app-logger/reporter'
import { renderHumanTable } from '~/utils/app-logger/human-table/human-table'
import { stripAnsi } from '~/utils/terminal-colors'
import type { StepEstimate } from '~/types'
import { createCapturingLogger } from './shared'

describe('logging contracts', () => {
  test('reporter ignores estimate notes in human pricing output', () => {
      const { logger, writes } = createCapturingLogger()
      const reporter = createReporter(logger)

      reporter.estimate({
        totalEstimatedCost: 0,
        steps: [{
          step: 'tts',
          provider: 'kitten',
          model: 'kitten-tts-mini',
          totalCost: 0
        }],
        notes: [
          'TTS estimate omitted: step 4 only runs when write produces exactly one summary.',
          'Second aggregate estimate note.'
        ]
      })

      expect(writes.map(write => write.message)).toEqual([
        'Estimate'
      ])
      expect(writes[0]?.options?.humanTable?.details).toEqual([
        { label: 'Total estimated cost', value: 'free (0.000\u00a2)' }
      ])
      expect(writes[0]?.options?.humanSections?.[0]?.title).toBe('Cost Estimate')
      expect(writes[0]?.options?.humanSections?.[0]?.table).toBeDefined()
      expect(writes.some(write => write.message.includes('Cost estimate notes:'))).toBe(false)
    })

  test('reporter displays Reverb cost estimates with the ASR model id', () => {
      const { logger, writes } = createCapturingLogger()
      const reporter = createReporter(logger)

      reporter.estimate({
        totalEstimatedCost: 0,
        steps: [{
          step: 'stt',
          provider: 'reverb',
          model: 'reverb',
          durationSeconds: 0,
          totalCost: 0
        }]
      })

      const estimateTable = writes[0]?.options?.humanSections
        ?.find(section => section.title === 'Cost Estimate')?.table
      expect(estimateTable?.rows[0]).toMatchObject({
        provider: 'reverb',
        model: 'reverb_asr_v1'
      })
    })

  test('extract manifest summary includes OCR cost calculation diagnostics', () => {
      const metadata = {
        step2: {
          extractionMethod: 'pdf+openai-ocr',
          totalPages: 2,
          ocrPages: 2,
          textPages: 0,
          processingTime: 1234,
          dpi: 300,
          languages: 'eng',
          tokenEstimate: 5000,
          ocrService: 'openai',
          ocrModel: 'gpt-5.4-nano',
          promptTokens: 6000,
          completionTokens: 1500
        },
        cost: {
          estimated: {
            totalCost: 0.58044,
            steps: [{
              step: 'extract',
              provider: 'openai',
              model: 'gpt-5.4-nano',
              cost: 0.58044,
              pageCount: 2,
              promptTokens: 5972,
              completionTokens: 3688,
              inputCostPer1MCents: 20,
              outputCostPer1MCents: 125,
              estimateType: 'heuristic'
            }]
          },
          actual: {
            totalCost: 0.3075,
            steps: [{
              step: 'extract',
              provider: 'openai',
              model: 'gpt-5.4-nano',
              cost: 0.3075,
              inputMetric: 'tokens',
              inputValue: 7500,
              promptTokens: 6000,
              completionTokens: 1500
            }]
          },
          ocrDiagnostics: [{
            provider: 'openai',
            model: 'gpt-5.4-nano',
            pages: 2,
            predictedCostInputs: {
              costCents: 0.58044,
              pageCount: 2,
              inputMetric: 'tokens',
              inputValue: 9660,
              promptTokens: 5972,
              completionTokens: 3688,
              estimateType: 'heuristic'
            },
            actualCostInputs: {
              costCents: 0.3075,
              pageCount: 2,
              inputMetric: 'tokens',
              inputValue: 7500,
              promptTokens: 6000,
              completionTokens: 1500
            },
            ratesUsed: {
              inputCostPer1MCents: 20,
              outputCostPer1MCents: 125
            },
            delta: {
              costCents: -0.27294,
              percent: -47.02294810833162
            }
          }, {
            provider: 'gemini',
            model: 'gemini-3.1-flash-lite',
            pages: 690,
            predictedCostInputs: {
              costCents: 60,
              pageCount: 690,
              inputMetric: 'tokens',
              inputValue: 900000,
              promptTokens: 600000,
              completionTokens: 300000,
              estimateType: 'heuristic'
            },
            actualCostInputs: {
              costCents: 74,
              pageCount: 690,
              inputMetric: 'tokens',
              inputValue: 1208345,
              promptTokens: 806511,
              completionTokens: 401834,
              schemaRetryUsage: {
                count: 3,
                pages: [38, 447, 660],
                promptTokens: 30000,
                completionTokens: 111696
              }
            },
            ratesUsed: {
              inputCostPer1MCents: 10,
              outputCostPer1MCents: 40
            },
            delta: {
              costCents: 14,
              percent: 23.333333333333332
            }
          }]
        }
      }

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
      logExtractManifestConsoleSummary('/tmp/autoshow-run', metadata, {}, logger)
      expect(writes.map((write) => write.message)).toEqual([
        'Locations',
        'Run Summary',
        'Prompt Usage',
        'OCR Cost Calculation'
      ])
      expect(writes[0]?.options?.humanTable).toMatchObject({
        columns: ['artifact', 'path'],
        rows: [{ artifact: 'runManifest', path: '/tmp/autoshow-run/run.json' }]
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
      const metadata = {
        step2: [{
          extractionMethod: 'gemini-ocr',
          totalPages: 228,
          ocrPages: 228,
          textPages: 0,
          processingTime: 180000,
          dpi: 300,
          languages: 'eng',
          tokenEstimate: 200000,
          ocrService: 'gemini',
          ocrModel: 'gemini-3.5-flash',
          promptTokens: 800000,
          completionTokens: 100000
        }],
        partialStep2: [{
          extractionMethod: 'kimi-ocr',
          totalPages: 228,
          ocrPages: 227,
          textPages: 0,
          processingTime: 600000,
          dpi: 300,
          languages: 'eng',
          tokenEstimate: 190000,
          ocrService: 'kimi',
          ocrModel: 'kimi-latest',
          promptTokens: 971207,
          completionTokens: 107681,
          providerCostSource: 'partial_provider_usage',
          status: 'failed_partial',
          artifactDir: 'providers/kimi-kimi-latest',
          completedPages: 227,
          failedPages: 1,
          failure: {
            message: 'Kimi OCR page 9 timed out after 10m',
            category: 'timeout',
            failureKind: 'timeout',
            retryable: true
          }
        }],
        cost: {
          estimated: {
            totalCost: 1,
            steps: [{
              step: 'extract',
              provider: 'gemini',
              model: 'gemini-3.5-flash',
              cost: 0.25,
              pageCount: 228,
              promptTokens: 800000,
              completionTokens: 100000
            }, {
              step: 'extract',
              provider: 'kimi',
              model: 'kimi-latest',
              cost: 0.75,
              pageCount: 228,
              promptTokens: 1000000,
              completionTokens: 120000
            }]
          },
          actual: {
            totalCost: 0.9,
            steps: [{
              step: 'extract',
              provider: 'gemini',
              model: 'gemini-3.5-flash',
              cost: 0.2,
              costSource: 'provider_usage',
              inputMetric: 'tokens',
              inputValue: 900000,
              promptTokens: 800000,
              completionTokens: 100000
            }, {
              step: 'extract',
              provider: 'kimi',
              model: 'kimi-latest',
              cost: 0.7,
              costSource: 'partial_provider_usage',
              inputMetric: 'tokens',
              inputValue: 1078888,
              promptTokens: 971207,
              completionTokens: 107681
            }]
          },
          ocrDiagnostics: [{
            provider: 'gemini',
            model: 'gemini-3.5-flash',
            pages: 228,
            predictedCostInputs: {
              costCents: 0.25,
              pageCount: 228,
              promptTokens: 800000,
              completionTokens: 100000
            },
            actualCostInputs: {
              costCents: 0.2,
              pageCount: 228,
              inputMetric: 'tokens',
              inputValue: 900000,
              promptTokens: 800000,
              completionTokens: 100000,
              costSource: 'provider_usage'
            },
            delta: { costCents: -0.05 }
          }, {
            provider: 'kimi',
            model: 'kimi-latest',
            status: 'failed_partial',
            pages: 228,
            completedPages: 227,
            failedPages: 1,
            predictedCostInputs: {
              costCents: 0.75,
              pageCount: 228,
              promptTokens: 1000000,
              completionTokens: 120000
            },
            actualCostInputs: {
              costCents: 0.7,
              pageCount: 227,
              status: 'failed_partial',
              totalPages: 228,
              failedPages: 1,
              inputMetric: 'tokens',
              inputValue: 1078888,
              promptTokens: 971207,
              completionTokens: 107681,
              costSource: 'partial_provider_usage'
            },
            delta: { costCents: -0.05 }
          }]
        },
        timing: {
          actual: {
            totalProcessingTimeMs: 780000,
            steps: [{
              step: 'extract',
              provider: 'gemini',
              model: 'gemini-3.5-flash',
              processingTimeMs: 180000,
              inputMetric: 'pages',
              inputValue: 228
            }, {
              step: 'extract',
              provider: 'kimi',
              model: 'kimi-latest',
              processingTimeMs: 600000,
              inputMetric: 'pages',
              inputValue: 227
            }]
          }
        }
      }

      const summary = buildWriteManifestConsoleSummary(metadata)
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
    })

  test('partial OCR metadata aggregates local cached page-result tokens without leaking source names', async () => {
      const outputDir = await mkdtemp(join(tmpdir(), 'autoshow-partial-ocr-'))
      const target = { service: 'kimi' as const, model: 'kimi-latest' }
      const pageResultsDir = join(outputDir, 'providers', getOcrTargetDirectoryName(target), 'page-results')

      try {
        await mkdir(pageResultsDir, { recursive: true })
        await writeFile(join(pageResultsDir, 'page-000001.json'), JSON.stringify({
          version: 1,
          mode: 'rendered-page',
          extractionMethod: 'kimi-ocr',
          model: 'kimi-latest',
          sourceFile: 'sensitive-input-name.pdf',
          totalPages: 3,
          pageNumber: 1,
          result: {
            page: { pageNumber: 1, method: 'ocr', text: 'alpha page' },
            promptTokens: 10,
            completionTokens: 3
          }
        }))
        await writeFile(join(pageResultsDir, 'page-000002.json'), JSON.stringify({
          version: 1,
          mode: 'rendered-page',
          extractionMethod: 'kimi-ocr',
          model: 'kimi-latest',
          sourceFile: 'sensitive-input-name.pdf',
          totalPages: 3,
          pageNumber: 2,
          result: {
            page: { pageNumber: 2, method: 'ocr', text: 'beta page' },
            promptTokens: 20,
            completionTokens: 4
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

  test('native EPUB extract manifest summary displays sections instead of pages', () => {
      const metadata = {
        step2: {
          extractionMethod: 'epub-text',
          totalPages: 9,
          ocrPages: 0,
          textPages: 9,
          processingTime: 60000,
          dpi: 300,
          languages: 'eng',
          tokenEstimate: 12000,
          outputFidelity: 'cleaned-epub-text'
        },
        timing: {
          actual: {
            totalProcessingTimeMs: 60000,
            steps: [{
              step: 'extract',
              provider: 'extract',
              model: 'epub-text',
              processingTimeMs: 60000,
              inputMetric: 'sections',
              inputValue: 9,
              throughputValue: 9,
              throughputUnit: 'sectionsPerMinute'
            }]
          }
        }
      }

      const summary = buildWriteManifestConsoleSummary(metadata)

      expect(summary.promptUsage?.rows[0]).toMatchObject({
        step: 'Extract',
        providerModel: 'extract/epub-text',
        usage: '9 sections'
      })
      expect(summary.runSummary?.rows[0]).toMatchObject({
        step: 'Extract',
        providerModel: 'extract/epub-text',
        actualSpeed: '9 sections/min',
        actualInputMetric: 'sections',
        actualInputValue: 9
      })

      const renderedPromptUsage = summary.promptUsage?.humanTable
        ? stripAnsi(renderHumanTable(summary.promptUsage.humanTable))
        : ''
      const renderedRunSummary = summary.runSummary?.humanTable
        ? stripAnsi(renderHumanTable(summary.runSummary.humanTable))
        : ''
      expect(renderedPromptUsage).toContain('9 sections')
      expect(renderedPromptUsage).not.toContain('9 pages')
      expect(renderedRunSummary).toContain('9 sections/min')
    })

  test('native EPUB extract manifest summary includes logical chapters when heading export expands one source section', () => {
      const metadata = {
        step2: {
          extractionMethod: 'epub-text',
          totalPages: 1,
          ocrPages: 0,
          textPages: 1,
          processingTime: 60000,
          dpi: 300,
          languages: 'eng',
          tokenEstimate: 12000,
          outputFidelity: 'cleaned-epub-text',
          chapterExport: {
            sourceFormat: 'epub',
            mode: 'chapters',
            sectionsKept: 1,
            sectionsDropped: 0,
            dividerSectionsMerged: 0,
            logicalChapterCount: 4,
            logicalChapterSource: 'heading',
            tocStartSections: 1,
            genericTocStartsIgnored: 1,
            filesWritten: 4,
            chapterFilesWritten: 4,
            directories: ['chapters']
          }
        }
      }

      const summary = buildWriteManifestConsoleSummary(metadata)

      expect(summary.promptUsage?.rows[0]).toMatchObject({
        step: 'Extract',
        providerModel: 'extract/epub-text',
        usage: '1 section / 4 chapters'
      })
    })

  test('reporter renders aggregate cost estimates as compact rows without note output', () => {
      const { logger, writes } = createCapturingLogger()
      const reporter = createReporter(logger)

      reporter.estimate({
        totalEstimatedCost: 201.255,
        steps: [
          {
            step: 'video',
            provider: 'gemini',
            model: 'veo-3.1-lite-generate-preview',
            durationSeconds: 4,
            totalCost: 200
          },
          {
            step: 'tts',
            provider: 'kitten',
            model: 'kitten-tts-mini',
            totalCost: 1.25,
            characterCount: 100,
            note: 'Provider credits may apply outside local estimates.'
          },
          {
            step: 'extract',
            provider: 'firecrawl',
            model: 'firecrawl',
            totalCost: 0.005,
            note: 'Provider credits may apply outside local estimates.'
          }
        ],
        notes: ['Aggregate caveat.']
      })

      const humanTable = writes[0]?.options?.humanSections
        ?.find(section => section.title === 'Cost Estimate')?.table
      expect(humanTable).toEqual({
        columns: ['step', 'provider', 'model', 'cost'],
        align: { cost: 'right' },
        rows: [
          { step: 'video', provider: 'gemini', model: 'veo-3.1-lite-generate-preview', cost: '$2.00' },
          { step: 'tts', provider: 'kitten', model: 'kitten-tts-mini', cost: '1.25\u00a2' },
          { step: 'extract', provider: 'firecrawl', model: 'firecrawl', cost: '<0.01\u00a2' }
        ]
      })
      expect(writes[0]?.message).toBe('Estimate')
      expect(writes[0]?.options?.humanTable?.details).toEqual([
        { label: 'Total estimated cost', value: '$2.01 (201.255\u00a2)' }
      ])
      expect(writes.some(write => write.message.includes('Cost estimate notes:'))).toBe(false)

      if (!humanTable) throw new Error('Expected cost estimate human table')
      const rendered = stripAnsi(renderHumanTable(humanTable))
      expect(rendered).toContain('\u2502 video   \u2502 gemini')
      expect(rendered).toContain('\u2502  $2.00 \u2502')
      expect(rendered).toContain('\u2502 <0.01\u00a2 \u2502')
      expect(rendered).not.toContain('[1]')
      expect(rendered).not.toContain('\u2502 key')
    })

  test('reporter omits human cost details for detail-heavy estimate types', () => {
      const { logger, writes } = createCapturingLogger()
      const reporter = createReporter(logger)
      const steps = [
        {
          step: 'stt',
          provider: 'deepgram',
          model: 'nova-3',
          durationSeconds: 123,
          estimateType: 'heuristic',
          totalCost: 4.1
        },
        {
          step: 'llm',
          provider: 'openai',
          model: 'gpt-5.4-nano',
          inputCostPer1MCents: 20,
          outputCostPer1MCents: 125,
          estimatedInputTokens: 600,
          estimatedOutputTokens: 400,
          totalCost: 0.062
        },
        {
          step: 'extract',
          provider: 'openai',
          model: 'gpt-5.4-nano',
          inputCostPer1MCents: 20,
          outputCostPer1MCents: 125,
          pageCount: 2,
          promptTokens: 5972,
          completionTokens: 3688,
          estimateType: 'heuristic',
          totalCost: 0.58044
        },
        {
          step: 'extract',
          provider: 'glm-reader',
          model: 'glm-reader',
          costPer1kPagesCents: 1000,
          pageCount: 1,
          totalCost: 1
        },
        {
          step: 'tts',
          provider: 'mistral',
          model: 'voxtral-mini-tts-2603',
          inputCostPer1MCharactersCents: 0,
          outputCostPer1MCharactersCents: 1600,
          characterCount: 1000,
          setupCostCents: 0,
          estimateType: 'heuristic',
          totalCost: 1.6
        },
        {
          step: 'music',
          provider: 'minimax',
          model: 'music-2.6',
          durationSeconds: 180,
          lyricsSource: 'generated',
          totalCost: 500
        }
      ] satisfies StepEstimate[]

      reporter.estimate({
        totalEstimatedCost: steps.reduce((total, step) => total + step.totalCost, 0),
        steps
      })

      const humanTable = writes[0]?.options?.humanSections
        ?.find(section => section.title === 'Cost Estimate')?.table
      if (!humanTable) throw new Error('Expected cost estimate human table')

      expect(humanTable.columns).toEqual(['step', 'provider', 'model', 'setup', 'cost'])
      expect(humanTable.details).toBeUndefined()
      expect(humanTable.rows.every(row => row['details'] === undefined)).toBe(true)

      const rendered = stripAnsi(renderHumanTable(humanTable))
      expect(rendered).not.toContain('details')
      expect(rendered).not.toContain('see details')
      expect(rendered).not.toContain('rate $10.00/1K pages')
      expect(rendered).not.toContain('lyrics generated')
      expect(rendered).not.toContain('tokens')
      expect(rendered).not.toContain('characters')
    })
})
