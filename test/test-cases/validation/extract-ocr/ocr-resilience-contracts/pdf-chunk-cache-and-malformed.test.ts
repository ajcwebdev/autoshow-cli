import { describe, expect, test } from 'bun:test'
import {
  createOcrPdfChunkWithLocalFallback
} from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/pdf-chunk-fallback'
import { normalizeHostedOcrPages } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/hosted-ocr-json'
import { parseStoredHostedOcrPageCache } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/pdf-chunk-fallback-state'
import {
  basePdfMetadata,
  captureLogEvents,
  classifyOcrProviderFailure,
  createOcrPdfChunkRenderError,
  hostedRun,
  invalidPageResponsePath,
  join,
  mkdtemp,
  OcrStructuredResponseError,
  pageCachePath,
  pagesForRange,
  pageTextPath,
  rm,
  runHostedOcrWithPdfChunkFallback,
  shouldFallbackToOcrPdfChunks,
  stitchHostedOcrChunkRuns,
  tmpdir,
  writeOcrProviderError
} from './shared'
import type { HostedOcrRun } from './shared'

describe('OCR resilience contracts', () => {
  test('hosted page response cache identity includes provider mode, input, DPI, model, and reasoning policy', () => {
    const identity = {
      extractionMethod: 'openai-ocr' as const,
      ocrService: 'openai' as const,
      ocrModel: 'gpt-5.6-sol',
      requestedReasoningEffort: 'high' as const,
      effectiveReasoningEffort: 'high' as const,
      ocrProviderMode: 'pool' as const,
      inputSha256: 'abc123',
      inputFormat: 'pdf',
      inputPageNumber: 7,
      dpi: 300
    }
    const run = {
      ...hostedRun([{ pageNumber: 7, method: 'ocr', text: 'page 7' }]),
      ...identity
    }
    const stored = {
      version: 2,
      mode: 'single-page',
      totalPages: 10,
      pageNumber: 7,
      sourceFile: 'page-000007.pdf',
      run
    }

    expect(parseStoredHostedOcrPageCache(stored, {
      pageNumber: 7,
      totalPages: 10,
      sourceFile: 'page-000007.pdf',
      identity
    })?.run.pages[0]?.text).toBe('page 7')
    expect(parseStoredHostedOcrPageCache(stored, { identity: { ...identity, ocrProviderMode: 'fanout' } })).toBeUndefined()
    expect(parseStoredHostedOcrPageCache(stored, { identity: { ...identity, inputSha256: 'different' } })).toBeUndefined()
    expect(parseStoredHostedOcrPageCache(stored, { identity: { ...identity, effectiveReasoningEffort: 'low' } })).toBeUndefined()
    expect(parseStoredHostedOcrPageCache(stored, { identity: { ...identity, dpi: 200 } })).toBeUndefined()
  })

  test('hosted OCR page normalization decodes escaped line formatting artifacts', () => {
    const pages = normalizeHostedOcrPages([{
      pageNumber: 1,
      text: 'Page 115\\n\\nCHAPTER\\nVII\\nTHE LONG SHADOW OF ROME\\n\\tFirst paragraph'
    }], 1, {
      countMismatchMessage: (actual, expected) => `got ${actual}, wanted ${expected}`,
      nonContiguousMessage: 'non-contiguous'
    })

    expect(pages[0]?.text).toContain('CHAPTER\nVII\nTHE LONG SHADOW OF ROME')
    expect(pages[0]?.text).toContain('\tFirst paragraph')
  })

  test('hosted OCR page normalization leaves isolated literal slash-n text alone', () => {
    const pages = normalizeHostedOcrPages([{
      pageNumber: 1,
      text: 'Windows path C:\\new-folder stays literal'
    }], 1, {
      countMismatchMessage: (actual, expected) => `got ${actual}, wanted ${expected}`,
      nonContiguousMessage: 'non-contiguous'
    })

    expect(pages[0]?.text).toBe('Windows path C:\\new-folder stays literal')
  })

  test('local PDF chunk creation rasterizes a single page when direct extraction produces no PDF', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-raster-pdf-chunk-'))
    try {
      const outputPath = join(tempDir, 'page-000006.pdf')
      const calls: string[] = []

      await createOcrPdfChunkWithLocalFallback({
        inputPath: '/virtual/input.pdf',
        outputPath,
        range: { startPage: 6, endPage: 6 },
        dpi: 222,
        tools: {
          splitPdfPages: async (_inputPath, _outputPath, pageRange) => {
            calls.push(`split:${pageRange}`)
            return {
              tool: 'mutool',
              exitCode: 1,
              stderr: 'warning: the pdf device does not support image masks; output may be incomplete',
              stdout: ''
            }
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
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('hosted PDF page fallback switches to raster-only after repeated direct split failures', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-adaptive-raster-only-'))
    const splitCalls: string[] = []
    const renderCalls: number[] = []
    const convertCalls: string[] = []
    let activeSplits = 0
    let maxActiveSplits = 0

    try {
      const result = await runHostedOcrWithPdfChunkFallback({
        filePath: '/virtual/input.pdf',
        step1Metadata: { ...basePdfMetadata, pageCount: 21 },
        serviceLabel: 'Test OCR',
        totalPages: 21,
        fallbackDir: tempDir,
        pageConcurrency: 8,
        runFull: async () => {
          throw new Error('full OCR should not run for large fallback PDFs')
        },
        chunkTools: {
          splitPdfPages: async (_inputPath, _outputPath, pageRange) => {
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
                attempts: [
                  { tool: 'qpdf', exitCode: 2 },
                  { tool: 'mutool', exitCode: 1 }
                ]
              }
            } finally {
              activeSplits -= 1
            }
          },
          renderPageToImage: async (_filePath, page, _dpi, outPath) => {
            renderCalls.push(page)
            await Bun.write(outPath, `rendered page ${page}`)
            return { exitCode: 0, stderr: '', stdout: '' }
          },
          convertDocumentToPdf: async (imagePath, outPath) => {
            convertCalls.push(await Bun.file(imagePath).text())
            await Bun.write(outPath, '%PDF-1.7\n')
            return { exitCode: 0, stderr: '', stdout: '' }
          }
        },
        runChunk: async (_chunkPath, _chunkMetadata, range) =>
          hostedRun(pagesForRange(range.startPage, range.endPage), { totalPages: 1 })
      })

      expect(result.pages).toHaveLength(21)
      expect(splitCalls).toHaveLength(2)
      expect(maxActiveSplits).toBe(1)
      expect(renderCalls).toHaveLength(21)
      expect(convertCalls).toHaveLength(21)

      const state = await Bun.file(join(tempDir, 'fallback-state.json')).json() as Record<string, unknown>
      const preparation = state['chunkPreparation'] as Record<string, unknown>
      expect(preparation['strategy']).toBe('raster-only')
      expect(preparation['directPageAttempts']).toBe(2)
      expect(preparation['directFailures']).toBe(2)
      expect(preparation['rasterizedPages']).toBe(21)
      expect(preparation['directSplittingDisabled']).toBe(true)
      expect(preparation['tools']).toEqual([
        { tool: 'qpdf', attempts: 2, exitCodes: { '2': 2 } },
        { tool: 'mutool', attempts: 2, exitCodes: { '1': 2 } }
      ])
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  }, 10_000)

  test('hosted PDF page fallback can use provider-specific image chunks', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-image-page-fallback-'))
    const seenChunks: Array<{ path: string, format: string, text: string }> = []
    try {
      const result = await runHostedOcrWithPdfChunkFallback({
        filePath: '/virtual/input.pdf',
        step1Metadata: { ...basePdfMetadata, pageCount: 21 },
        serviceLabel: 'Test OCR',
        totalPages: 21,
        fallbackDir: tempDir,
        pageConcurrency: 1,
        keepPageInputs: true,
        chunkFormat: 'png',
        chunkExtension: 'png',
        runFull: async () => {
          throw new Error('full OCR should not run for large fallback PDFs')
        },
        createChunk: async (_inputPath, outputPath, range) => {
          expect(outputPath.endsWith(`page-${String(range.startPage).padStart(6, '0')}.png`)).toBe(true)
          await Bun.write(outputPath, `png page ${range.startPage}`)
        },
        runChunk: async (chunkPath, chunkMetadata, range) => {
          expect(chunkPath.endsWith('.png')).toBe(true)
          expect(chunkMetadata.format).toBe('png')
          expect(chunkMetadata.pageCount).toBe(1)
          const text = await Bun.file(chunkPath).text()
          seenChunks.push({ path: chunkPath, format: chunkMetadata.format, text })
          return hostedRun(pagesForRange(range.startPage, range.endPage), { totalPages: 1 })
        }
      })

      expect(result.pages).toHaveLength(21)
      expect(result.pdfChunkPreparation).toBeUndefined()
      expect(seenChunks).toHaveLength(21)
      expect(seenChunks[0]).toMatchObject({ format: 'png', text: 'png page 1' })
      expect(await Bun.file(join(tempDir, 'page-inputs', 'page-000001.png')).exists()).toBe(true)
      expect(await Bun.file(join(tempDir, 'page-inputs', 'page-000001.pdf')).exists()).toBe(false)
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('hosted PDF page fallback disables qpdf after repeated same-code failures when mutool succeeds', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-disable-qpdf-'))
    const splitCalls: Array<{ pageRange: string, disabledTools: string[] }> = []

    try {
      const result = await runHostedOcrWithPdfChunkFallback({
        filePath: '/virtual/input.pdf',
        step1Metadata: { ...basePdfMetadata, pageCount: 21 },
        serviceLabel: 'Test OCR',
        totalPages: 21,
        fallbackDir: tempDir,
        pageConcurrency: 1,
        runFull: async () => {
          throw new Error('full OCR should not run for large fallback PDFs')
        },
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
                : [
                    { tool: 'qpdf', exitCode: 2 },
                    { tool: 'mutool', exitCode: 0 }
                  ]
            }
          },
          renderPageToImage: async () => {
            throw new Error('rasterization should not run when mutool direct split succeeds')
          },
          convertDocumentToPdf: async () => {
            throw new Error('raster conversion should not run when mutool direct split succeeds')
          }
        },
        runChunk: async (_chunkPath, _chunkMetadata, range) =>
          hostedRun(pagesForRange(range.startPage, range.endPage), { totalPages: 1 })
      })

      expect(result.pages).toHaveLength(21)
      expect(splitCalls.map((call) => call.disabledTools.includes('qpdf'))).toEqual([
        false,
        false,
        ...Array.from({ length: 19 }, () => true)
      ])

      const state = await Bun.file(join(tempDir, 'fallback-state.json')).json() as Record<string, unknown>
      const preparation = state['chunkPreparation'] as Record<string, unknown>
      expect(preparation).toMatchObject({
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
        disabledTools: [{
          tool: 'qpdf',
          disabledAtPage: 2,
          exitCode: 2,
          fallbackTool: 'mutool'
        }]
      })
      expect(result.pdfChunkPreparation?.disabledTools?.[0]).toMatchObject({
        tool: 'qpdf',
        disabledAtPage: 2,
        exitCode: 2,
        fallbackTool: 'mutool'
      })
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  }, 10_000)

  test('repeated direct split failures emit one warning during rasterized page fallback', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-adaptive-raster-logs-'))
    try {
      const { events } = await captureLogEvents(async () => await runHostedOcrWithPdfChunkFallback({
        filePath: '/virtual/input.pdf',
        step1Metadata: { ...basePdfMetadata, pageCount: 21 },
        serviceLabel: 'Test OCR',
        totalPages: 21,
        fallbackDir: tempDir,
        pageConcurrency: 8,
        runFull: async () => {
          throw new Error('full OCR should not run for large fallback PDFs')
        },
        chunkTools: {
          splitPdfPages: async (_inputPath, _outputPath, _pageRange) => ({
            tool: 'mutool',
            exitCode: 1,
            stderr: 'direct split failed',
            stdout: '',
            attempts: [
              { tool: 'qpdf', exitCode: 2, path: '/managed/runtime/bin/qpdf', source: 'managed' },
              { tool: 'mutool', exitCode: 1, path: '/usr/local/bin/mutool', source: 'path' }
            ]
          }),
          renderPageToImage: async (_filePath, page, _dpi, outPath) => {
            await Bun.write(outPath, `rendered page ${page}`)
            return { exitCode: 0, stderr: '', stdout: '' }
          },
          convertDocumentToPdf: async (_imagePath, outPath) => {
            await Bun.write(outPath, '%PDF-1.7\n')
            return { exitCode: 0, stderr: '', stdout: '' }
          }
        },
        runChunk: async (_chunkPath, _chunkMetadata, range) =>
          hostedRun(pagesForRange(range.startPage, range.endPage), { totalPages: 1 })
      }))

      const warnings = events.filter((event) => event.level === 'warn')
      expect(warnings.map((event) => event.message)).toEqual([
        'Test OCR: direct PDF page splitting failed twice; using rasterized page PDFs for remaining OCR fallback pages'
      ])
      const warningMetadata = warnings[0]?.metadata as Record<string, unknown>
      const chunkPreparation = warningMetadata['chunkPreparation'] as Record<string, unknown>
      expect(chunkPreparation['lastDirectFailure']).toMatchObject({
        tool: 'mutool',
        exitCode: 1,
        path: '/usr/local/bin/mutool',
        source: 'path',
        message: 'direct split failed'
      })
      expect(chunkPreparation['tools']).toEqual([
        { tool: 'qpdf', attempts: 2, exitCodes: { '2': 2 }, path: '/managed/runtime/bin/qpdf', source: 'managed' },
        { tool: 'mutool', attempts: 2, exitCodes: { '1': 2 }, path: '/usr/local/bin/mutool', source: 'path' }
      ])
      expect(events.some((event) =>
        event.level === 'info'
        && /OCR fallback (?:page \d|page \d+ already cached)/.test(event.message)
      )).toBe(false)
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  }, 10_000)

  test('qpdf launch failures disable direct PDF splitting after one classified probe', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-qpdf-launch-fallback-'))
    const splitCalls: string[] = []
    try {
      const { events } = await captureLogEvents(async () => await runHostedOcrWithPdfChunkFallback({
        filePath: '/virtual/input.pdf',
        step1Metadata: { ...basePdfMetadata, pageCount: 21 },
        serviceLabel: 'Test OCR',
        totalPages: 21,
        fallbackDir: tempDir,
        pageConcurrency: 8,
        runFull: async () => {
          throw new Error('full OCR should not run for large fallback PDFs')
        },
        chunkTools: {
          splitPdfPages: async (_inputPath, _outputPath, pageRange) => {
            splitCalls.push(pageRange)
            return {
              tool: 'mutool',
              exitCode: 1,
              stderr: 'mutool direct split failed',
              stdout: '',
              attempts: [
                {
                  tool: 'qpdf',
                  exitCode: -1,
                  path: '/managed/runtime/bin/qpdf',
                  source: 'managed',
                  failureKind: 'qpdf_launch_failure',
                  message: 'dyld: Library not loaded: @rpath/libqpdf.dylib'
                },
                { tool: 'mutool', exitCode: 1 }
              ]
            }
          },
          renderPageToImage: async (_filePath, page, _dpi, outPath) => {
            await Bun.write(outPath, `rendered page ${page}`)
            return { exitCode: 0, stderr: '', stdout: '' }
          },
          convertDocumentToPdf: async (_imagePath, outPath) => {
            await Bun.write(outPath, '%PDF-1.7\n')
            return { exitCode: 0, stderr: '', stdout: '' }
          }
        },
        runChunk: async (_chunkPath, _chunkMetadata, range) =>
          hostedRun(pagesForRange(range.startPage, range.endPage), { totalPages: 1 })
      }))

      expect(splitCalls).toHaveLength(1)
      const warnings = events.filter((event) => event.level === 'warn')
      expect(warnings.map((event) => event.message)).toEqual([
        'Test OCR: direct PDF page splitting failed because qpdf could not launch (dyld: Library not loaded: @rpath/libqpdf.dylib); using rasterized page PDFs for remaining OCR fallback pages'
      ])

      const state = await Bun.file(join(tempDir, 'fallback-state.json')).json() as Record<string, unknown>
      const preparation = state['chunkPreparation'] as Record<string, unknown>
      expect(preparation).toMatchObject({
        strategy: 'raster-only',
        directPageAttempts: 1,
        directFailures: 1,
        directSplittingDisabled: true,
        lastDirectFailure: {
          tool: 'qpdf',
          exitCode: -1,
          failureKind: 'qpdf_launch_failure',
          message: 'dyld: Library not loaded: @rpath/libqpdf.dylib'
        }
      })
      expect(preparation['tools']).toEqual([
        {
          tool: 'qpdf',
          attempts: 1,
          exitCodes: { '-1': 1 },
          path: '/managed/runtime/bin/qpdf',
          source: 'managed',
          failureKind: 'qpdf_launch_failure',
          message: 'dyld: Library not loaded: @rpath/libqpdf.dylib'
        },
        { tool: 'mutool', attempts: 1, exitCodes: { '1': 1 } }
      ])
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  }, 10_000)

  test('mutool unsupported-document failures disable repeated direct split probes', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-mutool-unsupported-fallback-'))
    const splitCalls: string[] = []
    const mutoolMessage = 'warning: the pdf device does not support image masks; output may be incomplete'
    try {
      const { events } = await captureLogEvents(async () => await runHostedOcrWithPdfChunkFallback({
        filePath: '/virtual/input.pdf',
        step1Metadata: { ...basePdfMetadata, pageCount: 21 },
        serviceLabel: 'Test OCR',
        totalPages: 21,
        fallbackDir: tempDir,
        pageConcurrency: 8,
        runFull: async () => {
          throw new Error('full OCR should not run for large fallback PDFs')
        },
        chunkTools: {
          splitPdfPages: async (_inputPath, _outputPath, pageRange) => {
            splitCalls.push(pageRange)
            return {
              tool: 'mutool',
              exitCode: 1,
              stderr: mutoolMessage,
              stdout: '',
              attempts: [{
                tool: 'mutool',
                exitCode: 1,
                path: '/usr/local/bin/mutool',
                source: 'path',
                failureKind: 'mutool_unsupported_document',
                message: mutoolMessage
              }]
            }
          },
          renderPageToImage: async (_filePath, page, _dpi, outPath) => {
            await Bun.write(outPath, `rendered page ${page}`)
            return { exitCode: 0, stderr: '', stdout: '' }
          },
          convertDocumentToPdf: async (_imagePath, outPath) => {
            await Bun.write(outPath, '%PDF-1.7\n')
            return { exitCode: 0, stderr: '', stdout: '' }
          }
        },
        runChunk: async (_chunkPath, _chunkMetadata, range) =>
          hostedRun(pagesForRange(range.startPage, range.endPage), { totalPages: 1 })
      }))

      expect(splitCalls).toHaveLength(1)
      const warnings = events.filter((event) => event.level === 'warn')
      expect(warnings.map((event) => event.message)).toEqual([
        `Test OCR: direct PDF page splitting failed because mutool cannot preserve this PDF page content (${mutoolMessage}); using rasterized page PDFs for remaining OCR fallback pages`
      ])

      const state = await Bun.file(join(tempDir, 'fallback-state.json')).json() as Record<string, unknown>
      const preparation = state['chunkPreparation'] as Record<string, unknown>
      expect(preparation).toMatchObject({
        strategy: 'raster-only',
        directPageAttempts: 1,
        directFailures: 1,
        lastDirectFailure: {
          tool: 'mutool',
          failureKind: 'mutool_unsupported_document',
          message: mutoolMessage
        }
      })
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  }, 10_000)

  test('successful fallback pages are cached before the next page runs', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-page-cache-order-'))
    try {
      await runHostedOcrWithPdfChunkFallback({
        filePath: '/virtual/input.pdf',
        step1Metadata: { ...basePdfMetadata, pageCount: 2 },
        serviceLabel: 'Test OCR',
        totalPages: 2,
        fallbackDir: tempDir,
        pageConcurrency: 1,
        runFull: async () => {
          throw Object.assign(new Error('provider timed out while reading OCR response'), { status: 503 })
        },
        createChunk: async (_inputPath, outputPath, range) => {
          await Bun.write(outputPath, `page ${range.startPage}`)
        },
        runChunk: async (_chunkPath, _chunkMetadata, range) => {
          if (range.startPage === 2) {
            expect(await Bun.file(pageCachePath(tempDir, 1)).exists()).toBe(true)
            expect(await Bun.file(pageTextPath(tempDir, 1)).text()).toBe('page 1\n')
            expect(await Bun.file(join(tempDir, 'partial-extraction.txt')).text()).toContain('Page 1\npage 1')
          }
          return hostedRun(pagesForRange(range.startPage, range.endPage), {
            totalPages: 1
          })
        }
      })
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('malformed structured fallback pages are accepted as raw text and processing continues', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-page-invalid-'))
    const attemptedPages: number[] = []
    const rawMalformedText = 'raw page OCR text\nsecond line'
    try {
      const result = await runHostedOcrWithPdfChunkFallback({
        filePath: '/virtual/input.pdf',
        step1Metadata: { ...basePdfMetadata, pageCount: 2 },
        serviceLabel: 'Test OCR',
        totalPages: 2,
        fallbackDir: tempDir,
        pageConcurrency: 1,
        runFull: async () => {
          throw Object.assign(new Error('provider timed out while reading OCR response'), { status: 503 })
        },
        createChunk: async (_inputPath, outputPath, range) => {
          await Bun.write(outputPath, `page ${range.startPage}`)
        },
        runChunk: async (_chunkPath, _chunkMetadata, range) => {
          attemptedPages.push(range.startPage)
          if (range.startPage === 1) {
            throw new OcrStructuredResponseError('Response was not valid JSON', rawMalformedText)
          }
          return hostedRun(pagesForRange(range.startPage, range.endPage), { totalPages: 1 })
        },
        buildMalformedPageRun: (rawText, range) => hostedRun([{
          pageNumber: range.startPage,
          method: 'ocr',
          text: rawText
        }], { totalPages: 1 })
      })

      expect(attemptedPages).toEqual([1, 2])
      expect(result.pages.map((page) => page.text)).toEqual([rawMalformedText, 'page 2'])
      expect(await Bun.file(invalidPageResponsePath(tempDir, 1)).text()).toBe(rawMalformedText)
      expect(await Bun.file(pageTextPath(tempDir, 1)).text()).toBe(`${rawMalformedText}\n`)
      expect(await Bun.file(pageTextPath(tempDir, 2)).text()).toBe('page 2\n')
      expect(await Bun.file(join(tempDir, 'partial-extraction.txt')).text()).toContain(`Page 1\n${rawMalformedText}`)

      const cached = await Bun.file(pageCachePath(tempDir, 1)).json() as Record<string, unknown>
      const cachedRun = cached['run'] as HostedOcrRun
      expect(cachedRun.extractionMethod).toBe('openai-ocr')
      expect(cachedRun.ocrService).toBe('openai')
      expect(cachedRun.ocrModel).toBe('test-model')
      expect(cachedRun.pages[0]?.text).toBe(rawMalformedText)
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('structured fallback pages with empty raw output are cached as blank pages and continue', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-page-empty-valid-'))
    try {
      const attemptedPages: number[] = []
      const result = await runHostedOcrWithPdfChunkFallback({
        filePath: '/virtual/input.pdf',
        step1Metadata: { ...basePdfMetadata, pageCount: 2 },
        serviceLabel: 'Test OCR',
        totalPages: 2,
        fallbackDir: tempDir,
        pageConcurrency: 1,
        runFull: async () => {
          throw Object.assign(new Error('provider timed out while reading OCR response'), { status: 503 })
        },
        createChunk: async (_inputPath, outputPath, range) => {
          await Bun.write(outputPath, `page ${range.startPage}`)
        },
        runChunk: async (_chunkPath, _chunkMetadata, range) => {
          attemptedPages.push(range.startPage)
          if (range.startPage === 1) {
            throw new OcrStructuredResponseError('DeepInfra OCR returned no text output.', '')
          }
          return hostedRun(pagesForRange(range.startPage, range.endPage), { totalPages: 1 })
        },
        buildMalformedPageRun: (rawText, range) => hostedRun([{
          pageNumber: range.startPage,
          method: 'ocr',
          text: rawText
        }], { totalPages: 1 })
      })

      expect(attemptedPages).toEqual([1, 2])
      expect(result.pages.map((page) => page.text)).toEqual(['', 'page 2'])
      expect(await Bun.file(pageCachePath(tempDir, 1)).exists()).toBe(true)
      expect(await Bun.file(pageTextPath(tempDir, 1)).text()).toBe('\n')
      expect(await Bun.file(invalidPageResponsePath(tempDir, 1)).text()).toBe('')
      expect(await Bun.file(pageTextPath(tempDir, 2)).text()).toBe('page 2\n')

      const cached = await Bun.file(pageCachePath(tempDir, 1)).json() as Record<string, unknown>
      const cachedRun = cached['run'] as HostedOcrRun
      expect(cachedRun.pages[0]?.text).toBe('')
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('malformed fallback pages force stitched text to use complete page text when canonical text would be partial', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-page-canonical-invalid-'))
    try {
      const result = await runHostedOcrWithPdfChunkFallback({
        filePath: '/virtual/input.pdf',
        step1Metadata: { ...basePdfMetadata, pageCount: 2 },
        serviceLabel: 'Test OCR',
        totalPages: 2,
        fallbackDir: tempDir,
        runFull: async () => {
          throw Object.assign(new Error('provider timed out while reading OCR response'), { status: 503 })
        },
        createChunk: async (_inputPath, outputPath, range) => {
          await Bun.write(outputPath, `page ${range.startPage}`)
        },
        runChunk: async (_chunkPath, _chunkMetadata, range) => {
          if (range.startPage === 1) {
            throw new OcrStructuredResponseError('Response was not valid JSON', 'raw page OCR text')
          }
          return hostedRun(pagesForRange(range.startPage, range.endPage), {
            canonicalText: 'canonical page 2',
            totalPages: 1
          })
        },
        buildMalformedPageRun: (rawText, range) => hostedRun([{
          pageNumber: range.startPage,
          method: 'ocr',
          text: rawText
        }], { totalPages: 1 })
      })

      expect(result.pages.map((page) => page.text)).toEqual(['raw page OCR text', 'page 2'])
      expect(result.canonicalText).toBeUndefined()
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('chunk stitching sorts pages and aggregates usage metadata', () => {
    const result = stitchHostedOcrChunkRuns([
      hostedRun([
        { pageNumber: 2, method: 'ocr', text: 'two' },
        { pageNumber: 1, method: 'ocr', text: 'one' }
      ], {
        canonicalText: 'one\ntwo',
        promptTokens: 2,
        completionTokens: 20,
        providerCostCents: 3,
        providerCostSource: 'provider_quote',
        providerUsage: [{
          unit: 'chunk',
          pageStart: 1,
          pageEnd: 2,
          promptTokens: 2,
          completionTokens: 20
        }]
      }),
      hostedRun([
        { pageNumber: 3, method: 'ocr', text: 'three' }
      ], {
        canonicalText: 'three',
        promptTokens: 1,
        completionTokens: 10,
        providerCostCents: 5,
        providerCostSource: 'registry_fallback',
        providerUsage: [{
          unit: 'chunk',
          pageStart: 3,
          pageEnd: 3,
          promptTokens: 1,
          completionTokens: 10,
          providerCostCents: 5,
          providerCostSource: 'registry_fallback'
        }]
      })
    ], 3, {
      strategy: 'raster-only',
      directPageAttempts: 2,
      directSuccesses: 0,
      directFailures: 2,
      rasterizedPages: 3,
      directSplittingDisabled: true,
      tools: []
    })

    expect(result.pages.map((page) => page.pageNumber)).toEqual([1, 2, 3])
    expect(result.canonicalText).toBe('one\ntwo\n\nthree')
    expect(result.promptTokens).toBe(3)
    expect(result.completionTokens).toBe(30)
    expect(result.providerCostCents).toBe(8)
    expect(result.providerCostSource).toBe('registry_fallback')
    expect(result.pdfChunkPreparation).toMatchObject({
      strategy: 'raster-only',
      rasterizedPages: 3
    })
    expect(result.providerUsage).toEqual([
      {
        unit: 'chunk',
        pageStart: 1,
        pageEnd: 2,
        promptTokens: 2,
        completionTokens: 20
      },
      {
        unit: 'chunk',
        pageStart: 3,
        pageEnd: 3,
        promptTokens: 1,
        completionTokens: 10,
        providerCostCents: 5,
        providerCostSource: 'registry_fallback'
      }
    ])
  })

  test('PDF fallback classifier splits transient and limit failures but not auth or policy failures', () => {
    expect(shouldFallbackToOcrPdfChunks(Object.assign(new Error('provider timed out'), { status: 503 }))).toBe(true)
    expect(shouldFallbackToOcrPdfChunks(new Error('Gemini OCR supports PDF inputs up to 1000 pages. Got 1200 pages.'))).toBe(true)
    expect(shouldFallbackToOcrPdfChunks(new Error('OpenAI OCR returned malformed JSON.'))).toBe(true)
    expect(shouldFallbackToOcrPdfChunks(new Error('OPENAI_API_KEY environment variable is required for OpenAI OCR'))).toBe(false)
    expect(shouldFallbackToOcrPdfChunks(new Error('Output blocked by content filtering policy'))).toBe(false)
    expect(shouldFallbackToOcrPdfChunks(Object.assign(new Error('Kimi OCR request failed (429): insufficient balance'), { status: 429 }))).toBe(false)
  })

  test('PDF chunk render failures are concise and persist raw stderr diagnostics', async () => {
    const rawStderr = [
      'warning: ICC support is not available',
      'error: cannot render page tree for encrypted object',
      'more raw stderr detail'
    ].join('\n')
    const error = createOcrPdfChunkRenderError(
      { startPage: 6, endPage: 10 },
      {
        exitCode: 1,
        stderr: rawStderr,
        stdout: '',
        command: 'mutool convert -F pdf -o chunk.pdf input.pdf 6-10'
      }
    )
    const failure = classifyOcrProviderFailure(error)

    expect(failure).toMatchObject({
      category: 'pdf_chunk_render'
    })
    expect(failure.message).toContain('PDF chunk creation failed for pages 6-10')
    expect(failure.message).toContain('warning: ICC support is not available')
    expect(failure.message).not.toContain('more raw stderr detail')

    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-error-artifact-'))
    try {
      await writeOcrProviderError(tempDir, error, failure)
      const diagnostic = await Bun.file(join(tempDir, 'error.json')).json() as Record<string, unknown>
      expect(diagnostic['category']).toBe('pdf_chunk_render')
      expect(diagnostic['failureKind']).toBe('pdf_chunk_render')
      expect(diagnostic['retryable']).toBe(true)
      expect((diagnostic['error'] as Record<string, unknown>)['stderr']).toBe(rawStderr)
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('OCR provider diagnostics redact sensitive identifiers in persisted artifacts', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-redacted-error-'))
    try {
      const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'
      const cloudTrace = '105445aa7843bc8bf206b12000100000/123456789;o=1'
      const cfRay = '8f7b3c2d1a0e9f12-DFW'
      const error = Object.assign(new Error('Kimi OCR request failed (429): insufficient account balance for account acct_live_secret1234'), {
        status: 429,
        headers: new Headers({
          'x-request-id': 'req_headersecret123456',
          traceparent,
          traceresponse: traceparent,
          'x-cloud-trace-context': cloudTrace,
          'cf-ray': cfRay,
          'set-cookie': 'session=secret-cookie'
        }),
        rawResponse: {
          error: {
            message: 'insufficient account balance',
            account_id: 'acct_live_secret1234',
            organization_id: 'org_live_secret1234',
            project_id: 'proj_live_secret1234',
            request_id: 'req_live_secret1234',
            trace_id: 'trace_live_secret1234',
            traceparent,
            traceResponse: traceparent,
            credential: 'cred_secret123456789'
          },
          diagnostics: {
            providerTrace: `traceparent=${traceparent}`,
            headers: {
              'cf-ray': cfRay,
              'x-cloud-trace-context': cloudTrace
            }
          }
        }
      })
      const failure = classifyOcrProviderFailure(error)

      await writeOcrProviderError(tempDir, error, failure)
      const errorText = await Bun.file(join(tempDir, 'error.json')).text()
      const rawText = await Bun.file(join(tempDir, 'raw-response.json')).text()

      expect(errorText).toContain('REDACTED')
      expect(errorText).not.toContain('acct_live_secret1234')
      expect(errorText).not.toContain('org_live_secret1234')
      expect(errorText).not.toContain('proj_live_secret1234')
      expect(errorText).not.toContain('req_live_secret1234')
      expect(errorText).not.toContain('trace_live_secret1234')
      expect(errorText).not.toContain('secret-cookie')
      expect(errorText).not.toContain(traceparent)
      expect(errorText).not.toContain(cloudTrace)
      expect(errorText).not.toContain(cfRay)
      expect(rawText).not.toContain('acct_live_secret1234')
      expect(rawText).not.toContain('cred_secret123456789')
      expect(rawText).not.toContain(traceparent)
      expect(rawText).not.toContain(cloudTrace)
      expect(rawText).not.toContain(cfRay)
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })
})
