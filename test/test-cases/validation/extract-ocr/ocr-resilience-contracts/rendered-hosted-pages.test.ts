import { describe, expect, test } from 'bun:test'
import {
  basePdfMetadata,
  captureLogEvents,
  createOcrPreparationCache,
  createRenderedPngPageChunk,
  join,
  mkdir,
  mkdtemp,
  OcrStructuredResponseError,
  pageCachePath,
  pageInputPath,
  pageTextPath,
  prefillRenderedPageCache,
  rm,
  runHostedOcrWithPdfChunkFallback,
  tmpdir
} from './shared'
import type { HostedOcrRun } from './shared'

const kimiIdentity = {
  extractionMethod: 'kimi-ocr' as const,
  ocrService: 'kimi' as const,
  ocrModel: 'kimi-k2.6'
}

const kimiPageRun = (pageNumber: number, text = `page ${pageNumber}`): HostedOcrRun => ({
  pages: [{ pageNumber: 1, method: 'ocr', text }],
  ...kimiIdentity,
  totalPages: 1,
  promptTokens: pageNumber,
  completionTokens: pageNumber * 10,
  providerUsage: [{
    unit: 'chunk',
    pageNumber: 1,
    promptTokens: pageNumber,
    completionTokens: pageNumber * 10
  }]
})

const writeLegacyRenderedPage = async (
  dir: string,
  sourceFile: string,
  pageNumber: number,
  totalPages: number,
  text: string
): Promise<void> => {
  await mkdir(join(dir, 'page-results'), { recursive: true })
  await Bun.write(pageCachePath(dir, pageNumber), JSON.stringify({
    version: 1,
    mode: 'rendered-page',
    extractionMethod: kimiIdentity.extractionMethod,
    model: kimiIdentity.ocrModel,
    sourceFile,
    totalPages,
    pageNumber,
    result: {
      page: { pageNumber, method: 'ocr', text },
      promptTokens: pageNumber,
      completionTokens: pageNumber * 10
    }
  }, null, 2) + '\n')
}

describe('OCR resilience contracts', () => {
  test('rendered PNG chunks copy preparation-cache images into provider page inputs', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-rendered-png-chunk-'))
    const inputPath = join(tempDir, 'input.pdf')
    const outputPath = join(tempDir, 'page-000002.png')
    const cache = createOcrPreparationCache()

    try {
      await prefillRenderedPageCache(cache, join(tempDir, 'renders'), inputPath, [2], 240, 'secret')
      await createRenderedPngPageChunk(240, cache)(
        inputPath,
        outputPath,
        { startPage: 2, endPage: 2 },
        'secret'
      )

      expect(await Bun.file(outputPath).text()).toBe('rendered page 2')
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('forced rendered-page mode preserves ordered text bytes and records per-page usage', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-rendered-page-fallback-'))
    const inputPath = join(tempDir, 'input.pdf')
    const cache = createOcrPreparationCache()
    const completionOrder: number[] = []
    let fullAttempts = 0
    let active = 0
    let maxActive = 0

    try {
      await prefillRenderedPageCache(cache, join(tempDir, 'renders'), inputPath, [1, 2, 3, 4], 300)
      const { result, events } = await captureLogEvents(async () =>
        await runHostedOcrWithPdfChunkFallback({
          filePath: inputPath,
          step1Metadata: { ...basePdfMetadata, pageCount: 4 },
          serviceLabel: 'Kimi OCR',
          totalPages: 4,
          dpi: 300,
          fallbackDir: tempDir,
          pageConcurrency: 2,
          keepPageInputs: true,
          forcePageMode: true,
          cacheIdentity: kimiIdentity,
          chunkFormat: 'png',
          chunkExtension: 'png',
          createChunk: createRenderedPngPageChunk(300, cache),
          runFull: async () => {
            fullAttempts += 1
            throw new Error('forced page mode must bypass full-document OCR')
          },
          runChunk: async (_chunkPath, _chunkMetadata, range) => {
            active += 1
            maxActive = Math.max(maxActive, active)
            await Bun.sleep(range.startPage === 1 ? 20 : 2)
            completionOrder.push(range.startPage)
            active -= 1
            return kimiPageRun(range.startPage)
          }
        })
      )

      expect(fullAttempts).toBe(0)
      expect(maxActive).toBe(2)
      expect(completionOrder[0]).toBe(2)
      expect(result.pages.map((page) => page.pageNumber)).toEqual([1, 2, 3, 4])
      expect(result.pages.map((page) => page.text)).toEqual(['page 1', 'page 2', 'page 3', 'page 4'])
      expect(result.promptTokens).toBe(10)
      expect(result.completionTokens).toBe(100)
      expect(result.providerUsage?.map((entry) => entry['pageNumber'])).toEqual([1, 2, 3, 4])
      expect(result.providerUsage?.every((entry) => entry['unit'] === 'chunk')).toBe(true)
      expect(events.some((event) => event.level === 'info' && event.message === 'Kimi OCR: using resumable rendered-page OCR')).toBe(true)
      expect(await Bun.file(pageTextPath(tempDir, 4)).text()).toBe('page 4\n')
      expect(await Bun.file(join(tempDir, 'partial-extraction.txt')).text()).toBe('Page 1\npage 1\n\nPage 2\npage 2\n\nPage 3\npage 3\n\nPage 4\npage 4\n')
      expect(await Bun.file(pageInputPath(tempDir, 1).replace(/\.pdf$/, '.png')).text()).toBe('rendered page 1')

      const cached = await Bun.file(pageCachePath(tempDir, 3)).json() as Record<string, unknown>
      expect(cached).toMatchObject({
        mode: 'single-page',
        sourceFile: 'input.pdf',
        totalPages: 4,
        pageNumber: 3
      })
      expect(cached['run']).toMatchObject(kimiIdentity)
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('legacy rendered-page caches resume byte-identically and upgrade to the shared schema', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-rendered-page-compat-'))
    const inputPath = join(tempDir, 'input.pdf')
    let providerCalls = 0
    let renderCalls = 0

    try {
      await writeLegacyRenderedPage(tempDir, 'input.pdf', 1, 2, '')
      await writeLegacyRenderedPage(tempDir, 'input.pdf', 2, 2, 'page 2')

      const { result, events } = await captureLogEvents(async () =>
        await runHostedOcrWithPdfChunkFallback({
          filePath: inputPath,
          step1Metadata: { ...basePdfMetadata, pageCount: 2 },
          serviceLabel: 'Kimi OCR',
          totalPages: 2,
          fallbackDir: tempDir,
          forcePageMode: true,
          cacheIdentity: kimiIdentity,
          chunkFormat: 'png',
          chunkExtension: 'png',
          createChunk: async () => {
            renderCalls += 1
          },
          runFull: async () => {
            throw new Error('forced page mode must bypass full-document OCR')
          },
          runChunk: async () => {
            providerCalls += 1
            throw new Error('legacy rendered-page cache should skip provider calls')
          }
        })
      )

      expect(renderCalls).toBe(0)
      expect(providerCalls).toBe(0)
      expect(result.pages.map((page) => page.text)).toEqual(['', 'page 2'])
      expect(result.promptTokens).toBe(3)
      expect(result.completionTokens).toBe(30)
      expect(result.providerUsage?.map((entry) => entry['unit'])).toEqual(['chunk', 'chunk'])
      expect(await Bun.file(pageTextPath(tempDir, 1)).text()).toBe('\n')
      expect(await Bun.file(pageTextPath(tempDir, 2)).text()).toBe('page 2\n')
      expect(await Bun.file(join(tempDir, 'partial-extraction.txt')).text()).toBe('Page 1\n\n\nPage 2\npage 2\n')
      expect(events
        .filter((event) => event.message.includes('already cached'))
        .every((event) => event.level === 'debug')
      ).toBe(true)

      const upgraded = await Bun.file(pageCachePath(tempDir, 1)).json() as Record<string, unknown>
      expect(upgraded).toMatchObject({
        version: 1,
        mode: 'single-page',
        sourceFile: 'input.pdf',
        totalPages: 2,
        pageNumber: 1
      })
      expect(upgraded['result']).toBeUndefined()
      expect(upgraded['run']).toMatchObject(kimiIdentity)
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('shared page resume rejects caches from another model or source file', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-rendered-page-validation-'))
    const inputPath = join(tempDir, 'input.pdf')
    const attemptedPages: number[] = []

    try {
      await mkdir(join(tempDir, 'page-results'), { recursive: true })
      await Bun.write(pageCachePath(tempDir, 1), JSON.stringify({
        version: 1,
        mode: 'single-page',
        sourceFile: 'input.pdf',
        totalPages: 3,
        pageNumber: 1,
        run: {
          ...kimiPageRun(1, 'wrong model'),
          ocrModel: 'other-model'
        }
      }, null, 2) + '\n')
      await Bun.write(pageCachePath(tempDir, 2), JSON.stringify({
        version: 1,
        mode: 'single-page',
        sourceFile: 'other.pdf',
        totalPages: 3,
        pageNumber: 2,
        run: {
          ...kimiPageRun(2, 'wrong source'),
          pages: [{ pageNumber: 2, method: 'ocr', text: 'wrong source' }]
        }
      }, null, 2) + '\n')
      await writeLegacyRenderedPage(tempDir, 'input.pdf', 3, 3, 'legacy page 3')

      const result = await runHostedOcrWithPdfChunkFallback({
        filePath: inputPath,
        step1Metadata: { ...basePdfMetadata, pageCount: 3 },
        serviceLabel: 'Kimi OCR',
        totalPages: 3,
        fallbackDir: tempDir,
        pageConcurrency: 1,
        forcePageMode: true,
        cacheIdentity: kimiIdentity,
        createChunk: async (_source, outputPath, range) => {
          await Bun.write(outputPath, `page ${range.startPage}`)
        },
        runFull: async () => {
          throw new Error('forced page mode must bypass full-document OCR')
        },
        runChunk: async (_chunkPath, _chunkMetadata, range) => {
          attemptedPages.push(range.startPage)
          return kimiPageRun(range.startPage, `fresh ${range.startPage}`)
        }
      })

      expect(attemptedPages).toEqual([1, 2])
      expect(result.pages.map((page) => page.text)).toEqual(['fresh 1', 'fresh 2', 'legacy page 3'])
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('forced page mode does not salvage Kimi provider-limit truncation as page text', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-rendered-page-truncation-'))
    const inputPath = join(tempDir, 'input.pdf')

    try {
      const truncated = new OcrStructuredResponseError('Kimi response reached its completion limit.', 'partial page')
      ;(truncated as OcrStructuredResponseError & { category: 'provider_limit' }).category = 'provider_limit'

      await expect(runHostedOcrWithPdfChunkFallback({
        filePath: inputPath,
        step1Metadata: { ...basePdfMetadata, pageCount: 1 },
        serviceLabel: 'Kimi OCR',
        totalPages: 1,
        fallbackDir: tempDir,
        forcePageMode: true,
        cacheIdentity: kimiIdentity,
        createChunk: async (_source, outputPath) => {
          await Bun.write(outputPath, 'page 1')
        },
        runFull: async () => {
          throw new Error('forced page mode must bypass full-document OCR')
        },
        runChunk: async () => {
          throw truncated
        },
        buildMalformedPageRun: rawText => kimiPageRun(1, rawText)
      })).rejects.toThrow('completion limit')

      expect(await Bun.file(pageCachePath(tempDir, 1)).exists()).toBe(false)
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })
})
