import type { HtmlArticleBackend, UrlArticleProviderAdapter, UrlArticleProviderRunWithStats, UrlArticleRunResult, UrlRequestOptions } from '~/types'
import { AppError, isAppError } from '~/utils/error-handler'
import { classifyFetchRetry, withRetry } from '~/utils/retries'
import { defuddleArticleAdapter } from './url-local/defuddle/run-defuddle-url'
import { firecrawlArticleAdapter } from './url-services/firecrawl/run-firecrawl-url'
import { glmReaderArticleAdapter } from './url-services/glm-reader/run-glm-reader-url'
import { spiderArticleAdapter } from './url-services/spider/run-spider-url'
import { supadataArticleAdapter } from './url-services/url-supadata/run-supadata-url'
import { zyteArticleAdapter } from './url-services/zyte/run-zyte-url'
import { getUrlRequestAttempts, getUrlRequestTimeoutMs } from './url-utils'

export const URL_ARTICLE_PROVIDER_ADAPTERS: Record<HtmlArticleBackend, UrlArticleProviderAdapter> = {
  defuddle: defuddleArticleAdapter,
  firecrawl: firecrawlArticleAdapter,
  'glm-reader': glmReaderArticleAdapter,
  spider: spiderArticleAdapter,
  supadata: supadataArticleAdapter,
  zyte: zyteArticleAdapter
}

export const getUrlArticleProviderAdapter = (
  backend: HtmlArticleBackend
): UrlArticleProviderAdapter => URL_ARTICLE_PROVIDER_ADAPTERS[backend]

const URL_PROVIDER_RETRY_POLICY = {
  baseDelayMs: 2_000,
  maxDelayMs: 10_000,
  jitter: true,
  exponential: true
} as const

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
  const causeMessage = error.cause?.message ?? error.message
  const attempts = typeof error.metadata['attemptsMade'] === 'number' ? error.metadata['attemptsMade'] : attemptsMade
  const max = typeof error.metadata['maxAttempts'] === 'number' ? error.metadata['maxAttempts'] : maxAttempts
  // Enrich in place rather than downgrading to a plain Error plus Object.assign: the
  // original is an AppError{retry_exhausted}, and rebuilding it as a bare Error dropped the
  // kind and exit code that the top-level handler and retry classification depend on.
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
      ...(error.stage !== undefined ? { stage: error.stage } : {}),
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

  try {
    const article = await withRetry(
      {
        retryClass: 'runtime_http_read',
        operationName: `${adapter.displayName} request`,
        timeoutMs,
        policy: {
          ...URL_PROVIDER_RETRY_POLICY,
          maxAttempts
        }
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
      (error) => classifyFetchRetry(error, 'runtime_http_read')
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
