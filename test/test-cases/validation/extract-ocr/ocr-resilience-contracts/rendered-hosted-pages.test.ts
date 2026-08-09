import { describe, expect, test } from 'bun:test'
import {
  basePdfMetadata,
  buildHostedOcrImageResult,
  captureLogEvents,
  createOcrPreparationCache,
  join,
  mkdtemp,
  pageCachePath,
  pageTextPath,
  prefillRenderedPageCache,
  rm,
  runHostedOcrDocument,
  runOrderedOcrPageTasks,
  tmpdir
} from './shared'

describe('OCR resilience contracts', () => {
  test('rendered hosted OCR stops scheduling pages after a page task fails', async () => {
    const startedPages: number[] = []

    await expect(runOrderedOcrPageTasks([1, 2, 3, 4], 2, async (page) => {
      startedPages.push(page)
      if (page === 2) {
        throw new Error('page 2 failed')
      }
      await Bun.sleep(20)
      return page
    })).rejects.toThrow('page 2 failed')

    await Bun.sleep(30)
    expect(startedPages).toEqual([1, 2])
  })

  test('rendered hosted OCR starts with the default page concurrency when concurrency is unset', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-rendered-hosted-ocr-default-concurrency-'))
    const inputPath = join(tempDir, 'input.pdf')
    const renderDir = join(tempDir, 'renders')
    const cache = createOcrPreparationCache()
    const pages = Array.from({ length: 12 }, (_value, index) => index + 1)
    let active = 0
    let maxActive = 0

    try {
      await prefillRenderedPageCache(cache, renderDir, inputPath, pages, 300)

      await runHostedOcrDocument(inputPath, {
        ...basePdfMetadata,
        pageCount: pages.length
      }, {
        dpi: 300,
        password: undefined,
        outputDir: tempDir,
        ocrConcurrency: undefined,
        ocrPreparationCache: cache
      }, {
        extractionMethod: 'kimi-ocr',
        tempDirPrefix: 'autoshow-rendered-hosted-test-',
        providerLabel: 'Kimi OCR',
        model: 'kimi-k2.6',
        runImage: async (_imagePath, _format, pageNumber) => {
          active += 1
          maxActive = Math.max(maxActive, active)
          await Bun.sleep(pageNumber <= 10 ? 10 : 1)
          active -= 1
          return buildHostedOcrImageResult(pageNumber, `page ${pageNumber}`)
        }
      })

      expect(maxActive).toBe(10)
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('rendered hosted OCR respects page concurrency, logs attempts, and writes ordered page artifacts', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-rendered-hosted-ocr-'))
    const inputPath = join(tempDir, 'input.pdf')
    const renderDir = join(tempDir, 'renders')
    const cache = createOcrPreparationCache()
    let active = 0
    let maxActive = 0
    const completionOrder: number[] = []

    try {
      await prefillRenderedPageCache(cache, renderDir, inputPath, [1, 2, 3, 4], 300)

      const { result, events } = await captureLogEvents(async () =>
        await runHostedOcrDocument(inputPath, {
          ...basePdfMetadata,
          pageCount: 4
        }, {
          dpi: 300,
          password: undefined,
          outputDir: tempDir,
          ocrConcurrency: 2,
          ocrPreparationCache: cache
        }, {
          extractionMethod: 'kimi-ocr',
          tempDirPrefix: 'autoshow-rendered-hosted-test-',
          providerLabel: 'Kimi OCR',
          model: 'kimi-k2.6',
          runImage: async (_imagePath, format, pageNumber, pageLabel) => {
            expect(format).toBe('png')
            expect(pageLabel).toBe(`page ${pageNumber}`)
            active += 1
            maxActive = Math.max(maxActive, active)
            await Bun.sleep(pageNumber === 1 ? 20 : 2)
            completionOrder.push(pageNumber)
            active -= 1
            return buildHostedOcrImageResult(pageNumber, `page ${pageNumber}`, {
              promptTokens: pageNumber,
              completionTokens: pageNumber * 10
            })
          }
        })
      )

      expect(maxActive).toBe(2)
      expect(completionOrder[0]).toBe(2)
      expect(result.pages.map((page) => page.pageNumber)).toEqual([1, 2, 3, 4])
      expect(result.pages.map((page) => page.text)).toEqual(['page 1', 'page 2', 'page 3', 'page 4'])
      expect(result.promptTokens).toBe(10)
      expect(result.completionTokens).toBe(100)
      expect(events
        .map((event) => event.message)
        .filter((message) => message.startsWith('Kimi OCR: OCR page '))
        .sort()
      ).toEqual([
        'Kimi OCR: OCR page 1',
        'Kimi OCR: OCR page 2',
        'Kimi OCR: OCR page 3',
        'Kimi OCR: OCR page 4'
      ].sort())
      expect(await Bun.file(pageTextPath(tempDir, 4)).text()).toBe('page 4\n')
      expect(await Bun.file(join(tempDir, 'partial-extraction.txt')).text()).toContain('Page 4\npage 4')

      const cached = await Bun.file(pageCachePath(tempDir, 3)).json() as Record<string, unknown>
      expect(cached).toMatchObject({
        mode: 'rendered-page',
        extractionMethod: 'kimi-ocr',
        model: 'kimi-k2.6',
        totalPages: 4,
        pageNumber: 3
      })
      expect(((cached['result'] as Record<string, unknown>)['page'] as Record<string, unknown>)['text']).toBe('page 3')
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('rendered hosted OCR resumes cached blank pages before rendering', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-rendered-hosted-ocr-resume-'))
    const inputPath = join(tempDir, 'input.pdf')
    const renderDir = join(tempDir, 'renders')
    const cache = createOcrPreparationCache()
    let firstRunCalls = 0
    let secondRunCalls = 0

    try {
      await prefillRenderedPageCache(cache, renderDir, inputPath, [1, 2], 300)

      await runHostedOcrDocument(inputPath, {
        ...basePdfMetadata,
        pageCount: 2
      }, {
        dpi: 300,
        password: undefined,
        outputDir: tempDir,
        ocrConcurrency: 1,
        ocrPreparationCache: cache
      }, {
        extractionMethod: 'deepinfra-ocr',
        tempDirPrefix: 'autoshow-rendered-hosted-test-',
        providerLabel: 'DeepInfra OCR',
        model: 'qwen-test',
        runImage: async (_imagePath, _format, pageNumber) => {
          firstRunCalls += 1
          return buildHostedOcrImageResult(pageNumber, pageNumber === 1 ? '' : 'page 2', {
            promptTokens: pageNumber,
            completionTokens: pageNumber * 10
          })
        }
      })

      const { result, events } = await captureLogEvents(async () =>
        await runHostedOcrDocument(inputPath, {
          ...basePdfMetadata,
          pageCount: 2
        }, {
          dpi: 300,
          password: undefined,
          outputDir: tempDir,
          ocrConcurrency: 2,
          ocrPreparationCache: undefined
        }, {
          extractionMethod: 'deepinfra-ocr',
          tempDirPrefix: 'autoshow-rendered-hosted-test-',
          providerLabel: 'DeepInfra OCR',
          model: 'qwen-test',
          runImage: async () => {
            secondRunCalls += 1
            throw new Error('cached rendered OCR page should skip provider calls')
          }
        })
      )

      expect(firstRunCalls).toBe(2)
      expect(secondRunCalls).toBe(0)
      expect(result.pages.map((page) => page.text)).toEqual(['', 'page 2'])
      expect(result.promptTokens).toBe(3)
      expect(result.completionTokens).toBe(30)
      expect(events
        .map((event) => event.message)
        .filter((message) => message.includes('already cached'))
        .sort()
      ).toEqual([
        'DeepInfra OCR: OCR page 1 already cached',
        'DeepInfra OCR: OCR page 2 already cached'
      ].sort())
      expect(await Bun.file(pageTextPath(tempDir, 1)).text()).toBe('\n')
      expect(await Bun.file(pageTextPath(tempDir, 2)).text()).toBe('page 2\n')
      expect(await Bun.file(join(tempDir, 'partial-extraction.txt')).text()).toContain('Page 1')

      const cached = await Bun.file(pageCachePath(tempDir, 1)).json() as Record<string, unknown>
      expect(((cached['result'] as Record<string, unknown>)['page'] as Record<string, unknown>)['text']).toBe('')
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })
})
