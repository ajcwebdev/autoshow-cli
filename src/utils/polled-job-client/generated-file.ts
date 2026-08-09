import { InfraError } from '~/utils/error-handler'
import { classifyFetchRetry, isRetryableStatus, withRetry } from '~/utils/retries'
import { httpResponseError } from '~/utils/rest-client'

export const downloadGeneratedFile = async (options: {
  url: string
  operationName: string
  init?: RequestInit | undefined
  outputPath?: string | undefined
  errorFactory: (response: Response) => Error
  validateBytes?: ((bytes: Uint8Array) => void) | undefined
}): Promise<Uint8Array> =>
  await withRetry(
    { operationName: options.operationName, retryClass: 'runtime_http_read' },
    async (signal) => {
      const response = await fetch(options.url, {
        ...options.init,
        ...(signal && !options.init?.signal ? { signal } : {})
      })
      if (!response.ok) {
        throw options.errorFactory(response)
      }
      const bytes = new Uint8Array(await response.arrayBuffer())
      options.validateBytes?.(bytes)
      if (options.outputPath) {
        await Bun.write(options.outputPath, bytes)
      }
      return bytes
    },
    (error) => classifyFetchRetry(error, 'runtime_http_read', { retryAbortOnConservative: true })
  )

export const imageDownloadHttpError = (message: string, response: Response): Error =>
  httpResponseError(message, response, {
    stage: 'result-download',
    retryClass: 'runtime_http_read',
    retryable: isRetryableStatus(response.status)
  })

export const downloadGeneratedImage = async (options: {
  url: string
  outputPath: string
  outputFormat: string
  providerLabel: string
  stage: string
  operationName?: string | undefined
}): Promise<void> => {
  await downloadGeneratedFile({
    url: options.url,
    outputPath: options.outputPath,
    operationName: options.operationName ?? `${options.providerLabel.toLowerCase()}-image-result-download`,
    init: {
      method: 'GET',
      headers: { accept: `image/${options.outputFormat},image/*;q=0.9,*/*;q=0.8` }
    },
    errorFactory: (response) => imageDownloadHttpError(`${options.providerLabel} image result download failed (${response.status})`, response),
    validateBytes: (bytes) => {
      if (bytes.byteLength === 0) {
        throw InfraError(`${options.providerLabel} image generation returned an empty image`, { stage: options.stage })
      }
    }
  })
}

export const downloadGeneratedVideo = async (
  videoUrl: string,
  providerLabel: string
): Promise<Uint8Array> =>
  await downloadGeneratedFile({
    url: videoUrl,
    operationName: `${providerLabel.toLowerCase()}-video-download`,
    errorFactory: (response) => httpResponseError(`${providerLabel} video download failed (${response.status})`, response)
  })
