import type { UrlArticleProviderAdapter, UrlRequestOptions, WebArticleMetadata } from '~/types'
import { cleanString, countWords, createUrlArticleRun, fetchUrlProviderJson, isRecord, normalizeMarkdown, pickCleanString, requireHostedUrlProviderApiKey } from '../../url-utils'
import { ValidationError } from '~/utils/error-handler'

const ZYTE_DEFAULT_API_URL = 'https://api.zyte.com'

const getZyteAuthor = (
  article: Record<string, unknown>
): string | undefined => {
  const authors = article['authors']
  if (!Array.isArray(authors)) {
    return undefined
  }

  const names = authors
    .map(author => isRecord(author) ? cleanString(author['name']) : undefined)
    .filter((name): name is string => typeof name === 'string')

  return names.length > 0 ? names.join(', ') : undefined
}

const getZytePublisher = (
  article: Record<string, unknown>
): string | undefined => {
  const publisher = article['publisher']
  if (isRecord(publisher)) {
    return cleanString(publisher['name'])
  }
  return cleanString(publisher)
}

const articleBodyToMarkdown = (
  title: string | undefined,
  body: string
): string => {
  const normalizedBody = normalizeMarkdown(body)
  if (!title) {
    return normalizedBody
  }

  const normalizedTitle = title.trim()
  if (normalizedTitle.length === 0) {
    return normalizedBody
  }

  const bodyStart = normalizedBody.slice(0, normalizedTitle.length).toLowerCase()
  if (bodyStart === normalizedTitle.toLowerCase() || normalizedBody.startsWith('#')) {
    return normalizedBody
  }

  return `# ${normalizedTitle}\n\n${normalizedBody}`
}

const parseZyteResponse = (payload: unknown): { markdown: string, web: WebArticleMetadata } => {
  if (!isRecord(payload)) {
    throw ValidationError('Zyte returned an invalid JSON payload.', { stage: 'url:zyte' })
  }

  const article = isRecord(payload['article']) ? payload['article'] : null
  if (!article) {
    const fallbackMessage = cleanString(payload['error']) ?? cleanString(payload['message']) ?? cleanString(payload['detail'])
    throw ValidationError(fallbackMessage ?? 'Zyte did not return article data.', { stage: 'url:zyte' })
  }

  const body = pickCleanString(article, 'articleBody', 'text', 'description')
  if (!body) {
    throw ValidationError('Zyte returned empty article markdown.', { stage: 'url:zyte' })
  }

  const title = pickCleanString(article, 'headline', 'title', 'name')
  const markdown = articleBodyToMarkdown(title, body)
  const author = getZyteAuthor(article)
  const site = getZytePublisher(article)
  const finalUrl = pickCleanString(article, 'canonicalUrl', 'url')
  const published = pickCleanString(article, 'datePublished', 'datePublishedRaw')
  const language = pickCleanString(article, 'inLanguage', 'language')
  const description = pickCleanString(article, 'description')

  const web: WebArticleMetadata = {
    wordCount: countWords(markdown)
  }
  if (finalUrl) web.finalUrl = finalUrl
  if (title) web.title = title
  if (author) web.author = author
  if (site) web.site = site
  if (published) web.published = published
  if (language) web.language = language
  if (description) web.description = description

  return { markdown, web }
}

const runZyteExtract = async (
  source: string,
  options?: UrlRequestOptions,
  baseUrl: string = ZYTE_DEFAULT_API_URL
): Promise<{ markdown: string, web: WebArticleMetadata }> => {
  const apiKey = requireHostedUrlProviderApiKey('zyte', 'url:zyte', baseUrl === ZYTE_DEFAULT_API_URL)
  const payload = await fetchUrlProviderJson('Zyte', 'extract', `${baseUrl.replace(/\/$/, '')}/v1/extract`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}` } : {})
    },
    body: JSON.stringify({ url: source, article: true })
  }, options, ['detail', 'title', 'error', 'message'])
  return parseZyteResponse(payload)
}

export const runZyteUrl = createUrlArticleRun('zyte', 'Zyte', runZyteExtract)

export const zyteArticleAdapter: UrlArticleProviderAdapter = {
  id: 'zyte',
  displayName: 'Zyte',
  run: runZyteUrl
}
