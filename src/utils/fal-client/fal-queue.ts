import * as l from '~/utils/app-logger/app-logger'
import { FAL_QUEUE_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { InfraError } from '~/utils/error-handler'
import { classifyFetchRetry, pollUntil, withRetry } from '~/utils/retries'
import { MEDIA_GENERATION_TIMEOUT_MS } from '~/utils/timeouts'
import type { FalQueueStatus } from '~/types'
import { readHttpPayloadJson } from '~/utils/http-payload'
import { readRestDiagnosticText } from '~/utils/rest-client'

const headersFor = (apiKey: string): Record<string, string> => ({
  Authorization: `Key ${apiKey}`,
  'Content-Type': 'application/json',
  accept: 'application/json'
})

const parseQueueStatus = (value: unknown, context: string): FalQueueStatus => {
  if (!value || typeof value !== 'object') {
    throw InfraError(`${context} returned an invalid response`, { stage: 'fal:queue' })
  }
  const record = value as Record<string, unknown>
  if (typeof record['status'] !== 'string' || typeof record['request_id'] !== 'string') {
    throw InfraError(`${context} did not include status and request_id`, { stage: 'fal:queue' })
  }
  return {
    status: record['status'],
    request_id: record['request_id'],
    ...(typeof record['response_url'] === 'string' ? { response_url: record['response_url'] } : {}),
    ...(typeof record['status_url'] === 'string' ? { status_url: record['status_url'] } : {}),
    ...(typeof record['cancel_url'] === 'string' ? { cancel_url: record['cancel_url'] } : {}),
    ...(typeof record['queue_position'] === 'number' ? { queue_position: record['queue_position'] } : {})
  }
}

const readErrorBody = async (response: Response): Promise<string> => {
  const body = await readRestDiagnosticText(response)
  return body.trim().length > 0 ? body : 'No response body'
}

const getFalQueueBaseUrl = (): string => FAL_QUEUE_DEFAULT_BASE_URL.replace(/\/+$/, '')

const FAL_CANCEL_TIMEOUT_MS = 15_000

const parseReportedCancelStatus = (body: string): string | undefined => {
  try {
    const parsed: unknown = JSON.parse(body)
    return parsed && typeof parsed === 'object' && typeof (parsed as Record<string, unknown>)['status'] === 'string'
      ? (parsed as Record<string, string>)['status']
      : undefined
  } catch {
    return undefined
  }
}

const describeCancelOutcome = (status: number, reported: string | undefined): { outcome: string, message: string } => {
  if (status >= 200 && status < 300) {
    return { outcome: 'cancellation-requested', message: 'fal.ai accepted the cancellation; a request that was already processing may still complete and be billed.' }
  }
  if (status === 400 && reported === 'ALREADY_COMPLETED') {
    return { outcome: 'already-completed', message: 'The fal.ai request had already completed before cancellation; its result may be billed and still retrievable.' }
  }
  if (status === 404) {
    return { outcome: 'not-found', message: 'fal.ai reported no request to cancel.' }
  }
  return { outcome: 'rejected', message: `fal.ai rejected the cancellation (HTTP ${status}); the request may still be running.` }
}

/**
 * Best-effort cancellation after a local failure. fal documents 202 CANCELLATION_REQUESTED,
 * 400 ALREADY_COMPLETED and 404 NOT_FOUND; none confirms that remote work stopped, so every
 * outcome is logged for reconciliation and the caller keeps its original error. Request IDs are
 * redacted from logs, so the outcome carries only statuses.
 */
export const cancelFalQueueRequest = async (
  apiKey: string,
  cancelUrl: string,
  timeoutMs: number = FAL_CANCEL_TIMEOUT_MS
): Promise<void> => {
  try {
    const response = await fetch(cancelUrl, { method: 'PUT', headers: headersFor(apiKey), signal: AbortSignal.timeout(timeoutMs) })
    const body = await readRestDiagnosticText(response)
    const reported = parseReportedCancelStatus(body)
    const { outcome, message } = describeCancelOutcome(response.status, reported)
    l.warn(message, {
      category: 'pipeline',
      metadata: { provider: 'fal', cancelOutcome: outcome, status: response.status, ...(reported ? { reportedStatus: reported } : {}) }
    })
  } catch (error) {
    l.warn('The fal.ai cancellation outcome is unknown; the request may still be running.', {
      category: 'pipeline',
      metadata: { provider: 'fal', cancelOutcome: 'unknown' },
      error
    })
  }
}

export const runFalQueue = async <T>(options: {
  apiKey: string
  endpointId: string
  input: Record<string, unknown>
  pollIntervalMs?: number | undefined
  operationName: string
  onStatus?: ((status: FalQueueStatus) => void) | undefined
  abortSignal?: AbortSignal | undefined
}): Promise<{ requestId: string, output: T }> => {
  const baseUrl = getFalQueueBaseUrl()
  const headers = headersFor(options.apiKey)
  let submission: FalQueueStatus | undefined

  try {
    submission = await withRetry(
      {
        operationName: `${options.operationName}-submit`,
        retryClass: 'runtime_http_create_conservative',
        ...(options.abortSignal ? { abortSignal: options.abortSignal } : {})
      },
      async (signal) => {
        const response = await fetch(`${baseUrl}/${options.endpointId}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(options.input),
          ...(signal ? { signal } : {})
        })
        if (!response.ok) {
          throw InfraError(`fal.ai queue submission failed (${response.status}): ${await readErrorBody(response)}`, { stage: 'fal:queue', status: response.status })
        }
        return parseQueueStatus(await readHttpPayloadJson(response, 'fal.ai queue submission', { payloadClass: 'control', stage: 'fal:queue' }), 'fal.ai queue submission')
      },
      (error) => classifyFetchRetry(error, 'runtime_http_create_conservative')
    )

    const statusUrl = submission.status_url ?? `${baseUrl}/${options.endpointId}/requests/${encodeURIComponent(submission.request_id)}/status`
    const completed = submission.status.toUpperCase() === 'COMPLETED'
      ? submission
      : await pollUntil({
          operationName: options.operationName,
          intervalMs: options.pollIntervalMs ?? 5_000,
          deadlineMs: MEDIA_GENERATION_TIMEOUT_MS,
          ...(options.abortSignal ? { abortSignal: options.abortSignal } : {}),
          pollFn: async () => await withRetry({
            retryClass: 'runtime_http_poll',
            operationName: `${options.operationName}-poll`,
            ...(options.abortSignal ? { abortSignal: options.abortSignal } : {})
          }, async (signal) => {
            const response = await fetch(statusUrl, { headers, ...(signal ? { signal } : {}) })
            if (!response.ok) {
              throw InfraError(`fal.ai queue status failed (${response.status}): ${await readErrorBody(response)}`, { stage: 'fal:queue', status: response.status })
            }
            const status = parseQueueStatus(await readHttpPayloadJson(response, 'fal.ai queue status', { payloadClass: 'control', stage: 'fal:queue' }), 'fal.ai queue status')
            options.onStatus?.(status)
            return status
          }, (error) => classifyFetchRetry(error, 'runtime_http_poll')),
          isDone: status => status.status.toUpperCase() === 'COMPLETED',
          isFailed: status => {
            const terminalStatus = status.status.toUpperCase()
            return ['FAILED', 'CANCELLED', 'CANCELED'].includes(terminalStatus)
              ? { failed: true, reason: `fal.ai request ${status.request_id} ended with status ${status.status}` }
              : { failed: false }
          }
        })

    const responseUrl = completed.response_url ?? submission.response_url ?? `${baseUrl}/${options.endpointId}/requests/${encodeURIComponent(submission.request_id)}`
    const resultResponse = await withRetry(
      { operationName: `${options.operationName}-result`, retryClass: 'runtime_http_paid_result' },
      async (signal) => {
        const response = await fetch(responseUrl, { headers, ...(signal ? { signal } : {}) })
        if (!response.ok) {
          throw InfraError(`fal.ai queue result failed (${response.status}): ${await readErrorBody(response)}`, { stage: 'fal:queue', status: response.status })
        }
        return response
      },
      (error) => classifyFetchRetry(error, 'runtime_http_paid_result')
    )

    return { requestId: submission.request_id, output: await readHttpPayloadJson(resultResponse, 'fal.ai queue result', { stage: 'fal:queue' }) as T }
  } catch (error) {
    if (submission?.cancel_url) await cancelFalQueueRequest(options.apiKey, submission.cancel_url)
    throw error
  }
}
