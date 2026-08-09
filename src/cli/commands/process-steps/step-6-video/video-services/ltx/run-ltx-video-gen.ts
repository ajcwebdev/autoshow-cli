import * as v from 'valibot'
import type { LtxVideoModel, Step6VideoMetadata, VideoMode } from '~/types'
import { CLIUsageError, InfraError } from '~/utils/error-handler'
import { logGenCompleted, logGenStatus } from '~/cli/commands/process-steps/generation-command-utils'
import { estimateVideoCost, logVideoEstimate } from '~/cli/commands/process-steps/step-6-video/video-utils/video-pricing'
import {
  normalizeLtxVideoAspectRatio,
  normalizeLtxVideoDuration,
  normalizeLtxVideoFps,
  normalizeLtxVideoResolution,
  normalizeLtxVideoSize
} from '~/cli/commands/process-steps/step-6-video/video-utils/video-normalization'
import { downloadVideoOutputBytes } from '~/cli/commands/process-steps/step-6-video/video-utils/video-output-download'
import { pollUntil } from '~/utils/retries'
import { requireApiKey } from '~/utils/validate/env-utils'
import { validateData } from '~/utils/validate/validation'
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

const formatLtxError = (value: unknown): string => {
  if (value === undefined || value === null) return 'Unknown error'
  if (typeof value === 'string') return value
  if (typeof value === 'object' && 'message' in value) {
    const message = (value as { message?: unknown }).message
    if (typeof message === 'string' && message.length > 0) return message
  }
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

const resolveLtxEndpoint = (mode: VideoMode): 'text-to-video' | 'image-to-video' | 'extend' => {
  if (mode === 'text') return 'text-to-video'
  if (mode === 'image-to-video' || mode === 'interpolate') return 'image-to-video'
  if (mode === 'extend') return 'extend'
  throw CLIUsageError(`--video-mode ${mode} is not supported by LTX.`)
}

const requireLtxPrompt = (prompt: string | undefined): string => {
  if (prompt === undefined || prompt.trim().length === 0) {
    throw CLIUsageError('LTX video prompt cannot be empty.')
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
    size?: string | undefined
    aspectRatio?: string | undefined
    resolution?: string | undefined
    inputImage?: string | undefined
    lastFrameImage?: string | undefined
    inputVideo?: string | undefined
  }
): Promise<{ videoPath: string, metadata: Step6VideoMetadata }> => {
  const apiKey = requireApiKey('LTXV_API_KEY', 'video:ltx', 'LTX video generation')

  const mode = options.mode ?? 'text'
  const endpoint = resolveLtxEndpoint(mode)
  const size = normalizeLtxVideoSize(options.model, options.size, options.resolution, options.aspectRatio)
  const resolution = normalizeLtxVideoResolution(options.resolution)
  const aspectRatio = normalizeLtxVideoAspectRatio(options.model, options.aspectRatio)
  const duration = normalizeLtxVideoDuration(options.model, size, options.durationSeconds, mode)
  const fps = mode === 'extend' ? undefined : normalizeLtxVideoFps(options.model)
  const resolvedPrompt = prompt ?? (mode === 'image-to-video' || mode === 'interpolate' ? DEFAULT_IMAGE_VIDEO_PROMPT : undefined)
  if (mode === 'text') {
    requireLtxPrompt(resolvedPrompt)
  }

  logGenStatus('video', 'ltx', options.model, 'started')

  const estimate = estimateVideoCost({
    ltxVideoModel: options.model,
    videoDuration: options.durationSeconds,
    videoSize: options.size,
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
  const createResp = await fetch(`${LTX_BASE_URL}/v2/${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  })

  if (!createResp.ok) {
    const body = await createResp.text()
    throw InfraError(`LTX video ${mode} request failed (${createResp.status}): ${body || 'No response body'}`, { stage: 'video:ltx', status: createResp.status })
  }

  const createData = validateData(
    LtxCreateVideoResponseSchema,
    await createResp.json() as unknown,
    'LTX video generation create response'
  )

  const taskData = await pollUntil({
    operationName: 'ltx-video-gen',
    intervalMs: POLL_INTERVAL_MS,
    deadlineMs: POLL_TIMEOUT_MS,
    pollFn: async () => {
      const pollResp = await fetch(`${LTX_BASE_URL}/v2/${endpoint}/${encodeURIComponent(createData.id)}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (!pollResp.ok) {
        const body = await pollResp.text()
        throw InfraError(`LTX video generation query failed (${pollResp.status}): ${body || 'No response body'}`, { stage: 'video:ltx', status: pollResp.status })
      }

      const data = validateData(
        LtxPollVideoResponseSchema,
        await pollResp.json() as unknown,
        'LTX video generation query response'
      )
      logGenStatus('video', 'ltx', options.model, data.status)
      return data
    },
    isDone: (data) => data.status === 'completed',
    isFailed: (data) => data.status === 'failed'
      ? { failed: true, reason: formatLtxError(data.error) }
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
