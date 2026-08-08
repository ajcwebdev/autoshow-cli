import { REPLICATE_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { AppProviderError, InfraError, ValidationError } from '~/utils/error-handler'
import { extractRestErrorMessage, joinRestUrl, parseJsonOrText, readRestResponseText } from '~/utils/rest-client'
import { classifyFetchRetry, isRetryableStatus, pollUntil, withRetry } from '~/utils/retries'
import { MEDIA_GENERATION_TIMEOUT_MS } from '~/utils/timeouts'
import type { ReplicatePrediction, RetryClass, RunReplicatePredictionOptions } from '~/types'

const REPLICATE_SYNC_WAIT_SECONDS = 60
const REPLICATE_POLL_INTERVAL_MS = 5_000
const REPLICATE_SUCCESS_STATUSES = new Set(['succeeded', 'successful'])
const REPLICATE_FAILURE_STATUSES = new Set(['failed', 'canceled', 'aborted'])

class ReplicateRestError extends AppProviderError {
  override readonly status: number
  readonly headers: Headers
  readonly rawResponse: unknown
  override readonly stage: string
  override readonly retryClass: RetryClass
  override readonly retryable: boolean

  constructor(
    message: string,
    response: Response,
    rawResponse: unknown,
    stage: string,
    retryClass: RetryClass
  ) {
    super(message, {
      status: response.status,
      stage,
      retryClass,
      retryable: isRetryableStatus(response.status),
      metadata: {
        status: response.status,
        stage,
        retryClass,
        retryable: isRetryableStatus(response.status),
        rawResponse
      }
    })
    this.name = 'ReplicateRestError'
    this.status = response.status
    this.headers = response.headers
    this.rawResponse = rawResponse
    this.stage = stage
    this.retryClass = retryClass
    this.retryable = isRetryableStatus(response.status)
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const normalizeStatus = (status: string | undefined): string =>
  status?.trim().toLowerCase() ?? ''

const isTerminalSuccess = (prediction: Pick<ReplicatePrediction, 'status'>): boolean =>
  REPLICATE_SUCCESS_STATUSES.has(normalizeStatus(prediction.status))

const terminalFailureReason = (prediction: ReplicatePrediction): string | undefined => {
  const status = normalizeStatus(prediction.status)
  if (!REPLICATE_FAILURE_STATUSES.has(status)) {
    return undefined
  }
  if (typeof prediction.error === 'string' && prediction.error.trim().length > 0) {
    return prediction.error
  }
  if (prediction.error !== undefined) {
    return JSON.stringify(prediction.error)
  }
  return `status ${prediction.status}`
}

const parseModelId = (model: string): { owner: string, name: string } => {
  const [owner, name, ...rest] = model.split('/')
  if (!owner || !name || rest.length > 0) {
    throw ValidationError(`Invalid Replicate model id "${model}". Expected owner/model.`, { stage: 'replicate:prediction' })
  }
  return { owner, name }
}

const buildModelPredictionUrl = (baseUrl: string, model: string): string => {
  const { owner, name } = parseModelId(model)
  return joinRestUrl(
    baseUrl,
    `/models/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/predictions`,
    REPLICATE_DEFAULT_BASE_URL,
    { collapseVersionPrefix: 'v1' }
  )
}

const parsePredictionPayload = (payload: unknown, label: string): ReplicatePrediction => {
  if (!isRecord(payload)) {
    throw ValidationError(`${label} returned invalid JSON payload`, { stage: 'replicate:prediction' })
  }
  const status = payload['status']
  if (typeof status !== 'string') {
    throw ValidationError(`${label} returned a prediction without status`, { stage: 'replicate:prediction' })
  }
  const urls = isRecord(payload['urls'])
    ? {
        ...(typeof payload['urls']['get'] === 'string' ? { get: payload['urls']['get'] as string } : {}),
        ...(typeof payload['urls']['cancel'] === 'string' ? { cancel: payload['urls']['cancel'] as string } : {}),
        ...(typeof payload['urls']['web'] === 'string' ? { web: payload['urls']['web'] as string } : {})
      }
    : undefined
  return {
    ...(typeof payload['id'] === 'string' ? { id: payload['id'] } : {}),
    ...(typeof payload['model'] === 'string' ? { model: payload['model'] } : {}),
    ...(typeof payload['version'] === 'string' ? { version: payload['version'] } : {}),
    status,
    ...(payload['output'] !== undefined ? { output: payload['output'] } : {}),
    ...(payload['error'] !== undefined ? { error: payload['error'] } : {}),
    ...(typeof payload['logs'] === 'string' ? { logs: payload['logs'] } : {}),
    ...(urls ? { urls } : {}),
    ...(isRecord(payload['metrics']) ? { metrics: payload['metrics'] } : {}),
    ...(typeof payload['created_at'] === 'string' ? { created_at: payload['created_at'] } : {}),
    ...(typeof payload['started_at'] === 'string' ? { started_at: payload['started_at'] } : {}),
    ...(typeof payload['completed_at'] === 'string' ? { completed_at: payload['completed_at'] } : {})
  }
}

const fetchReplicateJson = async (
  url: string,
  apiToken: string,
  init: RequestInit,
  stage: string,
  retryClass: RetryClass
): Promise<unknown> => {
  const headers = new Headers(init.headers)
  headers.set('authorization', `Bearer ${apiToken}`)
  headers.set('accept', 'application/json')

  const response = await fetch(url, {
    ...init,
    headers
  })
  const captured = await readRestResponseText(response)
  const rawText = captured.text
  const parsed = captured.truncated ? captured.sanitizedPreview : parseJsonOrText(rawText)
  if (!response.ok) {
    throw new ReplicateRestError(
      `Replicate ${stage} failed (${response.status}): ${extractRestErrorMessage(parsed, rawText, response.status)}`,
      response,
      parsed,
      stage,
      retryClass
    )
  }
  return parsed
}

export const runReplicatePrediction = async (
  options: RunReplicatePredictionOptions
): Promise<ReplicatePrediction> => {
  const requestUrl = options.version
    ? joinRestUrl(options.baseUrl, '/predictions', REPLICATE_DEFAULT_BASE_URL, { collapseVersionPrefix: 'v1' })
    : buildModelPredictionUrl(options.baseUrl, options.model)
  const waitSeconds = REPLICATE_SYNC_WAIT_SECONDS

  const createPrediction = async (signal?: AbortSignal): Promise<ReplicatePrediction> => {
    const headers = new Headers({
      'content-type': 'application/json',
      prefer: `wait=${waitSeconds}`
    })
    const payload = await fetchReplicateJson(
      requestUrl,
      options.apiToken,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...(options.version ? { version: `${options.model}:${options.version}` } : {}),
          input: options.input
        }),
        ...(signal ? { signal } : {})
      },
      'prediction create',
      'runtime_http_create_conservative'
    )
    return parsePredictionPayload(payload, 'Replicate prediction create')
  }

  const created = await withRetry(
    { retryClass: 'runtime_http_create_conservative', operationName: `${options.operationName}-create` },
    createPrediction,
    (error) => classifyFetchRetry(error, 'runtime_http_create_conservative', { retryAbortOnConservative: true })
  )
  options.onStatus?.(created)

  if (isTerminalSuccess(created)) {
    return created
  }
  const failureReason = terminalFailureReason(created)
  if (failureReason) {
    throw InfraError(`${options.operationName}: terminal failure - ${failureReason}`, { stage: 'replicate:prediction' })
  }

  const pollUrl = created.urls?.get
  if (!pollUrl) {
    throw ValidationError('Replicate prediction create response did not include urls.get for polling', { stage: 'replicate:prediction' })
  }

  return await pollUntil({
    operationName: options.operationName,
    intervalMs: REPLICATE_POLL_INTERVAL_MS,
    deadlineMs: MEDIA_GENERATION_TIMEOUT_MS,
    pollFn: async () => {
      const prediction = await withRetry(
        { retryClass: 'runtime_http_read', operationName: `${options.operationName}-poll` },
        async (signal) => {
          const payload = await fetchReplicateJson(
            pollUrl,
            options.apiToken,
            {
              method: 'GET',
              ...(signal ? { signal } : {})
            },
            'prediction poll',
            'runtime_http_read'
          )
          return parsePredictionPayload(payload, 'Replicate prediction poll')
        },
        (error) => classifyFetchRetry(error, 'runtime_http_read', { retryAbortOnConservative: true })
      )
      options.onStatus?.(prediction)
      return prediction
    },
    isDone: isTerminalSuccess,
    isFailed: (prediction) => {
      const reason = terminalFailureReason(prediction)
      return reason ? { failed: true, reason } : { failed: false }
    }
  })
}

export const normalizeReplicateOutputUris = (output: unknown): string[] => {
  if (typeof output === 'string' && output.trim().length > 0) {
    return [output]
  }
  if (Array.isArray(output)) {
    return output.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  }
  return []
}
