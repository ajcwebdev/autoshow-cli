import type { MistralFetchOptions, MistralJsonRequestOptions, MistralMultipartRequestOptions, MistralRestError } from '~/types'
import { MISTRAL_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { buildCaptureMetadata, redactPayloadPreview } from '~/utils/bounded-capture'
import { extractRestErrorMessage, normalizeFetchAbortError, parseJsonOrText, readJsonResponse, readRestResponseText, trimTrailingSlashes } from '~/utils/rest-client'

export const normalizeMistralBaseUrl = (baseURL: string): string => {
  const trimmed = baseURL.trim()
  if (trimmed.length === 0) {
    return MISTRAL_DEFAULT_BASE_URL
  }

  try {
    const url = new URL(trimmed)
    url.hash = ''
    url.search = ''
    const pathname = trimTrailingSlashes(url.pathname)
    url.pathname = pathname.endsWith('/v1')
      ? pathname
      : `${pathname}/v1`.replace(/\/{2,}/g, '/')
    return trimTrailingSlashes(url.toString())
  } catch {
    const withoutTrailingSlash = trimTrailingSlashes(trimmed)
    return withoutTrailingSlash.endsWith('/v1')
      ? withoutTrailingSlash
      : `${withoutTrailingSlash}/v1`
  }
}

const buildMistralUrl = (baseURL: string | undefined, path: string): string => {
  const normalizedBase = normalizeMistralBaseUrl(baseURL ?? MISTRAL_DEFAULT_BASE_URL)
  return new URL(path.replace(/^\/+/, ''), `${normalizedBase}/`).toString()
}

const createMistralHttpError = async (
  response: Response,
  errorMessagePrefix: string
): Promise<MistralRestError> => {
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
    bodyPreview: captured.sanitizedPreview
  } satisfies Pick<MistralRestError, 'status' | 'headers' | 'body' | 'rawResponse' | 'bodyBytes' | 'bodyTruncated' | 'bodyPreview'>)
}

const mistralFetch = async (options: MistralFetchOptions): Promise<Response> => {
  const requestUrl = buildMistralUrl(options.baseURL, options.path)

  const headers = new Headers(options.headers)
  if (!headers.has('accept')) {
    headers.set('accept', 'application/json')
  }
  headers.set('authorization', `Bearer ${options.apiKey}`)

  const signal = options.signal
    ?? (typeof options.timeoutMs === 'number' ? AbortSignal.timeout(options.timeoutMs) : undefined)

  try {
    const response = await fetch(requestUrl, {
      method: options.method ?? 'POST',
      headers,
      body: options.body,
      ...(signal ? { signal } : {})
    })

    if (!response.ok) {
      throw await createMistralHttpError(response, options.errorMessagePrefix)
    }

    return response
  } catch (error) {
    throw normalizeFetchAbortError(error)
  }
}

export const mistralJsonRequest = async <T = unknown>(
  options: MistralJsonRequestOptions
): Promise<T> => {
  const response = await mistralFetch({
    ...options,
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(options.body)
  })
  return await readJsonResponse(response, options.errorMessagePrefix) as T
}

export const mistralMultipartRequest = async <T = unknown>(
  options: MistralMultipartRequestOptions
): Promise<T> => {
  const response = await mistralFetch({
    ...options,
    body: options.form
  })
  return await readJsonResponse(response, options.errorMessagePrefix) as T
}
