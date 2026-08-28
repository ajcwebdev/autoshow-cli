import { expect, test } from 'bun:test'
import {
  buildAbortError,
  buildMockArticle,
  runUrlArticleProviderWithStats,
  URL_ARTICLE_PROVIDER_ADAPTERS
} from './shared'
import type { UrlRequestOptions } from '~/types'
import { extractErrorMetadata, isAppError } from '~/utils/error-handler'

test('URL article provider retry wrapper retries timeout failures and reports attempts', async () => {
  const originalSleep = Bun.sleep
  const seenOptions: UrlRequestOptions[] = []
  let calls = 0

  try {
    ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = (async () => {}) as typeof Bun.sleep
    URL_ARTICLE_PROVIDER_ADAPTERS.zyte.run = async (source, sourceUrl, options) => {
      calls += 1
      seenOptions.push(options ?? {})
      if (calls === 1) {
        throw buildAbortError('Zyte request timed out after 25ms')
      }
      return buildMockArticle('zyte', source, sourceUrl)
    }

    const result = await runUrlArticleProviderWithStats('zyte', 'https://article.test/retry', 'https://article.test/retry', {
      timeoutMs: 25,
      requestAttempts: 2
    })

    expect(result.article.title).toBe('zyte Article')
    expect(result.attempts).toBe(2)
    expect(calls).toBe(2)
    expect(seenOptions).toHaveLength(2)
    for (const options of seenOptions) {
      expect(options).toMatchObject({
        timeoutMs: 25,
        requestAttempts: 2
      })
      expect(options.requestSignal).toBeInstanceOf(AbortSignal)
    }
  } finally {
    ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = originalSleep
  }
})

test('URL article provider retry wrapper retries retryable HTTP status failures', async () => {
  const originalSleep = Bun.sleep
  let calls = 0

  try {
    ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = (async () => {}) as typeof Bun.sleep
    URL_ARTICLE_PROVIDER_ADAPTERS.firecrawl.run = async (source, sourceUrl) => {
      calls += 1
      if (calls === 1) {
        const error = new Error('Firecrawl scrape failed (503 Service Unavailable): overloaded')
        Object.assign(error, {
          status: 503,
          headers: new Headers()
        })
        throw error
      }
      return buildMockArticle('firecrawl', source, sourceUrl)
    }

    const result = await runUrlArticleProviderWithStats('firecrawl', 'https://article.test/status-retry', 'https://article.test/status-retry', {
      timeoutMs: 25,
      requestAttempts: 2
    })

    expect(result.article.title).toBe('firecrawl Article')
    expect(result.attempts).toBe(2)
    expect(calls).toBe(2)
  } finally {
    ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = originalSleep
  }
})

test('URL article provider retry wrapper enriches exhausted timeout errors', async () => {
  const originalSleep = Bun.sleep

  try {
    ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = (async () => {}) as typeof Bun.sleep
    URL_ARTICLE_PROVIDER_ADAPTERS.zyte.run = async () => {
      throw buildAbortError('Zyte request timed out after 25ms')
    }

    await expect(runUrlArticleProviderWithStats('zyte', 'https://article.test/retry-fail', 'https://article.test/retry-fail', {
      timeoutMs: 25,
      requestAttempts: 2
    })).rejects.toThrow('Zyte request failed after 2/2 attempts with 25ms timeout')

    let error: unknown
    try {
      await runUrlArticleProviderWithStats('zyte', 'https://article.test/retry-fail', 'https://article.test/retry-fail', {
        timeoutMs: 25,
        requestAttempts: 2
      })
    } catch (caught) {
      error = caught
    }

    expect(error).toBeInstanceOf(Error)
    const message = (error as Error).message
    expect(message).toContain('Zyte request failed after 2/2 attempts with 25ms timeout')
    expect(message).toContain('ms elapsed')
    expect(message).toContain('Zyte request timed out after 25ms')
    expect(extractErrorMetadata(error)['attemptsMade']).toBe(2)
    expect(isAppError(error) && error.kind).toBe('retry_exhausted')
  } finally {
    ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = originalSleep
  }
})
