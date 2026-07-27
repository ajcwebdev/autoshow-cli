import { expect, test } from 'bun:test'
import {
  htmlDocument,
  longMarkdown,
  runSupadataUrl,
  runZyteUrl
} from './shared'

test('Supadata URL backend sends scrape request and normalizes article metadata', async () => {
  process.env['SUPADATA_API_KEY'] = 'supadata-test-key'

  const requests: Array<{ url: string, method: string, headers?: Record<string, string> }> = []
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
    const url = String(input)
    const headers: Record<string, string> = {}
    if (init?.headers && typeof init.headers === 'object') {
      for (const [key, value] of Object.entries(init.headers as Record<string, string>)) {
        headers[key] = value
      }
    }
    requests.push({
      url,
      method: init?.method ?? 'GET',
      headers
    })

    if (url.startsWith('https://supadata.local/v1/web/scrape')) {
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

    if (url === 'https://article.test/supadata') {
      return new Response(htmlDocument, {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' }
      })
    }

    throw new Error(`Unexpected Supadata mock fetch: ${url}`)
  }) as typeof fetch

  const result = await runSupadataUrl('https://article.test/supadata', 'https://article.test/supadata', undefined, 'https://supadata.local/v1')

  expect(requests[0]).toMatchObject({
    url: 'https://supadata.local/v1/web/scrape?url=https%3A%2F%2Farticle.test%2Fsupadata',
    method: 'GET',
    headers: { 'x-api-key': 'supadata-test-key' }
  })
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

  globalThis.fetch = (async (_input: Parameters<typeof fetch>[0], _init?: Parameters<typeof fetch>[1]): Promise<Response> =>
    new Response(JSON.stringify({
      error: 'unauthorized',
      message: 'Unauthorized',
      details: 'The request is unauthorized. Please check your API key.'
    }), { status: 401, statusText: 'Unauthorized' })
  ) as typeof fetch

  await expect(
    runSupadataUrl('https://article.test/error', 'https://article.test/error')
  ).rejects.toThrow('Supadata scrape failed (401 Unauthorized): Unauthorized')
})

test('Zyte URL backend posts article extract request and normalizes article metadata', async () => {
  delete process.env['ZYTE_API_KEY']

  const requests: Array<{ url: string, method: string, body?: unknown }> = []
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
    const url = String(input)
    requests.push({
      url,
      method: init?.method ?? 'GET',
      ...(typeof init?.body === 'string' ? { body: JSON.parse(init.body) as unknown } : {})
    })

    if (url === 'https://zyte.local/v1/extract') {
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

    if (url === 'https://article.test/zyte') {
      return new Response(htmlDocument, {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' }
      })
    }

    throw new Error(`Unexpected Zyte mock fetch: ${url}`)
  }) as typeof fetch

  const result = await runZyteUrl('https://article.test/zyte', 'https://article.test/zyte', undefined, 'https://zyte.local')

  expect(requests[0]).toMatchObject({
    url: 'https://zyte.local/v1/extract',
    method: 'POST',
    body: {
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
