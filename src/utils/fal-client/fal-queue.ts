import { FAL_QUEUE_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { InfraError } from '~/utils/error-handler'
import { classifyFetchRetry, pollUntil, withRetry } from '~/utils/retries'
import { MEDIA_GENERATION_TIMEOUT_MS } from '~/utils/timeouts'

export type FalQueueStatus = {
  status: string
  request_id: string
  response_url?: string | undefined
  status_url?: string | undefined
  cancel_url?: string | undefined
  queue_position?: number | undefined
}

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
  const body = await response.text()
  return body.trim().length > 0 ? body : 'No response body'
}

export const getFalQueueBaseUrl = (baseUrl: string = FAL_QUEUE_DEFAULT_BASE_URL): string =>
  baseUrl.replace(/\/+$/, '')

export const cancelFalQueueRequest = async (apiKey: string, cancelUrl: string): Promise<void> => {
  try {
    await fetch(cancelUrl, { method: 'PUT', headers: headersFor(apiKey) })
  } catch {
    // Cancellation is best-effort while preserving the original queue error.
  }
}

export const runFalQueue = async <T>(options: {
  apiKey: string
  endpointId: string
  input: Record<string, unknown>
  baseUrl?: string | undefined
  pollIntervalMs?: number | undefined
  timeoutMs?: number | undefined
  operationName: string
  onStatus?: ((status: FalQueueStatus) => void) | undefined
}): Promise<{ requestId: string, output: T }> => {
  const baseUrl = getFalQueueBaseUrl(options.baseUrl)
  const headers = headersFor(options.apiKey)
  let submission: FalQueueStatus | undefined

  try {
    submission = await withRetry(
      { operationName: `${options.operationName}-submit`, retryClass: 'runtime_http_create_conservative' },
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
        return parseQueueStatus(await response.json() as unknown, 'fal.ai queue submission')
      },
      (error) => classifyFetchRetry(error, 'runtime_http_create_conservative')
    )

    const statusUrl = submission.status_url ?? `${baseUrl}/${options.endpointId}/requests/${encodeURIComponent(submission.request_id)}/status`
    const completed = submission.status.toUpperCase() === 'COMPLETED'
      ? submission
      : await pollUntil({
          operationName: options.operationName,
          intervalMs: options.pollIntervalMs ?? 5_000,
          deadlineMs: options.timeoutMs ?? MEDIA_GENERATION_TIMEOUT_MS,
          pollFn: async () => {
            const response = await fetch(statusUrl, { headers })
            if (!response.ok) {
              throw InfraError(`fal.ai queue status failed (${response.status}): ${await readErrorBody(response)}`, { stage: 'fal:queue', status: response.status })
            }
            const status = parseQueueStatus(await response.json() as unknown, 'fal.ai queue status')
            options.onStatus?.(status)
            return status
          },
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
      { operationName: `${options.operationName}-result`, retryClass: 'runtime_http_read' },
      async (signal) => {
        const response = await fetch(responseUrl, { headers, ...(signal ? { signal } : {}) })
        if (!response.ok) {
          throw InfraError(`fal.ai queue result failed (${response.status}): ${await readErrorBody(response)}`, { stage: 'fal:queue', status: response.status })
        }
        return response
      },
      (error) => classifyFetchRetry(error, 'runtime_http_read', { retryAbortOnConservative: true })
    )

    return { requestId: submission.request_id, output: await resultResponse.json() as T }
  } catch (error) {
    if (submission?.cancel_url) await cancelFalQueueRequest(options.apiKey, submission.cancel_url)
    throw error
  }
}
