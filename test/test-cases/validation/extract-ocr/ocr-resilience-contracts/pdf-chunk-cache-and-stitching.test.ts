import { describe, expect, test } from 'bun:test'
import { ProviderError } from '~/utils/error-handler'
import type { HostedOcrRun, RunHostedOcrPdfChunkFallbackOptions } from '~/types'
import {
  basePdfMetadata,
  hostedRun,
  invalidPageResponsePath,
  join,
  mkdir,
  OcrStructuredResponseError,
  pageCachePath,
  pagesForRange,
  pageTextPath,
  rm,
  runHostedOcrWithPdfChunkFallback,
  stitchHostedOcrChunkRuns
} from './shared'

const withLocalTestDir = async <T>(prefix: string, run: (dir: string) => Promise<T>): Promise<T> => {
  const dir = join(process.cwd(), '.test-work', `${prefix}-${crypto.randomUUID()}`)
  await mkdir(dir, { recursive: true })
  try { return await run(dir) } finally { await rm(dir, { recursive: true, force: true }) }
}

const runTwoPageFallback = async (
  fallbackDir: string,
  overrides: Partial<RunHostedOcrPdfChunkFallbackOptions> = {}
): Promise<HostedOcrRun> => await runHostedOcrWithPdfChunkFallback({
  filePath: '/virtual/input.pdf',
  step1Metadata: { ...basePdfMetadata, pageCount: 2 },
  serviceLabel: 'Test OCR',
  totalPages: 2,
  fallbackDir,
  pageConcurrency: 1,
  runFull: async () => {
    throw ProviderError('provider timed out while reading OCR response', { status: 503 })
  },
  createChunk: async (_inputPath, outputPath, range) => {
    await Bun.write(outputPath, `page ${range.startPage}`)
  },
  runChunk: async (_chunkPath, _chunkMetadata, range) =>
    hostedRun(pagesForRange(range.startPage, range.endPage), { totalPages: 1 }),
  ...overrides
})

const malformedPageRun: NonNullable<RunHostedOcrPdfChunkFallbackOptions['buildMalformedPageRun']> = (
  rawText,
  range
) => hostedRun([{
  pageNumber: range.startPage,
  method: 'ocr',
  text: rawText
}], { totalPages: 1 })

describe('PDF chunk cache and stitching contracts', () => {
  test('successful fallback pages are cached before the next page runs', async () => {
    await withLocalTestDir('ocr-page-cache-order', async (dir) => {
      await runTwoPageFallback(dir, {
        runChunk: async (_chunkPath, _chunkMetadata, range) => {
          if (range.startPage === 2) {
            expect(await Bun.file(pageCachePath(dir, 1)).exists()).toBe(true)
            expect(await Bun.file(pageTextPath(dir, 1)).text()).toBe('page 1\n')
            expect(await Bun.file(join(dir, 'partial-extraction.txt')).text()).toContain('Page 1\npage 1')
          }
          return hostedRun(pagesForRange(range.startPage, range.endPage), { totalPages: 1 })
        }
      })
    })
  })

  test('malformed structured fallback pages are accepted as raw text and processing continues', async () => {
    await withLocalTestDir('ocr-page-invalid', async (dir) => {
      const attemptedPages: number[] = []
      const rawMalformedText = 'raw page OCR text\nsecond line'
      const result = await runTwoPageFallback(dir, {
        runChunk: async (_chunkPath, _chunkMetadata, range) => {
          attemptedPages.push(range.startPage)
          if (range.startPage === 1) {
            throw new OcrStructuredResponseError('Response was not valid JSON', rawMalformedText)
          }
          return hostedRun(pagesForRange(range.startPage, range.endPage), { totalPages: 1 })
        },
        buildMalformedPageRun: malformedPageRun
      })

      expect(attemptedPages).toEqual([1, 2])
      expect(result.pages.map((page) => page.text)).toEqual([rawMalformedText, 'page 2'])
      expect(await Bun.file(invalidPageResponsePath(dir, 1)).text()).toBe(rawMalformedText)
      expect(await Bun.file(pageTextPath(dir, 1)).text()).toBe(`${rawMalformedText}\n`)
      expect(await Bun.file(pageTextPath(dir, 2)).text()).toBe('page 2\n')
      expect(await Bun.file(join(dir, 'partial-extraction.txt')).text()).toContain(`Page 1\n${rawMalformedText}`)

      const cached = await Bun.file(pageCachePath(dir, 1)).json() as Record<string, unknown>
      const cachedRun = cached['run'] as HostedOcrRun
      expect(cachedRun).toMatchObject({
        extractionMethod: 'openai-ocr',
        ocrService: 'openai',
        ocrModel: 'test-model'
      })
      expect(cachedRun.pages[0]?.text).toBe(rawMalformedText)
    })
  })

  test('structured fallback pages with empty raw output are cached as blank pages and continue', async () => {
    await withLocalTestDir('ocr-page-empty-valid', async (dir) => {
      const attemptedPages: number[] = []
      const result = await runTwoPageFallback(dir, {
        runChunk: async (_chunkPath, _chunkMetadata, range) => {
          attemptedPages.push(range.startPage)
          if (range.startPage === 1) {
            throw new OcrStructuredResponseError('DeepInfra OCR returned no text output.', '')
          }
          return hostedRun(pagesForRange(range.startPage, range.endPage), { totalPages: 1 })
        },
        buildMalformedPageRun: malformedPageRun
      })

      expect(attemptedPages).toEqual([1, 2])
      expect(result.pages.map((page) => page.text)).toEqual(['', 'page 2'])
      expect(await Bun.file(pageCachePath(dir, 1)).exists()).toBe(true)
      expect(await Bun.file(pageTextPath(dir, 1)).text()).toBe('\n')
      expect(await Bun.file(invalidPageResponsePath(dir, 1)).text()).toBe('')
      expect(await Bun.file(pageTextPath(dir, 2)).text()).toBe('page 2\n')

      const cached = await Bun.file(pageCachePath(dir, 1)).json() as Record<string, unknown>
      expect(((cached['run'] as HostedOcrRun).pages[0]?.text)).toBe('')
    })
  })

  test('malformed fallback pages force stitched text to use complete page text when canonical text would be partial', async () => {
    await withLocalTestDir('ocr-page-canonical-invalid', async (dir) => {
      const result = await runTwoPageFallback(dir, {
        runChunk: async (_chunkPath, _chunkMetadata, range) => {
          if (range.startPage === 1) {
            throw new OcrStructuredResponseError('Response was not valid JSON', 'raw page OCR text')
          }
          return hostedRun(pagesForRange(range.startPage, range.endPage), {
            canonicalText: 'canonical page 2',
            totalPages: 1
          })
        },
        buildMalformedPageRun: malformedPageRun
      })

      expect(result.pages.map((page) => page.text)).toEqual(['raw page OCR text', 'page 2'])
      expect(result.canonicalText).toBeUndefined()
    })
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
      hostedRun([{ pageNumber: 3, method: 'ocr', text: 'three' }], {
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
})
