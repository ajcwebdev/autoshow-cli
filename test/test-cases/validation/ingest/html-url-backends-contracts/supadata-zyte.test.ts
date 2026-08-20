import { expect, test } from 'bun:test'
import {
  htmlDocument,
  installMockFetch,
  longMarkdown,
  runSupadataUrl,
  runZyteUrl
} from './shared'
import { extractErrorMetadata } from '~/utils/error-handler'

test('Supadata URL backend sends scrape request and normalizes article metadata', async () => {
  process.env['SUPADATA_API_KEY'] = 'supadata-test-key'

  const requests = installMockFetch((call) => {
    if (call.url.startsWith('https://supadata.local/v1/web/scrape')) {
      return Response.json({
        url: 'https://article.test/supadata-final',
        content: longMarkdown,
        name: 'Supadata Title',
        description: 'Supadata description',
        ogUrl: 'https://article.test/og-image.png',
        countCharacters: longMarkdown.length,
        urls: ['https://article.test/link-1']
      })
    }

    if (call.url === 'https://article.test/supadata') {
      return new Response(htmlDocument, {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' }
      })
    }

    throw new Error(`Unexpected Supadata mock fetch: ${call.url}`)
  })

  const result = await runSupadataUrl('https://article.test/supadata', 'https://article.test/supadata', undefined, 'https://supadata.local/v1')

  expect(requests[0]).toMatchObject({
    url: 'https://supadata.local/v1/web/scrape?url=https%3A%2F%2Farticle.test%2Fsupadata',
    method: 'GET'
  })
  expect(requests[0]?.headers.get('x-api-key')).toBe('supadata-test-key')
  expect(result).toMatchObject({
    markdown: longMarkdown,
    title: 'Supadata Title',
    web: {
      sourceUrl: 'https://article.test/supadata',
      finalUrl: 'https://article.test/supadata-final',
      description: 'Supadata description'
    }
  })
  expect(result.fileSize).toBeGreaterThan(longMarkdown.length)
})

test('Supadata URL backend rejects missing API key', async () => {
  delete process.env['SUPADATA_API_KEY']

  await expect(
    runSupadataUrl('https://article.test/no-key', 'https://article.test/no-key')
  ).rejects.toThrow('SUPADATA_API_KEY is required')
})

test('Supadata URL backend reports provider HTTP errors with message/details', async () => {
  process.env['SUPADATA_API_KEY'] = 'supadata-test-key'

  installMockFetch(() => new Response(JSON.stringify({
      error: 'unauthorized',
      message: 'Unauthorized',
      details: 'The request is unauthorized. Please check your API key.'
  }), { status: 401, statusText: 'Unauthorized' }))

  await expect(
    runSupadataUrl('https://article.test/error', 'https://article.test/error')
  ).rejects.toThrow('Supadata scrape failed (401 Unauthorized): Unauthorized')
})

// Supadata uses 429 for both burst throttling and terminal plan exhaustion. Retrying the
// terminal case spends more quota-denied requests and stalls the run for minutes, so the
// error must carry retryable: false while an ordinary 429 stays retryable.
test('Supadata URL backend marks plan-limit 429 non-retryable but keeps burst 429 retryable', async () => {
  process.env['SUPADATA_API_KEY'] = 'supadata-test-key'

  installMockFetch(() => new Response(JSON.stringify({
    error: 'limit-exceeded',
    message: 'Limit Exceeded'
  }), { status: 429, statusText: 'Too Many Requests' }))

  const planLimitError = await runSupadataUrl('https://article.test/limit', 'https://article.test/limit')
    .then(() => undefined, (error: unknown) => error)
  expect(extractErrorMetadata(planLimitError)['retryable']).toBe(false)
  expect((planLimitError as Error).message).toContain('Limit Exceeded')

  installMockFetch(() => new Response(JSON.stringify({
    error: 'rate-limited',
    message: 'Too many requests, slow down'
  }), { status: 429, statusText: 'Too Many Requests' }))

  const burstError = await runSupadataUrl('https://article.test/burst', 'https://article.test/burst')
    .then(() => undefined, (error: unknown) => error)
  expect(extractErrorMetadata(burstError)['retryable']).toBe(true)
})

test('Zyte URL backend posts article extract request and normalizes article metadata', async () => {
  delete process.env['ZYTE_API_KEY']

  const requests = installMockFetch((call) => {
    if (call.url === 'https://zyte.local/v1/extract') {
      return Response.json({
        article: {
          headline: 'Zyte Title',
          articleBody: longMarkdown,
          description: 'Zyte description',
          datePublished: '2026-05-01T12:00:00Z',
          canonicalUrl: 'https://article.test/zyte-final',
          authors: [{ name: 'Zyte Author' }],
          publisher: { name: 'Zyte Site' },
          inLanguage: 'en'
        }
      })
    }

    if (call.url === 'https://article.test/zyte') {
      return new Response(htmlDocument, {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' }
      })
    }

    throw new Error(`Unexpected Zyte mock fetch: ${call.url}`)
  })

  const result = await runZyteUrl('https://article.test/zyte', 'https://article.test/zyte', undefined, 'https://zyte.local')

  expect(requests[0]).toMatchObject({
    url: 'https://zyte.local/v1/extract',
    method: 'POST',
    bodyJson: {
      url: 'https://article.test/zyte',
      article: true
    }
  })
  expect(result.markdown).toContain(longMarkdown)
  expect(result).toMatchObject({
    title: 'Zyte Title',
    author: 'Zyte Author',
    web: {
      sourceUrl: 'https://article.test/zyte',
      finalUrl: 'https://article.test/zyte-final',
      site: 'Zyte Site',
      description: 'Zyte description',
      published: '2026-05-01T12:00:00Z',
      language: 'en'
    }
  })
  expect(result.fileSize).toBeGreaterThan(longMarkdown.length)
})
