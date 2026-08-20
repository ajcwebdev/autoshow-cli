import { basename } from 'node:path'
import type { HappyScribeApiClientOptions, HappyScribeExport, HappyScribeJsonRequestOptions, HappyScribeOrder, HappyScribePollResult, HappyScribeTranscription, RetryClass } from '~/types'
import { ProviderError } from '~/utils/error-handler'
import { classifyFetchRetry, getSttStageRetryPolicy, parseRetryAfterMs, withRetry } from '~/utils/retries'
import { buildHappyScribeUrl, HAPPYSCRIBE_STT_LANGUAGE } from './happyscribe'
import { parseHappyScribeExport, parseHappyScribeOrder, parseHappyScribeSignedUploadUrl, parseHappyScribeTranscription } from './happyscribe-response-parsers'
import { attachHappyScribeErrorContext, buildHappyScribeRetryHeaders, readHappyScribeJsonOrText, toHappyScribeHttpError } from './happyscribe-utils'


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
          payload = await readHappyScribeJsonOrText(response)

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

  const getSignedUploadUrl = async (
    audioPath: string
  ): Promise<string> => {
    const payload = await fetchJsonWithRetry({
      stage: 'upload',
      retryClass: 'runtime_http_create_retriable',
      operationName: 'happyscribe-get-signed-upload',
      timeoutMs: REQUEST_TIMEOUT_MS,
      messagePrefix: 'Happy Scribe signed upload request failed',
      request: (signal) => fetch(`${buildHappyScribeUrl(options.baseURL, '/uploads/new')}?filename=${encodeURIComponent(basename(audioPath))}`, {
        method: 'GET',
        headers: {
          authorization: `Bearer ${options.apiKey}`,
          accept: 'application/json'
        },
        signal: signal ?? null
      })
    })

    try {
      return parseHappyScribeSignedUploadUrl(payload)
    } catch (error) {
      return attachHappyScribeErrorContext(error, 'upload', 'runtime_http_create_retriable', payload)
    }
  }

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
            const payload = await readHappyScribeJsonOrText(uploadResponse)
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
  ): Promise<HappyScribeOrder> => {
    const payload = await fetchJsonWithRetry({
      stage: 'create',
      retryClass: 'runtime_http_create_retriable',
      operationName: 'happyscribe-create-order',
      timeoutMs: REQUEST_TIMEOUT_MS,
      messagePrefix: 'Happy Scribe order creation failed',
      request: (signal) => fetch(buildHappyScribeUrl(options.baseURL, '/orders'), {
        method: 'POST',
        headers: {
          authorization: `Bearer ${options.apiKey}`,
          accept: 'application/json',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
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
        signal: signal ?? null
      })
    })

    try {
      return parseHappyScribeOrder(payload)
    } catch (error) {
      return attachHappyScribeErrorContext(error, 'create', 'runtime_http_create_retriable', payload)
    }
  }

  const pollOrder = async (
    orderId: string
  ): Promise<HappyScribePollResult<HappyScribeOrder>> => {
    let retryAfterMs: number | null = null
    const payload = await fetchJsonWithRetry({
      stage: 'poll',
      retryClass: 'runtime_http_read',
      operationName: 'happyscribe-poll-order',
      timeoutMs: POLL_REQUEST_TIMEOUT_MS,
      messagePrefix: 'Happy Scribe order poll failed',
      request: (signal) => fetch(buildHappyScribeUrl(options.baseURL, `/orders/${encodeURIComponent(orderId)}`), {
        method: 'GET',
        headers: {
          authorization: `Bearer ${options.apiKey}`,
          accept: 'application/json'
        },
        signal: signal ?? null
      }),
      onResponse: (response, responsePayload) => {
        retryAfterMs = parseRetryAfterMs(buildHappyScribeRetryHeaders(response, responsePayload)) ?? null
      }
    })

    try {
      return {
        status: parseHappyScribeOrder(payload),
        retryAfterMs
      }
    } catch (error) {
      return attachHappyScribeErrorContext(error, 'poll', 'runtime_http_read', payload)
    }
  }

  const getTranscription = async (
    transcriptionId: string
  ): Promise<HappyScribeTranscription> => {
    const payload = await fetchJsonWithRetry({
      stage: 'result',
      retryClass: 'runtime_http_read',
      operationName: 'happyscribe-get-transcription',
      timeoutMs: POLL_REQUEST_TIMEOUT_MS,
      messagePrefix: 'Happy Scribe transcription lookup failed',
      request: (signal) => fetch(buildHappyScribeUrl(options.baseURL, `/transcriptions/${encodeURIComponent(transcriptionId)}`), {
        method: 'GET',
        headers: {
          authorization: `Bearer ${options.apiKey}`,
          accept: 'application/json'
        },
        signal: signal ?? null
      })
    })

    try {
      return parseHappyScribeTranscription(payload)
    } catch (error) {
      return attachHappyScribeErrorContext(error, 'result', 'runtime_http_read', payload)
    }
  }

  const createExport = async (
    transcriptionId: string
  ): Promise<HappyScribeExport> => {
    const payload = await fetchJsonWithRetry({
      stage: 'result',
      retryClass: 'runtime_http_create_retriable',
      operationName: 'happyscribe-create-export',
      timeoutMs: REQUEST_TIMEOUT_MS,
      messagePrefix: 'Happy Scribe export creation failed',
      request: (signal) => fetch(buildHappyScribeUrl(options.baseURL, '/exports'), {
        method: 'POST',
        headers: {
          authorization: `Bearer ${options.apiKey}`,
          accept: 'application/json',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          export: {
            format: 'json',
            transcription_ids: [transcriptionId]
          }
        }),
        signal: signal ?? null
      })
    })

    try {
      return parseHappyScribeExport(payload)
    } catch (error) {
      return attachHappyScribeErrorContext(error, 'result', 'runtime_http_create_retriable', payload)
    }
  }

  const pollExport = async (
    exportId: string
  ): Promise<HappyScribePollResult<HappyScribeExport>> => {
    let retryAfterMs: number | null = null
    const payload = await fetchJsonWithRetry({
      stage: 'result',
      retryClass: 'runtime_http_read',
      operationName: 'happyscribe-poll-export',
      timeoutMs: POLL_REQUEST_TIMEOUT_MS,
      messagePrefix: 'Happy Scribe export poll failed',
      request: (signal) => fetch(buildHappyScribeUrl(options.baseURL, `/exports/${encodeURIComponent(exportId)}`), {
        method: 'GET',
        headers: {
          authorization: `Bearer ${options.apiKey}`,
          accept: 'application/json'
        },
        signal: signal ?? null
      }),
      onResponse: (response, responsePayload) => {
        retryAfterMs = parseRetryAfterMs(buildHappyScribeRetryHeaders(response, responsePayload)) ?? null
      }
    })

    try {
      return {
        status: parseHappyScribeExport(payload),
        retryAfterMs
      }
    } catch (error) {
      return attachHappyScribeErrorContext(error, 'result', 'runtime_http_read', payload)
    }
  }

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
        const payload = await readHappyScribeJsonOrText(response)
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
