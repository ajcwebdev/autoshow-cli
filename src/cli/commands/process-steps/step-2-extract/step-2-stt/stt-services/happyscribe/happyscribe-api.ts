import { basename } from 'node:path'
import type { HappyScribeApiClientOptions, HappyScribeExport, HappyScribeJsonRequestOptions, HappyScribeOrder, HappyScribePollResult, HappyScribeTranscription, RetryClass } from '~/types'
import { ProviderError } from '~/utils/error-handler'
import { classifyFetchRetry, getSttStageRetryPolicy, parseRetryAfterMs, withRetry } from '~/utils/retries'
import { HAPPYSCRIBE_STT_LANGUAGE } from './happyscribe'
import { parseHappyScribeExport, parseHappyScribeOrder, parseHappyScribeSignedUploadUrl, parseHappyScribeTranscription } from './happyscribe-response-parsers'
import { attachHappyScribeErrorContext, buildHappyScribeRetryHeaders, toHappyScribeHttpError } from './happyscribe-utils'
import { parseJsonOrText, resolveRestPath } from '~/utils/rest-client'

const REQUEST_TIMEOUT_MS = 20 * 60 * 1000
const POLL_REQUEST_TIMEOUT_MS = 60 * 1000

export const createHappyScribeApiClient = (
  options: HappyScribeApiClientOptions
) => {
  const fetchJsonWithRetry = async (
    requestOptions: HappyScribeJsonRequestOptions
  ): Promise<unknown> => {
    let payload: unknown
    try {
      return await withRetry(
        {
          retryClass: requestOptions.retryClass,
          operationName: requestOptions.operationName,
          ...(() => {
            const policy = getSttStageRetryPolicy(requestOptions.retryClass)
            return policy ? { policy } : {}
          })(),
          timeoutMs: requestOptions.timeoutMs
        },
        async (signal) => {
          options.onRequest?.()
          const response = await requestOptions.request(signal ?? undefined)
          payload = parseJsonOrText(await response.text())

          if (!response.ok) {
            throw toHappyScribeHttpError(
              requestOptions.stage,
              requestOptions.retryClass,
              response,
              payload,
              requestOptions.messagePrefix
            )
          }

          requestOptions.onResponse?.(response, payload)
          return payload
        },
        (error) => {
          const decision = classifyFetchRetry(error, requestOptions.retryClass)
          if (decision.shouldRetry) {
            options.onRetry?.(error)
          }
          return decision
        }
      )
    } catch (error) {
      return attachHappyScribeErrorContext(error, requestOptions.stage, requestOptions.retryClass, payload)
    }
  }

  const authHeaders = (extra: Record<string, string> = {}): Record<string, string> => ({
    authorization: `Bearer ${options.apiKey}`,
    accept: 'application/json',
    ...extra
  })

  const get = (path: string) => (signal: AbortSignal | undefined) =>
    fetch(resolveRestPath(options.baseURL, path), {
      method: 'GET',
      headers: authHeaders(),
      signal: signal ?? null
    })

  const post = (path: string, body: unknown) => (signal: AbortSignal | undefined) =>
    fetch(resolveRestPath(options.baseURL, path), {
      method: 'POST',
      headers: authHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify(body),
      signal: signal ?? null
    })

  const requestParsed = async <T>(
    requestOptions: Omit<HappyScribeJsonRequestOptions, 'onResponse'> & { parse: (payload: unknown) => T }
  ): Promise<T> => {
    const payload = await fetchJsonWithRetry(requestOptions)
    try {
      return requestOptions.parse(payload)
    } catch (error) {
      return attachHappyScribeErrorContext(error, requestOptions.stage, requestOptions.retryClass, payload)
    }
  }

  const pollParsed = async <T>(
    requestOptions: Omit<HappyScribeJsonRequestOptions, 'onResponse'> & { parse: (payload: unknown) => T }
  ): Promise<HappyScribePollResult<T>> => {
    let retryAfterMs: number | null = null
    const payload = await fetchJsonWithRetry({
      ...requestOptions,
      onResponse: (response, responsePayload) => {
        retryAfterMs = parseRetryAfterMs(buildHappyScribeRetryHeaders(response, responsePayload)) ?? null
      }
    })

    try {
      return { status: requestOptions.parse(payload), retryAfterMs }
    } catch (error) {
      return attachHappyScribeErrorContext(error, requestOptions.stage, requestOptions.retryClass, payload)
    }
  }

  const getSignedUploadUrl = async (
    audioPath: string
  ): Promise<string> => await requestParsed({
    stage: 'upload',
    retryClass: 'runtime_http_create_retriable',
    operationName: 'happyscribe-get-signed-upload',
    timeoutMs: REQUEST_TIMEOUT_MS,
    messagePrefix: 'Happy Scribe signed upload request failed',
    request: get(`/uploads/new?filename=${encodeURIComponent(basename(audioPath))}`),
    parse: parseHappyScribeSignedUploadUrl
  })

  const uploadMedia = async (
    uploadUrl: string,
    audioPath: string
  ): Promise<void> => {
    try {
      await withRetry(
        {
          retryClass: 'runtime_http_create_retriable',
          operationName: 'happyscribe-upload-media',
          timeoutMs: REQUEST_TIMEOUT_MS
        },
        async (signal) => {
          options.onRequest?.()
          const uploadResponse = await fetch(uploadUrl, {
            method: 'PUT',
            body: Bun.file(audioPath),
            signal: signal ?? null
          })

          if (!uploadResponse.ok) {
            const payload = parseJsonOrText(await uploadResponse.text())
            throw toHappyScribeHttpError(
              'upload',
              'runtime_http_create_retriable',
              uploadResponse,
              payload,
              'Happy Scribe media upload failed'
            )
          }
        },
        (error) => {
          const decision = classifyFetchRetry(error, 'runtime_http_create_retriable')
          if (decision.shouldRetry) {
            options.onRetry?.(error)
          }
          return decision
        }
      )
    } catch (error) {
      attachHappyScribeErrorContext(error, 'upload', 'runtime_http_create_retriable')
    }
  }

  const createOrder = async (
    createOptions: {
      audioPath: string
      uploadUrl: string
      organizationId: string
    }
  ): Promise<HappyScribeOrder> => await requestParsed({
    stage: 'create',
    retryClass: 'runtime_http_create_retriable',
    operationName: 'happyscribe-create-order',
    timeoutMs: REQUEST_TIMEOUT_MS,
    messagePrefix: 'Happy Scribe order creation failed',
    request: post('/orders', {
      order: {
        url: createOptions.uploadUrl,
        language: HAPPYSCRIBE_STT_LANGUAGE,
        service: 'auto',
        confirm: true,
        organization_id: createOptions.organizationId,
        is_subtitle: false,
        name: basename(createOptions.audioPath)
      }
    }),
    parse: parseHappyScribeOrder
  })

  const pollOrder = async (
    orderId: string
  ): Promise<HappyScribePollResult<HappyScribeOrder>> => await pollParsed({
    stage: 'poll',
    retryClass: 'runtime_http_read',
    operationName: 'happyscribe-poll-order',
    timeoutMs: POLL_REQUEST_TIMEOUT_MS,
    messagePrefix: 'Happy Scribe order poll failed',
    request: get(`/orders/${encodeURIComponent(orderId)}`),
    parse: parseHappyScribeOrder
  })

  const getTranscription = async (
    transcriptionId: string
  ): Promise<HappyScribeTranscription> => await requestParsed({
    stage: 'result',
    retryClass: 'runtime_http_read',
    operationName: 'happyscribe-get-transcription',
    timeoutMs: POLL_REQUEST_TIMEOUT_MS,
    messagePrefix: 'Happy Scribe transcription lookup failed',
    request: get(`/transcriptions/${encodeURIComponent(transcriptionId)}`),
    parse: parseHappyScribeTranscription
  })

  const createExport = async (
    transcriptionId: string
  ): Promise<HappyScribeExport> => await requestParsed({
    stage: 'result',
    retryClass: 'runtime_http_create_retriable',
    operationName: 'happyscribe-create-export',
    timeoutMs: REQUEST_TIMEOUT_MS,
    messagePrefix: 'Happy Scribe export creation failed',
    request: post('/exports', {
      export: {
        format: 'json',
        transcription_ids: [transcriptionId]
      }
    }),
    parse: parseHappyScribeExport
  })

  const pollExport = async (
    exportId: string
  ): Promise<HappyScribePollResult<HappyScribeExport>> => await pollParsed({
    stage: 'result',
    retryClass: 'runtime_http_read',
    operationName: 'happyscribe-poll-export',
    timeoutMs: POLL_REQUEST_TIMEOUT_MS,
    messagePrefix: 'Happy Scribe export poll failed',
    request: get(`/exports/${encodeURIComponent(exportId)}`),
    parse: parseHappyScribeExport
  })

  const fetchDownloadPayload = async (
    url: string
  ): Promise<unknown> => {
    const candidates: Array<Record<string, string>> = [
      { accept: 'application/json' },
      {
        accept: 'application/json',
        authorization: `Bearer ${options.apiKey}`
      }
    ]

    let lastError: unknown
    for (const headers of candidates) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers,
          redirect: 'follow'
        })
        const payload = parseJsonOrText(await response.text())
        if (!response.ok) {
          throw toHappyScribeHttpError('result', 'runtime_http_read', response, payload, 'Happy Scribe transcript download failed')
        }
        if (typeof payload === 'string') {
          throw Object.assign(
            ProviderError('Happy Scribe transcript download did not return JSON', {
              stage: 'result',
              retryClass: 'runtime_http_read'
            }),
            {
              stage: 'result',
              retryClass: 'runtime_http_read' as RetryClass,
              rawResponse: payload
            }
          )
        }
        return payload
      } catch (error) {
        lastError = error
      }
    }

    throw lastError instanceof Error
      ? lastError
      : ProviderError(String(lastError), { stage: 'result', retryClass: 'runtime_http_read' })
  }

  return {
    getSignedUploadUrl,
    uploadMedia,
    createOrder,
    pollOrder,
    getTranscription,
    createExport,
    pollExport,
    fetchDownloadPayload
  }
}
