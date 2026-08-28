import * as v from 'valibot'
import type { LtxVideoModel, Step6VideoMetadata, VideoMode } from '~/types'
import { UsageError, InfraError } from '~/utils/error-handler'
import { logGenCompleted, logGenStatus } from '~/cli/commands/process-steps/generation-command-utils'
import { estimateVideoCost, logVideoEstimate } from '~/cli/commands/process-steps/step-6-video/video-utils/video-pricing'
import {
  normalizeLtxVideoAspectRatio,
  normalizeLtxVideoDuration,
  normalizeLtxVideoResolution,
  normalizeLtxVideoSize
} from '~/cli/commands/process-steps/step-6-video/video-utils/video-normalization'
import { downloadVideoOutputBytes } from '~/cli/commands/process-steps/step-6-video/video-utils/video-output-download'
import { formatPolledJobError, runPolledJob } from '~/utils/polled-job-client/polled-job'
import { resolveCredential } from '~/utils/validate/env-utils'
import { MEDIA_GENERATION_TIMEOUT_MS } from '~/utils/timeouts'
import { videoMediaReferenceToUrlOrDataUrl } from '../../video-utils/video-media-inputs'
const LTX_BASE_URL = 'https://api.ltx.video'
const POLL_INTERVAL_MS = 5_000
const POLL_TIMEOUT_MS = MEDIA_GENERATION_TIMEOUT_MS
const DEFAULT_IMAGE_VIDEO_PROMPT = 'Animate the provided image with natural, subtle motion while preserving its subject and composition.'

const LtxCreateVideoResponseSchema = v.object({
  id: v.string()
})

const LtxPollVideoResponseSchema = v.object({
  id: v.optional(v.string(), undefined),
  status: v.string(),
  created_at: v.optional(v.string(), undefined),
  completed_at: v.optional(v.string(), undefined),
  result: v.optional(v.object({
    video_url: v.optional(v.string(), undefined)
  }), undefined),
  error: v.optional(v.unknown(), undefined)
})

const resolveLtxEndpoint = (mode: VideoMode): 'text-to-video' | 'image-to-video' | 'extend' => {
  if (mode === 'text') return 'text-to-video'
  if (mode === 'image-to-video' || mode === 'interpolate') return 'image-to-video'
  if (mode === 'extend') return 'extend'
  throw UsageError(`--mode ${mode} is not supported by LTX.`)
}

const requireLtxPrompt = (prompt: string | undefined): string => {
  if (prompt === undefined || prompt.trim().length === 0) {
    throw UsageError('LTX video prompt cannot be empty.')
  }
  return prompt
}

export const runLtxVideoGen = async (
  prompt: string | undefined,
  outputDir: string,
  options: {
    model: LtxVideoModel
    mode?: VideoMode | undefined
    durationSeconds?: number | undefined
    aspectRatio?: string | undefined
    resolution?: string | undefined
    inputImage?: string | undefined
    lastFrameImage?: string | undefined
    inputVideo?: string | undefined
  }
): Promise<{ videoPath: string, metadata: Step6VideoMetadata }> => {
  const apiKey = resolveCredential('ltx', 'require', { stage: 'video:ltx', description: 'LTX video generation' })

  const mode = options.mode ?? 'text'
  const endpoint = resolveLtxEndpoint(mode)
  const size = normalizeLtxVideoSize(options.model, options.resolution, options.aspectRatio)
  const resolution = normalizeLtxVideoResolution(options.resolution)
  const aspectRatio = normalizeLtxVideoAspectRatio(options.model, options.aspectRatio)
  const duration = normalizeLtxVideoDuration(options.model, size, options.durationSeconds, mode)
  const fps = mode === 'extend' ? undefined : 24
  const resolvedPrompt = prompt ?? (mode === 'image-to-video' || mode === 'interpolate' ? DEFAULT_IMAGE_VIDEO_PROMPT : undefined)
  if (mode === 'text') {
    requireLtxPrompt(resolvedPrompt)
  }

  logGenStatus('video', 'ltx', options.model, 'started')

  const estimate = estimateVideoCost({
    ltxVideoModels: [options.model],
    videoDuration: options.durationSeconds,
    videoAspectRatio: options.aspectRatio,
    videoResolution: options.resolution,
    videoMode: mode
  })
  logVideoEstimate(estimate)

  const inputImage = options.inputImage
    ? await videoMediaReferenceToUrlOrDataUrl(options.inputImage, 'image')
    : undefined
  const lastFrame = options.lastFrameImage
    ? await videoMediaReferenceToUrlOrDataUrl(options.lastFrameImage, 'image')
    : undefined
  const inputVideo = options.inputVideo
    ? await videoMediaReferenceToUrlOrDataUrl(options.inputVideo, 'video')
    : undefined

  const requestBody: Record<string, unknown> = {
    model: options.model
  }
  if (mode === 'text') {
    requestBody['prompt'] = requireLtxPrompt(resolvedPrompt)
    requestBody['duration'] = duration
    requestBody['fps'] = fps
    requestBody['resolution'] = size
  } else if (mode === 'image-to-video' || mode === 'interpolate') {
    requestBody['image_uri'] = inputImage
    requestBody['prompt'] = resolvedPrompt
    requestBody['duration'] = duration
    requestBody['fps'] = fps
    requestBody['resolution'] = size
    if (lastFrame) requestBody['last_frame_uri'] = lastFrame
  } else {
    requestBody['video_uri'] = inputVideo
    requestBody['duration'] = duration
    requestBody['mode'] = 'end'
    if (resolvedPrompt !== undefined && resolvedPrompt.trim().length > 0) {
      requestBody['prompt'] = resolvedPrompt
    }
  }

  const startTime = Date.now()
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  }
  const { created: createData, result: taskData } = await runPolledJob({
    operationName: 'ltx-video-gen',
    intervalMs: POLL_INTERVAL_MS,
    deadlineMs: POLL_TIMEOUT_MS,
    create: {
      url: `${LTX_BASE_URL}/v2/${endpoint}`,
      init: { method: 'POST', headers, body: JSON.stringify(requestBody) },
      schema: LtxCreateVideoResponseSchema,
      context: 'LTX video generation create response',
      stage: 'video:ltx',
      errorMessage: `LTX video ${mode} request failed`
    },
    poll: (created) => ({
      url: `${LTX_BASE_URL}/v2/${endpoint}/${encodeURIComponent(created.id)}`,
      init: { method: 'GET', headers },
      schema: LtxPollVideoResponseSchema,
      context: 'LTX video generation query response',
      stage: 'video:ltx',
      errorMessage: 'LTX video generation query failed'
    }),
    onPoll: (data) => logGenStatus('video', 'ltx', options.model, data.status),
    isDone: (data) => data.status === 'completed',
    isFailed: (data) => data.status === 'failed'
      ? { failed: true, reason: formatPolledJobError(data.error) }
      : { failed: false }
  })

  const videoUrl = taskData.result?.video_url
  if (!videoUrl) {
    throw InfraError('LTX video generation succeeded but no result.video_url was returned', { stage: 'video:ltx' })
  }

  const outputPath = `${outputDir}/generated-video.mp4`
  await Bun.write(outputPath, await downloadVideoOutputBytes(videoUrl, 'LTX'))

  const processingTime = Date.now() - startTime
  const videoFile = Bun.file(outputPath)
  const estimateDetail = `Actual billed cost was not returned by the API; estimated ${estimate.totalCost.toFixed(2)}¢.`

  logGenCompleted('video', 'ltx', options.model, processingTime, [outputPath], estimateDetail)

  return {
    videoPath: outputPath,
    metadata: {
      videoGenService: 'ltx',
      videoGenModel: options.model,
      processingTime,
      videoFileName: 'generated-video.mp4',
      videoFileSize: videoFile.size,
      videoDuration: duration,
      videoSize: size,
      requestMode: mode,
      ...(mode !== 'extend' ? { videoResolution: resolution, videoAspectRatio: aspectRatio } : {}),
      ...(options.inputImage ? { inputImage: options.inputImage } : {}),
      ...(options.lastFrameImage ? { lastFrameImage: options.lastFrameImage } : {}),
      ...(options.inputVideo ? { inputVideo: options.inputVideo } : {}),
      providerRequestId: createData.id,
      providerVideoUrl: videoUrl,
      ...(taskData.created_at || taskData.completed_at
        ? { providerFileOutput: { created_at: taskData.created_at, completed_at: taskData.completed_at } }
        : {}),
      providerCostCents: estimate.totalCost,
      providerCostSource: 'registry_fallback'
    }
  }
}
