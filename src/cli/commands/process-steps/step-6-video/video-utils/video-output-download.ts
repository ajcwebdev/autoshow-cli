import { classifyFetchRetry, withRetry } from '~/utils/retries'
import { httpResponseError } from '~/utils/rest-client'

export const downloadVideoOutputBytes = async (
  videoUrl: string,
  providerLabel: string
): Promise<Uint8Array> =>
  await withRetry(
    {
      operationName: `${providerLabel.toLowerCase()}-video-download`,
      retryClass: 'runtime_http_read'
    },
    async (signal) => {
      const response = await fetch(videoUrl, signal ? { signal } : undefined)
      if (!response.ok) {
        throw httpResponseError(`${providerLabel} video download failed (${response.status})`, response)
      }
      return new Uint8Array(await response.arrayBuffer())
    },
    (error) => classifyFetchRetry(error, 'runtime_http_read', { retryAbortOnConservative: true })
  )
