import type { ActiveHtmlArticleBackend, HtmlArticleBackend, UrlArticleProviderAdapter, UrlArticleProviderRunWithStats, UrlArticleRunResult, UrlRequestOptions } from '~/types'
import { AppError, isAppError, UsageError } from '~/utils/error-handler'
import { classifyFetchRetry, withRetry } from '~/utils/retries'
import { defuddleArticleAdapter } from './url-local/defuddle/run-defuddle-url'
import { spiderArticleAdapter } from './url-services/spider/run-spider-url'
import { zyteArticleAdapter } from './url-services/zyte/run-zyte-url'
import { isLocalUrlBackend } from './url-targets'
import { getUrlRequestAttempts, getUrlRequestTimeoutMs } from './url-utils'

export const URL_ARTICLE_PROVIDER_ADAPTERS: Record<ActiveHtmlArticleBackend, UrlArticleProviderAdapter> = {
  defuddle: defuddleArticleAdapter,
  spider: spiderArticleAdapter,
  zyte: zyteArticleAdapter
}

export const getUrlArticleProviderAdapter = (
  backend: HtmlArticleBackend
): UrlArticleProviderAdapter => {
  if (!Object.hasOwn(URL_ARTICLE_PROVIDER_ADAPTERS, backend)) {
    throw UsageError(`URL provider ${backend} is excluded or unsupported and cannot dispatch. Select an active URL provider explicitly.`)
  }
  return URL_ARTICLE_PROVIDER_ADAPTERS[backend as ActiveHtmlArticleBackend]
}

const enrichUrlRetryError = (
  error: unknown,
  providerLabel: string,
  timeoutMs: number,
  attemptsMade: number,
  maxAttempts: number
): Error => {
  if (!isAppError(error) || error.kind !== 'retry_exhausted') {
    return error instanceof Error ? error : new Error(String(error))
  }

  const elapsedMs = typeof error.metadata['elapsedMs'] === 'number' ? error.metadata['elapsedMs'] : undefined
  const causeMessage = error.cause instanceof Error ? error.cause.message : error.message
  const attempts = typeof error.metadata['attemptsMade'] === 'number' ? error.metadata['attemptsMade'] : attemptsMade
  const max = typeof error.metadata['maxAttempts'] === 'number' ? error.metadata['maxAttempts'] : maxAttempts
  return new AppError(
    `${providerLabel} request failed after ${attempts}/${max} attempts with ${timeoutMs}ms timeout` +
    `${typeof elapsedMs === 'number' ? ` (${elapsedMs}ms elapsed)` : ''}: ${causeMessage}`,
    {
      kind: error.kind,
      cause: error,
      exitCode: error.exitCode,
      hints: error.hints,
      ...(error.retryClass !== undefined ? { retryClass: error.retryClass } : {}),
      ...(error.retryable !== undefined ? { retryable: error.retryable } : {}),
      ...(error.status !== undefined ? { status: error.status } : {}),
      stage: error.stage ?? 'extract:url',
      metadata: {
        ...error.metadata,
        attemptsMade: attempts,
        maxAttempts: max,
        timeoutMs,
        ...(elapsedMs !== undefined ? { elapsedMs } : {}),
        provider: providerLabel
      }
    }
  )
}

export const runUrlArticleProviderWithStats = async (
  backend: HtmlArticleBackend,
  source: string,
  sourceUrl: string | undefined,
  options?: UrlRequestOptions
): Promise<UrlArticleProviderRunWithStats> => {
  const adapter = getUrlArticleProviderAdapter(backend)
  const timeoutMs = getUrlRequestTimeoutMs(options)
  const maxAttempts = getUrlRequestAttempts(options)
  let attemptsMade = 0

  // Local backends (e.g. Defuddle) may safely use read retries. Hosted scrape/extract POSTs are billable —
  // use conservative paid-create classification so ambiguous network/5xx outcomes do not redispatch.
  const retryClass = isLocalUrlBackend(backend) ? 'runtime_http_read' : 'runtime_http_create_conservative'
  try {
    const article = await withRetry(
      {
        retryClass,
        operationName: `url-article-${adapter.id}`,
        timeoutMs,
        policy: { maxAttempts }
      },
      async (signal) => {
        attemptsMade += 1
        return await adapter.run(source, sourceUrl, {
          ...options,
          timeoutMs,
          requestAttempts: maxAttempts,
          requestSignal: signal
        })
      },
      (error) => classifyFetchRetry(error, retryClass)
    )
    return { article, attempts: attemptsMade }
  } catch (error) {
    throw enrichUrlRetryError(error, adapter.displayName, timeoutMs, attemptsMade, maxAttempts)
  }
}

export const runUrlArticleProvider = async (
  backend: HtmlArticleBackend,
  source: string,
  sourceUrl: string | undefined,
  options?: UrlRequestOptions
): Promise<UrlArticleRunResult> =>
  (await runUrlArticleProviderWithStats(backend, source, sourceUrl, options)).article
