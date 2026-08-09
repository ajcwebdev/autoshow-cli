import * as l from '~/utils/app-logger/app-logger'
import type { UrlArticleProviderAdapter, UrlArticleRunResult, UrlRequestOptions, WebArticleMetadata } from '~/types'
import { cleanString, countWords, fetchUrlProviderJson, finalizeUrlArticleResult, getUrlRequestTimeoutMs, isRecord, normalizeMarkdown, requireHostedUrlProviderApiKey } from '../../url-utils'
import { InfraError, ValidationError } from '~/utils/error-handler'

const FIRECRAWL_DEFAULT_API_URL = 'https://api.firecrawl.dev'

const getFirecrawlMetadataValue = (
  metadata: Record<string, unknown>,
  ...keys: string[]
): string | undefined => {
  for (const key of keys) {
    const value = cleanString(metadata[key])
    if (value) {
      return value
    }
  }
  return undefined
}

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
  const sourceUrl = getFirecrawlMetadataValue(metadata, 'sourceURL', 'sourceUrl')
  const finalUrl = getFirecrawlMetadataValue(metadata, 'finalURL', 'finalUrl', 'url')
  const title = getFirecrawlMetadataValue(metadata, 'title')
  const author = getFirecrawlMetadataValue(metadata, 'author', 'byline')
  const site = getFirecrawlMetadataValue(metadata, 'site', 'siteName', 'ogSiteName')
  const published = getFirecrawlMetadataValue(metadata, 'published', 'publishedTime', 'publishDate')
  const language = getFirecrawlMetadataValue(metadata, 'language')
  const description = getFirecrawlMetadataValue(metadata, 'description')

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
  const apiKey = requireHostedUrlProviderApiKey('FIRECRAWL_API_KEY', 'firecrawl', 'extract:firecrawl', baseUrl === FIRECRAWL_DEFAULT_API_URL)
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

export const runFirecrawlUrl = async (
  source: string,
  sourceUrl: string | undefined,
  options?: UrlRequestOptions,
  baseUrl: string = FIRECRAWL_DEFAULT_API_URL
): Promise<UrlArticleRunResult> => {
  l.write('info', 'Using Firecrawl backend for article extraction')
  const firecrawlResult = await runFirecrawlScrape(source, options, baseUrl)
  return await finalizeUrlArticleResult(source, sourceUrl, 'firecrawl', firecrawlResult)
}

export const firecrawlArticleAdapter: UrlArticleProviderAdapter = {
  id: 'firecrawl',
  displayName: 'Firecrawl',
  run: runFirecrawlUrl
}
