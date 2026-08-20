import { mkdir } from 'node:fs/promises'
import type { GeminiVideoModel, Step6VideoMetadata, VideoMode } from '~/types'
import { InfraError } from '~/utils/error-handler'
import { logGenCompleted, logGenStatus } from '~/cli/commands/process-steps/generation-command-utils'
import { estimateVideoCost, logVideoEstimate } from '~/cli/commands/process-steps/step-6-video/video-utils/video-pricing'
import { requireApiKey } from '~/utils/validate/env-utils'
import { normalizeGeminiDuration, normalizeGeminiResolution } from '~/cli/commands/process-steps/step-6-video/video-utils/video-normalization'
import { pollUntil } from '~/utils/retries'
import { MEDIA_GENERATION_TIMEOUT_MS } from '~/utils/timeouts'
import { geminiDownloadFile, geminiGetOperation, geminiPredictLongRunning } from '~/utils/gemini/gemini-rest'
import {
  videoMediaReferenceToGeminiInlineData,
  videoMediaReferenceToGeminiVideoImage
} from '../../video-utils/video-media-inputs'
const POLL_INTERVAL_MS = 10_000
const POLL_TIMEOUT_MS = MEDIA_GENERATION_TIMEOUT_MS
const DEFAULT_IMAGE_VIDEO_PROMPT = 'Animate the provided image with natural, subtle motion while preserving its subject and composition.'

export const runGeminiVideoGen = async (
  prompt: string | undefined,
  outputDir: string,
  options: {
    model: GeminiVideoModel
    mode?: VideoMode | undefined
    aspectRatio?: string | undefined
    resolution?: string | undefined
    durationSeconds?: number | undefined
    inputImage?: string | undefined
    lastFrameImage?: string | undefined
    referenceImages?: string[] | undefined
    inputVideo?: string | undefined
    // Without this, Ctrl-C could not interrupt the video generation poll.
    abortSignal?: AbortSignal | undefined
  }
): Promise<{ videoPath: string, metadata: Step6VideoMetadata }> => {
  const apiKey = requireApiKey('GEMINI_API_KEY', 'video:gemini')

  logGenStatus('video', 'gemini', options.model, 'started')

  const estimate = estimateVideoCost({
    geminiVideoModel: options.model,
    videoDuration: options.durationSeconds,
    videoResolution: options.resolution,
    videoMode: options.mode
  })
  logVideoEstimate(estimate)

  await mkdir(outputDir, { recursive: true })
  const mode = options.mode ?? 'text'
  const normalizedResolution = mode === 'extend' ? '720p' : normalizeGeminiResolution(options.resolution, options.model)
  const normalizedDuration = normalizeGeminiDuration(options.durationSeconds, normalizedResolution, mode)
  const resolvedPrompt = prompt ?? (mode === 'image-to-video' || mode === 'interpolate' ? DEFAULT_IMAGE_VIDEO_PROMPT : undefined)
  const image = options.inputImage
    ? await videoMediaReferenceToGeminiVideoImage(options.inputImage, 'image')
    : undefined
  const lastFrame = options.lastFrameImage
    ? await videoMediaReferenceToGeminiInlineData(options.lastFrameImage, 'image')
    : undefined
  const referenceImages = options.referenceImages && options.referenceImages.length > 0
    ? await Promise.all(options.referenceImages.map(async (input) => ({
        image: await videoMediaReferenceToGeminiInlineData(input, 'image'),
        referenceType: 'asset' as const
      })))
    : undefined
  const inputVideo = options.inputVideo
    ? await videoMediaReferenceToGeminiInlineData(options.inputVideo, 'video')
    : undefined

  const startTime = Date.now()
  let operation = await geminiPredictLongRunning(apiKey, {
    model: options.model,
    ...(resolvedPrompt !== undefined ? { prompt: resolvedPrompt } : {}),
    ...(options.aspectRatio ? { aspectRatio: options.aspectRatio } : {}),
    resolution: normalizedResolution,
    durationSeconds: normalizedDuration,
    numberOfVideos: 1,
    ...(image ? { image } : {}),
    ...(lastFrame ? { lastFrame } : {}),
    ...(referenceImages ? { referenceImages } : {}),
    ...(inputVideo ? { video: inputVideo } : {})
  })

  const completedOp = await pollUntil({
    operationName: 'gemini-video-gen',
    intervalMs: POLL_INTERVAL_MS,
    deadlineMs: POLL_TIMEOUT_MS,
    ...(options.abortSignal ? { abortSignal: options.abortSignal } : {}),
    pollFn: async () => {
      logGenStatus('video', 'gemini', options.model, 'in_progress')
      const operationName = operation.name
      if (!operationName) {
        throw InfraError('Gemini video generation did not return an operation name', { stage: 'video:gemini' })
      }
      operation = await geminiGetOperation(apiKey, operationName)
      return operation
    },
    isDone: (op) => op.done === true,
    isFailed: (op) => {
      if (op.error) {
        return { failed: true, reason: JSON.stringify(op.error) }
      }
      return { failed: false }
    }
  })
  operation = completedOp

  const video = operation.response?.generatedVideos?.[0]?.video
  if (!video) {
    throw InfraError('Gemini video generation completed but no video was returned', { stage: 'video:gemini' })
  }

  const outputPath = `${outputDir}/generated-video.mp4`
  await geminiDownloadFile(apiKey, video, outputPath)

  const processingTime = Date.now() - startTime
  const videoFile = Bun.file(outputPath)

  logGenCompleted('video', 'gemini', options.model, processingTime, [outputPath], `Actual billed cost was not returned by the API; estimate ${estimate.totalCost.toFixed(3)}¢`)

  const metadata: Step6VideoMetadata = {
    videoGenService: 'gemini',
    videoGenModel: options.model,
    processingTime,
    videoFileName: 'generated-video.mp4',
    videoFileSize: videoFile.size,
    videoDuration: normalizedDuration,
    requestMode: mode,
    videoResolution: normalizedResolution,
    ...(options.aspectRatio ? { videoAspectRatio: options.aspectRatio } : {}),
    ...(options.inputImage ? { inputImage: options.inputImage } : {}),
    ...(options.lastFrameImage ? { lastFrameImage: options.lastFrameImage } : {}),
    ...(options.referenceImages && options.referenceImages.length > 0 ? { referenceImages: options.referenceImages } : {}),
    ...(options.inputVideo ? { inputVideo: options.inputVideo } : {}),
    ...(video.uri ? { providerVideoUri: video.uri } : {}),
    ...(video.mimeType ? { providerFileOutput: { mimeType: video.mimeType } } : {})
  }

  return { videoPath: outputPath, metadata }
}
