import * as v from 'valibot'
import type { GrokVideoModel, Step6VideoMetadata, VideoMode } from '~/types'
import { InfraError } from '~/utils/error-handler'
import { logGenCompleted, logGenStatus } from '~/cli/commands/process-steps/generation-command-utils'
import { estimateVideoCost, logVideoEstimate } from '~/cli/commands/process-steps/step-6-video/video-utils/video-pricing'
import {
  normalizeGrokVideoAspectRatio,
  normalizeGrokVideoDuration,
  normalizeGrokVideoExtensionDuration,
  normalizeGrokVideoResolution
} from '~/cli/commands/process-steps/step-6-video/video-utils/video-normalization'
import { downloadVideoOutputBytes } from '~/cli/commands/process-steps/step-6-video/video-utils/video-output-download'
import { formatPolledJobError, runPolledJob } from '~/utils/polled-job-client/polled-job'
import { requireApiKey } from '~/utils/validate/env-utils'
import { XAI_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { MEDIA_GENERATION_TIMEOUT_MS } from '~/utils/timeouts'
import {
  tryResolveLocalVideoDurationSeconds,
  videoMediaReferenceToGrokUrlObject
} from '../../video-utils/video-media-inputs'
const POLL_INTERVAL_MS = 10_000
const POLL_TIMEOUT_MS = MEDIA_GENERATION_TIMEOUT_MS

const GrokCreateVideoResponseSchema = v.object({
  request_id: v.string()
})

const GrokPollVideoResponseSchema = v.object({
  status: v.string(),
  error: v.optional(v.unknown(), undefined),
  model: v.optional(v.string(), undefined),
  progress: v.optional(v.number(), undefined),
  usage: v.optional(v.object({
    cost_in_usd_ticks: v.optional(v.number(), undefined)
  }), undefined),
  video: v.optional(v.object({
    url: v.optional(v.nullable(v.string()), undefined),
    duration: v.optional(v.number(), undefined),
    respect_moderation: v.optional(v.boolean(), undefined)
  }), undefined)
})

export const runGrokVideoGen = async (
  prompt: string | undefined,
  outputDir: string,
  options: {
    model: GrokVideoModel
    mode?: VideoMode | undefined
    durationSeconds?: number | undefined
    aspectRatio?: string | undefined
    resolution?: string | undefined
    inputImage?: string | undefined
    referenceImages?: string[] | undefined
    inputVideo?: string | undefined
  }
): Promise<{ videoPath: string, metadata: Step6VideoMetadata }> => {
  const apiKey = requireApiKey('XAI_API_KEY', 'video:grok', 'Grok video generation')

  const baseURL = XAI_DEFAULT_BASE_URL
  const mode = options.mode ?? 'text'
  const duration = mode === 'extend'
    ? normalizeGrokVideoExtensionDuration(options.durationSeconds)
    : normalizeGrokVideoDuration(options.durationSeconds)
  const aspectRatio = mode === 'edit' || mode === 'extend' ? undefined : normalizeGrokVideoAspectRatio(options.aspectRatio)
  const resolution = mode === 'edit' || mode === 'extend' ? undefined : normalizeGrokVideoResolution(options.resolution, options.model)
  const endpoint = mode === 'edit'
    ? '/videos/edits'
    : mode === 'extend'
      ? '/videos/extensions'
      : '/videos/generations'

  logGenStatus('video', 'grok', options.model, 'started')

  const inputVideoDurationSeconds = options.inputVideo
    ? await tryResolveLocalVideoDurationSeconds(options.inputVideo)
    : undefined
  const inputImageCount = (options.inputImage ? 1 : 0) + (options.referenceImages?.length ?? 0)
  const estimate = estimateVideoCost({
    grokVideoModel: options.model,
    videoDuration: options.durationSeconds,
    videoResolution: options.resolution,
    videoMode: options.mode,
    grokInputImageCount: inputImageCount,
    ...(inputVideoDurationSeconds !== undefined ? { grokInputVideoDurationSeconds: inputVideoDurationSeconds } : {})
  })
  logVideoEstimate(estimate)

  const startTime = Date.now()
  const image = options.inputImage
    ? await videoMediaReferenceToGrokUrlObject(options.inputImage, 'image')
    : undefined
  const referenceImages = options.referenceImages && options.referenceImages.length > 0
    ? await Promise.all(options.referenceImages.map(async (input) => await videoMediaReferenceToGrokUrlObject(input, 'image')))
    : undefined
  const inputVideo = options.inputVideo
    ? await videoMediaReferenceToGrokUrlObject(options.inputVideo, 'video')
    : undefined

  const requestBody: Record<string, unknown> = {
    model: options.model,
    ...(prompt !== undefined ? { prompt } : {})
  }
  if (mode === 'edit') {
    requestBody['video'] = inputVideo
  } else if (mode === 'extend') {
    requestBody['video'] = inputVideo
    requestBody['duration'] = duration
  } else {
    requestBody['duration'] = duration
    requestBody['aspect_ratio'] = aspectRatio
    requestBody['resolution'] = resolution
    if (image) requestBody['image'] = image
    if (referenceImages && referenceImages.length > 0) requestBody['reference_images'] = referenceImages
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  }
  const { created: createData, result: taskData } = await runPolledJob({
    operationName: 'grok-video-gen',
    intervalMs: POLL_INTERVAL_MS,
    deadlineMs: POLL_TIMEOUT_MS,
    create: {
      url: `${baseURL}${endpoint}`,
      init: { method: 'POST', headers, body: JSON.stringify(requestBody) },
      schema: GrokCreateVideoResponseSchema,
      context: 'Grok video generation create response',
      stage: 'video:grok',
      errorMessage: `Grok video ${mode} request failed`,
      errorFactory: (response, payload) => InfraError(`Grok video ${mode} request failed (${response.status}): ${typeof payload === 'string' && payload.length > 0 ? payload : 'No response body'}`, { stage: 'video:grok' })
    },
    poll: (created) => ({
      url: `${baseURL}/videos/${encodeURIComponent(created.request_id)}`,
      init: { method: 'GET', headers },
      schema: GrokPollVideoResponseSchema,
      context: 'Grok video generation query response',
      stage: 'video:grok',
      errorMessage: 'Grok video generation query failed'
    }),
    onPoll: (data) => logGenStatus('video', 'grok', options.model, data.status),
    isDone: (data) => data.status === 'done',
    isFailed: (data) => data.status === 'failed' || data.status === 'expired'
      ? { failed: true, reason: formatPolledJobError(data.error) }
      : { failed: false }
  })

  const videoUrl = taskData.video?.url
  if (!videoUrl && taskData.video?.respect_moderation === false) {
    throw InfraError('Grok video generation was blocked by moderation and no video URL was returned', { stage: 'video:grok' })
  }
  if (!videoUrl) {
    throw InfraError('Grok video generation succeeded but no video.url was returned', { stage: 'video:grok' })
  }

  const outputPath = `${outputDir}/generated-video.mp4`
  await Bun.write(outputPath, await downloadVideoOutputBytes(videoUrl, 'Grok'))

  const processingTime = Date.now() - startTime
  const videoFile = Bun.file(outputPath)

  logGenCompleted('video', 'grok', options.model, processingTime, [outputPath])

  return {
    videoPath: outputPath,
    metadata: {
      videoGenService: 'grok',
      videoGenModel: options.model,
      processingTime,
      videoFileName: 'generated-video.mp4',
      videoFileSize: videoFile.size,
      videoDuration: taskData.video?.duration ?? duration,
      requestMode: mode,
      ...(resolution ? { videoResolution: resolution } : {}),
      ...(aspectRatio ? { videoAspectRatio: aspectRatio } : {}),
      ...(options.inputImage ? { inputImage: options.inputImage } : {}),
      ...(options.referenceImages && options.referenceImages.length > 0 ? { referenceImages: options.referenceImages } : {}),
      ...(options.inputVideo ? { inputVideo: options.inputVideo } : {}),
      ...(inputVideoDurationSeconds !== undefined ? { inputVideoDurationSeconds } : {}),
      providerRequestId: createData.request_id,
      ...(taskData.model ? { providerReturnedModel: taskData.model } : {}),
      providerVideoUrl: videoUrl,
      ...(typeof taskData.progress === 'number' ? { providerProgress: taskData.progress } : {}),
      ...(taskData.video?.respect_moderation !== undefined ? { providerModeration: taskData.video.respect_moderation } : {}),
      ...(typeof taskData.usage?.cost_in_usd_ticks === 'number'
        ? {
            providerCostCents: taskData.usage.cost_in_usd_ticks / 100_000_000,
            providerCostSource: 'provider_usage' as const
          }
        : {})
    }
  }
}
