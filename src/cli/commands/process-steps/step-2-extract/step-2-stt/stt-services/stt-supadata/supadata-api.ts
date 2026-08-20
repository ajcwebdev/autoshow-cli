import type { RetryClass, SttRequestMetrics, SupadataHttpError, SupadataJobStatus } from '~/types'
import { ProviderError } from '~/utils/error-handler'
import { httpResponseError, parseJsonOrText, resolveRestPath } from '~/utils/rest-client'
import { classifyFetchRetry, parseRetryAfterMs, STT_POLL_RETRY_POLICY, withRetry } from '~/utils/retries'
import {
  extractSupadataErrorMessage,
  parseSupadataJobStatus
} from './supadata-response-parsers'
import { toSupadataHttpError } from './supadata-utils'

const REQUEST_TIMEOUT_MS = 70_000
const POLL_REQUEST_TIMEOUT_MS = 60_000

export const fetchSupadataTranscript = async (
  input: {
    baseURL: string
    apiKey: string
    sourceUrl: string
    modelName: string
    language?: string | undefined
    metrics?: SttRequestMetrics | undefined
  }
): Promise<{ status: number, headers: Headers, payload: unknown }> =>
  await withRetry(
    {
      retryClass: 'runtime_http_create_retriable',
      operationName: 'supadata-create-transcript',
      timeoutMs: REQUEST_TIMEOUT_MS
    },
    async (signal) => {
      input.metrics?.onRequest?.()
      const requestUrl = new URL(resolveRestPath(input.baseURL, '/transcript'))
      requestUrl.searchParams.set('url', input.sourceUrl)
      requestUrl.searchParams.set('text', 'false')
      requestUrl.searchParams.set('mode', input.modelName)
      if (input.modelName !== 'generate' && typeof input.language === 'string' && input.language.trim().length > 0) {
        requestUrl.searchParams.set('lang', input.language.trim())
      }

      const response = await fetch(requestUrl, {
        method: 'GET',
        headers: {
          'x-api-key': input.apiKey
        },
        signal: signal ?? null
      })
      const payload = parseJsonOrText(await response.text())

      if (response.status === 206) {
        throw httpResponseError(
          `Supadata transcript unavailable (${response.status}): ${extractSupadataErrorMessage(payload) ?? 'Transcript unavailable'}`,
          response,
          {
            stage: 'create',
            retryClass: 'runtime_http_create_retriable',
            retryable: false,
            rawResponse: payload
          } satisfies Pick<SupadataHttpError, 'stage' | 'retryClass' | 'retryable' | 'rawResponse'>
        )
      }

      if (!response.ok && response.status !== 202) {
        throw toSupadataHttpError('create', 'runtime_http_create_retriable', response, payload)
      }

      return {
        status: response.status,
        headers: response.headers,
        payload
      }
    },
    (error) => {
      const decision = classifyFetchRetry(error, 'runtime_http_create_retriable')
      if (decision.shouldRetry) {
        input.metrics?.onRetry?.((error as { status?: unknown }).status as number | undefined)
      }
      return decision
    }
  )

export const pollSupadataTranscriptJob = async (
  input: {
    baseURL: string
    apiKey: string
    jobId: string
    metrics?: SttRequestMetrics | undefined
  }
): Promise<{ status: SupadataJobStatus, retryAfterMs: number | null }> =>
  await withRetry(
    {
      retryClass: 'runtime_http_read',
      operationName: 'supadata-poll-transcript',
      policy: STT_POLL_RETRY_POLICY,
      timeoutMs: POLL_REQUEST_TIMEOUT_MS
    },
    async (signal) => {
      input.metrics?.onRequest?.()
      const response = await fetch(resolveRestPath(input.baseURL, `/transcript/${input.jobId}`), {
        method: 'GET',
        headers: {
          'x-api-key': input.apiKey
        },
        signal: signal ?? null
      })
      const payload = parseJsonOrText(await response.text())
      if (!response.ok) {
        throw toSupadataHttpError('poll', 'runtime_http_read', response, payload, 'Supadata polling failed')
      }

      const parsed = parseSupadataJobStatus(payload)
      if (!parsed) {
        throw Object.assign(
          ProviderError('Supadata returned an invalid job status payload', {
            stage: 'poll',
            retryClass: 'runtime_http_read'
          }),
          { stage: 'poll', retryClass: 'runtime_http_read' as RetryClass, rawResponse: payload }
        )
      }

      return {
        status: parsed,
        retryAfterMs: parseRetryAfterMs(response.headers) ?? null
      }
    },
    (error) => {
      const decision = classifyFetchRetry(error, 'runtime_http_read')
      if (decision.shouldRetry) {
        input.metrics?.onRetry?.((error as { status?: unknown }).status as number | undefined)
      }
      return decision
    }
  )
