import type { MistralFetchOptions, MistralJsonRequestOptions, MistralMultipartRequestOptions, MistralRestError } from '~/types'
import { MISTRAL_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { createProviderRestClient, readJsonResponse, trimTrailingSlashes } from '~/utils/rest-client'

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

const mistralFetch = createProviderRestClient<MistralFetchOptions, MistralRestError>({
  buildRequest: (options) => {
    const headers = new Headers(options.headers)
    if (!headers.has('accept')) {
      headers.set('accept', 'application/json')
    }
    headers.set('authorization', `Bearer ${options.apiKey}`)
    const signal = options.signal
      ?? (typeof options.timeoutMs === 'number' ? AbortSignal.timeout(options.timeoutMs) : undefined)

    return {
      url: buildMistralUrl(options.baseURL, options.path),
      init: {
        method: options.method ?? 'POST',
        headers,
        body: options.body,
        ...(signal ? { signal } : {})
      }
    }
  },
  errorMessagePrefix: (options) => options.errorMessagePrefix,
  createError: ({ message }) => new Error(message) as MistralRestError
})

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
