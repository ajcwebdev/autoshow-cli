import { AppError } from '~/utils/error-handler'
import { buildCaptureMetadata, readBoundedResponseText, redactPayloadPreview } from '~/utils/bounded-capture'
import { sanitizeLogText } from '~/utils/app-logger/redaction'
import type { BoundedCaptureResult } from '~/types'

export const trimTrailingSlashes = (value: string): string => value.replace(/\/+$/, '')

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const httpResponseError = <TExtras extends object = Record<never, never>>(
  message: string,
  response: Response,
  extras?: TExtras
): Error & { status: number, headers: Headers } & TExtras =>
  Object.assign(new Error(message), extras, {
    status: response.status,
    headers: response.headers
  })

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

export const normalizeFetchAbortError = (error: unknown): unknown => {
  if (error instanceof DOMException && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
    const abortError = new Error(error.message)
    abortError.name = 'AbortError'
    return abortError
  }

  if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
    const abortError = new Error(error.message)
    abortError.name = 'AbortError'
    return abortError
  }

  return error
}

type ProviderRestRequest = {
  url: string
  init: RequestInit
}

type ProviderRestErrorContext<TOptions> = {
  options: TOptions
  response: Response
  captured: BoundedCaptureResult
  rawText: string
  parsedBody: unknown
}

type ProviderRestClientProfile<TOptions, TError extends Error> = {
  buildRequest: (options: TOptions) => ProviderRestRequest
  errorMessagePrefix: (options: TOptions) => string
  formatErrorMessage?: ((context: ProviderRestErrorContext<TOptions> & { errorMessagePrefix: string }) => string) | undefined
  createError: (context: ProviderRestErrorContext<TOptions> & { message: string }) => TError
  diagnostics?: 'raw-and-parsed' | 'parsed-body' | 'factory' | undefined
}

export const createProviderRestClient = <TOptions, TError extends Error>(
  profile: ProviderRestClientProfile<TOptions, TError>
): ((options: TOptions) => Promise<Response>) =>
  async (options: TOptions): Promise<Response> => {
    const request = profile.buildRequest(options)

    try {
      const response = await fetch(request.url, request.init)
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
  options: { invalidJsonMessagePrefix?: string | undefined } = {}
): Promise<unknown> => {
  const captured = await readRestResponseText(response)
  const rawText = captured.text
  if (captured.truncated) {
    throw new AppError(`${errorMessagePrefix} exceeded the ${captured.retainedBytes.toLocaleString()} byte response capture limit`, {
      kind: 'validation',
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
      cause: error instanceof Error ? error : new Error(String(error)),
      status: response.status,
      metadata: buildCaptureMetadata(captured)
    })
  }
}

export const readRestResponseText = async (response: Response): Promise<BoundedCaptureResult> =>
  await readBoundedResponseText(response)
