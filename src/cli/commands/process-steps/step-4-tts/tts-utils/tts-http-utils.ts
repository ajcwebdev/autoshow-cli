import { extractRestErrorMessage, httpResponseError, httpResponseOptions, parseJsonOrText } from '~/utils/rest-client'

export const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '')

const readTtsHttpError = async (response: Response): Promise<string> => {
  const rawText = await response.text()
  if (!rawText.trim()) {
    return `HTTP ${response.status}`
  }

  return extractRestErrorMessage(parseJsonOrText(rawText), rawText, response.status)
}

export const fetchTtsAudioBytes = async (options: {
  url: string
  apiKey: string
  providerLabel: string
  body: Record<string, unknown>
  signal?: AbortSignal | undefined
}): Promise<Uint8Array> => {
  const response = await fetch(options.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'audio/wav'
    },
    body: JSON.stringify(options.body),
    ...(options.signal ? { signal: options.signal } : {})
  })

  if (!response.ok) {
    const errText = await readTtsHttpError(response)
    throw httpResponseError(`${options.providerLabel} TTS failed (${response.status}): ${errText}`, httpResponseOptions(response, {
      stage: 'tts:provider', retryClass: 'runtime_http_create_conservative', retryable: response.status === 425 || response.status === 429, metadata: { provider: options.providerLabel }
    }))
  }

  return new Uint8Array(await response.arrayBuffer())
}
