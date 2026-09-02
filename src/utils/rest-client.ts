import { AppError, type AppProviderError, ProviderError } from '~/utils/error-handler'
import { buildCaptureMetadata, readBoundedResponseText, redactPayloadPreview } from '~/utils/bounded-capture'
import { sanitizeLogText } from '~/utils/app-logger/redaction'
import type { BoundedCaptureResult, ProviderRestClientProfile, RetryClass } from '~/types'
import { isRecord } from '~/utils/value-helpers'

export { isRecord }

export const trimTrailingSlashes = (value: string): string => value.replace(/\/+$/, '')

export type HttpResponseErrorOptions<
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
  TStage extends string = string
> = {
  stage: TStage
  status: number
  headers: Headers
  retryable: boolean
  metadata: TMetadata
  retryClass?: RetryClass | undefined
}

export const httpResponseOptions = <TMetadata extends Record<string, unknown>, TStage extends string>(
  response: Response,
  options: Omit<HttpResponseErrorOptions<TMetadata, TStage>, 'status' | 'headers'> & { headers?: Headers | undefined }
): HttpResponseErrorOptions<TMetadata, TStage> => ({
  ...options,
  status: response.status,
  headers: options.headers ?? response.headers
})

export const httpResponseError = <TMetadata extends Record<string, unknown>, TStage extends string>(
  message: string,
  options: HttpResponseErrorOptions<TMetadata, TStage>
): AppProviderError & { stage: TStage, status: number, headers: Headers } & TMetadata =>
  Object.assign(
    ProviderError(message, {
      stage: options.stage,
      status: options.status,
      headers: options.headers,
      retryable: options.retryable,
      ...(options.retryClass ? { retryClass: options.retryClass } : {}),
      metadata: options.metadata
    }),
    options.metadata,
    { status: options.status, headers: options.headers }
  ) as AppProviderError & { stage: TStage, status: number, headers: Headers } & TMetadata

export const parseJsonOrText = (rawText: string): unknown => {
  if (rawText.trim().length === 0) {
    return {}
  }

  try {
    return JSON.parse(rawText) as unknown
  } catch {
    return rawText
  }
}

export const extractRestErrorMessage = (payload: unknown, rawText: string, status: number): string => {
  if (isRecord(payload)) {
    const error = payload['error']
    if (isRecord(error)) {
      const message = error['message']
      if (typeof message === 'string' && message.trim().length > 0) {
        return sanitizeLogText(message.trim())
      }
    }

    for (const key of ['message', 'detail', 'error'] as const) {
      const value = payload[key]
      if (typeof value === 'string' && value.trim().length > 0) {
        return sanitizeLogText(value.trim())
      }
    }
  }

  return sanitizeLogText(rawText.trim()) || `HTTP ${status}`
}

const normalizeFetchAbortError = (error: unknown): unknown => {
  const isAbortShaped = (error instanceof DOMException || error instanceof Error)
    && (error.name === 'AbortError' || error.name === 'TimeoutError')

  if (isAbortShaped) {
    const abortError = new Error(error.message, { cause: error })
    abortError.name = 'AbortError'
    return abortError
  }

  return error
}

export const createProviderRestClient = <TOptions, TError extends Error>(
  profile: ProviderRestClientProfile<TOptions, TError>
): ((options: TOptions) => Promise<Response>) =>
  async (options: TOptions): Promise<Response> => {
    const request = profile.buildRequest(options)

    try {
      const init: RequestInit & { timeout: false } = { ...request.init, timeout: false }
      const response = await fetch(request.url, init)
      if (response.ok) {
        return response
      }

      const captured = await readRestResponseText(response)
      const rawText = captured.text
      const parsedBody = captured.truncated
        ? captured.sanitizedPreview
        : parseJsonOrText(rawText)
      const errorMessagePrefix = profile.errorMessagePrefix(options)
      const context = { options, response, captured, rawText, parsedBody }
      const message = profile.formatErrorMessage?.({ ...context, errorMessagePrefix })
        ?? `${errorMessagePrefix} (${response.status}): ${extractRestErrorMessage(parsedBody, rawText, response.status)}`
      const error = profile.createError({ ...context, message })
      if (profile.diagnostics !== 'factory') {
        Object.assign(error, {
          status: response.status,
          headers: response.headers,
          ...(profile.diagnostics === 'parsed-body'
            ? { body: redactPayloadPreview(parsedBody) }
            : { body: rawText, rawResponse: redactPayloadPreview(parsedBody) }),
          ...buildCaptureMetadata(captured),
          bodyBytes: captured.totalBytes,
          bodyTruncated: captured.truncated,
          bodyPreview: captured.sanitizedPreview
        })
      }
      throw error
    } catch (error) {
      throw normalizeFetchAbortError(error)
    }
  }

export const resolveRestPath = (baseURL: string, path: string): string =>
  new URL(path.replace(/^\/+/, ''), baseURL.endsWith('/') ? baseURL : `${baseURL}/`).toString()

export const readRestErrorText = async (response: Response): Promise<string> => {
  const text = await response.text()
  return text.trim() || `HTTP ${response.status}`
}

export const joinRestUrl = (
  baseURL: string | undefined,
  path: string,
  defaultBaseUrl: string,
  options: { collapseVersionPrefix?: string } = {}
): string => {
  const base = trimTrailingSlashes((baseURL ?? defaultBaseUrl).trim() || defaultBaseUrl)
  const pathWithoutLeadingSlash = path.replace(/^\/+/, '')
  const versionPrefix = options.collapseVersionPrefix?.replace(/^\/+|\/+$/g, '')

  const resolveRequestPath = (basePath: string): string =>
    versionPrefix && basePath.endsWith(`/${versionPrefix}`) && pathWithoutLeadingSlash.startsWith(`${versionPrefix}/`)
      ? pathWithoutLeadingSlash.slice(`${versionPrefix}/`.length)
      : pathWithoutLeadingSlash

  try {
    const url = new URL(base)
    url.hash = ''
    url.search = ''
    const basePath = trimTrailingSlashes(url.pathname)
    const requestPath = resolveRequestPath(basePath)
    url.pathname = `${basePath}/${requestPath}`.replace(/\/{2,}/g, '/')
    return url.toString()
  } catch {
    const requestPath = resolveRequestPath(base)
    return `${base}/${requestPath}`
  }
}

export const readJsonResponse = async (
  response: Response,
  errorMessagePrefix: string,
  options: { invalidJsonMessagePrefix?: string | undefined, maxBytes?: number | undefined, stage?: string | undefined } = {}
): Promise<unknown> => {
  const captured = await readRestResponseText(response, { maxBytes: options.maxBytes })
  const rawText = captured.text
  if (captured.truncated) {
    throw new AppError(`${errorMessagePrefix} exceeded the ${captured.retainedBytes.toLocaleString()} byte response capture limit`, {
      kind: 'validation',
      stage: options.stage ?? 'rest:response-validation',
      status: response.status,
      metadata: buildCaptureMetadata(captured)
    })
  }

  if (rawText.trim().length === 0) {
    return {}
  }

  try {
    return JSON.parse(rawText) as unknown
  } catch (error) {
    throw new AppError(`${options.invalidJsonMessagePrefix ?? errorMessagePrefix} returned invalid JSON: ${sanitizeLogText(rawText.slice(0, 500))}`, {
      kind: 'validation',
      stage: options.stage ?? 'rest:response-validation',
      cause: error instanceof Error ? error : new Error(String(error)),
      status: response.status,
      metadata: buildCaptureMetadata(captured)
    })
  }
}

export const readRestResponseText = async (
  response: Response,
  options: { maxBytes?: number | undefined } = {}
): Promise<BoundedCaptureResult> => await readBoundedResponseText(response, options)
