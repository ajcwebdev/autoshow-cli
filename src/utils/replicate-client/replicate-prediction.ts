import { REPLICATE_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { buildCaptureMetadata, redactPayloadPreview } from '~/utils/bounded-capture'
import { AppProviderError, InfraError, ValidationError } from '~/utils/error-handler'
import { createProviderRestClient, isRecord, joinRestUrl, parseJsonOrText, readRestResponseText } from '~/utils/rest-client'
import { classifyFetchRetry, classifyPaidCreateRetry, isRetryableStatus, pollUntil, withRetry } from '~/utils/retries'
import { MEDIA_GENERATION_TIMEOUT_MS } from '~/utils/timeouts'
import type { BoundedCaptureResult, ReplicatePrediction, RetryClass, RunReplicatePredictionOptions } from '~/types'

const REPLICATE_SYNC_WAIT_SECONDS = 60
const REPLICATE_POLL_INTERVAL_MS = 5_000
const REPLICATE_SUCCESS_STATUSES = new Set(['succeeded', 'successful'])
const REPLICATE_FAILURE_STATUSES = new Set(['failed', 'canceled', 'aborted'])

class ReplicateRestError extends AppProviderError {
  override readonly status: number
  override readonly headers: Headers
  readonly rawResponse: unknown
  readonly bodyBytes: number
  readonly bodyTruncated: boolean
  readonly bodyPreview: string
  override readonly stage: string
  override readonly retryClass: RetryClass
  override readonly retryable: boolean

  constructor(
    message: string,
    response: Response,
    rawResponse: unknown,
    captured: BoundedCaptureResult,
    stage: string,
    retryClass: RetryClass
  ) {
    const redactedResponse = redactPayloadPreview(rawResponse)
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
        rawResponse: redactedResponse,
        ...buildCaptureMetadata(captured)
      }
    })
    this.name = 'ReplicateRestError'
    this.status = response.status
    this.headers = response.headers
    this.rawResponse = redactedResponse
    this.bodyBytes = captured.totalBytes
    this.bodyTruncated = captured.truncated
    this.bodyPreview = captured.sanitizedPreview
    this.stage = stage
    this.retryClass = retryClass
    this.retryable = isRetryableStatus(response.status)
  }
}

type ReplicateFetchOptions = {
  url: string
  apiToken: string
  init: RequestInit
  stage: string
  retryClass: RetryClass
}

const replicateFetch = createProviderRestClient<ReplicateFetchOptions, ReplicateRestError>({
  buildRequest: (options) => {
    const headers = new Headers(options.init.headers)
    headers.set('authorization', `Bearer ${options.apiToken}`)
    headers.set('accept', 'application/json')
    return {
      url: options.url,
      init: { ...options.init, headers }
    }
  },
  errorMessagePrefix: (options) => `Replicate ${options.stage} failed`,
  createError: ({ options, response, captured, parsedBody, message }) =>
    new ReplicateRestError(message, response, parsedBody, captured, options.stage, options.retryClass),
  diagnostics: 'factory'
})

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
  const response = await replicateFetch({
    url,
    apiToken,
    init,
    stage,
    retryClass
  })
  const captured = await readRestResponseText(response)
  return captured.truncated ? captured.sanitizedPreview : parseJsonOrText(captured.text)
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
      'runtime_http_create_retriable'
    )
    return parsePredictionPayload(payload, 'Replicate prediction create')
  }

  const created = await withRetry(
    {
      retryClass: 'runtime_http_create_conservative',
      operationName: `${options.operationName}-create`,
      abortSignal: options.abortSignal
    },
    createPrediction,
    classifyPaidCreateRetry
  )
  await options.onCreated?.(created)
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
        {
          retryClass: 'runtime_http_read',
          operationName: `${options.operationName}-poll`,
          abortSignal: options.abortSignal
        },
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
        (error) => classifyFetchRetry(error, 'runtime_http_read')
      )
      options.onStatus?.(prediction)
      return prediction
    },
    isDone: isTerminalSuccess,
    isFailed: (prediction) => {
      const reason = terminalFailureReason(prediction)
      return reason ? { failed: true, reason } : { failed: false }
    },
    abortSignal: options.abortSignal
  })
}

export const cancelReplicatePrediction = async (options: {
  apiToken: string
  cancelUrl: string
  operationName: string
}): Promise<void> => {
  await fetchReplicateJson(
    options.cancelUrl,
    options.apiToken,
    { method: 'POST' },
    `${options.operationName} cancel`,
    'runtime_http_read'
  )
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
