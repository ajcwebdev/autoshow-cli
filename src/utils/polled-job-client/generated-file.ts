import { rm } from 'node:fs/promises'
import { ValidationError } from '~/utils/error-handler'
import { classifyFetchRetry, isRetryableStatus, withRetry } from '~/utils/retries'
import { httpResponseError, httpResponseOptions } from '~/utils/rest-client'
import { MEDIA_GENERATION_TIMEOUT_MS } from '~/utils/timeouts'
import { writeHttpPayloadToFile } from '~/utils/http-payload'

export const downloadGeneratedFile = async (options: {
  url: string
  operationName: string
  init?: RequestInit | undefined
  outputPath: string | ((response: Response) => string)
  errorFactory: (response: Response) => Error
  /** Reads response headers before the body is consumed, e.g. to pick a file extension from `content-type`. */
  inspectResponse?: ((response: Response) => void) | undefined
  validateSize?: ((size: number) => void) | undefined
  timeoutMs?: number | undefined
}): Promise<number> =>
  await withRetry(
    {
      operationName: options.operationName,
      retryClass: 'runtime_http_read',
      abortSignal: options.init?.signal ?? undefined,
      timeoutMs: options.timeoutMs ?? MEDIA_GENERATION_TIMEOUT_MS
    },
    async (signal) => {
      const response = await fetch(options.url, {
        ...options.init,
        ...(signal && !options.init?.signal ? { signal } : {})
      })
      if (!response.ok) {
        throw options.errorFactory(response)
      }
      options.inspectResponse?.(response)
      const outputPath = typeof options.outputPath === 'function' ? options.outputPath(response) : options.outputPath
      const size = await writeHttpPayloadToFile(response, outputPath)
      try {
        options.validateSize?.(size)
      } catch (error) {
        await rm(outputPath, { force: true })
        throw error
      }
      return size
    },
    (error) => classifyFetchRetry(error, 'runtime_http_read')
  )

export const imageDownloadHttpError = (message: string, response: Response): Error =>
  httpResponseError(message, httpResponseOptions(response, {
    stage: 'result-download',
    retryClass: 'runtime_http_read',
    retryable: isRetryableStatus(response.status),
    metadata: {}
  }))

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
    validateSize: (size) => {
      if (size === 0) {
        throw ValidationError(`${options.providerLabel} image generation returned an empty image`, { stage: options.stage })
      }
    }
  })
}

export const downloadGeneratedVideo = async (
  videoUrl: string,
  providerLabel: string,
  outputPath: string
): Promise<number> =>
  await downloadGeneratedFile({
    url: videoUrl,
    outputPath,
    operationName: `${providerLabel.toLowerCase()}-video-download`,
    errorFactory: (response) => httpResponseError(`${providerLabel} video download failed (${response.status})`, httpResponseOptions(response, {
      stage: 'result-download',
      retryClass: 'runtime_http_read',
      retryable: isRetryableStatus(response.status),
      metadata: { provider: providerLabel }
    }))
  })
