import type { FetchFn, FetchUrlResult } from '~/types'
import { extractHtmlToMarkdown } from '~/cli/commands/process-steps/step-2-extract/step-2-url/url-local/defuddle/run-defuddle-url'
import { runFirecrawlUrl } from '~/cli/commands/process-steps/step-2-extract/step-2-url/url-services/firecrawl/run-firecrawl-url'
import * as l from '~/utils/app-logger/app-logger'
import { httpResponseError, httpResponseOptions } from '~/utils/rest-client'
import { InfraError, serializeDiagnosticError } from '~/utils/error-handler'
import { classifyFetchRetry, isRetryableStatus, withRetry } from '~/utils/retries'
import { LINKS_FETCH_TIMEOUT_MS } from '~/utils/timeouts'
import { formatErrorMessage } from '~/utils/value-helpers'

export const HTML_MIME_HINTS = ['text/html', 'application/xhtml+xml'] as const

export const isHtmlContentType = (contentType: string): boolean =>
  HTML_MIME_HINTS.some((hint) => contentType.includes(hint))

export const looksLikeHtmlDocument = (content: string): boolean =>
  /^(?:<!doctype html\b|<html\b|<head\b|<body\b)/i.test(content.trimStart())

export const getFetchableDocumentationUrl = (url: string): string => {
  const match = /^blob:(https?:\/\/.+)$/i.exec(url)
  return match?.[1] ?? url
}

export const createHttpFetchError = (response: Response): Error =>
  httpResponseError(`HTTP ${response.status} ${response.statusText}`, httpResponseOptions(response, {
    stage: 'links:fetch', retryClass: 'runtime_http_read', retryable: isRetryableStatus(response.status), metadata: {}
  }))

export const downloadUrl = async (
  url: string,
  fetchImpl: FetchFn
): Promise<{ contentType: string, finalUrl: string, fetchedText: string, requestUrl: string }> => withRetry(
  {
    retryClass: 'runtime_http_read',
    operationName: 'links-fetch',
    timeoutMs: LINKS_FETCH_TIMEOUT_MS
  },
  async (signal) => {
    const requestUrl = getFetchableDocumentationUrl(url)
    const response = await fetchImpl(requestUrl, signal ? { signal } : undefined)
    if (!response.ok) {
      throw createHttpFetchError(response)
    }

    const contentType = (response.headers.get('content-type') ?? '').toLowerCase()
    const fetchedText = (await response.text()).trim()

    return {
      contentType,
      finalUrl: response.url || requestUrl,
      fetchedText,
      requestUrl
    }
  },
  (error) => classifyFetchRetry(error, 'runtime_http_read')
)

export const fetchUrl = async (url: string, fetchImpl: FetchFn): Promise<FetchUrlResult> => {
  const fetchUrl = getFetchableDocumentationUrl(url)
  try {
    const { contentType, finalUrl, fetchedText, requestUrl } = await downloadUrl(url, fetchImpl)
    if (fetchedText.length === 0) {
      l.warn(`Fetched empty response from ${url}`, { category: 'pipeline', metadata: { url } })
      return {
        sourceUrl: url,
        fetchUrl: requestUrl,
        finalUrl,
        status: 'empty',
        content: `<!-- Empty response from ${url} -->`,
        markdownContent: ''
      }
    }

    let content: string
    if (isHtmlContentType(contentType) || looksLikeHtmlDocument(fetchedText)) {
      try {
        content = (await extractHtmlToMarkdown({
          html: fetchedText,
          documentUrl: finalUrl,
          sourceUrl: url,
          finalUrl
        })).markdown
      } catch (defuddleError) {
        l.warn(`Defuddle failed for ${url}; falling back to Firecrawl: ${formatErrorMessage(defuddleError)}`, {
          category: 'pipeline',
          metadata: { url, fallbackBackend: 'firecrawl' }, error: defuddleError
        })
        try {
          content = (await runFirecrawlUrl(requestUrl, url)).markdown
        } catch (firecrawlError) {
          throw InfraError(
            `Defuddle failed and Firecrawl fallback failed. ` +
            `Defuddle: ${formatErrorMessage(defuddleError)} Firecrawl: ${formatErrorMessage(firecrawlError)}`,
            {
              stage: 'links:fetch',
              metadata: { defuddleError: serializeDiagnosticError(defuddleError) },
              ...(firecrawlError instanceof Error ? { cause: firecrawlError } : {})
            }
          )
        }
      }
    } else {
      content = fetchedText
    }

    return {
      sourceUrl: url,
      fetchUrl: requestUrl,
      finalUrl,
      status: 'success',
      content: `<!-- Source: ${url} -->\n\n${content}`,
      markdownContent: content
    }
  } catch (error) {
    l.warn(`Failed to fetch ${url}: ${formatErrorMessage(error)}`, {
      category: 'pipeline',
      metadata: { url }, error: error
    })
    return {
      sourceUrl: url,
      fetchUrl,
      status: 'failed',
      content: `<!-- Failed to fetch ${url} -->`,
      markdownContent: '',
      failedUrl: url,
      failureReason: formatErrorMessage(error)
    }
  }
}
