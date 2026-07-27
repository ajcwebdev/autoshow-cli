import type { AnthropicDeletedFile, AnthropicFetchOptions, AnthropicFileMetadata, AnthropicMessageResponse, AnthropicRequestOptions, AnthropicRestConfig, AnthropicRestError } from '~/types'
import { ANTHROPIC_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { buildCaptureMetadata, redactPayloadPreview } from '~/utils/bounded-capture'
import { extractRestErrorMessage, isRecord, joinRestUrl, normalizeFetchAbortError, parseJsonOrText, readJsonResponse, readRestResponseText } from '~/utils/rest-client'

const ANTHROPIC_VERSION = '2023-06-01'
export const ANTHROPIC_FILES_API_BETA = 'files-api-2025-04-14'

const getBetaHeaderValue = (beta: string | string[] | undefined): string | undefined => {
  if (Array.isArray(beta)) {
    const values = beta.map((value) => value.trim()).filter(Boolean)
    return values.length > 0 ? values.join(',') : undefined
  }

  const value = beta?.trim()
  return value ? value : undefined
}

const buildAnthropicUrl = (baseURL: string | undefined, path: string, defaultBaseURL: string): string =>
  joinRestUrl(baseURL, path, defaultBaseURL, { collapseVersionPrefix: 'v1' })

const extractErrorType = (payload: unknown): string | undefined => {
  if (!isRecord(payload)) return undefined
  const error = payload['error']
  if (isRecord(error) && typeof error['type'] === 'string') {
    return error['type']
  }
  return undefined
}

const extractResponseType = (payload: unknown): string | undefined => {
  if (!isRecord(payload)) return undefined
  return typeof payload['type'] === 'string' ? payload['type'] : undefined
}

const createAnthropicHttpError = async (
  response: Response,
  errorMessagePrefix: string
): Promise<AnthropicRestError> => {
  const captured = await readRestResponseText(response)
  const rawText = captured.text
  const rawResponse = captured.truncated
    ? captured.sanitizedPreview
    : parseJsonOrText(rawText)
  const message = extractRestErrorMessage(rawResponse, rawText, response.status)
  return Object.assign(new Error(`${errorMessagePrefix} (${response.status}): ${message}`), {
    status: response.status,
    headers: response.headers,
    body: rawText,
    rawResponse: redactPayloadPreview(rawResponse),
    ...buildCaptureMetadata(captured),
    bodyBytes: captured.totalBytes,
    bodyTruncated: captured.truncated,
    bodyPreview: captured.sanitizedPreview,
    ...(extractErrorType(rawResponse) ? { errorType: extractErrorType(rawResponse) } : {}),
    ...(extractResponseType(rawResponse) ? { responseType: extractResponseType(rawResponse) } : {})
  } satisfies Omit<AnthropicRestError, keyof Error>)
}

const anthropicFetch = async (options: AnthropicFetchOptions): Promise<Response> => {
  const defaultBaseURL = options.config.defaultBaseURL ?? ANTHROPIC_DEFAULT_BASE_URL
  const requestUrl = buildAnthropicUrl(options.config.baseURL, options.path, defaultBaseURL)

  const headers = new Headers(options.headers)
  if (!headers.has('accept')) {
    headers.set('accept', 'application/json')
  }
  headers.set('x-api-key', options.config.apiKey)
  headers.set('anthropic-version', ANTHROPIC_VERSION)

  const beta = getBetaHeaderValue(options.beta)
  if (beta) {
    headers.set('anthropic-beta', beta)
  }

  try {
    const response = await fetch(requestUrl, {
      method: options.method ?? 'POST',
      headers,
      body: options.body,
      ...(options.signal ? { signal: options.signal } : {})
    })

    if (!response.ok) {
      throw await createAnthropicHttpError(response, options.errorMessagePrefix)
    }

    return response
  } catch (error) {
    throw normalizeFetchAbortError(error)
  }
}

const extractBetasFromBody = (body: Record<string, unknown>): string[] | undefined => {
  const value = body['betas']
  if (!Array.isArray(value)) {
    return undefined
  }

  const betas = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  return betas.length > 0 ? betas : undefined
}

export const createAnthropicMessage = async (
  config: AnthropicRestConfig,
  body: Record<string, unknown>,
  options: AnthropicRequestOptions = {}
): Promise<AnthropicMessageResponse> => {
  const requestBody = { ...body }
  const bodyBetas = extractBetasFromBody(requestBody)
  delete requestBody['betas']

  const response = await anthropicFetch({
    config,
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(requestBody),
    signal: options.signal,
    beta: options.beta ?? bodyBetas,
    errorMessagePrefix: 'Anthropic Messages request failed'
  })

  return await readJsonResponse(response, 'Anthropic Messages response') as AnthropicMessageResponse
}

export const uploadAnthropicFile = async (
  config: AnthropicRestConfig,
  file: File,
  options: AnthropicRequestOptions = {}
): Promise<AnthropicFileMetadata> => {
  const form = new FormData()
  form.append('file', file, file.name)

  const response = await anthropicFetch({
    config,
    path: '/v1/files',
    method: 'POST',
    body: form,
    signal: options.signal,
    beta: options.beta ?? ANTHROPIC_FILES_API_BETA,
    errorMessagePrefix: 'Anthropic Files upload failed'
  })

  return await readJsonResponse(response, 'Anthropic Files upload response') as AnthropicFileMetadata
}

export const deleteAnthropicFile = async (
  config: AnthropicRestConfig,
  fileId: string,
  options: AnthropicRequestOptions = {}
): Promise<AnthropicDeletedFile> => {
  const response = await anthropicFetch({
    config,
    path: `/v1/files/${encodeURIComponent(fileId)}`,
    method: 'DELETE',
    signal: options.signal,
    beta: options.beta ?? ANTHROPIC_FILES_API_BETA,
    errorMessagePrefix: 'Anthropic Files delete failed'
  })

  return await readJsonResponse(response, 'Anthropic Files delete response') as AnthropicDeletedFile
}
