import type { UrlArticleProviderAdapter, UrlRequestOptions, WebArticleMetadata } from '~/types'
import { cleanString, countWords, createUrlArticleRun, fetchUrlProviderJson, getUrlRequestTimeoutMs, isRecord, normalizeMarkdown, pickCleanString, requireHostedUrlProviderApiKey } from '../../url-utils'
import { InfraError, ValidationError } from '~/utils/error-handler'

const FIRECRAWL_DEFAULT_API_URL = 'https://api.firecrawl.dev'

const parseFirecrawlResponse = (payload: unknown): { markdown: string, web: WebArticleMetadata } => {
  if (!isRecord(payload)) {
    throw ValidationError('Firecrawl returned an invalid JSON payload.', { stage: 'extract:firecrawl' })
  }

  const data = isRecord(payload['data']) ? payload['data'] : null
  if (!data) {
    const fallbackMessage = cleanString(payload['error']) ?? cleanString(payload['message'])
    throw InfraError(fallbackMessage ?? 'Firecrawl did not return scrape data.', { stage: 'extract:firecrawl' })
  }

  const markdown = normalizeMarkdown(data['markdown'])
  if (markdown.length === 0) {
    throw ValidationError('Firecrawl returned empty article markdown.', { stage: 'extract:firecrawl' })
  }

  const metadata = isRecord(data['metadata']) ? data['metadata'] : {}
  const wordCountRaw = metadata['wordCount']
  const wordCount = typeof wordCountRaw === 'number' && Number.isFinite(wordCountRaw)
    ? wordCountRaw
    : countWords(markdown)

  const web: WebArticleMetadata = {}
  const sourceUrl = pickCleanString(metadata, 'sourceURL', 'sourceUrl')
  const finalUrl = pickCleanString(metadata, 'finalURL', 'finalUrl', 'url')
  const title = pickCleanString(metadata, 'title')
  const author = pickCleanString(metadata, 'author', 'byline')
  const site = pickCleanString(metadata, 'site', 'siteName', 'ogSiteName')
  const published = pickCleanString(metadata, 'published', 'publishedTime', 'publishDate')
  const language = pickCleanString(metadata, 'language')
  const description = pickCleanString(metadata, 'description')

  if (sourceUrl) web.sourceUrl = sourceUrl
  if (finalUrl) web.finalUrl = finalUrl
  if (title) web.title = title
  if (author) web.author = author
  if (site) web.site = site
  if (published) web.published = published
  if (language) web.language = language
  web.wordCount = wordCount
  if (description) web.description = description

  return {
    markdown,
    web
  }
}

const runFirecrawlScrape = async (
  source: string,
  options?: UrlRequestOptions,
  baseUrl: string = FIRECRAWL_DEFAULT_API_URL
): Promise<{ markdown: string, web: WebArticleMetadata }> => {
  const apiKey = requireHostedUrlProviderApiKey('firecrawl', 'extract:firecrawl', baseUrl === FIRECRAWL_DEFAULT_API_URL)
  const requestOptions = {
    ...options,
    timeoutMs: getUrlRequestTimeoutMs(options)
  }
  const payload = await fetchUrlProviderJson('Firecrawl', 'scrape', `${baseUrl.replace(/\/$/, '')}/v2/scrape`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
    },
    body: JSON.stringify(buildFirecrawlScrapeRequest(source, requestOptions))
  }, requestOptions, ['error', 'message'])
  return parseFirecrawlResponse(payload)
}

const buildFirecrawlScrapeRequest = (
  source: string,
  options: UrlRequestOptions | undefined
): Record<string, unknown> => {
  const body: Record<string, unknown> = {
    url: source,
    formats: ['markdown'],
    onlyMainContent: true
  }

  if (typeof options?.timeoutMs === 'number') {
    body['timeout'] = options.timeoutMs
  }

  return body
}

export const runFirecrawlUrl = createUrlArticleRun('firecrawl', 'Firecrawl', runFirecrawlScrape)

export const firecrawlArticleAdapter: UrlArticleProviderAdapter = {
  id: 'firecrawl',
  displayName: 'Firecrawl',
  run: runFirecrawlUrl
}
