import { InfraError } from '~/utils/error-handler'
import { isRetryableStatus } from '~/utils/retries'
import { httpResponseError } from '~/utils/rest-client'

export const readJsonOrText = async (response: Response): Promise<unknown> => {
  const text = await response.text()
  if (text.length === 0) return ''
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

export const extractImageErrorMessage = (
  payload: unknown,
  extraKeys: readonly string[] = []
): string | undefined => {
  if (typeof payload === 'string') return payload
  if (!payload || typeof payload !== 'object') return undefined
  const record = payload as Record<string, unknown>
  for (const key of ['message', 'error', 'detail', 'details', ...extraKeys]) {
    const value = record[key]
    if (typeof value === 'string') return value
    if (value !== undefined) return JSON.stringify(value)
  }
  return JSON.stringify(payload)
}

export const fetchImageProviderJson = async (
  url: string,
  init: RequestInit,
  authHeaders: Record<string, string>
): Promise<{ response: Response, payload: unknown }> => {
  const headers = new Headers(init.headers)
  headers.set('accept', 'application/json')
  for (const [name, value] of Object.entries(authHeaders)) {
    headers.set(name, value)
  }

  const response = await fetch(url, {
    ...init,
    headers
  })
  const payload = await readJsonOrText(response)
  return { response, payload }
}

export const imageDownloadHttpError = (message: string, response: Response): Error => {
  return httpResponseError(message, response, {
    stage: 'result-download',
    retryClass: 'runtime_http_read',
    retryable: isRetryableStatus(response.status)
  })
}

export const downloadGeneratedImage = async (options: {
  url: string
  outputPath: string
  outputFormat: string
  providerLabel: string
  stage: string
  signal?: AbortSignal | undefined
}): Promise<void> => {
  const response = await fetch(options.url, {
    method: 'GET',
    headers: { accept: `image/${options.outputFormat},image/*;q=0.9,*/*;q=0.8` },
    ...(options.signal ? { signal: options.signal } : {})
  })
  if (!response.ok) {
    throw imageDownloadHttpError(`${options.providerLabel} image result download failed (${response.status})`, response)
  }

  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength === 0) {
    throw InfraError(`${options.providerLabel} image generation returned an empty image`, { stage: options.stage })
  }
  await Bun.write(options.outputPath, bytes)
}
