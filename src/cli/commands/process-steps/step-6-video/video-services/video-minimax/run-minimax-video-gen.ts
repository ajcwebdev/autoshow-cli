import type { MinimaxVideoModel, Step6VideoMetadata, VideoMode } from '~/types'
import { InfraError } from '~/utils/error-handler'
import { logGenCompleted, logGenStatus } from '~/cli/commands/process-steps/generation-command-utils'
import { estimateVideoCost, logVideoEstimate } from '~/cli/commands/process-steps/step-6-video/video-utils/video-pricing'
import { requireApiKey } from '~/utils/validate/env-utils'
import { MINIMAX_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { normalizeMinimaxDurationForApi, normalizeMinimaxResolutionForApi } from '~/cli/commands/process-steps/step-6-video/video-utils/video-normalization'
import { downloadVideoOutputBytes } from '~/cli/commands/process-steps/step-6-video/video-utils/video-output-download'
import { classifyFetchRetry, pollUntil, withRetry } from '~/utils/retries'
import { MEDIA_GENERATION_TIMEOUT_MS } from '~/utils/timeouts'
import {
  MinimaxCreateResponseSchema,
  MinimaxQueryResponseSchema,
  isMinimaxTaskSuccess,
  isMinimaxTaskFailure,
  minimaxFetchJson,
  minimaxJsonRequestInit,
  readMinimaxTaskStatus,
  resolveMinimaxFileId,
  retrieveMinimaxFileUrl
} from '~/utils/minimax-client/minimax-client'
import { videoMediaReferenceToUrlOrDataUrl } from '../../video-utils/video-media-inputs'
const POLL_INTERVAL_MS = 10_000
const POLL_TIMEOUT_MS = MEDIA_GENERATION_TIMEOUT_MS

export const runMinimaxVideoGen = async (
  prompt: string | undefined,
  outputDir: string,
  options: {
    model: MinimaxVideoModel
    mode?: VideoMode | undefined
    durationSeconds?: number | undefined
    resolution?: string | undefined
    inputImage?: string | undefined
    lastFrameImage?: string | undefined
    referenceImages?: string[] | undefined
  }
): Promise<{ videoPath: string, metadata: Step6VideoMetadata }> => {
  const apiKey = requireApiKey('MINIMAX_API_KEY', 'video:minimax')

  const baseURL = MINIMAX_DEFAULT_BASE_URL
  const mode = options.mode ?? 'text'
  const resolutionForApi = normalizeMinimaxResolutionForApi(options.model, options.resolution)
  const durationForApi = normalizeMinimaxDurationForApi(options.model, resolutionForApi, options.durationSeconds)

  logGenStatus('video', 'minimax', options.model, 'started')

  const estimate = estimateVideoCost({
    minimaxVideoModel: options.model,
    videoDuration: options.durationSeconds,
    videoResolution: options.resolution,
    videoMode: mode
  })
  logVideoEstimate(estimate)

  const startTime = Date.now()
  const inputImage = options.inputImage
    ? await videoMediaReferenceToUrlOrDataUrl(options.inputImage, 'image')
    : undefined
  const lastFrameImage = options.lastFrameImage
    ? await videoMediaReferenceToUrlOrDataUrl(options.lastFrameImage, 'image')
    : undefined
  const referenceImage = options.referenceImages?.[0]
    ? await videoMediaReferenceToUrlOrDataUrl(options.referenceImages[0], 'image')
    : undefined

  const requestBody: Record<string, unknown> = {
    model: options.model,
    ...(prompt !== undefined ? { prompt } : {})
  }
  if (mode === 'reference-to-video') {
    requestBody['subject_reference'] = referenceImage
      ? [{ type: 'character', image: [referenceImage] }]
      : []
  } else {
    requestBody['duration'] = durationForApi
    requestBody['resolution'] = resolutionForApi
    if (inputImage) requestBody['first_frame_image'] = inputImage
    if (lastFrameImage) requestBody['last_frame_image'] = lastFrameImage
  }

  const createData = await minimaxFetchJson(
    `${baseURL}/v1/video_generation`,
    {
      init: minimaxJsonRequestInit(apiKey, 'POST', requestBody),
      schema: MinimaxCreateResponseSchema,
      responseContext: 'MiniMax video generation create response',
      baseRespContext: 'MiniMax video generation create request',
      stage: 'video:minimax',
      httpErrorMessage: 'MiniMax video generation request failed'
    }
  )

  const taskId = String(createData.task_id)

  const queryData = await pollUntil({
    operationName: 'minimax-video-gen',
    intervalMs: POLL_INTERVAL_MS,
    deadlineMs: POLL_TIMEOUT_MS,
    pollFn: () => withRetry(
      { retryClass: 'runtime_http_read', operationName: 'minimax-video-gen-poll' },
      async () => {
        const data = await minimaxFetchJson(
          `${baseURL}/v1/query/video_generation?task_id=${encodeURIComponent(taskId)}`,
          {
            init: minimaxJsonRequestInit(apiKey, 'GET'),
            schema: MinimaxQueryResponseSchema,
            responseContext: 'MiniMax video generation query response',
            baseRespContext: 'MiniMax video generation query',
            stage: 'video:minimax',
            httpErrorMessage: 'MiniMax video generation query failed'
          }
        )

        const status = readMinimaxTaskStatus(data)
        logGenStatus('video', 'minimax', options.model, String(status ?? 'processing'))
        return data
      },
      (error) => classifyFetchRetry(error, 'runtime_http_read', { retryAbortOnConservative: true })
    ),
    isDone: (data) => isMinimaxTaskSuccess(readMinimaxTaskStatus(data)),
    isFailed: (data) => {
      const status = readMinimaxTaskStatus(data)
      if (isMinimaxTaskFailure(status)) {
        return { failed: true, reason: data.data?.error_message ?? data.error_message ?? data.base_resp?.status_msg ?? 'Unknown error' }
      }
      return { failed: false }
    }
  })

  const fileId = resolveMinimaxFileId(queryData)
  if (!fileId) {
    throw InfraError('MiniMax video generation succeeded but no file_id was returned', { stage: 'video:minimax' })
  }

  const downloadUrl = await retrieveMinimaxFileUrl(baseURL, apiKey, fileId, 'video:minimax')

  const outputPath = `${outputDir}/generated-video.mp4`
  const bytes = await downloadVideoOutputBytes(downloadUrl, 'MiniMax')
  await Bun.write(outputPath, bytes)

  const processingTime = Date.now() - startTime
  const videoFile = Bun.file(outputPath)

  logGenCompleted('video', 'minimax', options.model, processingTime, [outputPath])

  const metadata: Step6VideoMetadata = {
    videoGenService: 'minimax',
    videoGenModel: options.model,
    processingTime,
    videoFileName: 'generated-video.mp4',
    videoFileSize: videoFile.size,
    videoDuration: durationForApi,
    requestMode: mode,
    ...(mode !== 'reference-to-video' ? { videoResolution: resolutionForApi } : {}),
    ...(options.inputImage ? { inputImage: options.inputImage } : {}),
    ...(options.lastFrameImage ? { lastFrameImage: options.lastFrameImage } : {}),
    ...(options.referenceImages && options.referenceImages.length > 0 ? { referenceImages: options.referenceImages } : {})
  }

  return { videoPath: outputPath, metadata }
}
