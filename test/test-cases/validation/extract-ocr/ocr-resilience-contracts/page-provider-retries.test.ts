import { describe, expect, test } from 'bun:test'
import { basePdfMetadata, classifyOcrCreateRetry, classifyOcrProviderFailure, createOcrPreparationCache, join, jsonResponse, OcrStructuredResponseError, OCR_PAGE_RATE_LIMIT_REQUEST_ATTEMPTS, OCR_RATE_LIMIT_RETRY_DELAY_MAX_MS, OCR_RATE_LIMIT_RETRY_DELAY_MIN_MS, prefillRenderedPageCache, rm, runKimiOcr, withOcrPageRequestRetry } from './shared'
import { runGeminiOcr } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/gemini-ocr/run-gemini-ocr'
import { runHostedOcr } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/hosted-ocr'
import { AppError, ProviderError } from '~/utils/error-handler'
import { classifyFetchRetry, withRetry } from '~/utils/retries'
import type { ExtractionOptions } from '~/types'
import { installMockFetch } from '../../../../test-utils/rest-contract-helpers'
import { makeTempDir } from '../../../../test-utils/temp-dirs'

describe('OCR resilience contracts', () => {
  test('DeepInfra page OCR uses bounded request retries and timeout classification keeps page context', async () => {
    let attempts = 0
    await expect(withOcrPageRequestRetry(
      'deepinfra-ocr page 7',
      async () => {
        attempts += 1
        throw new OcrStructuredResponseError('DeepInfra OCR returned no text output.', '')
      },
      {
        attempts: 2,
        timeoutMs: 1000,
        classifier: () => ({ shouldRetry: true, delayMs: 1, reason: 'structured_response' })
      }
    )).rejects.toThrow('deepinfra-ocr page 7 failed after 2/2 attempts')
    expect(attempts).toBe(2)

    const timeoutCause = new Error('The operation was aborted due to timeout')
    timeoutCause.name = 'AbortError'
    const timeoutError = new Error('deepinfra-ocr page 7 failed after 2 attempts (600000ms elapsed)', {
      cause: timeoutCause
    })
    const failure = classifyOcrProviderFailure(timeoutError)
    expect(failure.category).toBe('timeout')
    expect(failure.message).toContain('deepinfra-ocr page 7')
    expect(failure.message).toContain('timeout')
  })

  test('page request retry delays no-header 429s for the hosted OCR cooldown window', async () => {
    const previousSleep = Bun.sleep
    const pressures: Array<{ reason: string, delayMs?: number | undefined, status?: number | undefined, retryAfterMs?: number | undefined }> = []
    const sleeps: number[] = []
    let attempts = 0

    try {
      ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = (async (delayMs: number) => {
        sleeps.push(delayMs)
      }) as typeof Bun.sleep
      await expect(withOcrPageRequestRetry(
        'kimi-ocr page 3',
        async () => {
          attempts += 1
          throw ProviderError('rate limited', { status: 429 })
        },
        {
          attempts: 2,
          timeoutMs: 1000,
          onRetryable: pressure => {
            pressures.push(pressure)
          }
        }
      )).rejects.toThrow('kimi-ocr page 3 failed after 2/2 attempts')
    } finally {
      ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = previousSleep
    }

    expect(attempts).toBe(2)
    expect(sleeps).toHaveLength(1)
    expect(sleeps[0]).toBeGreaterThanOrEqual(OCR_RATE_LIMIT_RETRY_DELAY_MIN_MS)
    expect(sleeps[0]).toBeLessThanOrEqual(OCR_RATE_LIMIT_RETRY_DELAY_MAX_MS)
    expect(pressures).toHaveLength(1)
    expect(pressures[0]).toMatchObject({
      reason: 'retryable status 429',
      status: 429
    })
    expect(pressures[0]?.delayMs).toBeGreaterThanOrEqual(OCR_RATE_LIMIT_RETRY_DELAY_MIN_MS)
    expect(pressures[0]?.delayMs).toBeLessThanOrEqual(OCR_RATE_LIMIT_RETRY_DELAY_MAX_MS)
    expect(pressures[0]?.retryAfterMs).toBeUndefined()
  })

  test('page request retry uses the extended default attempt budget for 429s', async () => {
    const previousSleep = Bun.sleep
    let attempts = 0

    try {
      ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = (async () => {}) as typeof Bun.sleep
      await expect(withOcrPageRequestRetry(
        'kimi-ocr page 9',
        async () => {
          attempts += 1
          throw ProviderError('rate limited', { status: 429 })
        },
        { timeoutMs: 1000 }
      )).rejects.toThrow(`kimi-ocr page 9 failed after ${OCR_PAGE_RATE_LIMIT_REQUEST_ATTEMPTS}/${OCR_PAGE_RATE_LIMIT_REQUEST_ATTEMPTS} attempts`)
    } finally {
      ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = previousSleep
    }

    expect(attempts).toBe(OCR_PAGE_RATE_LIMIT_REQUEST_ATTEMPTS)
  })

  test('Kimi insufficient-balance 429 is a non-retryable quota blocker', async () => {
    const previousSleep = Bun.sleep
    let attempts = 0
    const error = ProviderError('Kimi OCR request failed (429): insufficient account balance for account acct_live_secret1234', { status: 429, metadata: { rawResponse: {
        error: {
          message: 'insufficient account balance for account acct_live_secret1234',
          request_id: 'req_secret123456789'
        }
      } } })

    try {
      ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = (async () => {
        throw new Error('non-retryable Kimi quota failures should not sleep')
      }) as typeof Bun.sleep

      await expect(withOcrPageRequestRetry(
        'kimi-ocr page 3',
        async () => {
          attempts += 1
          throw error
        },
        { timeoutMs: 1000 }
      )).rejects.toThrow('insufficient account balance')
    } finally {
      ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = previousSleep
    }

    expect(attempts).toBe(1)
    const failure = classifyOcrProviderFailure(error)
    expect(failure).toMatchObject({
      category: 'rate_limit',
      failureKind: 'quota',
      retryable: false,
      quota: true,
      providerWide: true,
      blockedReason: 'insufficient_balance'
    })
    expect(failure.message).not.toContain('acct_live_secret1234')
  })

  test('Anthropic content-policy and no-retry responses are non-retryable blockers', () => {
    const policyError = ProviderError('Anthropic Messages request failed (400): Output blocked by content filtering policy', { status: 400, metadata: { errorType: 'invalid_request_error', rawResponse: {
        error: {
          type: 'invalid_request_error',
          message: 'Output blocked by content filtering policy'
        }
      } } })
    const noRetryError = ProviderError('Anthropic Messages request failed (429): provider says do not retry', { status: 429, headers: new Headers({ 'x-should-retry': 'false' }) })

    expect(classifyOcrCreateRetry(policyError)).toMatchObject({
      shouldRetry: false,
      reason: 'content_policy'
    })
    expect(classifyOcrProviderFailure(policyError)).toMatchObject({
      category: 'content_policy',
      failureKind: 'content_policy',
      retryable: false,
      providerWide: true
    })
    expect(classifyOcrCreateRetry(noRetryError)).toMatchObject({
      shouldRetry: false,
      reason: 'provider_no_retry_header'
    })
    expect(classifyOcrProviderFailure(noRetryError)).toMatchObject({
      failureKind: 'provider_no_retry',
      retryable: false,
      providerWide: true
    })
  })

  test('transient OCR retry classification remains retryable', () => {
    expect(classifyOcrCreateRetry(ProviderError('try later', { status: 429 }))).toMatchObject({
      shouldRetry: true,
      reason: 'retryable status 429'
    })
    expect(classifyOcrCreateRetry(ProviderError('upstream unavailable', { status: 503 }))).toMatchObject({
      shouldRetry: true,
      reason: 'retryable status 503'
    })
    expect(classifyOcrCreateRetry(new TypeError('fetch failed'))).toMatchObject({
      shouldRetry: true,
      reason: 'network error'
    })
  })

  test('page request retry telemetry reports retryable status and retry-after pressure', async () => {
    const previousSleep = Bun.sleep
    const pressures: Array<{ reason: string, delayMs?: number | undefined, status?: number | undefined, retryAfterMs?: number | undefined }> = []
    const sleeps: number[] = []
    let attempts = 0

    try {
      ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = (async (delayMs: number) => {
        sleeps.push(delayMs)
      }) as typeof Bun.sleep
      await expect(withOcrPageRequestRetry(
        'kimi-ocr page 3',
        async () => {
          attempts += 1
          throw ProviderError('rate limited', { status: 429, headers: new Headers({ 'retry-after': '2' }) })
        },
        {
          attempts: 2,
          timeoutMs: 1000,
          classifier: () => ({ shouldRetry: true, delayMs: 1, reason: 'retryable status 429' }),
          onRetryable: pressure => {
            pressures.push(pressure)
          }
        }
      )).rejects.toThrow('kimi-ocr page 3 failed after 2/2 attempts')
    } finally {
      ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = previousSleep
    }

    expect(attempts).toBe(2)
    expect(sleeps).toEqual([2_000])
    expect(pressures).toHaveLength(1)
    expect(pressures[0]).toMatchObject({
      reason: 'retryable status 429',
      delayMs: 2_000,
      status: 429,
      retryAfterMs: 2_000
    })
  })

  test('Kimi image OCR uses page-level bounded retry attempts for structured page failures', async () => {
    const previousFetch = globalThis.fetch
    const previousSleep = Bun.sleep
    const previousEnv = {
      KIMI_API_KEY: process.env['KIMI_API_KEY']
    }
    const tempDir = await makeTempDir('autoshow-kimi-page-retry-')
    const inputPath = join(tempDir, 'input.png')
    let attempts = 0

    try {
      await Bun.write(inputPath, new Uint8Array([137, 80, 78, 71]))
      process.env['KIMI_API_KEY'] = 'test-key'
      ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = (async () => {}) as typeof Bun.sleep
      installMockFetch((_call, _input, init) => {
        attempts += 1
        expect(init?.signal).toBeDefined()
        return jsonResponse({
          choices: [{
            finish_reason: 'length',
            message: { content: 'partial page text' }
          }],
          usage: {
            prompt_tokens: 5,
            completion_tokens: 6
          }
        })
      })

      await expect(runKimiOcr(inputPath, {
        ...basePdfMetadata,
        pageCount: 1,
        format: 'png',
        fileSize: 4
      }, 'kimi-k2.6', {
        dpi: 300,
        password: undefined,
        outputDir: tempDir,
        ocrPreparationCache: undefined,
        ocrConcurrency: undefined
      })).rejects.toThrow('kimi-ocr input image failed after 2/2 attempts')

      expect(attempts).toBe(2)
    } finally {
      globalThis.fetch = previousFetch
      ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = previousSleep
      if (previousEnv.KIMI_API_KEY === undefined) {
        delete process.env['KIMI_API_KEY']
      } else {
        process.env['KIMI_API_KEY'] = previousEnv.KIMI_API_KEY
      }
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('Gemini single-page image OCR uses lower output cap and records schema retry diagnostics with document page context', async () => {
    const previousFetch = globalThis.fetch
    const previousEnv = {
      GEMINI_API_KEY: process.env['GEMINI_API_KEY']
    }
    const tempDir = await makeTempDir('autoshow-gemini-single-page-cap-')
    const inputPath = join(tempDir, 'input.png')

    try {
      await Bun.write(inputPath, new Uint8Array([137, 80, 78, 71]))
      process.env['GEMINI_API_KEY'] = 'test-key'
      const requests = installMockFetch((_call) => {
        if (requests.length === 1) {
          return jsonResponse({
            candidates: [{
              content: { parts: [{ text: 'not json' }] }
            }],
            usageMetadata: {
              promptTokenCount: 7,
              candidatesTokenCount: 8_000
            }
          })
        }
        return jsonResponse({
          candidates: [{
            content: { parts: [{ text: '{"pages":[{"pageNumber":1,"text":"fixed page"}]}' }] }
          }],
          usageMetadata: {
            promptTokenCount: 4,
            candidatesTokenCount: 5
          }
        })
      })

      const result = await runGeminiOcr(inputPath, {
        ...basePdfMetadata,
        pageCount: 1,
        format: 'png',
        fileSize: 4
      }, 'gemini-3.5-flash-lite', {
        documentPageNumber: 7
      })

      expect(requests).toHaveLength(2)
      expect((requests[0]?.bodyJson?.['generationConfig'] as Record<string, unknown>)['maxOutputTokens']).toBe(8_192)
      expect((requests[1]?.bodyJson?.['generationConfig'] as Record<string, unknown>)['maxOutputTokens']).toBe(8_192)
      const retryContents = requests[1]?.bodyJson?.['contents'] as Array<Record<string, unknown>>
      const retryParts = retryContents[0]?.['parts'] as Array<Record<string, unknown>>
      expect(retryParts[0]?.['text']).toContain('Return only valid JSON for this single OCR page.')

      expect(result.pages[0]?.text).toBe('fixed page')
      expect(result.providerUsage?.[0]).toMatchObject({
        provider: 'gemini',
        usageRole: 'schema-retry',
        purpose: 'ocr-schema-retry',
        pageNumber: 7,
        pageCount: 1,
        attempt: 1,
        promptTokens: 7,
        completionTokens: 8_000,
        failureReason: expect.any(String)
      })
      expect(result.providerUsage?.[1]).toMatchObject({
        provider: 'gemini',
        usageRole: 'success',
        attempt: 2,
        promptTokens: 4,
        completionTokens: 5
      })
    } finally {
      globalThis.fetch = previousFetch
      if (previousEnv.GEMINI_API_KEY === undefined) {
        delete process.env['GEMINI_API_KEY']
      } else {
        process.env['GEMINI_API_KEY'] = previousEnv.GEMINI_API_KEY
      }
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('Gemini direct single-page PDF keeps the higher direct-PDF output cap', async () => {
    const previousFetch = globalThis.fetch
    const previousEnv = {
      GEMINI_API_KEY: process.env['GEMINI_API_KEY']
    }
    const tempDir = await makeTempDir('autoshow-gemini-direct-pdf-cap-')
    const inputPath = join(tempDir, 'input.pdf')

    try {
      await Bun.write(inputPath, '%PDF-1.7 test placeholder')
      process.env['GEMINI_API_KEY'] = 'test-key'
      const requests = installMockFetch(() => {
        return jsonResponse({
          candidates: [{
            content: { parts: [{ text: '{"pages":[{"pageNumber":1,"text":"pdf page"}]}' }] }
          }],
          usageMetadata: {
            promptTokenCount: 3,
            candidatesTokenCount: 4
          }
        })
      })

      const result = await runGeminiOcr(inputPath, {
        ...basePdfMetadata,
        pageCount: 1,
        format: 'pdf',
        fileSize: 24
      }, 'gemini-3.5-flash-lite')

      expect((requests[0]?.bodyJson?.['generationConfig'] as Record<string, unknown>)['maxOutputTokens']).toBe(24_576)
      expect(result.pages[0]?.text).toBe('pdf page')
    } finally {
      globalThis.fetch = previousFetch
      if (previousEnv.GEMINI_API_KEY === undefined) {
        delete process.env['GEMINI_API_KEY']
      } else {
        process.env['GEMINI_API_KEY'] = previousEnv.GEMINI_API_KEY
      }
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('Kimi rendered page OCR uses the shared fallback default concurrency without adaptive throttling', async () => {
    const previousFetch = globalThis.fetch
    const previousEnv = {
      KIMI_API_KEY: process.env['KIMI_API_KEY']
    }
    const tempDir = await makeTempDir('autoshow-kimi-default-page-concurrency-')
    const inputPath = join(tempDir, 'input.pdf')
    const renderDir = join(tempDir, 'renders')
    const cache = createOcrPreparationCache()
    const pages = Array.from({ length: 12 }, (_value, index) => index + 1)
    const starts: number[] = []
    let activeRequests = 0
    let maxActiveRequests = 0
    let releaseFirstWindow!: () => void
    const firstWindowRelease = new Promise<void>(resolve => {
      releaseFirstWindow = resolve
    })

    const readPageNumber = (body: Record<string, unknown>): number => {
      const messages = body['messages'] as Array<Record<string, unknown>>
      const content = messages[0]?.['content'] as Array<Record<string, unknown>>
      const imagePart = content.find(part => part['type'] === 'image_url')
      const imageUrl = (imagePart?.['image_url'] as Record<string, unknown> | undefined)?.['url']
      if (typeof imageUrl !== 'string') {
        throw new Error('Kimi test request did not include an image URL')
      }
      const encoded = imageUrl.split(',')[1] ?? ''
      const decoded = Buffer.from(encoded, 'base64').toString('utf8')
      const match = /rendered page (\d+)/.exec(decoded)
      if (!match?.[1]) {
        throw new Error(`Kimi test request used unexpected image data: ${decoded}`)
      }
      return Number(match[1])
    }

    try {
      await Bun.write(inputPath, '%PDF-1.7 test placeholder')
      await prefillRenderedPageCache(cache, renderDir, inputPath, pages, 300)
      process.env['KIMI_API_KEY'] = 'test-key'
      installMockFetch(async (call) => {
        const pageNumber = readPageNumber(call.bodyJson ?? {})
        starts.push(pageNumber)
        activeRequests += 1
        maxActiveRequests = Math.max(maxActiveRequests, activeRequests)
        try {
          if (pageNumber <= 10) {
            await firstWindowRelease
          }
          return jsonResponse({
            choices: [{
              finish_reason: 'stop',
              message: { content: `page ${pageNumber}` }
            }],
            usage: {
              prompt_tokens: pageNumber,
              completion_tokens: pageNumber * 10
            }
          })
        } finally {
          activeRequests -= 1
        }
      })

      const run = runHostedOcr(inputPath, {
        ...basePdfMetadata,
        pageCount: pages.length,
        format: 'pdf',
        fileSize: 128
      }, {
        filePath: inputPath,
        dpi: 300,
        password: undefined,
        outputDir: tempDir,
        ocrPreparationCache: cache,
        ocrConcurrency: undefined,
        kimiOcrModel: 'kimi-k2.6'
      } as ExtractionOptions)

      for (let attempt = 0; attempt < 500 && starts.length < 10; attempt++) {
        await Bun.sleep(1)
      }
      const initialStarts = [...starts]
      releaseFirstWindow()

      const result = await run
      expect(initialStarts).toHaveLength(10)
      expect(initialStarts.slice().sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
      expect(maxActiveRequests).toBe(10)
      expect(starts.slice().sort((a, b) => a - b)).toEqual(pages)
      expect(result.pages.map(page => page.text)).toEqual(pages.map(page => `page ${page}`))
      expect(result.providerUsage?.map(entry => entry['unit'])).toEqual(pages.map(() => 'chunk'))
    } finally {
      releaseFirstWindow?.()
      globalThis.fetch = previousFetch
      if (previousEnv.KIMI_API_KEY === undefined) {
        delete process.env['KIMI_API_KEY']
      } else {
        process.env['KIMI_API_KEY'] = previousEnv.KIMI_API_KEY
      }
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('retry-exhausted OCR failures surface attemptsMade in the provider failure summary', async () => {
    const previousSleep = Bun.sleep
    ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = (async () => {}) as typeof Bun.sleep
    let exhausted: unknown
    try {
      await withRetry(
        {
          retryClass: 'runtime_http_create_retriable',
          operationName: 'kimi-ocr page 3',
          policy: { maxAttempts: 6, baseDelayMs: 0, maxDelayMs: 0, jitter: false, exponential: false }
        },
        async () => {
          throw ProviderError('Kimi OCR request failed (503)', { status: 503 })
        },
        (error) => classifyFetchRetry(error, 'runtime_http_create_retriable')
      )
    } catch (error) {
      exhausted = error
    } finally {
      ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = previousSleep
    }

    expect(exhausted).toBeInstanceOf(AppError)
    expect((exhausted as AppError).message).toMatch(/^kimi-ocr page 3 failed after 6\/6 attempts \(max attempts reached, \d+ms elapsed\)$/)

    const failure = classifyOcrProviderFailure(exhausted)
    expect(failure.attemptsMade).toBe(6)
    expect(failure.retryable).toBe(true)
    expect(failure.status).toBe(503)
  })
})
