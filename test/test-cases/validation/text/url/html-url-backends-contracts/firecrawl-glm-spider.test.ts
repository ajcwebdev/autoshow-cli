import { expect, test } from 'bun:test'
import {
  DEFAULT_URL_REQUEST_TIMEOUT_MS,
  htmlDocument,
  installMockFetch,
  longMarkdown,
  runFirecrawlUrl,
  runGlmReaderUrl,
  runSpiderUrl
} from './shared'

test('firecrawl URL backend posts scrape request and normalizes article metadata', async () => {
  delete process.env['FIRECRAWL_API_KEY']

  const requests = installMockFetch((call) => {
    if (call.url === 'https://firecrawl.local/v2/scrape') {
      return Response.json({
        data: {
          markdown: longMarkdown,
          metadata: {
            title: 'Firecrawl Title',
            author: 'Firecrawl Author',
            sourceURL: 'https://article.test/story',
            url: 'https://article.test/final',
            siteName: 'Example Site',
            wordCount: 17
          }
        }
      })
    }

    if (call.url === 'https://article.test/story') {
      return new Response(htmlDocument, {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' }
      })
    }

    throw new Error(`Unexpected Firecrawl mock fetch: ${call.url}`)
  })

  const result = await runFirecrawlUrl('https://article.test/story', 'https://article.test/story', undefined, 'https://firecrawl.local')

  expect(requests[0]).toMatchObject({
    url: 'https://firecrawl.local/v2/scrape',
    method: 'POST',
    bodyJson: {
      url: 'https://article.test/story',
      formats: ['markdown'],
      onlyMainContent: true,
      timeout: DEFAULT_URL_REQUEST_TIMEOUT_MS
    }
  })
  expect(result).toMatchObject({
    markdown: longMarkdown,
    title: 'Firecrawl Title',
    author: 'Firecrawl Author',
    web: {
      sourceUrl: 'https://article.test/story',
      finalUrl: 'https://article.test/final',
      site: 'Example Site',
      wordCount: 17
    }
  })
  expect(result.fileSize).toBeGreaterThan(longMarkdown.length)
})

test('GLM Reader URL backend posts reader request, normalizes metadata, and backfills final URL', async () => {
  process.env['GLM_API_KEY'] = 'glm-test-key'

  const requests = installMockFetch((call) => {
    if (call.url === 'https://glm.local/api/paas/v4/reader') {
      return new Response(JSON.stringify({
        reader_result: {
          content: longMarkdown,
          title: 'GLM Reader Title',
          description: 'GLM Reader description'
        }
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    }

    if (call.url === 'https://article.test/glm') {
      return new Response(htmlDocument, {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' }
      })
    }

    throw new Error(`Unexpected GLM Reader mock fetch: ${call.url}`)
  })

  const result = await runGlmReaderUrl('https://article.test/glm', 'https://article.test/glm', undefined, 'https://glm.local')

  expect(requests[0]).toMatchObject({
    url: 'https://glm.local/api/paas/v4/reader',
    method: 'POST',
    bodyJson: {
      url: 'https://article.test/glm',
      return_format: 'markdown',
      timeout: Math.ceil(DEFAULT_URL_REQUEST_TIMEOUT_MS / 1000),
      no_cache: false,
      retain_images: false,
      no_gfm: false,
      keep_img_data_url: false,
      with_images_summary: false,
      with_links_summary: false
    }
  })
  expect(result).toMatchObject({
    markdown: longMarkdown,
    title: 'GLM Reader Title',
    web: {
      sourceUrl: 'https://article.test/glm',
      finalUrl: 'https://article.test/glm',
      description: 'GLM Reader description'
    }
  })
  expect(result.fileSize).toBeGreaterThan(longMarkdown.length)
})

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
