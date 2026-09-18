import { expect, test } from 'bun:test'
import {
  buildAbortError,
  buildMockArticle,
  runUrlArticleProviderWithStats,
  URL_ARTICLE_PROVIDER_ADAPTERS
} from './shared'
import type { UrlRequestOptions } from '~/types'
import { extractErrorMetadata, isAppError } from '~/utils/error-handler'

const withoutSleep = async (run: () => Promise<void>): Promise<void> => {
  const originalSleep = Bun.sleep
  try {
    ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = (async () => {}) as typeof Bun.sleep
    await run()
  } finally {
    ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = originalSleep
  }
}

test('URL article provider retry wrapper retries local backend timeout failures and reports attempts', async () => {
  const seenOptions: UrlRequestOptions[] = []
  let calls = 0

  await withoutSleep(async () => {
    URL_ARTICLE_PROVIDER_ADAPTERS.defuddle.run = async (source, sourceUrl, options) => {
      calls += 1
      seenOptions.push(options ?? {})
      if (calls === 1) throw buildAbortError('Defuddle request timed out after 25ms')
      return buildMockArticle('defuddle', source, sourceUrl)
    }

    const result = await runUrlArticleProviderWithStats('defuddle', 'https://article.test/retry', 'https://article.test/retry', {
      timeoutMs: 25,
      requestAttempts: 2
    })

    expect(result.article.title).toBe('defuddle Article')
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
  })
})

test('URL article provider retry wrapper does not redispatch an ambiguous hosted timeout', async () => {
  let calls = 0

  await withoutSleep(async () => {
    URL_ARTICLE_PROVIDER_ADAPTERS.zyte.run = async (source, sourceUrl) => {
      calls += 1
      if (calls === 1) throw buildAbortError('Zyte request timed out after 25ms')
      return buildMockArticle('zyte', source, sourceUrl)
    }

    await expect(runUrlArticleProviderWithStats('zyte', 'https://article.test/hosted-timeout', 'https://article.test/hosted-timeout', {
      timeoutMs: 25,
      requestAttempts: 2
    })).rejects.toThrow('Zyte request timed out after 25ms')
    expect(calls).toBe(1)
  })
})

test('URL article provider retry wrapper does not redispatch an ambiguous hosted 5xx', async () => {
  let calls = 0

  await withoutSleep(async () => {
    URL_ARTICLE_PROVIDER_ADAPTERS.firecrawl.run = async (source, sourceUrl) => {
      calls += 1
      if (calls === 1) {
        const error = new Error('Firecrawl scrape failed (503 Service Unavailable): overloaded')
        Object.assign(error, { status: 503, headers: new Headers() })
        throw error
      }
      return buildMockArticle('firecrawl', source, sourceUrl)
    }

    await expect(runUrlArticleProviderWithStats('firecrawl', 'https://article.test/status-retry', 'https://article.test/status-retry', {
      timeoutMs: 25,
      requestAttempts: 2
    })).rejects.toThrow('503 Service Unavailable')
    expect(calls).toBe(1)
  })
})

test('URL article provider retry wrapper redispatches an explicitly rejected hosted request', async () => {
  let calls = 0

  await withoutSleep(async () => {
    URL_ARTICLE_PROVIDER_ADAPTERS.firecrawl.run = async (source, sourceUrl) => {
      calls += 1
      if (calls === 1) {
        const error = new Error('Firecrawl scrape failed (429 Too Many Requests): slow down')
        Object.assign(error, { status: 429, headers: new Headers() })
        throw error
      }
      return buildMockArticle('firecrawl', source, sourceUrl)
    }

    const result = await runUrlArticleProviderWithStats('firecrawl', 'https://article.test/rate-limited', 'https://article.test/rate-limited', {
      timeoutMs: 25,
      requestAttempts: 2
    })

    expect(result.article.title).toBe('firecrawl Article')
    expect(result.attempts).toBe(2)
    expect(calls).toBe(2)
  })
})

test('URL article provider retry wrapper enriches exhausted timeout errors', async () => {
  await withoutSleep(async () => {
    URL_ARTICLE_PROVIDER_ADAPTERS.defuddle.run = async () => {
      throw buildAbortError('Defuddle request timed out after 25ms')
    }

    let error: unknown
    try {
      await runUrlArticleProviderWithStats('defuddle', 'https://article.test/retry-fail', 'https://article.test/retry-fail', {
        timeoutMs: 25,
        requestAttempts: 2
      })
    } catch (caught) {
      error = caught
    }

    expect(error).toBeInstanceOf(Error)
    const message = (error as Error).message
    expect(message).toContain('Defuddle request failed after 2/2 attempts with 25ms timeout')
    expect(message).toContain('ms elapsed')
    expect(message).toContain('Defuddle request timed out after 25ms')
    expect(extractErrorMetadata(error)['attemptsMade']).toBe(2)
    expect(isAppError(error) && error.kind).toBe('retry_exhausted')
  })
})
