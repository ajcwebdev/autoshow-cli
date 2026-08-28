import { describe, expect, test } from 'bun:test'
import type {
  LogSinkEvent,
  PdfChunkLocalTools,
  PdfChunkSplitResult,
  RunHostedOcrPdfChunkFallbackOptions
} from '~/types'
import {
  basePdfMetadata,
  captureLogEvents,
  createOcrPdfChunkWithLocalFallback,
  hostedRun,
  join,
  pagesForRange,
  runHostedOcrWithPdfChunkFallback
} from './shared'
import { withLocalTestDir } from '../../../../test-utils/temp-dirs'

const runLargePdfFallback = async (
  fallbackDir: string,
  overrides: Partial<RunHostedOcrPdfChunkFallbackOptions>
) => await runHostedOcrWithPdfChunkFallback({
  filePath: '/virtual/input.pdf',
  step1Metadata: { ...basePdfMetadata, pageCount: 21 },
  serviceLabel: 'Test OCR',
  totalPages: 21,
  fallbackDir,
  pageConcurrency: 8,
  runFull: async () => {
    throw new Error('full OCR should not run for large fallback PDFs')
  },
  runChunk: async (_chunkPath, _chunkMetadata, range) =>
    hostedRun(pagesForRange(range.startPage, range.endPage), { totalPages: 1 }),
  ...overrides
})

const rasterTools = (
  splitPdfPages: PdfChunkLocalTools['splitPdfPages'],
  hooks: {
    renderedPages?: number[]
    convertedInputs?: string[]
  } = {}
): PdfChunkLocalTools => ({
  splitPdfPages,
  renderPageToImage: async (_filePath, page, _dpi, outPath) => {
    hooks.renderedPages?.push(page)
    await Bun.write(outPath, `rendered page ${page}`)
    return { exitCode: 0, stderr: '', stdout: '' }
  },
  convertDocumentToPdf: async (imagePath, outPath) => {
    hooks.convertedInputs?.push(await Bun.file(imagePath).text())
    await Bun.write(outPath, '%PDF-1.7\n')
    return { exitCode: 0, stderr: '', stdout: '' }
  }
})

const readPreparation = async (dir: string): Promise<Record<string, unknown>> => {
  const state = await Bun.file(join(dir, 'fallback-state.json')).json() as Record<string, unknown>
  return state['chunkPreparation'] as Record<string, unknown>
}

const warningMessages = (events: LogSinkEvent[]): string[] =>
  events.filter((event) => event.level === 'warn').map((event) => event.message)

const runImmediateRasterDisable = async (
  dir: string,
  result: PdfChunkSplitResult
): Promise<{ events: LogSinkEvent[], preparation: Record<string, unknown>, splitCalls: string[] }> => {
  const splitCalls: string[] = []
  const { events } = await captureLogEvents(async () => await runLargePdfFallback(dir, {
    chunkTools: rasterTools(async (_inputPath, _outputPath, pageRange) => {
      splitCalls.push(pageRange)
      return result
    })
  }))
  return { events, preparation: await readPreparation(dir), splitCalls }
}

describe('PDF chunk creation and routing contracts', () => {
  test('local PDF chunk creation rasterizes a single page when direct extraction produces no PDF', async () => {
    await withLocalTestDir('ocr-raster-pdf-chunk', async (dir) => {
      const outputPath = join(dir, 'page-000006.pdf')
      const calls: string[] = []

      await createOcrPdfChunkWithLocalFallback({
        inputPath: '/virtual/input.pdf',
        outputPath,
        range: { startPage: 6, endPage: 6 },
        dpi: 222,
        tools: {
          splitPdfPages: async (_inputPath, _outputPath, pageRange) => {
            calls.push(`split:${pageRange}`)
            return { tool: 'mutool', exitCode: 1, stderr: 'unsupported content', stdout: '' }
          },
          renderPageToImage: async (_filePath, page, dpi, outPath) => {
            calls.push(`render:${page}:${dpi}`)
            await Bun.write(outPath, 'png bytes')
            return { exitCode: 0, stderr: '', stdout: '' }
          },
          convertDocumentToPdf: async (imagePath, outPath) => {
            calls.push(`convert:${await Bun.file(imagePath).text()}`)
            await Bun.write(outPath, '%PDF-1.7\n')
            return { exitCode: 0, stderr: '', stdout: '' }
          }
        }
      })

      expect(calls).toEqual(['split:6', 'render:6:222', 'convert:png bytes'])
      expect(await Bun.file(outputPath).text()).toBe('%PDF-1.7\n')
    })
  })

  test('hosted PDF page fallback can use provider-specific image chunks', async () => {
    await withLocalTestDir('ocr-image-page-fallback', async (dir) => {
      const seenChunks: Array<{ format: string, text: string }> = []
      const result = await runLargePdfFallback(dir, {
        pageConcurrency: 1,
        keepPageInputs: true,
        chunkFormat: 'png',
        chunkExtension: 'png',
        createChunk: async (_inputPath, outputPath, range) => {
          expect(outputPath.endsWith(`page-${String(range.startPage).padStart(6, '0')}.png`)).toBe(true)
          await Bun.write(outputPath, `png page ${range.startPage}`)
        },
        runChunk: async (chunkPath, chunkMetadata, range) => {
          expect(chunkPath.endsWith('.png')).toBe(true)
          expect(chunkMetadata).toMatchObject({ format: 'png', pageCount: 1 })
          seenChunks.push({ format: chunkMetadata.format, text: await Bun.file(chunkPath).text() })
          return hostedRun(pagesForRange(range.startPage, range.endPage), { totalPages: 1 })
        }
      })

      expect(result.pages).toHaveLength(21)
      expect(result.pdfChunkPreparation).toBeUndefined()
      expect(seenChunks).toHaveLength(21)
      expect(seenChunks[0]).toEqual({ format: 'png', text: 'png page 1' })
      expect(await Bun.file(join(dir, 'page-inputs', 'page-000001.png')).exists()).toBe(true)
      expect(await Bun.file(join(dir, 'page-inputs', 'page-000001.pdf')).exists()).toBe(false)
    })
  })
})

describe('PDF chunk adaptive tool fallback contracts', () => {
  test('hosted PDF page fallback switches to raster-only after repeated direct split failures', async () => {
    await withLocalTestDir('ocr-adaptive-raster-only', async (dir) => {
      const splitCalls: string[] = []
      const renderedPages: number[] = []
      const convertedInputs: string[] = []
      let activeSplits = 0
      let maxActiveSplits = 0
      const result = await runLargePdfFallback(dir, {
        chunkTools: rasterTools(async (_inputPath, _outputPath, pageRange) => {
          activeSplits += 1
          maxActiveSplits = Math.max(maxActiveSplits, activeSplits)
          try {
            await Bun.sleep(5)
            splitCalls.push(pageRange)
            return {
              tool: 'mutool',
              exitCode: 1,
              stderr: 'direct split failed',
              stdout: '',
              attempts: [{ tool: 'qpdf', exitCode: 2 }, { tool: 'mutool', exitCode: 1 }]
            }
          } finally {
            activeSplits -= 1
          }
        }, { renderedPages, convertedInputs })
      })

      expect(result.pages).toHaveLength(21)
      expect(splitCalls).toHaveLength(2)
      expect(maxActiveSplits).toBe(1)
      expect(renderedPages).toHaveLength(21)
      expect(convertedInputs).toHaveLength(21)
      expect(await readPreparation(dir)).toMatchObject({
        strategy: 'raster-only',
        directPageAttempts: 2,
        directFailures: 2,
        rasterizedPages: 21,
        directSplittingDisabled: true,
        tools: [
          { tool: 'qpdf', attempts: 2, exitCodes: { '2': 2 } },
          { tool: 'mutool', attempts: 2, exitCodes: { '1': 2 } }
        ]
      })
    })
  }, 10_000)

  test('hosted PDF page fallback disables qpdf after repeated same-code failures when mutool succeeds', async () => {
    await withLocalTestDir('ocr-disable-qpdf', async (dir) => {
      const splitCalls: Array<{ pageRange: string, disabledTools: string[] }> = []
      const result = await runLargePdfFallback(dir, {
        pageConcurrency: 1,
        chunkTools: {
          splitPdfPages: async (_inputPath, outputPath, pageRange, _password, options) => {
            const disabledTools = options?.disabledTools ?? []
            splitCalls.push({ pageRange, disabledTools })
            await Bun.write(outputPath, '%PDF-1.7\n')
            return {
              tool: 'mutool',
              exitCode: 0,
              stderr: '',
              stdout: '',
              attempts: disabledTools.includes('qpdf')
                ? [{ tool: 'mutool', exitCode: 0 }]
                : [{ tool: 'qpdf', exitCode: 2 }, { tool: 'mutool', exitCode: 0 }]
            }
          },
          renderPageToImage: async () => { throw new Error('rasterization should not run') },
          convertDocumentToPdf: async () => { throw new Error('raster conversion should not run') }
        }
      })

      expect(result.pages).toHaveLength(21)
      expect(splitCalls.map(({ disabledTools }) => disabledTools.includes('qpdf'))).toEqual([
        false,
        false,
        ...Array.from({ length: 19 }, () => true)
      ])
      expect(await readPreparation(dir)).toMatchObject({
        strategy: 'direct',
        directPageAttempts: 21,
        directSuccesses: 21,
        directFailures: 0,
        rasterizedPages: 0,
        directSplittingDisabled: false,
        tools: [
          { tool: 'qpdf', attempts: 2, exitCodes: { '2': 2 } },
          { tool: 'mutool', attempts: 21, exitCodes: { '0': 21 } }
        ],
        disabledTools: [{ tool: 'qpdf', disabledAtPage: 2, exitCode: 2, fallbackTool: 'mutool' }]
      })
      expect(result.pdfChunkPreparation?.disabledTools?.[0]).toMatchObject({
        tool: 'qpdf',
        disabledAtPage: 2,
        exitCode: 2,
        fallbackTool: 'mutool'
      })
    })
  }, 10_000)

  test('repeated direct split failures emit one warning during rasterized page fallback', async () => {
    await withLocalTestDir('ocr-adaptive-raster-logs', async (dir) => {
      const { events } = await captureLogEvents(async () => await runLargePdfFallback(dir, {
        chunkTools: rasterTools(async () => ({
          tool: 'mutool',
          exitCode: 1,
          stderr: 'direct split failed',
          stdout: '',
          attempts: [
            { tool: 'qpdf', exitCode: 2, path: '/managed/runtime/bin/qpdf', source: 'managed' },
            { tool: 'mutool', exitCode: 1, path: '/usr/local/bin/mutool', source: 'path' }
          ]
        }))
      }))

      expect(warningMessages(events)).toEqual([
        'Test OCR: direct PDF page splitting failed twice; using rasterized page PDFs for remaining OCR fallback pages'
      ])
      const warning = events.find((event) => event.level === 'warn')
      const preparation = (warning?.metadata as Record<string, unknown>)['chunkPreparation'] as Record<string, unknown>
      expect(preparation['lastDirectFailure']).toMatchObject({
        tool: 'mutool',
        exitCode: 1,
        path: '/usr/local/bin/mutool',
        source: 'path',
        message: 'direct split failed'
      })
      expect(preparation['tools']).toEqual([
        { tool: 'qpdf', attempts: 2, exitCodes: { '2': 2 }, path: '/managed/runtime/bin/qpdf', source: 'managed' },
        { tool: 'mutool', attempts: 2, exitCodes: { '1': 2 }, path: '/usr/local/bin/mutool', source: 'path' }
      ])
      expect(events.some((event) => event.level === 'info' && /OCR fallback (?:page \d|page \d+ already cached)/.test(event.message))).toBe(false)
    })
  }, 10_000)
})

describe('PDF chunk classified tool probe contracts', () => {
  test('qpdf launch failures disable direct PDF splitting after one classified probe', async () => {
    await withLocalTestDir('ocr-qpdf-launch-fallback', async (dir) => {
      const message = 'dyld: Library not loaded: @rpath/libqpdf.dylib'
      const { events, preparation, splitCalls } = await runImmediateRasterDisable(dir, {
        tool: 'mutool',
        exitCode: 1,
        stderr: 'mutool direct split failed',
        stdout: '',
        attempts: [
          { tool: 'qpdf', exitCode: -1, path: '/managed/runtime/bin/qpdf', source: 'managed', failureKind: 'qpdf_launch_failure', message },
          { tool: 'mutool', exitCode: 1 }
        ]
      })

      expect(splitCalls).toHaveLength(1)
      expect(warningMessages(events)).toEqual([
        `Test OCR: direct PDF page splitting failed because qpdf could not launch (${message}); using rasterized page PDFs for remaining OCR fallback pages`
      ])
      expect(preparation).toMatchObject({
        strategy: 'raster-only',
        directPageAttempts: 1,
        directFailures: 1,
        directSplittingDisabled: true,
        lastDirectFailure: { tool: 'qpdf', exitCode: -1, failureKind: 'qpdf_launch_failure', message }
      })
      expect(preparation['tools']).toEqual([
        { tool: 'qpdf', attempts: 1, exitCodes: { '-1': 1 }, path: '/managed/runtime/bin/qpdf', source: 'managed', failureKind: 'qpdf_launch_failure', message },
        { tool: 'mutool', attempts: 1, exitCodes: { '1': 1 } }
      ])
    })
  }, 10_000)

  test('mutool unsupported-document failures disable repeated direct split probes', async () => {
    await withLocalTestDir('ocr-mutool-unsupported-fallback', async (dir) => {
      const message = 'warning: the pdf device does not support image masks; output may be incomplete'
      const { events, preparation, splitCalls } = await runImmediateRasterDisable(dir, {
        tool: 'mutool',
        exitCode: 1,
        stderr: message,
        stdout: '',
        attempts: [{
          tool: 'mutool',
          exitCode: 1,
          path: '/usr/local/bin/mutool',
          source: 'path',
          failureKind: 'mutool_unsupported_document',
          message
        }]
      })

      expect(splitCalls).toHaveLength(1)
      expect(warningMessages(events)).toEqual([
        `Test OCR: direct PDF page splitting failed because mutool cannot preserve this PDF page content (${message}); using rasterized page PDFs for remaining OCR fallback pages`
      ])
      expect(preparation).toMatchObject({
        strategy: 'raster-only',
        directPageAttempts: 1,
        directFailures: 1,
        lastDirectFailure: { tool: 'mutool', failureKind: 'mutool_unsupported_document', message }
      })
    })
  }, 10_000)
})
