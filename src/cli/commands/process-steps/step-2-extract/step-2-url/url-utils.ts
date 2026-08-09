import { stat } from 'node:fs/promises'
import { basename, resolve as pathResolve } from 'node:path'
import type { FetchRemoteHtmlOptions, HtmlArticleBackend, LocalHtmlReadResult, RemoteHtmlFetchResult, UrlRequestOptions } from '~/types'
import { isAbortError } from '~/utils/retries'
import { readEnv } from '~/utils/validate/env-utils'
import { InfraError, InternalError, ValidationError, hintsForMissingEnv } from '~/utils/error-handler'

const HTML_FETCH_TIMEOUT_MS = 15000
export const DEFAULT_URL_REQUEST_TIMEOUT_MS = 60000
export const DEFAULT_URL_REQUEST_ATTEMPTS = 3

const MIN_MEANINGFUL_MARKDOWN_CHARS = 50
const ARTICLE_FETCH_USER_AGENT = 'Mozilla/5.0 (compatible; autoshow-cli/0.1; +https://github.com/ajcwebdev/autoshow-cli)'

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const cleanString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined
  }
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

export const byteLength = (value: string): number =>
  new TextEncoder().encode(value).byteLength

export const isRemoteSource = (source: string): boolean =>
  /^https?:\/\//i.test(source)

export const getLocalBaseName = (source: string): string => {
  const fileName = basename(source).trim()
  const withoutExtension = fileName.replace(/\.[^.]+$/, '')
  return withoutExtension.length > 0 ? withoutExtension : fileName
}

export const fallbackTitleFromSource = (source: string): string => {
  if (!isRemoteSource(source)) {
    return getLocalBaseName(source)
  }

  try {
    const parsed = new URL(source)
    const lastPathSegment = parsed.pathname
      .split('/')
      .filter(Boolean)
      .map((segment) => {
        try {
          return decodeURIComponent(segment)
        } catch {
          return segment
        }
      })
      .pop()

    if (lastPathSegment) {
      const withoutExtension = lastPathSegment.replace(/\.[^.]+$/, '').trim()
      if (withoutExtension.length > 0) {
        return withoutExtension
      }
    }

    return parsed.hostname.replace(/^www\./, '')
  } catch {
    return 'article'
  }
}

const withTimeout = async <T>(
  timeoutMs: number,
  fn: (signal: AbortSignal) => Promise<T>
): Promise<T> => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fn(controller.signal)
  } finally {
    clearTimeout(timeout)
  }
}

export const getUrlRequestTimeoutMs = (options: UrlRequestOptions | undefined): number =>
  typeof options?.timeoutMs === 'number' && Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
    ? options.timeoutMs
    : DEFAULT_URL_REQUEST_TIMEOUT_MS

export const getUrlRequestAttempts = (options: UrlRequestOptions | undefined): number =>
  typeof options?.requestAttempts === 'number' && Number.isFinite(options.requestAttempts) && options.requestAttempts > 0
    ? Math.floor(options.requestAttempts)
    : DEFAULT_URL_REQUEST_ATTEMPTS

const createUrlProviderTimeoutError = (
  providerLabel: string,
  timeoutMs: number,
  cause: unknown
): Error => {
  const error = new Error(`${providerLabel} request timed out after ${timeoutMs}ms`, {
    cause: cause instanceof Error ? cause : undefined
  })
  error.name = 'AbortError'
  Object.assign(error, {
    timeoutMs,
    provider: providerLabel,
    retryable: true
  })
  return error
}

export const createUrlProviderHttpError = (
  providerLabel: string,
  action: string,
  response: Response,
  message: string | undefined
): Error => {
  const error = new Error(
    `${providerLabel} ${action} failed (${response.status} ${response.statusText})${message ? `: ${message}` : ''}`
  )
  Object.assign(error, {
    status: response.status,
    headers: response.headers,
    provider: providerLabel,
    retryable: response.status === 408 || response.status === 429 || response.status >= 500
  })
  return error
}

export const withUrlProviderTimeout = async <T>(
  providerLabel: string,
  options: UrlRequestOptions | undefined,
  fn: (signal: AbortSignal) => Promise<T>
): Promise<T> => {
  const timeoutMs = getUrlRequestTimeoutMs(options)

  try {
    if (options?.requestSignal) {
      return await fn(options.requestSignal)
    }
    return await withTimeout(timeoutMs, fn)
  } catch (error) {
    if (isAbortError(error)) {
      throw createUrlProviderTimeoutError(providerLabel, timeoutMs, error)
    }
    throw error
  }
}

export const requireHostedUrlProviderApiKey = (
  envVar: string,
  providerId: string,
  stage: string,
  usingHostedApi: boolean
): string | undefined => {
  const apiKey = readEnv(envVar)
  if (usingHostedApi && !apiKey) {
    throw InternalError(
      `${envVar} is required for --url-provider ${providerId} when using the hosted API. ` +
      `Set ${envVar} or use a different URL backend.`,
      { stage, hints: hintsForMissingEnv(envVar) }
    )
  }
  return apiKey
}

export const fetchUrlProviderJson = async (
  providerLabel: string,
  action: string,
  endpoint: string,
  init: Omit<RequestInit, 'signal'>,
  options: UrlRequestOptions | undefined,
  errorKeys: readonly string[]
): Promise<unknown> => {
  const response = await withUrlProviderTimeout(providerLabel, options, async (signal) =>
    await fetch(endpoint, { ...init, signal })
  )

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok) {
    let errorMessage: string | undefined
    if (isRecord(payload)) {
      for (const key of errorKeys) {
        errorMessage ??= cleanString(payload[key])
      }
    }
    throw createUrlProviderHttpError(providerLabel, action, response, errorMessage)
  }

  return payload
}

export const fetchRemoteHtml = async (
  source: string,
  options: FetchRemoteHtmlOptions = {}
): Promise<RemoteHtmlFetchResult> => {
  const timeoutMs = typeof options.timeoutMs === 'number' ? options.timeoutMs : HTML_FETCH_TIMEOUT_MS
  const runFetch = async (signal: AbortSignal): Promise<Response> =>
    await fetch(source, {
      signal,
      headers: {
        'User-Agent': ARTICLE_FETCH_USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8'
      }
    })

  let response: Response
  try {
    response = options.signal
      ? await runFetch(options.signal)
      : await withTimeout(timeoutMs, runFetch)
  } catch (error) {
    if (isAbortError(error)) {
      throw createUrlProviderTimeoutError(options.providerLabel ?? 'URL article HTML fetch', timeoutMs, error)
    }
    throw error
  }

  if (!response.ok) {
    throw InfraError(`Failed to fetch article HTML (${response.status} ${response.statusText})`, { stage: 'url:fetch' })
  }

  const contentType = cleanString(response.headers.get('content-type'))?.toLowerCase() ?? ''
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
    throw InfraError(`Expected an HTML article response but received "${contentType || 'unknown'}"`, { stage: 'url:fetch' })
  }

  const html = await response.text()
  return {
    html,
    finalUrl: cleanString(response.url) ?? source,
    fileSize: byteLength(html)
  }
}

export const tryFetchRemoteHtml = async (
  source: string
): Promise<RemoteHtmlFetchResult | null> => {
  try {
    return await fetchRemoteHtml(source)
  } catch {
    return null
  }
}

export const readLocalHtml = async (
  source: string
): Promise<LocalHtmlReadResult> => {
  const file = Bun.file(source)
  if (!(await file.exists())) {
    throw InfraError(`File does not exist: ${source}`, { stage: 'url:fetch' })
  }

  const sourceStats = await stat(source)
  if (sourceStats.size <= 0) {
    throw InfraError(`Document is empty: ${source}`, { stage: 'url:fetch' })
  }

  return {
    html: await file.text(),
    fileSize: sourceStats.size,
    localFileUrl: `file://${pathResolve(source)}`
  }
}

export const countWords = (text: string): number => {
  const tokens = text.split(/\s+/).filter(Boolean)
  return tokens.length
}

export const normalizeMarkdown = (value: unknown): string => {
  if (typeof value !== 'string') {
    return ''
  }
  return value.trim()
}

export const formatErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

export const ensureMeaningfulMarkdown = (
  markdown: string,
  backend: HtmlArticleBackend
): string => {
  if (markdown.length >= MIN_MEANINGFUL_MARKDOWN_CHARS) {
    return markdown
  }

  if (backend === 'defuddle') {
    throw ValidationError(
      'Defuddle could not extract meaningful article content. ' +
      'The page may require client-side rendering. Retry with a remote --url-provider such as firecrawl, spider, supadata, or zyte.',
      { stage: 'url:fetch' }
    )
  }

  if (backend === 'glm-reader') {
    throw ValidationError('GLM Reader returned empty article markdown.', { stage: 'url:fetch' })
  }
  if (backend === 'spider') {
    throw ValidationError('Spider returned empty article markdown.', { stage: 'url:fetch' })
  }
  if (backend === 'supadata') {
    throw ValidationError('Supadata returned empty article markdown.', { stage: 'url:fetch' })
  }
  if (backend === 'zyte') {
    throw ValidationError('Zyte returned empty article markdown.', { stage: 'url:fetch' })
  }

  throw ValidationError('Firecrawl returned empty article markdown.', { stage: 'url:fetch' })
}
