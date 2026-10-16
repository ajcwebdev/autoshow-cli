import { expect, test } from 'bun:test'
import {
  DEFAULT_URL_REQUEST_TIMEOUT_MS,
  htmlDocument,
  installMockFetch,
  longMarkdown,
  runSpiderUrl
} from './shared'

test('Spider URL backend posts scrape request and normalizes article metadata', async () => {
  delete process.env['SPIDER_API_KEY']

  const requests = installMockFetch((call) => {
    if (call.url === 'https://spider.local/scrape') {
      return Response.json([{
        url: 'https://article.test/spider-final',
        content: longMarkdown,
        metadata: {
          title: 'Spider Title',
          author: 'Spider Author',
          siteName: 'Spider Site',
          description: 'Spider description',
          wordCount: 17
        }
      }])
    }

    if (call.url === 'https://article.test/spider') {
      return new Response(htmlDocument, {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' }
      })
    }

    throw new Error(`Unexpected Spider mock fetch: ${call.url}`)
  })

  const result = await runSpiderUrl('https://article.test/spider', 'https://article.test/spider', undefined, 'https://spider.local')

  expect(requests[0]).toMatchObject({
    url: 'https://spider.local/scrape',
    method: 'POST',
    bodyJson: {
      url: 'https://article.test/spider',
      return_format: 'markdown',
      metadata: true,
      filter_output_main_only: true,
      request_timeout: Math.ceil(DEFAULT_URL_REQUEST_TIMEOUT_MS / 1000)
    }
  })
  expect(result).toMatchObject({
    markdown: longMarkdown,
    title: 'Spider Title',
    author: 'Spider Author',
    web: {
      sourceUrl: 'https://article.test/spider',
      finalUrl: 'https://article.test/spider-final',
      site: 'Spider Site',
      description: 'Spider description',
      wordCount: 17
    }
  })
  expect(result.fileSize).toBeGreaterThan(longMarkdown.length)
})
