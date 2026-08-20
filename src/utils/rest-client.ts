import { AppError, type AppProviderError, ProviderError } from '~/utils/error-handler'
import { buildCaptureMetadata, readBoundedResponseText, redactPayloadPreview } from '~/utils/bounded-capture'
import { sanitizeLogText } from '~/utils/app-logger/redaction'
import type { BoundedCaptureResult, ProviderRestClientProfile } from '~/types'

export const trimTrailingSlashes = (value: string): string => value.replace(/\/+$/, '')

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

// Field names are unchanged from the previous plain-Error shape, so the existing call
// sites keep working; what changes is that the result is now an AppProviderError and
// therefore carries `kind` and survives the process-level failure handlers intact.
export const httpResponseError = <TExtras extends object = Record<never, never>>(
  message: string,
  response: Response,
  extras?: TExtras
): AppProviderError & { status: number, headers: Headers } & TExtras =>
  Object.assign(
    ProviderError(message, { status: response.status, headers: response.headers }),
    extras,
    { status: response.status, headers: response.headers }
  ) as AppProviderError & { status: number, headers: Headers } & TExtras

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

// Normalizes both abort spellings to a single `AbortError` the retry classifier can read.
// `cause` is preserved so `collectErrorChain` still reaches the original DOMException /
// TimeoutError instead of bottoming out at this re-wrap.
export const normalizeFetchAbortError = (error: unknown): unknown => {
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
      // Bun's fetch aborts after 300s of socket silence even when the caller passes its
      // own AbortSignal (oven-sh/bun#16682). Non-streaming provider calls can legitimately
      // stay silent longer (e.g. LLM reasoning), so disable Bun's idle timer and let each
      // caller's AbortSignal own the deadline.
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
  options: { invalidJsonMessagePrefix?: string | undefined, stage?: string | undefined } = {}
): Promise<unknown> => {
  const captured = await readRestResponseText(response)
  const rawText = captured.text
  if (captured.truncated) {
    throw new AppError(`${errorMessagePrefix} exceeded the ${captured.retainedBytes.toLocaleString()} byte response capture limit`, {
      kind: 'validation',
      status: response.status,
      ...(options.stage !== undefined ? { stage: options.stage } : {}),
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
      ...(options.stage !== undefined ? { stage: options.stage } : {}),
      metadata: buildCaptureMetadata(captured)
    })
  }
}

export const readRestResponseText = async (response: Response): Promise<BoundedCaptureResult> =>
  await readBoundedResponseText(response)
