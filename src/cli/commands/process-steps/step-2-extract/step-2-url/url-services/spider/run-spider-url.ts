import * as l from '~/utils/app-logger/app-logger'
import type { UrlArticleProviderAdapter, UrlArticleRunResult, UrlRequestOptions, WebArticleMetadata } from '~/types'
import { cleanString, countWords, fetchUrlProviderJson, finalizeUrlArticleResult, getUrlRequestTimeoutMs, isRecord, normalizeMarkdown, requireHostedUrlProviderApiKey } from '../../url-utils'
import { ValidationError } from '~/utils/error-handler'

const SPIDER_DEFAULT_API_URL = 'https://api.spider.cloud'

const getSpiderValue = (
  data: Record<string, unknown>,
  metadata: Record<string, unknown>,
  ...keys: string[]
): string | undefined => {
  for (const key of keys) {
    const dataValue = cleanString(data[key])
    if (dataValue) {
      return dataValue
    }

    const metadataValue = cleanString(metadata[key])
    if (metadataValue) {
      return metadataValue
    }
  }
  return undefined
}

const buildSpiderScrapeRequest = (
  source: string,
  options: UrlRequestOptions | undefined
): Record<string, unknown> => {
  const body: Record<string, unknown> = {
    url: source,
    return_format: 'markdown',
    metadata: true,
    filter_output_main_only: true
  }

  if (typeof options?.timeoutMs === 'number') {
    body['request_timeout'] = Math.ceil(options.timeoutMs / 1000)
  }

  return body
}

const parseSpiderResponse = (payload: unknown): { markdown: string, web: WebArticleMetadata } => {
  const firstResult = Array.isArray(payload) ? payload[0] : payload
  if (typeof firstResult === 'string') {
    const markdown = normalizeMarkdown(firstResult)
    if (markdown.length === 0) {
      throw ValidationError('Spider returned empty article markdown.', { stage: 'url:spider' })
    }
    return {
      markdown,
      web: { wordCount: countWords(markdown) }
    }
  }

  if (!isRecord(firstResult)) {
    throw ValidationError('Spider returned an invalid JSON payload.', { stage: 'url:spider' })
  }

  const data = isRecord(firstResult['data']) ? firstResult['data'] : firstResult
  const markdown = normalizeMarkdown(data['markdown'] ?? data['content'] ?? data['text'] ?? data['raw'])
  if (markdown.length === 0) {
    throw ValidationError('Spider returned empty article markdown.', { stage: 'url:spider' })
  }

  const metadata = isRecord(data['metadata']) ? data['metadata'] : {}
  const title = getSpiderValue(data, metadata, 'title')
  const author = getSpiderValue(data, metadata, 'author', 'byline')
  const site = getSpiderValue(data, metadata, 'site', 'siteName', 'ogSiteName')
  const published = getSpiderValue(data, metadata, 'published', 'publishedTime', 'publishDate', 'date')
  const language = getSpiderValue(data, metadata, 'language', 'locale')
  const description = getSpiderValue(data, metadata, 'description')
  const finalUrl = getSpiderValue(data, metadata, 'finalUrl', 'final_url', 'url')
  const sourceUrl = getSpiderValue(data, metadata, 'sourceUrl', 'source_url', 'sourceURL')
  const wordCountRaw = data['wordCount'] ?? metadata['wordCount']
  const wordCount = typeof wordCountRaw === 'number' && Number.isFinite(wordCountRaw)
    ? wordCountRaw
    : countWords(markdown)

  const web: WebArticleMetadata = { wordCount }
  if (sourceUrl) web.sourceUrl = sourceUrl
  if (finalUrl) web.finalUrl = finalUrl
  if (title) web.title = title
  if (author) web.author = author
  if (site) web.site = site
  if (published) web.published = published
  if (language) web.language = language
  if (description) web.description = description

  return { markdown, web }
}

const runSpiderScrape = async (
  source: string,
  options?: UrlRequestOptions,
  baseUrl: string = SPIDER_DEFAULT_API_URL
): Promise<{ markdown: string, web: WebArticleMetadata }> => {
  const apiKey = requireHostedUrlProviderApiKey('SPIDER_API_KEY', 'spider', 'url:spider', baseUrl === SPIDER_DEFAULT_API_URL)
  const requestOptions = {
    ...options,
    timeoutMs: getUrlRequestTimeoutMs(options)
  }
  const payload = await fetchUrlProviderJson('Spider', 'scrape', `${baseUrl.replace(/\/$/, '')}/scrape`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
    },
    body: JSON.stringify(buildSpiderScrapeRequest(source, requestOptions))
  }, requestOptions, ['error', 'message', 'detail'])
  return parseSpiderResponse(payload)
}

export const runSpiderUrl = async (
  source: string,
  sourceUrl: string | undefined,
  options?: UrlRequestOptions,
  baseUrl: string = SPIDER_DEFAULT_API_URL
): Promise<UrlArticleRunResult> => {
  l.write('info', 'Using Spider backend for article extraction')
  const spiderResult = await runSpiderScrape(source, options, baseUrl)
  return await finalizeUrlArticleResult(source, sourceUrl, 'spider', spiderResult)
}

export const spiderArticleAdapter: UrlArticleProviderAdapter = {
  id: 'spider',
  displayName: 'Spider',
  run: runSpiderUrl
}
