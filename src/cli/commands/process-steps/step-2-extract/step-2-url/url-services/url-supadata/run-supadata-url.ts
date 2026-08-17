import { SUPADATA_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { isSupadataPlanLimitExhausted } from '~/utils/supadata-plan-limit'
import { readEnv } from '~/utils/validate/env-utils'
import type { UrlArticleProviderAdapter, UrlRequestOptions, WebArticleMetadata } from '~/types'
import { cleanString, countWords, createUrlArticleRun, fetchUrlProviderJson, isRecord, normalizeMarkdown } from '../../url-utils'
import { InfraError, InternalError, ValidationError, hintsForMissingEnv } from '~/utils/error-handler'

const parseSupadataResponse = (
  payload: unknown,
  source: string
): { markdown: string, web: WebArticleMetadata } => {
  if (!isRecord(payload)) {
    throw ValidationError('Supadata returned an invalid JSON payload.', { stage: 'url:supadata' })
  }

  const errorField = cleanString(payload['error'])
  const messageField = cleanString(payload['message'])
  const detailsField = cleanString(payload['details'])
  if (errorField) {
    throw InfraError(
      `Supadata scrape error: ${messageField ?? errorField}${detailsField ? ` — ${detailsField}` : ''}`,
      { stage: 'url:supadata' }
    )
  }

  const markdown = normalizeMarkdown(payload['content'])
  if (markdown.length === 0) {
    throw ValidationError('Supadata returned empty article markdown.', { stage: 'url:supadata' })
  }

  const name = cleanString(payload['name'])
  const description = cleanString(payload['description'])
  const scrapedUrl = cleanString(payload['url'])
  const ogUrl = cleanString(payload['ogUrl'])
  const wordCount = countWords(markdown)

  const web: WebArticleMetadata = {}
  if (scrapedUrl) web.sourceUrl = scrapedUrl
  if (scrapedUrl && scrapedUrl !== source) web.finalUrl = scrapedUrl
  if (name) web.title = name
  if (description) web.description = description
  web.wordCount = wordCount
  if (ogUrl) {
    if (!web.finalUrl) web.finalUrl = ogUrl
  }

  return { markdown, web }
}

const runSupadataScrape = async (
  source: string,
  options?: UrlRequestOptions,
  baseUrl: string = SUPADATA_DEFAULT_BASE_URL
): Promise<{ markdown: string, web: WebArticleMetadata }> => {
  const apiKey = readEnv('SUPADATA_API_KEY')

  if (!apiKey) {
    throw InternalError(
      'SUPADATA_API_KEY is required for --url-provider supadata. ' +
      'Set SUPADATA_API_KEY or use a different URL backend.',
      { stage: 'url:supadata', hints: hintsForMissingEnv('SUPADATA_API_KEY') }
    )
  }

  const scrapeUrl = `${baseUrl.replace(/\/$/, '')}/web/scrape?url=${encodeURIComponent(source)}`

  const payload = await fetchUrlProviderJson('Supadata', 'scrape', scrapeUrl, {
    method: 'GET',
    headers: { 'x-api-key': apiKey }
  }, options, ['message', 'details', 'error'], isSupadataPlanLimitExhausted)
  return parseSupadataResponse(payload, source)
}

export const runSupadataUrl = createUrlArticleRun('supadata', 'Supadata', runSupadataScrape)

export const supadataArticleAdapter: UrlArticleProviderAdapter = {
  id: 'supadata',
  displayName: 'Supadata',
  run: runSupadataUrl
}
