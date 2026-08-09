import { describe, expect, test } from 'bun:test'
import {
  basePdfMetadata,
  hostedRun,
  jsonResponse,
  join,
  mkdtemp,
  pageCachePath,
  pageInputPath,
  pagesForRange,
  pageTextPath,
  rm,
  runAnthropicOcr,
  runHostedOcrWithPdfChunkFallback,
  runOrderedOcrPageTasks,
  tmpdir
} from './shared'
import { installMockFetch } from '../../../../test-utils/rest-contract-helpers'

describe('OCR resilience contracts', () => {
  test('PDFs over the hosted fallback threshold skip full-document OCR and include page 1', async () => {
    let fullAttempts = 0
    const attemptedPages: number[] = []
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-page-threshold-'))
    try {
      const result = await runHostedOcrWithPdfChunkFallback({
        filePath: '/virtual/input.pdf',
        step1Metadata: { ...basePdfMetadata, pageCount: 21 },
        serviceLabel: 'Test OCR',
        totalPages: 21,
        fallbackDir: tempDir,
        pageConcurrency: undefined,
        runFull: async () => {
          fullAttempts += 1
          throw new Error('full OCR should not run')
        },
        createChunk: async (_inputPath, outputPath, range) => {
          await Bun.write(outputPath, `page ${range.startPage}`)
        },
        runChunk: async (_chunkPath, _chunkMetadata, range) => {
          attemptedPages.push(range.startPage)
          return hostedRun(pagesForRange(range.startPage, range.endPage), {
            totalPages: 1
          })
        }
      })

      expect(fullAttempts).toBe(0)
      expect(attemptedPages).toContain(1)
      expect(attemptedPages).toHaveLength(21)
      expect(result.pages.map((page) => page.pageNumber)).toEqual(Array.from({ length: 21 }, (_value, index) => index + 1))
      expect(await Bun.file(join(tempDir, 'fallback-state.json')).exists()).toBe(true)
      expect(await Bun.file(pageInputPath(tempDir, 1)).exists()).toBe(false)
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  }, 10_000)

  test('successful PDF fallback keeps page inputs only when requested', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-page-keep-inputs-'))
    try {
      await runHostedOcrWithPdfChunkFallback({
        filePath: '/virtual/input.pdf',
        step1Metadata: { ...basePdfMetadata, pageCount: 21 },
        serviceLabel: 'Test OCR',
        totalPages: 21,
        fallbackDir: tempDir,
        keepPageInputs: true,
        runFull: async () => {
          throw new Error('full OCR should not run')
        },
        createChunk: async (_inputPath, outputPath, range) => {
          await Bun.write(outputPath, `page ${range.startPage}`)
        },
        runChunk: async (_chunkPath, _chunkMetadata, range) =>
          hostedRun(pagesForRange(range.startPage, range.endPage), { totalPages: 1 })
      })

      expect(await Bun.file(pageInputPath(tempDir, 1)).exists()).toBe(true)
      expect(await Bun.file(pageInputPath(tempDir, 21)).exists()).toBe(true)
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  }, 10_000)

  test('failed PDF fallback preserves page inputs for resume and debugging', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-page-failed-inputs-'))
    try {
      await expect(runHostedOcrWithPdfChunkFallback({
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
        runChunk: async () => {
          throw new Error('page OCR failed')
        }
      })).rejects.toThrow('page OCR failed')

      expect(await Bun.file(pageInputPath(tempDir, 1)).exists()).toBe(true)
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('PDFs at the hosted fallback threshold still try full-document OCR first', async () => {
    let fullAttempts = 0
    let pageAttempts = 0
    const result = await runHostedOcrWithPdfChunkFallback({
      filePath: '/virtual/input.pdf',
      step1Metadata: { ...basePdfMetadata, pageCount: 20 },
      serviceLabel: 'Test OCR',
      totalPages: 20,
      runFull: async () => {
        fullAttempts += 1
        return hostedRun(pagesForRange(1, 20), { totalPages: 20 })
      },
      createChunk: async (_inputPath, outputPath) => {
        await Bun.write(outputPath, 'page')
      },
      runChunk: async () => {
        pageAttempts += 1
        return hostedRun(pagesForRange(1, 1), { totalPages: 1 })
      }
    })

    expect(fullAttempts).toBe(1)
    expect(pageAttempts).toBe(0)
    expect(result.totalPages).toBe(20)
  })

  test('hosted OCR page task concurrency preserves result order', async () => {
    let active = 0
    let maxActive = 0
    const completionOrder: number[] = []

    const results = await runOrderedOcrPageTasks([1, 2, 3, 4], 2, async (page) => {
      active += 1
      maxActive = Math.max(maxActive, active)
      await Bun.sleep(page === 1 ? 20 : 2)
      completionOrder.push(page)
      active -= 1
      return `page ${page}`
    })

    expect(maxActive).toBe(2)
    expect(results).toEqual(['page 1', 'page 2', 'page 3', 'page 4'])
    expect(completionOrder[0]).toBe(2)
  })

  test('Anthropic single-page PDF chunks are uploaded without re-splitting', async () => {
    const previousFetch = globalThis.fetch
    const previousEnv = {
      ANTHROPIC_API_KEY: process.env['ANTHROPIC_API_KEY']
    }
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-anthropic-single-page-pdf-'))
    const inputPath = join(tempDir, 'page-000001.pdf')
    const calls: string[] = []

    try {
      await Bun.write(inputPath, '%PDF-1.7\nsingle page placeholder\n')
      process.env['ANTHROPIC_API_KEY'] = 'test-key'
      installMockFetch((call) => {
        if (call.url.endsWith('/v1/files') && call.method === 'POST') {
          calls.push('upload')
          return jsonResponse({ id: 'file_test_123' })
        }
        if (call.url.endsWith('/v1/messages')) {
          calls.push('message')
          return jsonResponse({
            content: [{
              type: 'text',
              text: JSON.stringify({ pages: [{ pageNumber: 1, text: 'page 1 text' }] })
            }],
            usage: {
              input_tokens: 11,
              output_tokens: 12
            }
          })
        }
        if (call.url.endsWith('/v1/files/file_test_123') && call.method === 'DELETE') {
          calls.push('delete')
          return jsonResponse({ id: 'file_test_123', type: 'file_deleted' })
        }
        throw new Error(`unexpected Anthropic mock URL: ${call.url}`)
      })

      const result = await runAnthropicOcr(inputPath, {
        ...basePdfMetadata,
        pageCount: 1,
        fileSize: 32
      }, 'claude-sonnet-5')

      expect(calls).toEqual(['upload', 'message', 'delete'])
      expect(result.pages).toEqual([{ pageNumber: 1, method: 'ocr', text: 'page 1 text' }])
      expect(result.promptTokens).toBe(11)
      expect(result.completionTokens).toBe(12)
    } finally {
      globalThis.fetch = previousFetch
      if (previousEnv.ANTHROPIC_API_KEY === undefined) {
        delete process.env['ANTHROPIC_API_KEY']
      } else {
        process.env['ANTHROPIC_API_KEY'] = previousEnv.ANTHROPIC_API_KEY
      }
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('small PDF full-document failures fall back to individual cached pages', async () => {
    const attemptedPages: number[] = []
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-page-fallback-'))
    try {
      const result = await runHostedOcrWithPdfChunkFallback({
        filePath: '/virtual/input.pdf',
        step1Metadata: { ...basePdfMetadata, pageCount: 3 },
        serviceLabel: 'Test OCR',
        totalPages: 3,
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
          return hostedRun(pagesForRange(range.startPage, range.endPage), {
            totalPages: 1,
            promptTokens: 1,
            completionTokens: 10,
            providerCostCents: 1,
            providerCostSource: range.startPage === 2 ? 'registry_fallback' : 'provider_quote'
          })
        }
      })

      expect(attemptedPages).toEqual([1, 2, 3])
      expect(result.pages.map((page) => page.pageNumber)).toEqual([1, 2, 3])
      expect(result.promptTokens).toBe(3)
      expect(result.completionTokens).toBe(30)
      expect(result.providerCostCents).toBe(3)
      expect(result.providerCostSource).toBe('registry_fallback')
      expect(await Bun.file(pageCachePath(tempDir, 1)).exists()).toBe(true)
      expect(await Bun.file(pageCachePath(tempDir, 2)).exists()).toBe(true)
      expect(await Bun.file(pageCachePath(tempDir, 3)).exists()).toBe(true)
      expect(await Bun.file(pageTextPath(tempDir, 1)).text()).toBe('page 1\n')
      expect(await Bun.file(pageTextPath(tempDir, 2)).text()).toBe('page 2\n')
      expect(await Bun.file(pageTextPath(tempDir, 3)).text()).toBe('page 3\n')
      expect(await Bun.file(join(tempDir, 'partial-extraction.txt')).text()).toContain('Page 3\npage 3')
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('small PDF fallback honors page concurrency and still writes ordered artifacts', async () => {
    let active = 0
    let maxActive = 0
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-page-fallback-concurrency-'))
    try {
      const result = await runHostedOcrWithPdfChunkFallback({
        filePath: '/virtual/input.pdf',
        step1Metadata: { ...basePdfMetadata, pageCount: 4 },
        serviceLabel: 'Test OCR',
        totalPages: 4,
        fallbackDir: tempDir,
        pageConcurrency: 2,
        runFull: async () => {
          throw Object.assign(new Error('provider timed out while reading OCR response'), { status: 503 })
        },
        createChunk: async (_inputPath, outputPath, range) => {
          await Bun.write(outputPath, `page ${range.startPage}`)
        },
        runChunk: async (_chunkPath, _chunkMetadata, range) => {
          active += 1
          maxActive = Math.max(maxActive, active)
          await Bun.sleep(range.startPage === 1 ? 20 : 2)
          active -= 1
          return hostedRun(pagesForRange(range.startPage, range.endPage), {
            totalPages: 1,
            promptTokens: range.startPage,
            completionTokens: range.startPage * 10,
            providerUsage: [{
              unit: 'chunk',
              pageStart: range.startPage,
              pageEnd: range.endPage,
              usageRole: 'schema-retry',
              pageNumber: 1
            }]
          })
        }
      })

      expect(maxActive).toBe(2)
      expect(result.pages.map((page) => page.pageNumber)).toEqual([1, 2, 3, 4])
      expect(result.pages.map((page) => page.text)).toEqual(['page 1', 'page 2', 'page 3', 'page 4'])
      expect(result.promptTokens).toBe(10)
      expect(result.completionTokens).toBe(100)
      expect(result.providerUsage?.map((entry) => entry['pageStart'])).toEqual([1, 2, 3, 4])
      expect(result.providerUsage?.map((entry) => entry['pageNumber'])).toEqual([1, 2, 3, 4])
      expect(await Bun.file(pageCachePath(tempDir, 1)).exists()).toBe(true)
      expect(await Bun.file(pageCachePath(tempDir, 4)).exists()).toBe(true)
      expect(await Bun.file(pageTextPath(tempDir, 4)).text()).toBe('page 4\n')
      expect(await Bun.file(join(tempDir, 'partial-extraction.txt')).text()).toContain('Page 4\npage 4')
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('PDF page fallback stops scheduling after provider-wide blockers and records canceled pages', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-page-provider-blocked-'))
    let resolveSecondStarted!: () => void
    const secondStarted = new Promise<void>(resolve => {
      resolveSecondStarted = resolve
    })
    const startedPages: number[] = []

    try {
      await Bun.write(join(tempDir, 'fallback-state.json'), JSON.stringify({
        version: 1,
        mode: 'single-page',
        totalPages: 5,
        serviceLabel: 'Anthropic OCR',
        sourceFile: 'input.pdf'
      }, null, 2) + '\n')

      await expect(runHostedOcrWithPdfChunkFallback({
        filePath: '/virtual/input.pdf',
        step1Metadata: { ...basePdfMetadata, pageCount: 5 },
        serviceLabel: 'Anthropic OCR',
        totalPages: 5,
        fallbackDir: tempDir,
        pageConcurrency: 2,
        runFull: async () => {
          throw new Error('full OCR should be bypassed')
        },
        createChunk: async (_inputPath, outputPath, range) => {
          await Bun.write(outputPath, `page ${range.startPage}`)
        },
        runChunk: async (_chunkPath, _chunkMetadata, range) => {
          startedPages.push(range.startPage)
          if (range.startPage === 2) {
            resolveSecondStarted()
            await Bun.sleep(20)
            return hostedRun(pagesForRange(range.startPage, range.endPage), { totalPages: 1 })
          }
          if (range.startPage === 1) {
            await secondStarted
            throw Object.assign(new Error('Anthropic Messages request failed (400): Output blocked by content filtering policy'), {
              status: 400,
              errorType: 'invalid_request_error'
            })
          }
          throw new Error(`page ${range.startPage} should not have been scheduled`)
        }
      })).rejects.toThrow('content filtering policy')

      expect(startedPages.slice().sort((a, b) => a - b)).toEqual([1, 2])
      const state = await Bun.file(join(tempDir, 'fallback-state.json')).json() as Record<string, unknown>
      expect(state['initialFallbackReason']).toBe('fallback-state')
      expect(state['pageStatusCounts']).toMatchObject({
        succeeded: 1,
        failed: 1,
        canceled: 3
      })
      expect(state['terminalReason']).toBe('content_policy')
      const pages = state['pages'] as Array<Record<string, unknown>>
      const statuses = Object.fromEntries(pages.map((page) => [page['pageNumber'], page['status']]))
      expect(statuses).toMatchObject({
        1: 'failed',
        2: 'succeeded',
        3: 'canceled',
        4: 'canceled',
        5: 'canceled'
      })
      const failedPage = pages.find((page) => page['pageNumber'] === 1)
      expect(failedPage?.['failure']).toMatchObject({
        failureKind: 'content_policy',
        retryable: false,
        blockedReason: 'content_policy'
      })
    } finally {
      resolveSecondStarted?.()
      await rm(tempDir, { recursive: true, force: true })
    }
  })
})
