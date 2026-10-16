import { expect, test } from 'bun:test'
import {
  htmlDocument,
  installMockFetch,
  longMarkdown,
  runZyteUrl
} from './shared'

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
